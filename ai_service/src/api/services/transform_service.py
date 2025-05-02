"""
Transformation service coordinating the AI pipeline components.
Handles image processing, style transfer, and quality assessment.
"""

import torch
from pathlib import Path
from typing import Dict, Tuple, Optional, List
import logging
from datetime import datetime
import random
import requests
import uuid
import os
import yaml
import base64

from ...utils.image_processing import ImageProcessor
from ...models.feature_extractor import VGG19FeatureExtractor
from ...models.style_transfer import StyleTransfer
from ...utils.quality_metrics import QualityMetrics

logger = logging.getLogger(__name__)

# --- Configuration Loading --- #
CONFIG_PATH = Path("config/config.yaml")
SERVICE_CONFIG = {}
if CONFIG_PATH.exists():
    try:
        with open(CONFIG_PATH, 'r') as f:
            SERVICE_CONFIG = yaml.safe_load(f)
        logger.info(f"Loaded configuration from {CONFIG_PATH}")
    except Exception as e:
        logger.error(f"Failed to load or parse {CONFIG_PATH}: {e}. Using defaults.")
else:
    logger.warning(f"Configuration file not found at {CONFIG_PATH}. Using defaults.")

# --- Configuration Values --- #
API_GATEWAY_URL = os.getenv("API_GATEWAY_URL", SERVICE_CONFIG.get('server', {}).get('api_gateway_url', "http://localhost:3002"))
STYLE_REFERENCE_COUNT = int(os.getenv("STYLE_REFERENCE_COUNT", SERVICE_CONFIG.get('model', {}).get('style_transfer', {}).get('num_reference_images', 3)))
# Style transfer tuning parameters
TUNING_CONFIG = SERVICE_CONFIG.get('tuning', {})
DEFAULT_CONTENT_WEIGHT = float(TUNING_CONFIG.get('content_weight', 1.0))
DEFAULT_STYLE_WEIGHT = float(TUNING_CONFIG.get('style_weight', 1.0e6))
DEFAULT_TV_WEIGHT = float(TUNING_CONFIG.get('tv_weight', 1.0e-6))
DEFAULT_NUM_STEPS = int(TUNING_CONFIG.get('num_steps', 300))
DEFAULT_CONTENT_LAYERS = TUNING_CONFIG.get('content_layers', ["conv4_2"])
DEFAULT_STYLE_LAYERS = TUNING_CONFIG.get('style_layers', ["conv1_1", "conv2_1", "conv3_1", "conv4_1", "conv5_1"])

# Define path for temporary downloads
TEMP_STYLE_DIR = Path(SERVICE_CONFIG.get('paths', {}).get('temp_storage', "temp/style_downloads"))
TEMP_STYLE_DIR.mkdir(parents=True, exist_ok=True)

# *** Add config for cloud test space URL ***
TEST_SPACE_URL = SERVICE_CONFIG.get('cloud_service', {}).get('TEST_SPACE_URL', "https://keras-io-neural-style-transfer.hf.space/run/predict")

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
                #thumbs are temporary!
                thumb_url = f"{url}?thumb=1"
                logger.info(f"Downloading style image {i+1}/{len(style_urls)} from {thumb_url} (thumbnail)")
                try:
                    response = requests.get(thumb_url, stream=True, timeout=30)
                    response.raise_for_status()

                    content_type = response.headers.get('content-type')
                    if not content_type or not content_type.startswith('image/'):
                        logger.warning(f"Skipping non-image URL: {thumb_url} (Content-Type: {content_type})")
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
        style_urls: List[str],
        output_path: Optional[Path],
        final_style_weight: float,
        final_content_weight: float,
        final_num_steps: int
    ) -> Dict:
        """Performs the style transfer using the local PyTorch implementation."""
        logger.info("Executing local transformation process.")
        temp_style_paths: List[Path] = []
        try:
            # 1. Download Style Images
            temp_style_paths = await self._download_style_images(style_urls)
            if not temp_style_paths:
                raise ValueError(f"Failed to download any valid style images for local processing.")

            # 2. Load and Process Images
            logger.info("Loading images for local processing")
            content_img, content_tensor = self.image_processor.load_image(str(content_path))
            style_tensors: List[torch.Tensor] = []
            for style_path in temp_style_paths:
                _, style_tensor = self.image_processor.load_image(str(style_path))
                style_tensors.append(style_tensor)
            if not style_tensors:
                raise RuntimeError("Failed to load any downloaded style images.")

            # 3. Perform Style Transfer
            logger.info("Starting local style transfer optimization")
            output_tensor, history = self.style_transfer.transfer_style(
                content_tensor,
                style_tensors,
                num_steps=final_num_steps,
                style_weight=final_style_weight,
                content_weight=final_content_weight
            )

            # 4. Post-process and Save Result
            output_image = self.image_processor.tensor_to_image(output_tensor)
            if output_path:
                logger.info(f"Saving local result to {output_path}")
                self.image_processor.save_image(output_image, str(output_path))

            # 5. Compute Quality Metrics
            logger.info("Computing local quality metrics")
            metrics = self.quality_metrics.assess_quality(
                content_tensor,
                style_tensors,
                output_tensor,
                self.feature_extractor,
                history
            )

            return {
                "status": "success",
                "metrics": metrics,
                "selected_style_urls": style_urls,
                "used_style_url": "Local Avg Method",
                "processing_mode": "local",
                "timestamp": datetime.now().isoformat()
            }
        finally:
            self._cleanup_temp_files(temp_style_paths)

    # --- CLOUD TRANSFORMATION LOGIC --- #
    async def _cloud_transform_keras_space(
        self,
        content_path: Path,
        style_urls: List[str],
        output_path: Optional[Path],
    ) -> Dict:
        """Performs style transfer using the keras-io Hugging Face Space API."""
        logger.info("Executing cloud transformation process (Keras Space)...")
        temp_style_paths: List[Path] = []
        space_api_url = TEST_SPACE_URL

        if not style_urls:
             raise ValueError("No style URLs provided for cloud processing.")

        try:
            # 1. Download *one* style image (API expects one)
            # Use the first URL, attempt download
            temp_style_paths = await self._download_style_images([style_urls[0]])
            if not temp_style_paths:
                 raise ValueError("Failed to download the primary style image for cloud processing.")
            primary_style_path = temp_style_paths[0]

            # 2. Prepare Payload (Base64 encode images)
            logger.info("Preparing payload for Keras Space API")
            try:
                content_bytes = content_path.read_bytes()
                style_bytes = primary_style_path.read_bytes()

                # Determine MIME type correctly
                content_mime = "image/jpeg" if content_path.suffix.lower() in [".jpg", ".jpeg"] else "image/png"
                style_mime = "image/jpeg" if primary_style_path.suffix.lower() in [".jpg", ".jpeg"] else "image/png"

                content_b64 = f"data:{content_mime};base64," + base64.b64encode(content_bytes).decode('utf-8')
                style_b64 = f"data:{style_mime};base64," + base64.b64encode(style_bytes).decode('utf-8')

                payload = {
                    "data": [
                        content_b64,
                        style_b64,
                    ]
                }
            except Exception as e:
                 logger.error(f"Error encoding images to Base64: {e}")
                 raise RuntimeError("Failed to prepare images for cloud API.")

            # 3. Call test Space API
            logger.info(f"Calling Keras Space API: {space_api_url}")
            # Note: No Authorization header in this space
            response = requests.post(space_api_url, json=payload, timeout=600)
            response.raise_for_status()

            # 4. Process Response
            result_data = response.json()
            output_b64_data = result_data.get("data", [None])[0]

            if not output_b64_data or not output_b64_data.startswith('data:image'):
                 logger.error(f"Invalid or missing image data in cloud API response: {result_data}")
                 raise RuntimeError(f"Invalid or missing image data in cloud API response.")

            # Decode base64 and save
            try:
                 img_metadata, img_data_str = output_b64_data.split(',', 1)
                 output_image_bytes = base64.b64decode(img_data_str)

                 if output_path:
                     logger.info(f"Saving cloud result to {output_path}")
                     with open(output_path, 'wb') as f:
                         f.write(output_image_bytes)
                 else: # Needed if we want to return bytes/PIL image later
                     pass

            except Exception as e:
                logger.error(f"Error decoding/saving base64 response: {e}")
                raise RuntimeError("Failed to process image data from cloud API.")

            # 5. Format Return Value
            return {
                "status": "success",
                "metrics": { "processing_duration_cloud": result_data.get("duration"),
                             "content_similarity": None,
                             "style_consistency_avg": None },
                "selected_style_urls": style_urls,
                "used_style_url": style_urls[0],
                "processing_mode": "cloud (Keras Space)",
                "timestamp": datetime.now().isoformat()
            }

        except requests.exceptions.RequestException as e:
            logger.error(f"Cloud API request failed: {e}")
            detail = str(e)
            if e.response is not None:
                 try:
                     detail = e.response.json()["error"]
                 except:
                     detail = e.response.text
            raise RuntimeError(f"Cloud service request failed: {detail}")
        except Exception as e:
            logger.error(f"Cloud transformation failed: {e}")
            raise RuntimeError(f"Cloud transformation process failed: {e}")
        finally:
            self._cleanup_temp_files(temp_style_paths)

    # --- Main Transformation Method --- #
    async def transform_image(
        self,
        content_path: Path,
        period_id: str,
        category_id: str,
        output_path: Optional[Path] = None,
        style_weight: Optional[float] = None,
        content_weight: Optional[float] = None,
        num_steps: Optional[int] = None,
        processing_mode: str = "local"
    ) -> Dict:
        """
        Transform a content image using a style selected by period and category.
        Dispatches to local or cloud processing based on the mode.
        Args:
            content_path: Path to content image
            period_id: ID of the selected historical period
            category_id: ID of the selected style category
            output_path: Optional path to save result
            style_weight: Optional override for style loss weight
            content_weight: Optional override for content loss weight
            num_steps: Optional override for number of optimization steps
            processing_mode: 'local' or 'cloud' to select the backend.

        Returns:
            Dictionary containing transformation results and metrics
        """
        final_style_weight = style_weight if style_weight is not None else DEFAULT_STYLE_WEIGHT
        final_content_weight = content_weight if content_weight is not None else DEFAULT_CONTENT_WEIGHT
        final_num_steps = num_steps if num_steps is not None else DEFAULT_NUM_STEPS

        try:
            # Fetch style URLs regardless of mode (cloud might still need one)
            logger.info(f"Fetching style reference URLs for period: {period_id}, category: {category_id}")
            style_urls = self._fetch_style_image_urls(period_id, category_id, STYLE_REFERENCE_COUNT)
            if not style_urls:
                raise ValueError(f"Could not find any style image URLs for period '{period_id}' and category '{category_id}'.")

            # Choose processing path based on mode
            if processing_mode == 'cloud':
                 cloud_config = SERVICE_CONFIG.get('cloud_service', {})
                 if not cloud_config.get('TEST_SPACE_URL'):
                      logger.error("Cloud processing selected, but Keras Space URL not configured in config.yaml")
                      raise ValueError("Cloud processing backend not configured.")

                 result = await self._cloud_transform_keras_space(
                      content_path,
                      style_urls,
                      output_path
                 )
            else:
                 # --- Local Processing --- #
                 result = await self._local_transform(
                     content_path,
                     style_urls,
                     output_path,
                     final_style_weight,
                     final_content_weight,
                     final_num_steps
                 )

            return result

        except Exception as e:
            logger.error(f"Transformation failed (mode: {processing_mode}): {str(e)}")
            raise RuntimeError(f"Image transformation failed: {str(e)}")

    def cleanup(self):
        """Clean up any temporary resources."""
        # Future use: clean up TEMP_STYLE_DIR on shutdown
        pass
