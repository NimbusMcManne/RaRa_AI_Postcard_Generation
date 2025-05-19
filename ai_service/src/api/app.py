"""
FastAPI application for the AI style transfer service.
Provides endpoints for image transformation and service status.
"""

from fastapi import FastAPI, UploadFile, HTTPException, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import uvicorn
from pathlib import Path
import logging
import shutil
import uuid
from datetime import datetime
from typing import Optional

from .services.transform_service import TransformationService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Postcard AI Transformer",
    description="AI service for transforming modern photos into historical postcard styles",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("temp/uploads")
RESULT_DIR = Path("temp/results")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
RESULT_DIR.mkdir(parents=True, exist_ok=True)

transform_service = TransformationService()

@app.get("/health")
async def health_check():
    """
    Health check endpoint to verify service status.
    Returns basic service information and status.
    """
    return {
        "status": "healthy",
        "service": "postcard-ai-transformer",
        "version": "0.1.0"
    }

@app.get("/")
async def root():
    """
    Root endpoint providing service information.
    """
    return {
        "service": "Postcard AI Transformer",
        "description": "Transform modern photos into historical postcard styles",
        "endpoints": {
            "health": "/health",
            "transform": "/transform",
            "styles": "/styles"
        }
    }

@app.post("/transform")
async def transform_image(
    content_image: UploadFile = File(...),
    period_id: Optional[str] = Form(None),
    category_id: Optional[str] = Form(None),
    local_style_image_file: Optional[UploadFile] = File(None),
    style_weight: Optional[float] = Form(None),
    content_weight: Optional[float] = Form(None),
    num_steps: Optional[int] = Form(None),
    tv_weight: Optional[float] = Form(None),
    learning_rate: Optional[float] = Form(None),
    saturation_enabled: Optional[bool] = Form(None),
    saturation_factor: Optional[float] = Form(None),
    clahe_enabled: Optional[bool] = Form(None),
    clahe_clip_limit: Optional[float] = Form(None),
    usm_enabled: Optional[bool] = Form(None),
    usm_amount: Optional[float] = Form(None),
    processing_mode: str = Form("local"),
    ai_model_choice: str = Form("local_vgg"),
    style_blur: Optional[bool] = Form(None)
):
    """
    Transform a content image using either a selected archive style or a local test style.

    Handles dispatching to local or cloud processing based on parameters.
    """
    if not local_style_image_file and (not period_id or not category_id):
        raise HTTPException(
            status_code=422,
            detail="Either period_id/category_id or local_style_image_file must be provided."
        )
    if local_style_image_file and (period_id or category_id):
        raise HTTPException(
            status_code=422,
            detail="Provide EITHER period_id/category_id OR local_style_image_file, not both."
        )

    try:
        process_id = str(uuid.uuid4())
        content_path = UPLOAD_DIR / f"content_{process_id}.jpg"
        result_path = RESULT_DIR / f"result_{process_id}.jpg"

        logger.info("Saving uploaded content image")
        with content_path.open("wb") as f:
            shutil.copyfileobj(content_image.file, f)

        logger.info(f"Starting transformation for content: {content_path}")
        result = await transform_service.transform_image(
            content_path=content_path,
            period_id=period_id,
            category_id=category_id,
            local_style_image_file=local_style_image_file,
            output_path=result_path,
            style_weight=style_weight,
            content_weight=content_weight,
            num_steps=num_steps,
            tv_weight=tv_weight,
            learning_rate=learning_rate,
            saturation_enabled=saturation_enabled,
            saturation_factor=saturation_factor,
            clahe_enabled=clahe_enabled,
            clahe_clip_limit=clahe_clip_limit,
            usm_enabled=usm_enabled,
            usm_amount=usm_amount,
            processing_mode=processing_mode,
            ai_model_choice=ai_model_choice,
            style_blur=style_blur
        )

        result["result_path"] = str(result_path)
        result["result_id"] = process_id

        content_path.unlink()

        return JSONResponse(content=result)

    except Exception as e:
        logger.exception(f"Transformation failed: {str(e)}")
        if 'content_path' in locals() and content_path.exists():
            try:
                content_path.unlink()
            except OSError as unlink_err:
                logger.error(f"Error removing temp content file {content_path}: {unlink_err}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.get("/result/{process_id}")
async def get_result(process_id: str):
    """
    Retrieve a transformation result by its ID.

    Args:
        process_id: Unique process identifier

    Returns:
        Transformed image file
    """
    result_path = RESULT_DIR / f"result_{process_id}.jpg"
    if not result_path.exists():
        raise HTTPException(status_code=404, detail="Result not found")
    return FileResponse(result_path)

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
