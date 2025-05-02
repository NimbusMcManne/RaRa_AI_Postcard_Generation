"""
Manual test script for the AI transformation service.
Provides a simple way to test the API with real images.
"""

import requests
import argparse
from pathlib import Path
import json
import time

def run_manual_transformation(content_path: str, period_id: str, category_id: str, output_path: str):
    """
    Test the transformation service using period and category IDs.

    Args:
        content_path: Path to content image
        period_id: ID of the selected period
        category_id: ID of the selected category
        output_path: Path to save the result
    """
    base_url = "http://localhost:8000"

    print("Checking service health...")
    try:
        health_response = requests.get(f"{base_url}/health", timeout=5)
        health_response.raise_for_status()
        print("Service is healthy")
    except requests.exceptions.RequestException as e:
        print(f"Service is not healthy or unreachable: {e}")
        return

    print(f"\nPreparing to transform {content_path} with style from {period_id} / {category_id}")
    try:
        files = {
            'content_image': ('content.jpg', open(content_path, 'rb'), 'image/jpeg'),
        }
        data = {
            'period_id': period_id,
            'category_id': category_id
            # Add optional tuning parameters here if needed, like:
            # 'style_weight': 1e5,
            # 'num_steps': 200
        }
    except FileNotFoundError:
         print(f"Error: Content image not found at {content_path}")
         return

    print("\nSending transformation request...")
    start_time = time.time()
    try:
        response = requests.post(f"{base_url}/transform", files=files, data=data, timeout=600)
        response.raise_for_status()

    except requests.exceptions.Timeout:
         print("\nError: Transformation request timed out (maybe processing is too long?)")
         return
    except requests.exceptions.RequestException as e:
        print(f"\nError during transformation request: {e}")
        if e.response is not None:
            print(f"Response Status: {e.response.status_code}")
            try:
                 print(f"Response Body: {e.response.json()}")
            except json.JSONDecodeError:
                 print(f"Response Body: {e.response.text}")
        return
    finally:
        files['content_image'][1].close()

    try:
        result = response.json()
        process_time = time.time() - start_time
        print(f"\nTransformation completed in {process_time:.2f} seconds")

        print("\nQuality Metrics:")
        metrics = result.get('metrics', {})
        print(f"  Content Similarity: {metrics.get('content_similarity', 'N/A'):.3f}")
        print(f"  Style Consistency Avg: {metrics.get('style_consistency_avg', 'N/A'):.3f}")
        print(f"Selected Style URLs: {result.get('selected_style_urls', [])}")
        print(f"Used Style URL (if applicable): {result.get('used_style_url', 'N/A')}")

        process_id = result.get("result_id")
        if process_id:
            image_response = requests.get(f"{base_url}/result/{process_id}", timeout=60)
            image_response.raise_for_status()

            with open(output_path, 'wb') as f:
                f.write(image_response.content)
            print(f"\nResult saved to {output_path}")

            metrics_path = Path(output_path).with_suffix('.json')
            with open(metrics_path, 'w') as f:
                json.dump(result, f, indent=2)
            print(f"Metrics saved to {metrics_path}")
        else:
            print("Error: Result ID not found in response.")

    except json.JSONDecodeError:
        print("Error: Could not decode JSON response from server.")
        print(f"Response Text: {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"Error retrieving result image: {e}")
        if e.response is not None:
             print(f"Response Status: {e.response.status_code}")
             print(f"Response Body: {e.response.text}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test the AI transformation service using period/category IDs")
    parser.add_argument("content", help="Path to content image")
    parser.add_argument("period_id", help="ID of the style period (e.g., 1906_1917)")
    parser.add_argument("category_id", help="ID of the style category (e.g., drawn_scenery)")
    parser.add_argument("output", help="Path to save the result image (e.g., result.jpg)")

    args = parser.parse_args()
    run_manual_transformation(args.content, args.period_id, args.category_id, args.output)
