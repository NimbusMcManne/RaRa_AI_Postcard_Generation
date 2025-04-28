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
    style_image: UploadFile = File(...),
    style_weight: float = Form(1e6),
    content_weight: float = Form(1.0),
    num_steps: int = Form(300)
):
    """
    Transform a content image using the style of another image.

    Args:
        content_image: Content image file
        style_image: Style image file
        style_weight: Weight for style loss
        content_weight: Weight for content loss
        num_steps: Number of optimization steps

    Returns:
        JSON response with transformation results and output image path
    """
    try:
        process_id = str(uuid.uuid4())
        content_path = UPLOAD_DIR / f"content_{process_id}.jpg"
        style_path = UPLOAD_DIR / f"style_{process_id}.jpg"
        result_path = RESULT_DIR / f"result_{process_id}.jpg"

        logger.info("Saving uploaded files")
        with content_path.open("wb") as f:
            shutil.copyfileobj(content_image.file, f)
        with style_path.open("wb") as f:
            shutil.copyfileobj(style_image.file, f)

        logger.info("Starting transformation")
        result = await transform_service.transform_image(
            content_path=content_path,
            style_path=style_path,
            output_path=result_path,
            style_weight=style_weight,
            content_weight=content_weight,
            num_steps=num_steps
        )

        result["result_path"] = str(result_path)

        content_path.unlink()
        style_path.unlink()

        return JSONResponse(content=result)

    except Exception as e:
        logger.error(f"Transformation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
