"""
Tests for the VGG19 feature extractor module.
"""

import unittest
import torch
from src.models.feature_extractor import VGG19FeatureExtractor

class TestVGG19FeatureExtractor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Set up test resources."""
        cls.default_layers = ['conv1_1', 'conv2_1', 'conv3_1', 'conv4_1', 'conv5_1']
        cls.extractor = VGG19FeatureExtractor()
        cls.test_input = torch.randn(1, 3, 224, 224)

    def test_initialization(self):
        """Test feature extractor initialization."""
        self.assertEqual(self.extractor.layers, self.default_layers)

        custom_layers = ['conv1_1', 'conv2_1']
        custom_extractor = VGG19FeatureExtractor(layers=custom_layers)
        self.assertEqual(custom_extractor.layers, custom_layers)

        with self.assertRaises(ValueError):
            VGG19FeatureExtractor(layers=['invalid_layer'])

    def test_layer_management(self):
        """Test layer selection and management."""
        all_layers = self.extractor.get_layer_names()
        self.assertIsInstance(all_layers, list)
        self.assertTrue(all(isinstance(name, str) for name in all_layers))

        selected = self.extractor.get_selected_layers()
        self.assertEqual(selected, self.default_layers)

        new_layers = ['conv1_1', 'conv2_1']
        self.extractor.set_layers(new_layers)
        self.assertEqual(self.extractor.get_selected_layers(), new_layers)

        with self.assertRaises(ValueError):
            self.extractor.set_layers(['invalid_layer'])

    def test_feature_extraction(self):
        """Test feature extraction functionality."""
        features = self.extractor(self.test_input)

        self.assertIsInstance(features, dict)
        self.assertEqual(set(features.keys()), set(self.extractor.layers))

        for name, feature in features.items():
            self.assertEqual(feature.dim(), 4)
            self.assertEqual(feature.size(0), 1)

            self.assertEqual(feature.device, self.test_input.device)

            self.assertFalse(feature.requires_grad)

    def test_gram_matrix(self):
        """Test Gram matrix computation."""
        test_features = torch.randn(2, 64, 32, 32)

        gram = VGG19FeatureExtractor.gram_matrix(test_features)

        self.assertEqual(gram.size(0), 2)
        self.assertEqual(gram.size(1), 64)
        self.assertEqual(gram.size(2), 64)

        self.assertTrue(torch.allclose(gram, gram.transpose(1, 2), atol=1e-4))

    def test_model_frozen(self):
        """Test that model parameters are frozen."""
        for param in self.extractor.parameters():
            self.assertFalse(param.requires_grad)

    def test_evaluation_mode(self):
        """Test that model is in evaluation mode."""
        self.assertFalse(self.extractor.training)

        _ = self.extractor(self.test_input)
        self.assertFalse(self.extractor.training)

if __name__ == '__main__':
    unittest.main()
