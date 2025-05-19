"""
Style transfer core module implementing the neural style transfer algorithm.
Handles loss computation, optimization, and style transfer process.
"""

import torch
import torch.nn as nn
import torch.optim as optim
from typing import Dict, List, Tuple, Optional
from .feature_extractor import VGG19FeatureExtractor
import logging
import numpy as np

logger = logging.getLogger(__name__)

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

            loss = torch.mean((input_feat - target_feat) ** 2)
            content_loss += loss

        return content_loss / len(self.content_layers)

    def compute_style_loss(
        self,
        input_features: Dict[str, torch.Tensor],
        target_avg_grams: Dict[str, torch.Tensor]
    ) -> torch.Tensor:
        """
        Compute style loss between input features and target average Gram matrices.
        Assumes Gram matrices from feature_extractor are already normalized.

        Args:
            input_features: Features from the current input image
            target_avg_grams: Dictionary mapping style layer names to the pre-computed
                              average (and normalized) Gram matrix from the style reference images.

        Returns:
            Style loss tensor
        """
        style_loss = 0.0
        for layer in self.style_layers:
            input_feat = input_features[layer]
            target_gram = target_avg_grams[layer].detach()
            input_gram = self.feature_extractor.gram_matrix(input_feat)

            loss = torch.mean((input_gram - target_gram) ** 2)
            style_loss += loss

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
        layer_grams: Dict[str, List[torch.Tensor]] = {layer: [] for layer in self.style_layers}

        for style_image in style_images:
            style_features = self.feature_extractor(style_image)
            for layer in self.style_layers:
                layer_features = style_features[layer]
                gram = self.feature_extractor.gram_matrix(layer_features)
                layer_grams[layer].append(gram.detach())

        avg_grams: Dict[str, torch.Tensor] = {}
        for layer in self.style_layers:
            if layer_grams[layer]:
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
        learning_rate: float = 0.02,
        callback = None
    ) -> Tuple[torch.Tensor, Dict[str, List[float]]]:
        """
        Perform style transfer optimization using multiple style references.
        Uses Adam optimizer.

        Args:
            content_image: Content image tensor
            style_images: List of style image tensors
            num_steps: Number of optimization steps
            content_weight: Optional override for content weight
            style_weight: Optional override for style weight
            tv_weight: Optional override for TV weight
            learning_rate: Learning rate for the Adam optimizer.
            callback: Optional callback function for progress updates

        Returns:
            Tuple of (stylized image tensor, loss history dict)
        """
        if not style_images:
             raise ValueError("Must provide at least one style image.")

        content_w = content_weight if content_weight is not None else self.content_weight
        style_w = style_weight if style_weight is not None else self.style_weight
        tv_w = tv_weight if tv_weight is not None else self.tv_weight

        target_content_features = {
            layer: self.feature_extractor(content_image)[layer].detach()
            for layer in self.content_layers
        }
        target_avg_grams = self._calculate_average_style_grams(style_images)

        input_image = content_image.clone().requires_grad_(True)

        optimizer = optim.Adam([input_image], lr=learning_rate)
        history = {
            'content_loss': [], 'style_loss': [], 'tv_loss': [], 'total_loss': []
        }

        logger.info(f"Starting Adam Optimization - Steps: {num_steps}, LR: {learning_rate}")
        logger.info(f"Initial Weights - Style: {style_w:.2e}, Content: {content_w:.2f}, TV: {tv_w:.2e}")

        for i in range(num_steps):
            optimizer.zero_grad()

            input_features = self.feature_extractor(input_image)
            content_loss = self.compute_content_loss(input_features, target_content_features)
            style_loss = self.compute_style_loss(input_features, target_avg_grams)
            tv_loss = self.compute_tv_loss(input_image)

            total_loss = (
                content_w * content_loss +
                style_w * style_loss +
                tv_w * tv_loss
            )

            total_loss.backward()

            if input_image.grad is not None and torch.isnan(input_image.grad).any():
                logger.error(f"NaN gradient detected at step {i}. Stopping optimization.")
                break 

            optimizer.step()

            with torch.no_grad():
                 input_image.clamp_(0, 1)

            history['content_loss'].append(content_loss.item())
            history['style_loss'].append(style_loss.item())
            history['tv_loss'].append(tv_loss.item())
            history['total_loss'].append(total_loss.item())

            if i % 25 == 0:
                logger.info(f"Step {i}/{num_steps} - "
                            f"Total Loss: {total_loss.item():.4e}, "
                            f"Content Loss: {content_loss.item():.4e} (W: {content_w}), "
                            f"Style Loss: {style_loss.item():.4e} (W: {style_w}), "
                            f"TV Loss: {tv_loss.item():.4e} (W: {tv_w})")

            if callback:
                callback(i, input_image.detach(), history)

        with torch.no_grad():
            input_image.clamp_(0, 1)

        final_steps = len(history['total_loss'])
        if final_steps < num_steps:
            nan_fill = [np.nan] * (num_steps - final_steps)
            for key in history:
                history[key].extend(nan_fill)

        return input_image.detach(), history
