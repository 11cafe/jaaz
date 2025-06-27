from typing import Optional, Tuple
import os
import asyncio
import traceback
from .base import ImageGenerator, get_image_info_and_save, generate_image_id
from services.config_service import config_service, FILES_DIR
import fal_client

# Ensure environment variables are loaded
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not available, environment variables should be set externally


class FalAIGenerator(ImageGenerator):
    """Fal AI image generator implementation"""

    def __init__(self):
        """Initialize Fal AI generator with configuration"""
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
    
    def _get_size_from_aspect_ratio(self, aspect_ratio: str, model: str = ""):
        """Convert aspect ratio to Fal AI size format"""
        # Map aspect ratios to valid Fal AI size parameters
        aspect_map = {
            "1:1": "square_hd",      # 1024x1024
            "16:9": "landscape_16_9", # 1920x1080
            "9:16": "portrait_16_9",  # 1080x1920 (corrected from portrait_9_16)
            "4:3": "landscape_4_3",
            "3:4": "portrait_4_3"    # Use portrait_4_3 instead of invalid portrait_3_4
        }
        return aspect_map.get(aspect_ratio, "square_hd")
    
    def _prepare_model_specific_args(self, model: str, **kwargs):
        """Prepare model-specific arguments"""
        args = {}
        
        # FLUX models support
        if 'flux' in model.lower():
            # Inference steps (default: 28 for dev, 25 for pro)
            if 'num_inference_steps' in kwargs:
                args['num_inference_steps'] = int(kwargs['num_inference_steps'])
            elif 'dev' in model.lower():
                args['num_inference_steps'] = 28
            else:
                args['num_inference_steps'] = 25
                
            # Guidance scale (default: 3.5)
            if 'guidance_scale' in kwargs:
                args['guidance_scale'] = float(kwargs['guidance_scale'])
            else:
                args['guidance_scale'] = 3.5
                
            # LoRA support
            if 'lora_path' in kwargs and kwargs['lora_path']:
                args['lora_path'] = kwargs['lora_path']
            if 'lora_scale' in kwargs:
                args['lora_scale'] = float(kwargs['lora_scale'])
                
            # Seed for reproducibility
            if 'seed' in kwargs:
                args['seed'] = int(kwargs['seed'])
                
            # Safety checker
            if 'enable_safety_checker' in kwargs:
                args['enable_safety_checker'] = bool(kwargs['enable_safety_checker'])
            else:
                args['enable_safety_checker'] = True
                
        # Recraft V3 specific parameters
        elif 'recraft' in model.lower():
            if 'style' in kwargs:
                args['style'] = kwargs['style']  # realistic_image, digital_illustration, vector_illustration
            if 'substyle' in kwargs:
                args['substyle'] = kwargs['substyle']
            if 'colors' in kwargs:
                args['colors'] = kwargs['colors']  # Array of color names
                
        # Ideogram V2 parameters
        elif 'ideogram' in model.lower():
            if 'style_type' in kwargs:
                args['style_type'] = kwargs['style_type']  # AUTO, GENERAL, REALISTIC, DESIGN, RENDER_3D, ANIME
            if 'magic_prompt_option' in kwargs:
                args['magic_prompt_option'] = kwargs['magic_prompt_option']  # AUTO, ON, OFF
                
        # HiDream I1 parameters
        elif 'hidream' in model.lower():
            if 'steps' in kwargs:
                args['steps'] = int(kwargs['steps'])
            if 'cfg_scale' in kwargs:
                args['cfg_scale'] = float(kwargs['cfg_scale'])
                
        # Stable Diffusion 3.5 parameters
        elif 'stable-diffusion' in model.lower():
            if 'num_inference_steps' in kwargs:
                args['num_inference_steps'] = int(kwargs['num_inference_steps'])
            if 'guidance_scale' in kwargs:
                args['guidance_scale'] = float(kwargs['guidance_scale'])
            if 'seed' in kwargs:
                args['seed'] = int(kwargs['seed'])
                
        return args

    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_image: Optional[str] = None,
        **kwargs
    ) -> Tuple[str, int, int, str]:
        """Generate image using Fal AI API"""
        
        try:
            api_key = self._get_api_key()
            if not api_key:
                raise Exception("Fal AI API key not configured")
            
            # Set environment variable for fal_client
            os.environ['FAL_KEY'] = api_key
            
            # Prepare base arguments
            arguments = {
                "prompt": prompt,
                "image_size": self._get_size_from_aspect_ratio(aspect_ratio, model),
            }
            
            # Add model-specific parameters
            model_args = self._prepare_model_specific_args(model, **kwargs)
            arguments.update(model_args)
            
            # Add input image if provided
            if input_image:
                arguments["image_url"] = input_image
            
            # Prepare endpoint - remove fal/ prefix if present
            model_clean = model.replace('fal/', '')
            endpoint = f"fal-ai/{model_clean}"
            
            # Make API call with asyncio executor to handle blocking call
            result = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: self.client.subscribe(endpoint, arguments=arguments)
            )
            
            # Process result - handle different response formats
            image_url = None
            if 'images' in result and result['images']:
                image_url = result['images'][0]['url']
            elif 'image' in result:
                image_url = result['image']['url']
            else:
                raise Exception("No image URL in response")
            
            # Download and save image
            image_id = generate_image_id()
            mime_type, width, height, extension = await get_image_info_and_save(
                image_url, 
                os.path.join(FILES_DIR, f'{image_id}')
            )
            
            filename = f'{image_id}.{extension}'
            return mime_type, width, height, filename
            
        except Exception as e:
            print(f"Fal AI generation error: {str(e)}")
            traceback.print_exc()
            raise Exception(f"Fal AI generation failed: {str(e)}")