"""
Tests for the style transfer module.
"""

import unittest
import torch
from src.models.style_transfer import StyleTransfer

class TestStyleTransfer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Set up test resources."""
        cls.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        cls.style_transfer = StyleTransfer(device=cls.device)

        cls.content_image = torch.randn(1, 3, 64, 64).to(cls.device)
        cls.style_image = torch.randn(1, 3, 64, 64).to(cls.device)

    def test_initialization(self):
        """Test StyleTransfer initialization."""
        self.assertEqual(self.style_transfer.content_weight, 1.0)
        self.assertEqual(self.style_transfer.style_weight, 1e6)
        self.assertEqual(self.style_transfer.tv_weight, 1e-6)
        self.assertEqual(self.style_transfer.content_layers, ['conv4_2'])

        custom_style_transfer = StyleTransfer(
            content_weight=2.0,
            style_weight=1e5,
            tv_weight=1e-5,
            content_layers=['conv3_2'],
            style_layers=['conv1_1', 'conv2_1']
        )
        self.assertEqual(custom_style_transfer.content_weight, 2.0)
        self.assertEqual(custom_style_transfer.style_weight, 1e5)
        self.assertEqual(custom_style_transfer.tv_weight, 1e-5)
        self.assertEqual(custom_style_transfer.content_layers, ['conv3_2'])
        self.assertEqual(custom_style_transfer.style_layers, ['conv1_1', 'conv2_1'])

    def test_content_loss(self):
        """Test content loss computation."""
        content_features = self.style_transfer.feature_extractor(self.content_image)
        input_features = self.style_transfer.feature_extractor(self.style_image)

        loss = self.style_transfer.compute_content_loss(input_features, content_features)

        self.assertIsInstance(loss, torch.Tensor)
        self.assertEqual(loss.dim(), 0)  
        self.assertGreaterEqual(loss.item(), 0)  

    def test_style_loss(self):
        """Test style loss computation."""
        style_features = self.style_transfer.feature_extractor(self.style_image)
        input_features = self.style_transfer.feature_extractor(self.content_image)

        loss = self.style_transfer.compute_style_loss(input_features, style_features)

        self.assertIsInstance(loss, torch.Tensor)
        self.assertEqual(loss.dim(), 0)  
        self.assertGreaterEqual(loss.item(), 0)  

    def test_tv_loss(self):
        """Test total variation loss computation."""
        loss = self.style_transfer.compute_tv_loss(self.content_image)

        self.assertIsInstance(loss, torch.Tensor)
        self.assertEqual(loss.dim(), 0)  
        self.assertGreaterEqual(loss.item(), 0)  

    def test_style_transfer(self):
        """Test complete style transfer process."""
        output_image, history = self.style_transfer.transfer_style(
            self.content_image,
            self.style_image,
            num_steps=2  
        )

        self.assertIsInstance(output_image, torch.Tensor)
        self.assertEqual(output_image.size(), self.content_image.size())
        self.assertFalse(output_image.requires_grad)

        self.assertIn('content_loss', history)
        self.assertIn('style_loss', history)
        self.assertIn('tv_loss', history)
        self.assertIn('total_loss', history)

        self.assertEqual(len(history['content_loss']), 2)
        self.assertEqual(len(history['style_loss']), 2)
        self.assertEqual(len(history['tv_loss']), 2)
        self.assertEqual(len(history['total_loss']), 2)

        self.assertLessEqual(history['total_loss'][-1], history['total_loss'][0])

    def test_callback(self):
        """Test callback functionality."""
        callback_called = False
        callback_image = None
        callback_history = None

        def test_callback(image, history):
            nonlocal callback_called, callback_image, callback_history
            callback_called = True
            callback_image = image
            callback_history = history

        self.style_transfer.transfer_style(
            self.content_image,
            self.style_image,
            num_steps=1,
            callback=test_callback
        )

        self.assertTrue(callback_called)
        self.assertIsInstance(callback_image, torch.Tensor)
        self.assertIsInstance(callback_history, dict)

if __name__ == '__main__':
    unittest.main()
