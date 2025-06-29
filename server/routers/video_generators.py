# server/routers/video_generators.py
from nanoid import generate
from utils.http_client import HttpClient
import traceback

import aiofiles
import httpx
import mimetypes
import os
from io import BytesIO

from pymediainfo import MediaInfo

# services
from services.config_service import config_service
from services.config_service import FILES_DIR

import asyncio


async def get_video_info_and_save(url, file_path_without_extension):
    # Fetch the video asynchronously
    async with HttpClient.create() as client:
        response = await client.get(url)
        video_content = response.content

    # Save to temporary mp4 file first
    temp_path = f"{file_path_without_extension}.mp4"
    async with aiofiles.open(temp_path, "wb") as out_file:
        await out_file.write(video_content)
    print("🎥 Video saved to", temp_path)

    try:
        media_info = MediaInfo.parse(temp_path)
        for track in media_info.tracks:
            if track.track_type == "Video":
                width = track.width
                height = track.height
                print(f"Width: {width}, Height: {height}")

        extension = "mp4"  # 默认使用 mp4，实际情况可以根据 codec_name 灵活判断

        # Get mime type
        mime_type = mimetypes.types_map.get(".mp4", "video/mp4")

        print(
            f"🎥 Video info - width: {width}, height: {height}, mime_type: {mime_type}, extension: {extension}"
        )

        return mime_type, width, height, extension
    except Exception as e:
        print(f"Error probing video file {temp_path}: {str(e)}")
        raise e


async def generate_video_replicate(prompt, model, aspect_ratio):
    try:
        api_key = config_service.app_config.get("replicate", {}).get("api_key", "")
        if not api_key:
            raise ValueError("Video generation failed: Replicate API key is not set")

        url = f"https://api.replicate.com/v1/models/{model}/predictions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        # Prepare input
        data = {
            "input": {
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
            }
        }

        async with HttpClient.create() as client:
            # Step 1: Initial POST request
            response = await client.post(url, headers=headers, json=data)
            res = response.json()

            prediction_id = res.get("id")
            status = res.get("status")
            print(f"🎥 Initial prediction status: {status}, id: {prediction_id}")

            if not prediction_id:
                print("🎥 Full Replicate response:", res)
                raise Exception("Replicate API returned no prediction id")

            # Step 2: Polling loop
            polling_url = f"https://api.replicate.com/v1/predictions/{prediction_id}"

            while status not in ("succeeded", "failed", "canceled"):
                print(
                    f"🎥 Polling prediction {prediction_id}, current status: {status} ..."
                )
                await asyncio.sleep(3)  # Wait 3 seconds between polls

                poll_response = await client.get(polling_url, headers=headers)
                poll_res = poll_response.json()

                status = poll_res.get("status")
                output = poll_res.get("output", None)

            # Step 3: Final check
            if status != "succeeded" or not output or not isinstance(output, str):
                detail_error = poll_res.get(
                    "detail", f"Prediction failed with status: {status}"
                )
                raise Exception(f"Replicate video generation failed: {detail_error}")

            print(f"🎥 Prediction succeeded, output url: {output}")

            video_id = "vi_" + generate(size=8)

            # Now download and get video info
            mime_type, width, height, extension = await get_video_info_and_save(
                output, os.path.join(FILES_DIR, f"{video_id}")
            )
            filename = f"{video_id}.{extension}"

            return mime_type, width, height, filename

    except Exception as e:
        print("Error generating video with replicate", e)
        traceback.print_exc()
        raise e
