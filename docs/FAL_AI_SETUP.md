# Fal AI Setup Guide

This guide explains how to set up and use the Fal AI integration in Jaaz.

## Quick Setup

### 1. API Key Configuration

The easiest way to configure your Fal AI API key:

```bash
# Navigate to the server directory
cd server

# Create .env file with your API keys
cat > .env << 'EOF'
FAL_KEY=your_fal_ai_api_key_here
REPLICATE_API_TOKEN=your_replicate_api_token_here
OPENAI_API_KEY=your_openai_api_key_here
EOF
```

**Note:** Replace the placeholder values with your actual API keys.

### 2. Install Dependencies

```bash
# Make sure you're in the server directory with activated virtual environment
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Start the Server

```bash
python main.py
```

## Features Available

### Image Generation (7 Models)
- **FLUX.1 [dev]** - High-quality 12B parameter model
- **FLUX.1 Pro** - Enhanced version with 2K support
- **FLUX.1 Pro Ultra** - Up to 2K resolution with photorealism
- **Recraft V3** - SOTA with vector art capabilities
- **Stable Diffusion 3.5 Large** - Multimodal transformer
- **Ideogram V2** - Exceptional typography handling
- **HiDream I1** - 17B parameter fast generation

### Video Generation
- **Hailuo Image-to-Video** - Convert images to 6s or 10s videos

### Advanced Parameters
- **LoRA support** for FLUX models
- **Guidance scale** control
- **Inference steps** customization
- **Style parameters** for Recraft V3
- **Seed control** for reproducibility
- **Safety checker** options

## Usage Instructions

### Via UI Settings
1. Open Jaaz application
2. Go to Settings → Providers
3. Click "Add Provider"
4. Select "Fal AI" or "Replicate" from the dropdown
5. Your API keys will be automatically loaded from .env
6. Configure additional models if needed

**All three providers are now auto-configured:**
- **Fal AI:** 7 models + video generation
- **Replicate:** Additional models for variety
- **OpenAI:** DALL-E and GPT models

### Via Multi-Agent Workflow
1. Start a new chat session
2. Request image generation: "Create a professional logo design"
3. Request video generation: "Animate the logo with a smooth rotation"
4. The system will automatically use appropriate agents and models

## Configuration Priority

The system checks for API keys in this order:
1. **User Configuration** (via UI settings) - highest priority
2. **Environment Variables** (via .env file) - fallback
3. **Empty string** - if neither available

## Security Notes

- ✅ `.env` file is automatically ignored by git
- ✅ API keys are never committed to version control
- ✅ Environment variables are loaded securely
- ✅ Fallback system ensures flexibility

## Troubleshooting

### API Key Not Working
1. Check if `.env` file exists in `/server/` directory
2. Verify API key format: `key_id:secret_key`
3. Restart the server after changing .env
4. Check server logs for authentication errors

### Import Errors
1. Ensure `python-dotenv` is installed: `pip install python-dotenv`
2. Check virtual environment is activated
3. Verify all requirements are installed: `pip install -r requirements.txt`

### Video Generation Issues
1. Ensure you have an existing image in the canvas
2. Video generation requires an image as starting frame
3. Check that video model is selected in settings

## API Usage Examples

### Image Generation
```python
# Via Agent System
"Generate a futuristic cityscape with neon lights and flying cars"

# Advanced parameters automatically applied:
# - FLUX.1 [dev]: 28 inference steps, 3.5 guidance scale
# - Recraft V3: realistic_image style
# - Safety checker enabled
```

### Video Generation
```python
# Via Agent System (after generating an image)
"Animate this cityscape with moving traffic and pulsing neon lights"

# Automatically uses:
# - Hailuo Image-to-Video model
# - 6-second duration (customizable to 10s)
# - Professional motion prompts
```

## Getting Help

- Check the [Fal AI Integration Plan](./fal-ai-integration-plan.md) for technical details
- Review server logs for error messages
- Ensure your API key has sufficient credits
- Verify network connectivity to fal.run

## What's Next

The Fal AI integration is feature-complete and ready for production use. Enjoy creating with state-of-the-art AI models! 🎨✨