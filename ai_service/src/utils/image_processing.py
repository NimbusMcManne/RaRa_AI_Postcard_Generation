"""
Image processing utilities for the AI transformation pipeline.
Handles image loading, preprocessing, and basic transformations.
"""

import torch
import torchvision.transforms as transforms
from PIL import Image
from typing import Tuple, Optional
import numpy as np

class ImageProcessor:
    """Handles image processing operations for the style transfer pipeline."""

    def __init__(self, max_image_size: int = 1024):
        self.max_image_size = max_image_size
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Standard preprocessing for VGG network
        self.preprocess = transforms.Compose([
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406],
                              std=[0.229, 0.224, 0.225])
        ])

        # Reverse preprocessing for visualization
        self.postprocess = transforms.Compose([
            transforms.Lambda(lambda x: x.mul(torch.tensor([0.229, 0.224, 0.225])
                                           .view(-1, 1, 1).to(x.device))),
            transforms.Lambda(lambda x: x.add(torch.tensor([0.485, 0.456, 0.406])
                                           .view(-1, 1, 1).to(x.device))),
            transforms.Lambda(lambda x: torch.clamp(x, 0, 1))
        ])

    def load_image(self, image_path: str) -> Tuple[Image.Image, torch.Tensor]:
        """
        Load and preprocess an image for the neural network.

        Args:
            image_path: Path to the image file

        Returns:
            Tuple of (original PIL Image, preprocessed tensor)
        """
        image = Image.open(image_path).convert('RGB')
        image = self._resize_image(image)
        tensor = self.preprocess(image).unsqueeze(0).to(self.device)
        return image, tensor

    def _resize_image(self, image: Image.Image) -> Image.Image:
        """
        Resize image while maintaining aspect ratio.

        Args:
            image: PIL Image to resize

        Returns:
            Resized PIL Image
        """
        if max(image.size) > self.max_image_size:
            ratio = self.max_image_size / max(image.size)
            new_size = tuple(int(dim * ratio) for dim in image.size)
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        return image

    def tensor_to_image(self, tensor: torch.Tensor) -> Image.Image:
        """
        Convert a tensor back to a PIL Image.

        Args:
            tensor: Input tensor (C x H x W)

        Returns:
            PIL Image
        """
        if tensor.dim() == 4:
            tensor = tensor.squeeze(0)

        tensor = self.postprocess(tensor)
        tensor = tensor.cpu().detach()
        tensor = tensor.mul(255).clamp(0, 255).byte()
        return Image.fromarray(tensor.permute(1, 2, 0).numpy())

    def save_image(self, image: Image.Image, path: str, quality: int = 95) -> None:
        """
        Save image with specified quality.

        Args:
            image: PIL Image to save
            path: Output path
            quality: JPEG quality (1-100)
        """
        image.save(path, 'JPEG', quality=quality, optimize=True)

    def prepare_batch(self, images: list) -> torch.Tensor:
        """
        Prepare a batch of images for processing.

        Args:
            images: List of PIL Images

        Returns:
            Batch tensor (B x C x H x W)
        """
        tensors = []
        for img in images:
            img = self._resize_image(img)
            tensor = self.preprocess(img).unsqueeze(0)
            tensors.append(tensor)
        return torch.cat(tensors, 0).to(self.device)
