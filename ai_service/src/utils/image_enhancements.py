import cv2
import numpy as np
from PIL import Image, ImageEnhance

def unsharp_mask(image_array: np.ndarray, kernel_size=(5, 5), sigma=1.0, amount=1.0, threshold=0) -> np.ndarray:
    """
    Return a sharpened version of the image, using an unsharp mask.
    Assumes input image_array is a NumPy array in BGR format (standard for OpenCV).
    """
    if image_array is None:
        raise ValueError("Input image_array cannot be None")
    if image_array.ndim not in [2, 3]:
        raise ValueError("Input image_array must be 2D (grayscale) or 3D (color)")

    original_type = image_array.dtype
    if original_type != np.float32 and original_type != np.float64:
        image_float = image_array.astype(np.float32)
    else:
        image_float = image_array.copy()

    blurred = cv2.GaussianBlur(image_float, kernel_size, sigma)
    sharpened = float(amount + 1) * image_float - float(amount) * blurred
    sharpened = np.clip(sharpened, 0, 255)

    if threshold > 0:
        diff = np.abs(image_float - blurred)
        if image_float.ndim == 3:
            low_contrast_mask = np.all(diff < threshold, axis=2, keepdims=True)
        else:
            low_contrast_mask = diff < threshold
        np.copyto(sharpened, image_float, where=low_contrast_mask)

    if original_type != np.float32 and original_type != np.float64:
        return sharpened.astype(np.uint8)
    else:
        return sharpened.astype(np.uint8)

def apply_clahe_contrast(image_array: np.ndarray, clip_limit: float = 2.0, tile_grid_size: int = 8) -> np.ndarray:
    """
    Apply Contrast Limited Adaptive Histogram Equalization (CLAHE).
    Assumes input image_array is a NumPy array in BGR format.
    """
    if image_array.ndim == 3 and image_array.shape[2] == 3: 
        lab_image = cv2.cvtColor(image_array, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab_image)
        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_grid_size, tile_grid_size))
        l_clahe = clahe.apply(l)
        lab_clahe_image = cv2.merge((l_clahe, a, b))
        enhanced_image = cv2.cvtColor(lab_clahe_image, cv2.COLOR_LAB2BGR)
    elif image_array.ndim == 2: 
        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_grid_size, tile_grid_size))
        enhanced_image = clahe.apply(image_array)
    else:
        return image_array
    return enhanced_image

def adjust_saturation(pil_image: Image.Image, factor: float) -> Image.Image:
    """
    Adjust the color saturation of a PIL Image.
    Factor > 1.0 increases saturation, < 1.0 decreases it.
    Factor = 1.0 returns the original image.
    """
    enhancer = ImageEnhance.Color(pil_image)
    return enhancer.enhance(factor)
