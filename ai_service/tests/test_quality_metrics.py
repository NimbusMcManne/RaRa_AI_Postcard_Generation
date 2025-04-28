"""
Tests for the quality metrics module.
"""

import unittest
import torch
import numpy as np
from src.utils.quality_metrics import QualityMetrics
from src.models.feature_extractor import VGG19FeatureExtractor

class TestQualityMetrics(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Set up test resources."""
        cls.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        cls.metrics = QualityMetrics(device=cls.device)
        cls.feature_extractor = VGG19FeatureExtractor().to(cls.device)

        cls.content_image = torch.randn(1, 3, 64, 64).to(cls.device)
        cls.style_image = torch.randn(1, 3, 64, 64).to(cls.device)
        cls.transformed_image = torch.randn(1, 3, 64, 64).to(cls.device)

        cls.loss_history = {
            'content_loss': [2.0, 1.5, 1.0],
            'style_loss': [10.0, 7.5, 5.0],
            'tv_loss': [0.1, 0.08, 0.05],
            'total_loss': [12.1, 9.08, 6.05]
        }

    def test_content_similarity(self):
        """Test content similarity computation."""
        similarity = self.metrics.compute_content_similarity(
            self.content_image,
            self.content_image
        )
        self.assertIsInstance(similarity, float)
        self.assertGreaterEqual(similarity, 0.99) 

        similarity = self.metrics.compute_content_similarity(
            self.content_image,
            self.style_image
        )
        self.assertIsInstance(similarity, float)
        self.assertGreaterEqual(similarity, 0.0)
        self.assertLessEqual(similarity, 1.0)

    def test_style_consistency(self):
        """Test style consistency computation."""
        consistency = self.metrics.compute_style_consistency(
            self.style_image,
            self.style_image,
            self.feature_extractor
        )
        self.assertIsInstance(consistency, float)
        self.assertGreaterEqual(consistency, 0.99) 

        consistency = self.metrics.compute_style_consistency(
            self.style_image,
            self.content_image,
            self.feature_extractor
        )
        self.assertIsInstance(consistency, float)
        self.assertGreaterEqual(consistency, 0.0)
        self.assertLessEqual(consistency, 1.0)

    def test_performance_measurement(self):
        """Test performance measurement functionality."""
        def dummy_function(x):
            return torch.mean(x)

        metrics, result = self.metrics.measure_performance(
            dummy_function,
            self.content_image
        )

        self.assertIn('execution_time', metrics)
        self.assertIn('cpu_memory_used', metrics)
        self.assertGreaterEqual(metrics['execution_time'], 0)

        if torch.cuda.is_available():
            self.assertIn('gpu_memory_used', metrics)
            self.assertIn('gpu_memory_peak', metrics)
            self.assertGreaterEqual(metrics['gpu_memory_used'], 0)
            self.assertGreaterEqual(metrics['gpu_memory_peak'], 0)

    def test_quality_assessment(self):
        """Test comprehensive quality assessment."""
        metrics = self.metrics.assess_quality(
            self.content_image,
            self.style_image,
            self.transformed_image,
            self.feature_extractor
        )

        self.assertIn('content_similarity', metrics)
        self.assertIn('style_consistency', metrics)

        metrics = self.metrics.assess_quality(
            self.content_image,
            self.style_image,
            self.transformed_image,
            self.feature_extractor,
            self.loss_history
        )

        self.assertIn('final_loss', metrics)
        self.assertIn('loss_improvement', metrics)
        self.assertIn('content_loss_final', metrics)
        self.assertIn('style_loss_final', metrics)

        expected_improvement = 1 - (6.05 / 12.1)
        self.assertAlmostEqual(
            metrics['loss_improvement'],
            expected_improvement,
            places=6
        )

    def test_device_handling(self):
        """Test device handling in metrics computation."""
        cpu_image = torch.randn(1, 3, 64, 64)
        gpu_image = self.content_image  

        similarity = self.metrics.compute_content_similarity(
            cpu_image,
            gpu_image
        )

        self.assertIsInstance(similarity, float)
        self.assertGreaterEqual(similarity, 0.0)
        self.assertLessEqual(similarity, 1.0)

if __name__ == '__main__':
    unittest.main()
