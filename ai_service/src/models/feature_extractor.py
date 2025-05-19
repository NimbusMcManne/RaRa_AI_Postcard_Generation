"""
Feature extraction module using VGG19 for style transfer.
Handles model loading, layer selection, and feature extraction.
"""

import torch
import torch.nn as nn
from torchvision.models import vgg19, VGG19_Weights
from typing import Dict, List, Optional
from collections import OrderedDict
import logging

logger = logging.getLogger(__name__)

class VGG19FeatureExtractor(nn.Module):
    """VGG19-based feature extractor for style transfer."""

    def __init__(self, layers: Optional[List[str]] = None):
        """
        Initialize the feature extractor with specified layers.

        Args:
            layers: List of layer names to extract features from.
                   If None, uses default style transfer layers.
        """
        super().__init__()

        self.layers = layers or [
            'conv1_1', 'conv2_1', 'conv3_1',
            'conv4_1', 'conv5_1'
        ]

        vgg = vgg19(weights=VGG19_Weights.IMAGENET1K_V1)

        self.blocks = nn.ModuleList()
        self.layer_map = OrderedDict()

        current_block = []
        block_count = 1
        conv_count = 1

        for layer in vgg.features:
            current_block.append(layer)

            if isinstance(layer, nn.MaxPool2d):
                self.blocks.append(nn.Sequential(*current_block))
                current_block = []
                block_count += 1
                conv_count = 1
            elif isinstance(layer, nn.Conv2d):
                layer_name = f'conv{block_count}_{conv_count}'
                self.layer_map[layer_name] = (len(self.blocks), len(current_block) - 1)
                conv_count += 1

        if current_block:
            self.blocks.append(nn.Sequential(*current_block))

        missing_layers = set(self.layers) - set(self.layer_map.keys())
        if missing_layers:
            raise ValueError(f"Invalid layer names: {missing_layers}")

        for param in self.parameters():
            param.requires_grad = False

        self.eval()

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Extract features from specified layers.

        Args:
            x: Input tensor (B x C x H x W)

        Returns:
            Dictionary mapping layer names to feature tensors
        """
        features = {}
        current_input = x
        processed_layers = set()

        layer_indices = {name: self.layer_map[name] for name in self.layers}
        max_block_needed = max(idx for idx, _ in layer_indices.values()) if layer_indices else -1

        for block_idx, block in enumerate(self.blocks):
            if block_idx > max_block_needed:
                 break

            current_conv_in_block = 0
            for i, layer in enumerate(block):
                 current_input = layer(current_input)

                 if isinstance(layer, nn.Conv2d):
                     current_conv_in_block += 1
                     for name, (target_block, target_conv_idx) in layer_indices.items():
                          layer_name_here = f'conv{block_idx + 1}_{current_conv_in_block}'

                          if name == layer_name_here and name not in processed_layers:
                              features[name] = current_input 
                              processed_layers.add(name)

            if len(processed_layers) == len(self.layers):
                 break

        if len(features) != len(self.layers):
             missing = set(self.layers) - set(features.keys())
             logger.warning(f"Could not extract all requested features. Missing: {missing}")

        return features

    def get_layer_names(self) -> List[str]:
        """Get names of all available layers."""
        return list(self.layer_map.keys())

    def get_selected_layers(self) -> List[str]:
        """Get names of currently selected layers."""
        return self.layers.copy()

    def set_layers(self, layers: List[str]) -> None:
        """
        Update the list of layers to extract features from.

        Args:
            layers: New list of layer names

        Raises:
            ValueError: If any layer names are invalid
        """
        missing_layers = set(layers) - set(self.layer_map.keys())
        if missing_layers:
            raise ValueError(f"Invalid layer names: {missing_layers}")
        self.layers = layers.copy()

    @staticmethod
    def gram_matrix(features: torch.Tensor) -> torch.Tensor:
        """
        Compute Gram matrix for style feature representation.
        Normalizes by the number of elements in each feature map (C*H*W).

        Args:
            features: Feature tensor (B x C x H x W)

        Returns:
            Normalized Gram matrix (B x C x C)
        """
        batch_size, channels, height, width = features.size()
        features_reshaped = features.view(batch_size, channels, -1)
        gram = torch.bmm(features_reshaped, features_reshaped.transpose(1, 2))

        norm_factor = channels * height * width
        if norm_factor > 0:
            gram = gram / norm_factor
        return gram
