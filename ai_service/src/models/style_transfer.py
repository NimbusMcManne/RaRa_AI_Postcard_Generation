"""
Style transfer core module implementing the neural style transfer algorithm.
Handles loss computation, optimization, and style transfer process.
"""

import torch
import torch.nn as nn
import torch.optim as optim
from typing import Dict, List, Tuple, Optional
from .feature_extractor import VGG19FeatureExtractor

class StyleTransfer:
    """Neural style transfer implementation."""

    def __init__(
        self,
        content_weight: float = 1.0,
        style_weight: float = 1e6,
        tv_weight: float = 1e-6,
        content_layers: Optional[List[str]] = None,
        style_layers: Optional[List[str]] = None,
        device: Optional[torch.device] = None
    ):
        """
        Initialize style transfer module.

        Args:
            content_weight: Weight for content loss
            style_weight: Weight for style loss
            tv_weight: Weight for total variation loss
            content_layers: Layers to use for content loss
            style_layers: Layers to use for style loss
            device: Torch device to use
        """
        self.content_weight = content_weight
        self.style_weight = style_weight
        self.tv_weight = tv_weight

        self.content_layers = content_layers or ['conv4_2']
        self.style_layers = style_layers or [
            'conv1_1', 'conv2_1', 'conv3_1',
            'conv4_1', 'conv5_1'
        ]

        self.device = device or torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )

        # Initialize feature extractor
        all_layers = list(set(self.content_layers + self.style_layers))
        self.feature_extractor = VGG19FeatureExtractor(layers=all_layers).to(self.device)

    def compute_content_loss(
        self,
        input_features: Dict[str, torch.Tensor],
        target_features: Dict[str, torch.Tensor]
    ) -> torch.Tensor:
        """
        Compute content loss between input and target features.

        Args:
            input_features: Features from input image
            target_features: Features from the original content image

        Returns:
            Content loss tensor
        """
        content_loss = 0.0
        for layer in self.content_layers:
            input_feat = input_features[layer]
            target_feat = target_features[layer]

            # Normalize loss by number of elements for stability
            content_loss += torch.mean((input_feat - target_feat) ** 2)

        # Average loss over the content layers used
        return content_loss / len(self.content_layers)

    def compute_style_loss(
        self,
        input_features: Dict[str, torch.Tensor],
        # Accept pre-computed average target Gram matrices
        target_avg_grams: Dict[str, torch.Tensor]
    ) -> torch.Tensor:
        """
        Compute style loss between input features and target average Gram matrices.

        Args:
            input_features: Features from the current input image
            target_avg_grams: Dictionary mapping style layer names to the pre-computed
                              average Gram matrix from the style reference images.

        Returns:
            Style loss tensor
        """
        style_loss = 0.0
        for layer in self.style_layers:
            input_feat = input_features[layer]
            # Target is the pre-computed average Gram matrix for this layer
            target_gram = target_avg_grams[layer].detach()

            # Compute Gram matrix for the current input image features
            input_gram = self.feature_extractor.gram_matrix(input_feat)

            # Compute loss against the average target Gram matrix
            # Normalize loss by number of elements in the Gram matrix for stability
            layer_loss = torch.mean((input_gram - target_gram) ** 2)
            style_loss += layer_loss

        # Average loss over the style layers used
        return style_loss / len(self.style_layers)

    def compute_tv_loss(self, image: torch.Tensor) -> torch.Tensor:
        """
        Compute total variation loss for smoothness.

        Args:
            image: Input image tensor

        Returns:
            Total variation loss tensor
        """
        tv_h = torch.mean(torch.abs(image[:, :, 1:, :] - image[:, :, :-1, :]))
        tv_w = torch.mean(torch.abs(image[:, :, :, 1:] - image[:, :, :, :-1]))
        return tv_h + tv_w

    def _calculate_average_style_grams(self, style_images: List[torch.Tensor]) -> Dict[str, torch.Tensor]:
        """Calculates the average Gram matrix for each style layer across multiple style images."""
        if not style_images:
            raise ValueError("Style images list cannot be empty.")

        num_style_images = len(style_images)
        # Store all Gram matrices for each layer in a list
        layer_grams: Dict[str, List[torch.Tensor]] = {layer: [] for layer in self.style_layers}

        for style_image in style_images:
            style_features = self.feature_extractor(style_image)
            for layer in self.style_layers:
                layer_features = style_features[layer]
                gram = self.feature_extractor.gram_matrix(layer_features)
                layer_grams[layer].append(gram.detach())

        # Calculate the average Gram matrix for each layer
        avg_grams: Dict[str, torch.Tensor] = {}
        for layer in self.style_layers:
            if layer_grams[layer]: # Check if any Gram matrices were collected for this layer
                # Stack tensors along a new dimension (dim=0) and compute the mean
                avg_grams[layer] = torch.mean(torch.stack(layer_grams[layer], dim=0), dim=0)
            else:
                raise RuntimeError(f"Could not calculate average Gram matrix for layer {layer} - no style images processed?")

        return avg_grams

    def transfer_style(
        self,
        content_image: torch.Tensor,
        style_images: List[torch.Tensor],
        num_steps: int = 300,
        content_weight: Optional[float] = None,
        style_weight: Optional[float] = None,
        tv_weight: Optional[float] = None,
        callback = None
    ) -> Tuple[torch.Tensor, Dict[str, List[float]]]:
        """
        Perform style transfer optimization using multiple style references.

        Args:
            content_image: Content image tensor
            style_images: List of style image tensors
            num_steps: Number of optimization steps
            content_weight: Optional override for content weight
            style_weight: Optional override for style weight
            tv_weight: Optional override for TV weight
            callback: Optional callback function for progress updates

        Returns:
            Tuple of (stylized image tensor, loss history dict)
        """
        if not style_images:
             raise ValueError("Must provide at least one style image.")

        # Use instance weights if not overridden
        content_w = content_weight or self.content_weight
        style_w = style_weight or self.style_weight
        tv_w = tv_weight or self.tv_weight

        # 1. Extract target content features (only once)
        target_content_features = {
            layer: self.feature_extractor(content_image)[layer].detach()
            for layer in self.content_layers
        }

        # 2. Calculate target *average* style Gram matrices (only once)
        target_avg_grams = self._calculate_average_style_grams(style_images)

        # Initialize input image (the one being optimized)
        input_image = content_image.clone().requires_grad_(True)
        # Setup optimizer - LBFGS is often good for style transfer
        optimizer = optim.LBFGS([input_image], max_iter=1) # max_iter=1 for standard loop

        # Track loss history
        history = {
            'content_loss': [],
            'style_loss': [],
            'tv_loss': [],
            'total_loss': []
        }
        step = [0]

        # Define the optimization closure
        def closure():
            with torch.no_grad():
                 input_image.clamp_(0, 1) # Assuming input is normalized 0-1 before VGG mean/std subtraction
                 # If input_image is expected to be normalized like VGG, clamping may be obsolete.
                 # We assume input_image is manipulated directly and needs clamping.

            optimizer.zero_grad()

            # Extract features from the *current* input image being optimized
            input_features = self.feature_extractor(input_image)

            # Compute losses using pre-computed targets
            content_loss = self.compute_content_loss(input_features, target_content_features)
            # Pass the average Gram matrices to style loss function
            style_loss = self.compute_style_loss(input_features, target_avg_grams)
            tv_loss = self.compute_tv_loss(input_image)

            # Weighted total loss
            total_loss = (
                content_w * content_loss +
                style_w * style_loss +
                tv_w * tv_loss
            )

            # Backpropagate
            total_loss.backward()

            # Update history
            if step[0] < num_steps:
                history['content_loss'].append(content_loss.item())
                history['style_loss'].append(style_loss.item())
                history['tv_loss'].append(tv_loss.item())
                history['total_loss'].append(total_loss.item())

            # Progress callback
            if callback:
                callback(step[0], input_image.detach(), history)

            step[0] += 1
            return total_loss

        while step[0] < num_steps:
            optimizer.step(closure)

        # Final clamp after optimization
        with torch.no_grad():
            input_image.clamp_(0, 1)

        return input_image.detach(), history
