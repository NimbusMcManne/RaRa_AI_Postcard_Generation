"""
Tests for the image processing module.
"""

import unittest
import torch
import os
from PIL import Image
import numpy as np
from pathlib import Path
from src.utils.image_processing import ImageProcessor

class TestImageProcessor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Set up test resources."""
        cls.processor = ImageProcessor(max_image_size=512)
        cls.test_dir = Path(__file__).parent / "test_data"
        cls.test_dir.mkdir(exist_ok=True)

        cls.test_image = Image.new('RGB', (800, 600), color='red')
        cls.test_image_path = cls.test_dir / "test_image.jpg"
        cls.test_image.save(cls.test_image_path)

    def test_initialization(self):
        """Test ImageProcessor initialization."""
        self.assertEqual(self.processor.max_image_size, 512)
        self.assertTrue(isinstance(self.processor.device, torch.device))

    def test_resize_image(self):
        """Test image resizing functionality."""
        resized = self.processor._resize_image(self.test_image)
        max_dim = max(resized.size)
        self.assertLessEqual(max_dim, self.processor.max_image_size)

        original_ratio = self.test_image.size[0] / self.test_image.size[1]
        resized_ratio = resized.size[0] / resized.size[1]
        self.assertAlmostEqual(original_ratio, resized_ratio, places=2)

    def test_load_image(self):
        """Test image loading and preprocessing."""
        image, tensor = self.processor.load_image(str(self.test_image_path))

        self.assertIsInstance(image, Image.Image)
        self.assertIsInstance(tensor, torch.Tensor)
        self.assertEqual(tensor.dim(), 4)  
        self.assertEqual(tensor.size(1), 3)  

    def test_tensor_to_image(self):
        """Test tensor to image conversion."""
        test_tensor = torch.ones(3, 64, 64)  
        image = self.processor.tensor_to_image(test_tensor)

        self.assertIsInstance(image, Image.Image)
        self.assertEqual(image.size, (64, 64))
        self.assertEqual(image.mode, 'RGB')

    def test_prepare_batch(self):
        """Test batch preparation."""
        images = [self.test_image] * 3  
        batch = self.processor.prepare_batch(images)

        self.assertEqual(batch.dim(), 4)  
        self.assertEqual(batch.size(0), 3) 
        self.assertEqual(batch.size(1), 3) 

    def test_save_image(self):
        """Test image saving functionality."""
        output_path = self.test_dir / "output_test.jpg"
        self.processor.save_image(self.test_image, str(output_path))

        self.assertTrue(output_path.exists())
        saved_image = Image.open(output_path)
        self.assertEqual(saved_image.mode, 'RGB')

    @classmethod
    def tearDownClass(cls):
        """Clean up test resources."""
        import shutil
        if cls.test_dir.exists():
            shutil.rmtree(cls.test_dir)

if __name__ == '__main__':
    unittest.main()
