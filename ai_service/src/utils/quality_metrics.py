"""
Quality assessment module for style transfer results.
Implements various metrics for evaluating transformation quality and performance.
"""

import torch
import torch.nn.functional as F
from typing import Dict, Tuple, Optional, List
import time
import psutil
import numpy as np
import logging
from .image_processing import ImageProcessor

logger = logging.getLogger(__name__)

class QualityMetrics:
    """Quality assessment tools for style transfer."""

    def __init__(self, device: Optional[torch.device] = None):
        """
        Initialize quality metrics module.

        Args:
            device: Torch device to use
        """
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def compute_content_similarity(
        self,
        original: torch.Tensor,
        transformed: torch.Tensor
    ) -> float:
        """
        Compute structural similarity between original and transformed images.

        Args:
            original: Original image tensor
            transformed: Transformed image tensor

        Returns:
            Similarity score (0-1)
        """
        original = original.to(self.device)
        transformed = transformed.to(self.device)

        # Convert to luminance
        original_y = 0.299 * original[:, 0] + 0.587 * original[:, 1] + 0.114 * original[:, 2]
        transformed_y = 0.299 * transformed[:, 0] + 0.587 * transformed[:, 1] + 0.114 * transformed[:, 2]

        # Compute SSIM
        c1 = (0.01 * 255) ** 2
        c2 = (0.03 * 255) ** 2

        mu_x = F.avg_pool2d(original_y, kernel_size=11, stride=1, padding=5)
        mu_y = F.avg_pool2d(transformed_y, kernel_size=11, stride=1, padding=5)

        sigma_x = F.avg_pool2d(original_y ** 2, kernel_size=11, stride=1, padding=5) - mu_x ** 2
        sigma_y = F.avg_pool2d(transformed_y ** 2, kernel_size=11, stride=1, padding=5) - mu_y ** 2
        sigma_xy = F.avg_pool2d(original_y * transformed_y, kernel_size=11, stride=1, padding=5) - mu_x * mu_y

        ssim = ((2 * mu_x * mu_y + c1) * (2 * sigma_xy + c2)) / \
               ((mu_x ** 2 + mu_y ** 2 + c1) * (sigma_x + sigma_y + c2))

        return ssim.mean().item()

    def compute_style_consistency(
        self,
        style: torch.Tensor,
        transformed: torch.Tensor,
        feature_extractor
    ) -> float:
        """
        Compute style consistency using feature statistics.

        Args:
            style: Style image tensor
            transformed: Transformed image tensor
            feature_extractor: VGG feature extractor

        Returns:
            Style consistency score (0-1)
        """
        # Extract features
        style_features = feature_extractor(style)
        transformed_features = feature_extractor(transformed)

        # Compute Gram matrix differences
        consistency_scores = []
        for layer in feature_extractor.get_selected_layers():
            style_gram = feature_extractor.gram_matrix(style_features[layer])
            transformed_gram = feature_extractor.gram_matrix(transformed_features[layer])

            # Normalize and compute similarity
            style_norm = torch.norm(style_gram)
            transformed_norm = torch.norm(transformed_gram)

            if style_norm > 0 and transformed_norm > 0:
                similarity = torch.sum(style_gram * transformed_gram) / (style_norm * transformed_norm)
                consistency_scores.append(similarity.item())

        # Handle case where no valid scores were computed
        if not consistency_scores:
            return 0.0
        return np.mean(consistency_scores)

    def measure_performance(
        self,
        func,
        *args,
        **kwargs
    ) -> Dict[str, float]:
        """
        Measure performance metrics for a function.

        Args:
            func: Function to measure
            *args: Positional arguments for the function
            **kwargs: Keyword arguments for the function

        Returns:
            Dictionary of performance metrics
        """
        start_time = time.time()
        start_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB

        if torch.cuda.is_available():
            torch.cuda.reset_peak_memory_stats()
            start_gpu = torch.cuda.memory_allocated() / 1024 / 1024  # MB

        result = func(*args, **kwargs)

        # Compute metrics
        end_time = time.time()
        end_memory = psutil.Process().memory_info().rss / 1024 / 1024

        metrics = {
            'execution_time': end_time - start_time,
            'cpu_memory_used': end_memory - start_memory
        }

        if torch.cuda.is_available():
            end_gpu = torch.cuda.memory_allocated() / 1024 / 1024
            max_gpu = torch.cuda.max_memory_allocated() / 1024 / 1024
            metrics.update({
                'gpu_memory_used': end_gpu - start_gpu,
                'gpu_memory_peak': max_gpu
            })

        return metrics, result

    def assess_quality(
        self,
        content_image: torch.Tensor,
        style_images: List[torch.Tensor],
        transformed_image: torch.Tensor,
        feature_extractor,
        loss_history: Optional[Dict] = None
    ) -> Dict:
        """
        Comprehensive quality assessment of style transfer result.

        Args:
            content_image: Original content image tensor
            style_images: List of style image tensors
            transformed_image: Transformed image tensor
            feature_extractor: VGG feature extractor
            loss_history: Optional optimization history

        Returns:
            Dictionary of quality metrics
        """
        if not style_images:
            logger.warning("No style images provided for quality assessment.")
            avg_style_consistency = 0.0
        else:
            # Calculate style consistency against each reference and average
            all_consistencies = []
            for style_image in style_images:
                consistency = self.compute_style_consistency(
                    style_image, transformed_image, feature_extractor
                )
                all_consistencies.append(consistency)

            valid_consistencies = [c for c in all_consistencies if not np.isnan(c)]
            avg_style_consistency = np.mean(valid_consistencies) if valid_consistencies else 0.0

        content_similarity_score = self.compute_content_similarity(
            content_image, transformed_image
        )
        if np.isnan(content_similarity_score):
            logger.warning("Content similarity resulted in NaN, replacing with 0.0")
            content_similarity_score = 0.0

        metrics = {
            'content_similarity': content_similarity_score,
            'style_consistency_avg': avg_style_consistency
        }

        if loss_history:
            metrics.update({
                'final_loss': loss_history['total_loss'][-1],
                'loss_improvement': 1 - (
                    loss_history['total_loss'][-1] / loss_history['total_loss'][0]
                ),
                'content_loss_final': loss_history['content_loss'][-1],
                'style_loss_final': loss_history['style_loss'][-1]
            })

        return metrics
