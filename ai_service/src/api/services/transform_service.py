"""
Transformation service coordinating the AI pipeline components.
Handles image processing, style transfer, and quality assessment.
"""

import torch
from pathlib import Path
from typing import Dict, Tuple, Optional
import logging
from datetime import datetime

from ...utils.image_processing import ImageProcessor
from ...models.feature_extractor import VGG19FeatureExtractor
from ...models.style_transfer import StyleTransfer
from ...utils.quality_metrics import QualityMetrics

logger = logging.getLogger(__name__)

class TransformationService:
    """Coordinates the AI pipeline for image transformation."""

    def __init__(self):
        """Initialize the transformation service components."""
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Using device: {self.device}")

        self.image_processor = ImageProcessor()
        self.feature_extractor = VGG19FeatureExtractor().to(self.device)
        self.style_transfer = StyleTransfer(device=self.device)
        self.quality_metrics = QualityMetrics(device=self.device)

        logger.info("Transformation service initialized")

    async def transform_image(
        self,
        content_path: Path,
        style_path: Path,
        output_path: Optional[Path] = None,
        style_weight: float = 1e6,
        content_weight: float = 1.0,
        num_steps: int = 300
    ) -> Dict:
        """
        Transform a content image using the style of another image.

        Args:
            content_path: Path to content image
            style_path: Path to style image
            output_path: Optional path to save result
            style_weight: Weight for style loss
            content_weight: Weight for content loss
            num_steps: Number of optimization steps

        Returns:
            Dictionary containing transformation results and metrics
        """
        try:
            logger.info("Loading images")
            content_img, content_tensor = self.image_processor.load_image(str(content_path))
            style_img, style_tensor = self.image_processor.load_image(str(style_path))

            logger.info("Starting style transfer")
            output_tensor, history = self.style_transfer.transfer_style(
                content_tensor,
                style_tensor,
                num_steps=num_steps,
                style_weight=style_weight,
                content_weight=content_weight
            )

            output_image = self.image_processor.tensor_to_image(output_tensor)

            if output_path:
                logger.info(f"Saving result to {output_path}")
                self.image_processor.save_image(output_image, str(output_path))

            logger.info("Computing quality metrics")
            metrics = self.quality_metrics.assess_quality(
                content_tensor,
                style_tensor,
                output_tensor,
                self.feature_extractor,
                history
            )

            return {
                "status": "success",
                "metrics": metrics,
                "history": history,
                "timestamp": datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Transformation failed: {str(e)}")
            raise RuntimeError(f"Image transformation failed: {str(e)}")

    def cleanup(self):
        """Clean up any temporary resources."""
        pass 
