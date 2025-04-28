"""
Tests for the FastAPI application endpoints.
Tests both API functionality and integration with the AI pipeline.
"""

import pytest
from fastapi.testclient import TestClient
import httpx
from pathlib import Path
import io
import PIL.Image
import numpy as np
import json
import asyncio
from ..src.api.app import app

client = TestClient(app)

@pytest.fixture
def test_images():
    """Create test images for transformation testing."""
    content_image = PIL.Image.fromarray(
        (np.random.rand(64, 64, 3) * 255).astype(np.uint8)
    )

    style_image = PIL.Image.fromarray(
        (np.random.rand(64, 64, 3) * 255).astype(np.uint8)
    )

    content_bytes = io.BytesIO()
    style_bytes = io.BytesIO()
    content_image.save(content_bytes, format='JPEG')
    style_image.save(style_bytes, format='JPEG')
    content_bytes.seek(0)
    style_bytes.seek(0)

    return {
        'content': content_bytes,
        'style': style_bytes
    }

def test_health_check():
    """Test the health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "postcard-ai-transformer"
    assert "version" in data

def test_root_endpoint():
    """Test the root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "service" in data
    assert "description" in data
    assert "endpoints" in data
    assert all(endpoint in data["endpoints"] for endpoint in ["health", "transform", "styles"])

def test_transform_endpoint(test_images):
    """Test the image transformation endpoint."""
    files = {
        'content_image': ('content.jpg', test_images['content'], 'image/jpeg'),
        'style_image': ('style.jpg', test_images['style'], 'image/jpeg')
    }
    data = {
        'style_weight': 1e6,
        'content_weight': 1.0,
        'num_steps': 2  
    }

    response = client.post("/transform", files=files, data=data)
    assert response.status_code == 200

    data = response.json()
    assert "status" in data
    assert data["status"] == "success"
    assert "metrics" in data
    assert "history" in data
    assert "timestamp" in data
    assert "result_path" in data

    metrics = data["metrics"]
    assert "content_similarity" in metrics
    assert "style_consistency" in metrics
    assert isinstance(metrics["content_similarity"], float)
    assert isinstance(metrics["style_consistency"], float)

    history = data["history"]
    assert "content_loss" in history
    assert "style_loss" in history
    assert "total_loss" in history
    assert len(history["content_loss"]) == 2 

    process_id = Path(data["result_path"]).stem.split("_")[-1]
    result_response = client.get(f"/result/{process_id}")
    assert result_response.status_code == 200
    assert result_response.headers["content-type"] == "image/jpeg"

def test_transform_invalid_input():
    """Test transformation endpoint with invalid inputs."""
    response = client.post("/transform", files={}, data={})
    assert response.status_code == 422  

    files = {
        'content_image': ('test.txt', b'not an image', 'text/plain'),
        'style_image': ('test.txt', b'not an image', 'text/plain')
    }
    response = client.post("/transform", files=files)
    assert response.status_code == 500  

def test_result_not_found():
    """Test result endpoint with non-existent ID."""
    response = client.get("/result/nonexistent")
    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert data["detail"] == "Result not found"

@pytest.mark.asyncio
async def test_concurrent_requests(test_images):
    """Test handling of concurrent transformation requests."""
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        files = {
            'content_image': ('content.jpg', test_images['content'], 'image/jpeg'),
            'style_image': ('style.jpg', test_images['style'], 'image/jpeg')
        }
        data = {'num_steps': 2} 

        tasks = []
        for _ in range(3):  
            tasks.append(
                ac.post("/transform", files=files, data=data)
            )

        responses = await asyncio.gather(*tasks)

        for response in responses:
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            assert "metrics" in data
            assert "history" in data

def test_transform_parameters(test_images):
    """Test transformation with different parameter values."""
    files = {
        'content_image': ('content.jpg', test_images['content'], 'image/jpeg'),
        'style_image': ('style.jpg', test_images['style'], 'image/jpeg')
    }

    parameter_sets = [
        {'style_weight': 1e5, 'content_weight': 2.0, 'num_steps': 2},
        {'style_weight': 1e7, 'content_weight': 0.5, 'num_steps': 2}
    ]

    for params in parameter_sets:
        response = client.post("/transform", files=files, data=params)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"

        history = data["history"]
        assert len(history["content_loss"]) == params["num_steps"]
