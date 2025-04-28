"""
Manual test script for the AI transformation service.
Provides a simple way to test the API with real images.
"""

import requests
import argparse
from pathlib import Path
import json
import time

def test_transformation(content_path: str, style_path: str, output_path: str):
    """
    Test the transformation service with real images.

    Args:
        content_path: Path to content image
        style_path: Path to style image
        output_path: Path to save the result
    """
    base_url = "http://localhost:8000"

    print("Checking service health...")
    health_response = requests.get(f"{base_url}/health")
    if health_response.status_code != 200:
        print("Service is not healthy!")
        return
    print("Service is healthy")

    print(f"\nPreparing to transform {content_path} with style from {style_path}")
    files = {
        'content_image': ('content.jpg', open(content_path, 'rb'), 'image/jpeg'),
        'style_image': ('style.jpg', open(style_path, 'rb'), 'image/jpeg')
    }

    data = {
        'style_weight': 1e6,
        'content_weight': 1.0,
        'num_steps': 300
    }

    print("\nSending transformation request...")
    start_time = time.time()
    response = requests.post(f"{base_url}/transform", files=files, data=data)

    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        print(response.text)
        return

    result = response.json()
    process_time = time.time() - start_time
    print(f"\nTransformation completed in {process_time:.2f} seconds")

    print("\nQuality Metrics:")
    metrics = result['metrics']
    print(f"Content Similarity: {metrics['content_similarity']:.3f}")
    print(f"Style Consistency: {metrics['style_consistency']:.3f}")

    process_id = Path(result["result_path"]).stem.split("_")[-1]
    image_response = requests.get(f"{base_url}/result/{process_id}")

    if image_response.status_code == 200:
        with open(output_path, 'wb') as f:
            f.write(image_response.content)
        print(f"\nResult saved to {output_path}")

        metrics_path = Path(output_path).with_suffix('.json')
        with open(metrics_path, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"Metrics saved to {metrics_path}")
    else:
        print("Error retrieving result image")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test the AI transformation service")
    parser.add_argument("content", help="Path to content image")
    parser.add_argument("style", help="Path to style image")
    parser.add_argument("output", help="Path to save the result")

    args = parser.parse_args()
    test_transformation(args.content, args.style, args.output)
