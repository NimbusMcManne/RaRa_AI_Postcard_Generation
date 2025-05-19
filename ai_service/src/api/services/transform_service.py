"""
Transformation service coordinating the AI pipeline components.
Handles image processing, style transfer, and quality assessment.
"""

import torch
from pathlib import Path
from typing import Dict, Tuple, Optional, List, Any
import logging
from datetime import datetime
import random
import requests
import uuid
import os
import yaml
import base64
import shutil
from fastapi import UploadFile

# --- GPU Configuration for TensorFlow --- #
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'

import tensorflow as tf
import tensorflow_hub as hub
import numpy as np
from PIL import Image

from ...utils.image_processing import ImageProcessor
from ...models.feature_extractor import VGG19FeatureExtractor
from ...models.style_transfer import StyleTransfer
from ...utils.quality_metrics import QualityMetrics
from ...utils.image_enhancements import unsharp_mask, apply_clahe_contrast, adjust_saturation
from gradio_client import Client, file as gradio_file, handle_file

logger = logging.getLogger(__name__)

# --- Configuration Loading --- #
CONFIG_PATH = Path(__file__).parent.parent.parent / "config/config.yaml"
SERVICE_CONFIG = {}
POST_PROCESSING_CONFIG = {}
TUNING_CONFIG = {}
if CONFIG_PATH.exists():
    try:
        with open(CONFIG_PATH, 'r') as f:
            SERVICE_CONFIG = yaml.safe_load(f)
        POST_PROCESSING_CONFIG = SERVICE_CONFIG.get('post_processing', {})
        TUNING_CONFIG = SERVICE_CONFIG.get('tuning', {})
        logger.info(f"Loaded configuration from {CONFIG_PATH}")

        cloud_service_config = SERVICE_CONFIG.get('cloud_service', {})
        logger.info(f"Cloud service configuration: {cloud_service_config}")
        gradio_space_id = cloud_service_config.get('gradio_space_id', None)
        logger.info(f"GRADIO_SPACE_ID: {gradio_space_id}")
    except Exception as e:
        logger.error(f"Failed to load or parse {CONFIG_PATH}: {e}. Using defaults.")
else:
    logger.warning(f"Configuration file not found at {CONFIG_PATH}. Using defaults.")


# --- Configuration Values --- #
API_GATEWAY_URL = os.getenv("API_GATEWAY_URL", SERVICE_CONFIG.get('server', {}).get('api_gateway_url', "http://localhost:3002"))
STYLE_REFERENCE_COUNT = int(os.getenv("STYLE_REFERENCE_COUNT", SERVICE_CONFIG.get('model', {}).get('style_transfer', {}).get('num_reference_images', 3)))
DEFAULT_CONTENT_WEIGHT = float(TUNING_CONFIG.get('content_weight', 1.0))
DEFAULT_STYLE_WEIGHT = float(TUNING_CONFIG.get('style_weight', 1.0e6))
DEFAULT_TV_WEIGHT = float(TUNING_CONFIG.get('tv_weight', 1.0e-6))
DEFAULT_NUM_STEPS = int(TUNING_CONFIG.get('num_steps', 300))
DEFAULT_CONTENT_LAYERS = TUNING_CONFIG.get('content_layers', ["conv4_2"])
DEFAULT_STYLE_LAYERS = TUNING_CONFIG.get('style_layers', ["conv1_1", "conv2_1", "conv3_1", "conv4_1", "conv5_1"])
DEFAULT_LEARNING_RATE = float(TUNING_CONFIG.get('learning_rate', 0.02))
GRADIO_SPACE_ID = SERVICE_CONFIG.get('cloud_service', {}).get('gradio_space_id', None)

logger.info(f"Configuration: GRADIO_SPACE_ID = '{GRADIO_SPACE_ID}'")

if GRADIO_SPACE_ID is None and 'cloud_service' in SERVICE_CONFIG and 'gradio_space_id' in SERVICE_CONFIG['cloud_service']:
    GRADIO_SPACE_ID = SERVICE_CONFIG['cloud_service']['gradio_space_id']
    logger.info(f"Explicitly set GRADIO_SPACE_ID from config to: '{GRADIO_SPACE_ID}'")

if GRADIO_SPACE_ID is None:
    GRADIO_SPACE_ID = "Hexii/Neural-Style-Transfer"
    logger.info(f"Forced GRADIO_SPACE_ID to default value: '{GRADIO_SPACE_ID}'")


TEMP_STYLE_DIR = Path(SERVICE_CONFIG.get('paths', {}).get('temp_storage', "temp")) / "style_downloads"
TEMP_STYLE_DIR.mkdir(parents=True, exist_ok=True)


TFHUB_MAGENTA_MODEL_URL = SERVICE_CONFIG.get('cloud_service', {}).get('tfhub_magenta_model_url', "https://tfhub.dev/google/magenta/arbitrary-image-stylization-v1-256/2")

MAGENTA_HUB_MODEL = None

def _load_magenta_model():
    global MAGENTA_HUB_MODEL
    if MAGENTA_HUB_MODEL is None:
        if not TFHUB_MAGENTA_MODEL_URL:
            logger.error("TensorFlow Hub Magenta model URL is not configured.")
            return None
        try:
            logger.info(f"Loading TensorFlow Hub Magenta model from: {TFHUB_MAGENTA_MODEL_URL}")
            os.environ['TFHUB_MODEL_LOAD_FORMAT'] = 'COMPRESSED'
            MAGENTA_HUB_MODEL = hub.load(TFHUB_MAGENTA_MODEL_URL)
            logger.info("TensorFlow Hub Magenta model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load TensorFlow Hub Magenta model: {e}")
            MAGENTA_HUB_MODEL = None
    return MAGENTA_HUB_MODEL

def _preprocess_for_magenta(pil_image: Image.Image) -> tf.Tensor:
    max_dim = 512
    img = tf.convert_to_tensor(np.array(pil_image))
    if img.shape[-1] == 1:
        img = tf.image.grayscale_to_rgb(img)
    elif img.shape[-1] == 4:
        img = img[..., :3]

    img = tf.image.convert_image_dtype(img, tf.float32)
    shape = tf.cast(tf.shape(img)[:-1], tf.float32)
    long_dim = tf.maximum(shape[0], shape[1])
    scale = max_dim / long_dim
    new_shape = tf.cast(shape * scale, tf.int32)
    img = tf.image.resize(img, new_shape)
    img = img[tf.newaxis, :]
    return img

def _tensor_to_pil_image_magenta(tensor) -> Image.Image:
    tensor = tensor * 255
    tensor = np.array(tensor, dtype=np.uint8)
    if np.ndim(tensor) > 3:
        assert tensor.shape[0] == 1
        tensor = tensor[0]
    return Image.fromarray(tensor)

class TransformationService:
    """Coordinates the AI pipeline for image transformation."""

    def __init__(self):
        """Initialize the transformation service components."""
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Using device: {self.device}")


        self.image_processor = ImageProcessor()
        self.feature_extractor = VGG19FeatureExtractor(layers=list(set(DEFAULT_CONTENT_LAYERS + DEFAULT_STYLE_LAYERS))).to(self.device)
        self.style_transfer = StyleTransfer(
            content_weight=DEFAULT_CONTENT_WEIGHT,
            style_weight=DEFAULT_STYLE_WEIGHT,
            tv_weight=DEFAULT_TV_WEIGHT,
            content_layers=DEFAULT_CONTENT_LAYERS,
            style_layers=DEFAULT_STYLE_LAYERS,
            device=self.device
        )
        self.quality_metrics = QualityMetrics(device=self.device)

        logger.info("Transformation service initialized with config defaults")
        logger.info(f"Default Weights - Content: {DEFAULT_CONTENT_WEIGHT}, Style: {DEFAULT_STYLE_WEIGHT}, TV: {DEFAULT_TV_WEIGHT}")
        logger.info(f"Default Steps: {DEFAULT_NUM_STEPS}")

        _load_magenta_model()

    def _fetch_style_image_urls(self, period_id: str, category_id: str, count: int) -> List[str]:
        """Fetches multiple style image URLs from the API gateway."""
        target_url = f"{API_GATEWAY_URL}/api/styles/{period_id}/{category_id}/references?count={count}"
        logger.info(f"Fetching style references from: {target_url}")

        try:
            response = requests.get(target_url, timeout=15)
            response.raise_for_status()
            data = response.json()
            urls = data.get('urls', [])
            if not urls:
                 logger.warning(f"No style URLs returned from gateway for {period_id}/{category_id}")
                 return []
            logger.info(f"Received {len(urls)} style URLs.")
            return urls
        except requests.exceptions.Timeout:
            logger.error(f"Timeout fetching style references from gateway: {target_url}")
            raise RuntimeError("Timeout connecting to gateway for style references.")
        except requests.exceptions.ConnectionError:
            logger.error(f"Connection error fetching style references from gateway: {target_url}")
            raise RuntimeError("Could not connect to gateway for style references.")
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching style references from gateway ({e.response.status_code if e.response else 'Network Error'}): {e}")
            raise RuntimeError(f"Could not fetch style references: {e}")
        except Exception as e:
            logger.error(f"Error parsing style references response: {e}")
            raise RuntimeError("Failed to parse style references response.")


    async def _download_style_images(self, style_urls: List[str]) -> List[Path]:
        """Downloads multiple style images from URLs to a temporary directory."""
        downloaded_paths = []
        try:
            for i, url in enumerate(style_urls):
                thumb_url = url if "?thumb=1" in url else f"{url}?thumb=1"
                logger.info(f"Downloading style image {i+1}/{len(style_urls)} from {thumb_url}")
                try:
                    response = requests.get(thumb_url, stream=True, timeout=30)
                    response.raise_for_status()

                    content_type = response.headers.get('content-type')
                    if not content_type or not content_type.startswith('image/'):
                        logger.warning(f"Skipping non-image URL: {thumb_url} (Content-Type: {content_type}) Original: {url}")
                        continue

                    temp_style_filename = f"style_{uuid.uuid4()}.jpg"
                    temp_style_path = TEMP_STYLE_DIR / temp_style_filename
                    with open(temp_style_path, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    downloaded_paths.append(temp_style_path)
                    logger.info(f"Style image saved temporarily to {temp_style_path}")
                except requests.exceptions.Timeout:
                    logger.warning(f"Timeout downloading style image from {thumb_url}. Original URL: {url}. Skipping.")
                except requests.exceptions.ConnectionError:
                     logger.warning(f"Connection error downloading style image from {thumb_url}. Original URL: {url}. Skipping.")
                except requests.exceptions.RequestException as e:
                    status_code = e.response.status_code if e.response else "N/A"
                    logger.warning(f"Failed to download style image from {thumb_url} (Status: {status_code}): {e}. Original URL: {url}. Skipping.")
                except ValueError as e:
                     logger.warning(f"ValueError during download from {thumb_url}: {e}. Original URL: {url}. Skipping.")
                except Exception as e:
                    logger.warning(f"Generic error processing download from {thumb_url}: {e}. Original URL: {url}. Skipping.")

            if not downloaded_paths:
                 raise RuntimeError("Failed to download any valid style images.")

            return downloaded_paths
        except Exception as e:
            self._cleanup_temp_files(downloaded_paths)
            raise e

    def _cleanup_temp_files(self, file_paths: List[Path]):
        """Removes a list of temporary files."""
        for file_path in file_paths:
             if file_path and file_path.exists():
                try:
                    os.remove(file_path)
                    logger.info(f"Cleaned up temporary style image: {file_path}")
                except OSError as e:
                    logger.error(f"Error removing temporary file {file_path}: {e}")

    # --- LOCAL TRANSFORMATION LOGIC --- #
    async def _local_transform(
        self,
        content_path: Path,
        style_source_paths: List[Path],
        output_path: Optional[Path],
        final_style_weight: float,
        final_content_weight: float,
        final_num_steps: int,
        final_tv_weight: float,
        final_learning_rate: float,
        saturation_enabled_param: Optional[bool],
        saturation_factor_param: Optional[float],
        clahe_enabled_param: Optional[bool],
        clahe_clip_limit_param: Optional[float],
        usm_enabled_param: Optional[bool],
        usm_amount_param: Optional[float],
        is_local_test_style: bool = False
    ) -> Dict:
        """Performs the style transfer using the local PyTorch implementation."""
        logger.info(f"Executing local transformation process (Source: {'Local Test Image' if is_local_test_style else 'Archive References'})")
        temp_style_paths_to_clean: List[Path] = [] if is_local_test_style else style_source_paths

        parameters_used = {
            'content_weight': final_content_weight,
            'style_weight': final_style_weight,
            'tv_weight': final_tv_weight,
            'num_steps': final_num_steps,
            'learning_rate': final_learning_rate,
            'post_processing_applied': {}
        }

        try:
            # 1. Load and Process Images for Style Transfer
            logger.info("Loading images for local processing")
            content_pil_img, content_tensor = self.image_processor.load_image(str(content_path))
            style_tensors: List[torch.Tensor] = []
            loaded_style_paths: List[str] = []
            target_size = content_pil_img.size
            logger.info(f"Content image dimensions for style resizing: {target_size}")
            for style_path in style_source_paths:
                try:
                    style_pil_img = Image.open(style_path).convert('RGB')
                    if style_pil_img.size != target_size:
                        logger.info(f"Resizing style image from {style_pil_img.size} to {target_size} to match content image.")
                        style_pil_img_resized = style_pil_img.resize(target_size, Image.Resampling.LANCZOS)
                    else:
                        style_pil_img_resized = style_pil_img
                    style_tensor = self.image_processor.preprocess(style_pil_img_resized).unsqueeze(0).to(self.device)
                    style_tensors.append(style_tensor)
                    loaded_style_paths.append(str(style_path))
                except FileNotFoundError:
                    logger.error(f"Style image not found at {style_path}. Skipping.")
                except Exception as e:
                    logger.error(f"Error loading/processing style image {style_path}: {e}. Skipping.")
            if not style_tensors:
                raise RuntimeError("Failed to load any valid style images.")

            # 2. Perform Style Transfer
            logger.info("Starting local style transfer optimization")
            logger.info(f" -> Using Weights: Style={final_style_weight:.2e}, Content={final_content_weight:.2f}, TV={final_tv_weight:.2e} | Steps={final_num_steps} | LR: {final_learning_rate:.3f}")
            output_tensor, history = self.style_transfer.transfer_style(
                content_tensor,
                style_tensors,
                num_steps=final_num_steps,
                style_weight=final_style_weight,
                content_weight=final_content_weight,
                tv_weight=final_tv_weight,
                learning_rate=final_learning_rate
            )

            # 3. Convert initial stylized tensor to PIL Image
            processed_pil_image = self.image_processor.tensor_to_image(output_tensor)

            # 4. Compute Quality Metrics (on the image BEFORE aesthetic post-processing)
            logger.info("Computing local quality metrics on pre-enhancement image")
            metrics = self.quality_metrics.assess_quality(
                content_tensor,
                style_tensors,
                output_tensor, 
                self.feature_extractor,
                history
            )

            # 5. Apply Post-Processing Enhancements (use param if provided, else config)
            logger.info("Applying post-processing enhancements based on parameters or config...")
            final_enhanced_pil_image = processed_pil_image.copy()

            # --- Unsharp Mask --- #
            usm_config = POST_PROCESSING_CONFIG.get('unsharp_mask', {})
            usm_enabled = usm_enabled_param if usm_enabled_param is not None else usm_config.get('enabled', False)
            usm_amount = usm_amount_param if usm_amount_param is not None else float(usm_config.get('amount', 1.0))
            usm_sigma = float(usm_config.get('sigma', 1.0))
            usm_threshold = int(usm_config.get('threshold', 0))

            parameters_used['post_processing_applied']['unsharp_mask'] = {
                'enabled': usm_enabled,
                'amount': usm_amount,
                'sigma': usm_sigma,
                'threshold': usm_threshold
            }
            if usm_enabled:
                logger.info(f"Applying Unsharp Mask: amount={usm_amount}, sigma={usm_sigma}, threshold={usm_threshold}")
                numpy_bgr = np.array(final_enhanced_pil_image.convert('RGB'))[:, :, ::-1].copy()
                sharpened_bgr = unsharp_mask(
                    numpy_bgr,
                    amount=usm_amount,
                    sigma=usm_sigma,
                    threshold=usm_threshold
                )
                final_enhanced_pil_image = Image.fromarray(sharpened_bgr[:, :, ::-1])

            # --- CLAHE Contrast --- #
            clahe_config = POST_PROCESSING_CONFIG.get('clahe_contrast', {})
            clahe_enabled = clahe_enabled_param if clahe_enabled_param is not None else clahe_config.get('enabled', False)
            clahe_clip_limit = clahe_clip_limit_param if clahe_clip_limit_param is not None else float(clahe_config.get('clip_limit', 2.0))
            clahe_tile_size = int(clahe_config.get('tile_grid_size', 8))

            parameters_used['post_processing_applied']['clahe_contrast'] = {
                'enabled': clahe_enabled,
                'clip_limit': clahe_clip_limit,
                'tile_grid_size': clahe_tile_size
            }
            if clahe_enabled:
                logger.info(f"Applying CLAHE Contrast: clip_limit={clahe_clip_limit}, tile_size={clahe_tile_size}")
                numpy_bgr = np.array(final_enhanced_pil_image.convert('RGB'))[:, :, ::-1].copy()
                contrasted_bgr = apply_clahe_contrast(
                    numpy_bgr,
                    clip_limit=clahe_clip_limit,
                    tile_grid_size=clahe_tile_size
                )
                final_enhanced_pil_image = Image.fromarray(contrasted_bgr[:, :, ::-1])

            satur_config = POST_PROCESSING_CONFIG.get('saturation_boost', {})
            saturation_enabled = saturation_enabled_param if saturation_enabled_param is not None else satur_config.get('enabled', False)
            saturation_factor = saturation_factor_param if saturation_factor_param is not None else float(satur_config.get('factor', 1.2))

            parameters_used['post_processing_applied']['saturation_boost'] = {
                'enabled': saturation_enabled,
                'factor': saturation_factor
            }
            if saturation_enabled:
                logger.info(f"Applying Saturation Boost: factor={saturation_factor}")
                final_enhanced_pil_image = adjust_saturation(
                    final_enhanced_pil_image,
                    factor=saturation_factor
                )

            # 6. Save Final (potentially enhanced) Result
            if output_path:
                logger.info(f"Saving final result to {output_path}")
                self.image_processor.save_image(final_enhanced_pil_image, str(output_path))

            # 7. Format Return Value
            return {
                "status": "success",
                "metrics": metrics,
                "used_style_paths": loaded_style_paths,
                "processing_mode": "local",
                "timestamp": datetime.now().isoformat(),
                "parameters_used": parameters_used
            }
        finally:
            self._cleanup_temp_files(temp_style_paths_to_clean)

    # --- CLOUD TRANSFORMATION LOGIC (Magenta TF Hub) --- #
    async def _execute_tfhub_magenta_model_locally(
        self,
        content_path: Path,
        style_image_path: Path,
        output_path: Optional[Path],
    ) -> Dict:
        """Performs style transfer using the Magenta TF Hub model (run locally)."""
        logger.info("Executing local transformation using TF Hub Magenta model...")
        hub_model = _load_magenta_model()
        if not hub_model:
            raise RuntimeError("TF Hub Magenta model could not be loaded.")

        try:
            # 1. Load and preprocess images for Magenta model
            logger.info("Loading and preprocessing images for Magenta model...")
            content_pil_img = Image.open(content_path).convert('RGB')
            style_pil_img = Image.open(style_image_path).convert('RGB')

            content_tensor_tf = _preprocess_for_magenta(content_pil_img)
            style_tensor_tf = _preprocess_for_magenta(style_pil_img)

            # 2. Perform Stylization
            logger.info("Stylizing image with Magenta model...")
            stylized_image_tf = hub_model(tf.constant(content_tensor_tf), tf.constant(style_tensor_tf))[0]

            # 3. Convert output tensor to PIL Image
            output_pil_image = _tensor_to_pil_image_magenta(stylized_image_tf)

            # 4. Save Result
            if output_path:
                logger.info(f"Saving Magenta model result to {output_path}")
                self.image_processor.save_image(output_pil_image, str(output_path))

            # 5. Format Return Value (Metrics are not directly comparable/available)
            # Also include placeholder parameters_used for consistency
            parameters_used = {
                'content_weight': None,
                'style_weight': None,
                'tv_weight': None,
                'num_steps': None,
                'learning_rate': None,
                'post_processing_applied': {}
            }
            return {
                "status": "success",
                "metrics": { "content_similarity": None, "style_consistency_avg": None },
                "used_style_paths": [str(style_image_path)],
                "processing_mode": "cloud (TFHub Magenta)",
                "timestamp": datetime.now().isoformat(),
                "parameters_used": parameters_used
            }
        except Exception as e:
            logger.error(f"Magenta model transformation failed: {e}")
            raise RuntimeError(f"Magenta model transformation process failed: {e}")

    # --- CLOUD TRANSFORMATION LOGIC (Gradio Space) --- #
    async def _cloud_transform_gradio_space(
        self,
        content_path: Path,
        style_urls: Optional[List[str]] = None,
        local_style_image_file: Optional[UploadFile] = None,
        output_path: Optional[Path] = None,
        style_weight: Optional[float] = None,
        content_weight: Optional[float] = None,
        style_blur: Optional[bool] = None,
    ) -> Dict:
        """Performs style transfer using a Gradio Space API."""
        if not GRADIO_SPACE_ID:
            raise RuntimeError("Gradio Space ID is not configured in config.yaml (cloud_service.gradio_space_id)")
        logger.info(f"Executing cloud transformation process via Gradio Space: {GRADIO_SPACE_ID}")
        temp_style_paths_to_clean: List[Path] = []
        style_source_path: Optional[Path] = None

        style_weight_val = style_weight if style_weight is not None else 1.0
        content_weight_val = content_weight if content_weight is not None else 1.0
        style_blur_val = style_blur if style_blur is not None else False

        parameters_used = {
            'content_weight': content_weight_val,
            'style_weight': style_weight_val,
            'style_blur': style_blur_val,
            'tv_weight': None,
            'num_steps': None,
            'learning_rate': None,
            'post_processing_applied': {}
        }

        try:
            # 1. Get the single style image path (either download or from upload)
            if local_style_image_file:
                temp_local_style_path = TEMP_STYLE_DIR / f"style_{uuid.uuid4()}_{local_style_image_file.filename}"
                with open(temp_local_style_path, "wb") as f:
                    # Read the file content from UploadFile
                    file_content = await local_style_image_file.read()
                    f.write(file_content)
                style_source_path = temp_local_style_path
                temp_style_paths_to_clean.append(temp_local_style_path)
                logger.info(f"Using uploaded local test style image: {local_style_image_file.filename}")
            else:
                if not style_urls:
                    raise ValueError("Style URLs must be provided for Gradio cloud processing if not using local file.")
                temp_style_paths_to_clean = await self._download_style_images([style_urls[0]])
                if not temp_style_paths_to_clean:
                     raise ValueError("Failed to download the primary style image for cloud processing.")
                style_source_path = temp_style_paths_to_clean[0]

            if not style_source_path:
                raise RuntimeError("Could not determine style source path for cloud processing.")

            # 2. Initialize Gradio Client
            client = Client(GRADIO_SPACE_ID)

            # 3. Call predict method with all parameters
            logger.info(f"Calling Gradio client predict for Space: {GRADIO_SPACE_ID}")
            try:
                result_filepath_temp = client.predict(
                    content_img=handle_file(str(content_path)),
                    style_image=handle_file(str(style_source_path)),
                    style_weight=style_weight_val,
                    content_weight=content_weight_val,
                    style_blur=style_blur_val,
                    api_name="/predict"
                )
            except Exception as e:
                logger.error(f"Gradio API call failed: {e}")
                raise RuntimeError("Cloud service (Gradio) failed to process the request.")

            logger.info(f"Gradio client saved result temporarily to: {result_filepath_temp}")

            # 4. Copy result to desired output path
            if output_path:
                logger.info(f"Copying cloud result to {output_path}")
                if result_filepath_temp and Path(result_filepath_temp).exists():
                    shutil.copyfile(result_filepath_temp, output_path)
                else:
                    logger.error(f"Gradio client did not return a valid file path: {result_filepath_temp}")
                    raise RuntimeError("Cloud service did not return a valid result file.")
            else:
                logger.warning(f"No output_path provided. Cloud result is in temp file: {result_filepath_temp}")

            # 5. Format Return Value
            return {
                "status": "success",
                "metrics": { "content_similarity": None, "style_consistency_avg": None },
                "used_style_paths": [str(style_source_path)],
                "processing_mode": f"cloud (Gradio Space: {GRADIO_SPACE_ID})",
                "timestamp": datetime.now().isoformat(),
                "parameters_used": parameters_used
            }

        except Exception as e:
            logger.error(f"Cloud transformation failed: {e}")
            raise RuntimeError(f"Cloud transformation process failed: {e}")
        finally:
            self._cleanup_temp_files(temp_style_paths_to_clean)
            if 'result_filepath_temp' in locals():
                 result_temp_path_obj = Path(result_filepath_temp)
                 if result_temp_path_obj.exists():
                     try:
                         os.remove(result_filepath_temp)
                         logger.info(f"Cleaned up temporary Gradio result file: {result_filepath_temp}")
                     except OSError as e:
                         logger.error(f"Error removing temporary Gradio file {result_filepath_temp}: {e}")


    # --- Main Transformation Method --- #
    async def transform_image(
        self,
        content_path: Path,
        period_id: Optional[str] = None,
        category_id: Optional[str] = None,
        local_style_image_file: Optional[UploadFile] = None,
        output_path: Optional[Path] = None,
        style_weight: Optional[float] = None,
        content_weight: Optional[float] = None,
        num_steps: Optional[int] = None,
        tv_weight: Optional[float] = None,
        learning_rate: Optional[float] = None,
        saturation_enabled: Optional[bool] = None,
        saturation_factor: Optional[float] = None,
        clahe_enabled: Optional[bool] = None,
        clahe_clip_limit: Optional[float] = None,
        usm_enabled: Optional[bool] = None,
        usm_amount: Optional[float] = None,
        processing_mode: str = "local",
        ai_model_choice: str = "local_vgg",
        style_blur: Optional[bool] = None
    ) -> Dict:
        """
        Transform image using archive style (period/category) or local test style.
        Dispatches to local or cloud processing based on the mode.
        """

        final_style_weight = style_weight if style_weight is not None else DEFAULT_STYLE_WEIGHT
        final_content_weight = content_weight if content_weight is not None else DEFAULT_CONTENT_WEIGHT
        final_num_steps = num_steps if num_steps is not None else DEFAULT_NUM_STEPS
        final_tv_weight = tv_weight if tv_weight is not None else DEFAULT_TV_WEIGHT
        final_learning_rate = learning_rate if learning_rate is not None else DEFAULT_LEARNING_RATE

        logger.info(f"Transformation Parameters Received - Model: {ai_model_choice}, Mode: {processing_mode}, Steps: {num_steps}, LR: {learning_rate}, StyleW: {style_weight}, ContentW: {content_weight}, TV_W: {tv_weight}")
        logger.info(f"PostProc Params Received - Sat: {saturation_enabled}/{saturation_factor}, CLAHE: {clahe_enabled}/{clahe_clip_limit}, USM: {usm_enabled}/{usm_amount}")

        try:
            # --- Model Dispatch Logic --- #
            if ai_model_choice == 'local_magenta':
                logger.info("Dispatching to TFHub Magenta model processing (run locally).")
                style_source_path_for_magenta: Optional[Path] = None
                temp_magenta_style_path_to_clean: List[Path] = []
                temp_local_style_path_magenta: Optional[Path] = None

                if local_style_image_file:
                    temp_local_style_path_magenta = TEMP_STYLE_DIR / f"style_{uuid.uuid4()}_{local_style_image_file.filename}"
                    with open(temp_local_style_path_magenta, "wb") as f:
                        file_content = await local_style_image_file.read()
                        f.write(file_content)
                    style_source_path_for_magenta = temp_local_style_path_magenta
                    temp_magenta_style_path_to_clean.append(temp_local_style_path_magenta)
                elif period_id and category_id:
                    style_urls = self._fetch_style_image_urls(period_id, category_id, 1)
                    if not style_urls:
                        raise ValueError(f"Could not find style URL for Magenta model ({period_id}/{category_id})")
                    downloaded_paths = await self._download_style_images(style_urls)
                    if not downloaded_paths:
                        raise ValueError("Failed to download style image for Magenta model.")
                    style_source_path_for_magenta = downloaded_paths[0]
                    temp_magenta_style_path_to_clean.extend(downloaded_paths)
                else:
                    raise ValueError("Style source (local file or period/category) not provided for Magenta model.")
                if not style_source_path_for_magenta:
                     raise RuntimeError("Style source path for Magenta model was not determined.")
                try:
                    result = await self._execute_tfhub_magenta_model_locally(
                        content_path,
                        style_image_path=style_source_path_for_magenta,
                        output_path=output_path,
                    )
                finally:
                    self._cleanup_temp_files(temp_magenta_style_path_to_clean)
                    if temp_local_style_path_magenta and temp_local_style_path_magenta.exists():
                        self._cleanup_temp_files([temp_local_style_path_magenta])

            elif ai_model_choice == 'local_vgg':
                logger.info("Dispatching to local_vgg model, local processing.")
                style_source_paths: List[Path]
                is_local_test = False
                temp_local_style_path: Optional[Path] = None
                if local_style_image_file:
                    temp_local_style_path = TEMP_STYLE_DIR / f"style_{uuid.uuid4()}_{local_style_image_file.filename}"
                    with open(temp_local_style_path, "wb") as f:
                        file_content = await local_style_image_file.read()
                        f.write(file_content)
                    style_source_paths = [temp_local_style_path]
                    is_local_test = True
                else:
                    if period_id is None or category_id is None:
                        raise ValueError("Period ID and Category ID must be provided for local_vgg if not using local test style.")
                    style_urls = self._fetch_style_image_urls(period_id, category_id, STYLE_REFERENCE_COUNT)
                    if not style_urls:
                        raise ValueError(f"Could not find any style image URLs for period '{period_id}' and category '{category_id}'.")
                    temp_style_paths = await self._download_style_images(style_urls)
                    if not temp_style_paths:
                        raise ValueError("Failed to download any valid style images for local processing.")
                    style_source_paths = temp_style_paths
                    is_local_test = False
                try:
                    result = await self._local_transform(
                        content_path,
                        style_source_paths=style_source_paths,
                        output_path=output_path,
                        final_style_weight=final_style_weight,
                        final_content_weight=final_content_weight,
                        final_num_steps=final_num_steps,
                        final_tv_weight=final_tv_weight,
                        final_learning_rate=final_learning_rate,
                        saturation_enabled_param=saturation_enabled,
                        saturation_factor_param=saturation_factor,
                        clahe_enabled_param=clahe_enabled,
                        clahe_clip_limit_param=clahe_clip_limit,
                        usm_enabled_param=usm_enabled,
                        usm_amount_param=usm_amount,
                        is_local_test_style=is_local_test
                    )
                finally:
                    if temp_local_style_path and temp_local_style_path.exists():
                        self._cleanup_temp_files([temp_local_style_path])

            elif ai_model_choice == 'cloud_gradio':
                logger.info("Dispatching to Gradio Space for cloud processing.")
                if not GRADIO_SPACE_ID:
                    logger.error("Cloud processing (Gradio) selected, but Gradio Space ID not configured.")
                    raise ValueError("Gradio Space cloud backend not configured.")
                style_urls_for_gradio = None
                if not local_style_image_file and period_id and category_id:
                    style_urls_for_gradio = self._fetch_style_image_urls(period_id, category_id, 1)
                    if not style_urls_for_gradio:
                        raise ValueError("No style URLs for Gradio.")
                result = await self._cloud_transform_gradio_space(
                    content_path,
                    style_urls=style_urls_for_gradio,
                    local_style_image_file=local_style_image_file,
                    output_path=output_path,
                    style_weight=style_weight,
                    content_weight=content_weight,
                    style_blur=style_blur,
                )
            else:
                raise ValueError(f"Unsupported AI model choice: '{ai_model_choice}'. Supported: local_vgg, local_magenta, cloud_gradio.")

            return result

        except Exception as e:
            logger.exception(f"Transformation failed (model: {ai_model_choice}, mode: {processing_mode}): {str(e)}") # Use exception for stack trace
            raise RuntimeError(f"Image transformation failed: {str(e)}")

    def cleanup(self):
        """Clean up any temporary resources."""
        # Future use: clean up TEMP_STYLE_DIR on shutdown
        pass
