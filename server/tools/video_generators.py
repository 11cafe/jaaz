from abc import ABC, abstractmethod
from typing import Tuple, Optional
import base64
import os
import asyncio
import traceback
from nanoid import generate
import aiofiles
from services.config_service import config_service, FILES_DIR
from utils.http_client import HttpClient
import fal_client

# Ensure environment variables are loaded
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not available, environment variables should be set externally


class VideoGenerator(ABC):
    """Abstract base class for video generators"""

    @abstractmethod
    async def generate_video(
        self,
        prompt: str,
        image_url: str,
        duration: str = "6",
        progress_callback=None,
        **kwargs
    ) -> Tuple[str, str, int]:
        """
        Generate a video and return metadata
        
        Args:
            prompt: Text prompt for video generation
            image_url: Input image URL for image-to-video generation
            duration: Video duration in seconds (e.g., "6", "10")
            progress_callback: Optional callback function for progress updates
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Tuple of (mime_type, filename, duration_seconds)
        """
        pass


async def download_and_save_video(video_url: str, file_path: str) -> Tuple[str, str]:
    """Download video from URL and save to local file"""
    async with HttpClient.create() as client:
        response = await client.get(video_url)
        video_content = response.content
    
    # Save the video file
    async with aiofiles.open(file_path, 'wb') as out_file:
        await out_file.write(video_content)
    
    print(f'🎬 Video saved to {file_path}')
    
    # Return mime type and filename
    filename = os.path.basename(file_path)
    return 'video/mp4', filename


def generate_video_id():
    """Generate unique video ID"""
    return 'vid_' + generate(size=8)


class FalAIVideoGenerator(VideoGenerator):
    """Fal AI video generator implementation"""

    def __init__(self):
        """Initialize Fal AI video generator"""
        self.client = fal_client
        self.base_url = "https://fal.run/"
        
    def _get_api_key(self):
        """Get API key from configuration or environment variable"""
        # First try to get from user configuration
        config_key = config_service.app_config.get('fal', {}).get('api_key', '')
        if config_key:
            return config_key
        
        # Fallback to environment variable
        env_key = os.environ.get('FAL_KEY', '')
        if env_key:
            return env_key
            
        return ''

    async def generate_video(
        self,
        prompt: str,
        image_url: str,
        duration: str = "6",
        progress_callback=None,
        **kwargs
    ) -> Tuple[str, str, int]:
        """Generate video using Fal AI Hailuo model"""
        
        try:
            # Progress: Starting
            if progress_callback:
                await progress_callback("🔧 Initializing video generation...")
            
            api_key = self._get_api_key()
            if not api_key:
                raise Exception("Fal AI API key not configured")
            
            # Set environment variable for fal_client
            os.environ['FAL_KEY'] = api_key
            
            # Progress: Preparing request
            if progress_callback:
                await progress_callback("📋 Preparing video generation request...")
            
            # Prepare arguments for Hailuo model
            arguments = {
                "prompt": prompt,
                "image_url": image_url,
                "duration": duration,
                "prompt_optimizer": kwargs.get('prompt_optimizer', True),
            }
            
            print(f"🎬 Fal AI arguments: prompt={prompt}, image_url={image_url[:100]}{'...' if len(image_url) > 100 else ''}, duration={duration}")
            
            # Progress: Submitting to AI
            if progress_callback:
                await progress_callback("🤖 Submitting to Fal AI (this may take 5-10 minutes)...")
            
            # Make API call with progress tracking
            endpoint = "fal-ai/minimax/hailuo-02/standard/image-to-video"
            
            # Use a wrapper to track progress during the blocking call
            async def track_generation():
                if progress_callback:
                    # Send periodic progress updates during generation
                    for i, message in enumerate([
                        "🎬 AI is analyzing your image...",
                        "🎨 AI is generating video frames...", 
                        "⚡ AI is processing motion...",
                        "🔄 AI is rendering video...",
                        "✨ Almost done, finalizing video..."
                    ]):
                        if i > 0:  # Don't wait before first message
                            await asyncio.sleep(60)  # Update every minute
                        await progress_callback(message)
            
            # Start progress tracking
            progress_task = None
            if progress_callback:
                progress_task = asyncio.create_task(track_generation())
            
            try:
                result = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self.client.subscribe(endpoint, arguments=arguments)
                )
            finally:
                if progress_task:
                    progress_task.cancel()
                    try:
                        await progress_task
                    except asyncio.CancelledError:
                        pass
            
            # Progress: Processing response
            if progress_callback:
                await progress_callback("🎉 Video generated! Downloading...")
            
            # Extract video URL from response
            if 'video' not in result or 'url' not in result['video']:
                raise Exception("No video URL in response")
            
            video_url = result['video']['url']
            video_id = generate_video_id()
            
            # Progress: Downloading
            if progress_callback:
                await progress_callback("⬇️ Downloading video file...")
            
            # Download and save video
            file_path = os.path.join(FILES_DIR, f'{video_id}.mp4')
            mime_type, filename = await download_and_save_video(video_url, file_path)
            
            # Progress: Complete
            if progress_callback:
                await progress_callback("✅ Video ready! Adding to canvas...")
            
            return mime_type, filename, int(duration)
            
        except Exception as e:
            print(f"Fal AI video generation error: {str(e)}")
            traceback.print_exc()
            raise Exception(f"Video generation failed: {str(e)}")


# Initialize video provider instances
VIDEO_PROVIDERS = {
    'fal': FalAIVideoGenerator(),
}