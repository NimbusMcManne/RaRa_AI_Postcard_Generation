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
            target_features: Features from target image

        Returns:
            Content loss tensor
        """
        content_loss = 0.0
        for layer in self.content_layers:
            input_feat = input_features[layer]
            target_feat = target_features[layer].detach()

            _, c, h, w = input_feat.size()
            content_loss += torch.mean((input_feat - target_feat) ** 2) / (c * h * w)

        return content_loss

    def compute_style_loss(
        self,
        input_features: Dict[str, torch.Tensor],
        style_features: Dict[str, torch.Tensor]
    ) -> torch.Tensor:
        """
        Compute style loss between input and style features.

        Args:
            input_features: Features from input image
            style_features: Features from style image

        Returns:
            Style loss tensor
        """
        style_loss = 0.0
        for layer in self.style_layers:
            input_feat = input_features[layer]
            style_feat = style_features[layer].detach()

            input_gram = VGG19FeatureExtractor.gram_matrix(input_feat)
            style_gram = VGG19FeatureExtractor.gram_matrix(style_feat)

            _, c, _ = input_gram.size()
            style_loss += torch.mean((input_gram - style_gram) ** 2) / (4 * (c ** 2))

        return style_loss

    def compute_tv_loss(self, image: torch.Tensor) -> torch.Tensor:
        """
        Compute total variation loss for smoothness.

        Args:
            image: Input image tensor

        Returns:
            Total variation loss tensor
        """
        tv_h = torch.mean((image[:, :, 1:, :] - image[:, :, :-1, :]) ** 2)
        tv_w = torch.mean((image[:, :, :, 1:] - image[:, :, :, :-1]) ** 2)
        return tv_h + tv_w

    def transfer_style(
        self,
        content_image: torch.Tensor,
        style_image: torch.Tensor,
        num_steps: int = 300,
        content_weight: Optional[float] = None,
        style_weight: Optional[float] = None,
        tv_weight: Optional[float] = None,
        callback = None
    ) -> Tuple[torch.Tensor, Dict[str, List[float]]]:
        """
        Perform style transfer optimization.

        Args:
            content_image: Content image tensor
            style_image: Style image tensor
            num_steps: Number of optimization steps
            content_weight: Optional override for content weight
            style_weight: Optional override for style weight
            tv_weight: Optional override for TV weight
            callback: Optional callback function for progress updates

        Returns:
            Tuple of (stylized image tensor, loss history dict)
        """
        content_weight = content_weight or self.content_weight
        style_weight = style_weight or self.style_weight
        tv_weight = tv_weight or self.tv_weight

        content_features = self.feature_extractor(content_image)
        style_features = self.feature_extractor(style_image)

        input_image = content_image.clone().requires_grad_(True)
        optimizer = optim.LBFGS([input_image], max_iter=1)

        history = {
            'content_loss': [],
            'style_loss': [],
            'tv_loss': [],
            'total_loss': []
        }

        def closure():
            optimizer.zero_grad()

            input_features = self.feature_extractor(input_image)

            content_loss = self.compute_content_loss(input_features, content_features)
            style_loss = self.compute_style_loss(input_features, style_features)
            tv_loss = self.compute_tv_loss(input_image)

            total_loss = (
                content_weight * content_loss +
                style_weight * style_loss +
                tv_weight * tv_loss
            )

            history['content_loss'].append(content_loss.item())
            history['style_loss'].append(style_loss.item())
            history['tv_loss'].append(tv_loss.item())
            history['total_loss'].append(total_loss.item())

            total_loss.backward()

            if callback:
                callback(input_image.detach(), history)

            return total_loss

        for _ in range(num_steps):
            optimizer.step(closure)

        return input_image.detach(), history
