import type { LLMConfig } from '@/types/types'

export const PROVIDER_NAME_MAPPING: {
  [key: string]: { name: string; icon: string }
} = {
  anthropic: {
    name: 'Claude',
    icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/claude-color.png',
  },
  openai: { name: 'OpenAI', icon: 'https://openai.com/favicon.ico' },
  replicate: {
    name: 'Replicate',
    icon: 'https://images.seeklogo.com/logo-png/61/1/replicate-icon-logo-png_seeklogo-611690.png',
  },
  ollama: {
    name: 'Ollama',
    icon: 'https://images.seeklogo.com/logo-png/59/1/ollama-logo-png_seeklogo-593420.png',
  },
  huggingface: {
    name: 'Hugging Face',
    icon: 'https://huggingface.co/favicon.ico',
  },
  wavespeed: {
    name: 'WaveSpeedAi',
    icon: 'https://www.wavespeed.ai/favicon.ico',
  },
}
export const DEFAULT_CONFIG: { [key: string]: LLMConfig } = {
  anthropic: {
    models: {
      'claude-3-7-sonnet-latest': { type: 'text' },
    },
    url: 'https://api.anthropic.com/v1/',
    api_key: '',
    max_tokens: 8192,
  },
  openai: {
    models: {
      'gpt-4o': { type: 'text' },
      'gpt-4o-mini': { type: 'text' },
    },
    url: 'https://api.openai.com/v1/',
    api_key: '',
    max_tokens: 8192,
  },
  replicate: {
    models: {
      'google/imagen-4': { type: 'image' },
      'black-forest-labs/flux-1.1-pro': { type: 'image' },
      'black-forest-labs/flux-kontext-pro': { type: 'image' },
      'black-forest-labs/flux-kontext-max': { type: 'image' },
      'recraft-ai/recraft-v3': { type: 'image' },
      'stability-ai/sdxl': { type: 'image' },
    },
    url: 'https://api.replicate.com/v1/',
    api_key: '',
    max_tokens: 8192,
  },
  wavespeed: {
    models: {
      'wavespeed-ai/flux-dev': { type: 'image' },
    },
    url: 'https://api.wavespeed.ai/',
    api_key: '',
  },
  // huggingface: {
  //   models: {
  //     "dreamlike-art/dreamlike-photoreal-2.0": { type: "image" },
  //   },
  //   url: "https://api.replicate.com/v1/",
  //   api_key: "",
  // },
  ollama: {
    models: {},
    url: 'http://localhost:11434',
    api_key: '',
    max_tokens: 8192,
  },
}

export const PLATFORMS_CONFIG = [
  {
    id: 'bilibili',
    name: 'Bilibili',
    icon: 'https://www.bilibili.com/favicon.ico',
    checked: true,
  },
  {
    id: 'xiaohongshu',
    name: '小红书',
    icon: 'https://www.xiaohongshu.com/favicon.ico',
    checked: true,
  },
  {
    id: 'douyin',
    name: '抖音',
    icon: 'https://www.tiktok.com/favicon.ico',
    checked: true,
  },
  {
    id: 'weixin_channels',
    name: '微信视频号',
    icon: 'https://res.wx.qq.com/t/wx_fed/finder/helper/finder-helper-web/res/favicon-v2.ico',
    checked: true,
  },
  {
    id: 'x',
    name: 'X',
    icon: 'https://www.x.com/favicon.ico',
    checked: true,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: 'https://www.youtube.com/favicon.ico',
    checked: true,
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: 'https://www.instagram.com/static/images/ico/favicon-192.png/68d99ba29cc8.png',
    checked: true,
  },
  {
    id: 'medium',
    name: 'Medium',
    icon: 'https://miro.medium.com/v2/resize:fit:1400/0*zPzAcHbkOUmfNnuB.jpeg',
    checked: true,
  },
  {
    id: 'devto',
    name: 'DEV.to',
    icon: 'https://d2fltix0v2e0sb.cloudfront.net/dev-badge.svg',
    checked: true,
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: 'https://www.facebook.com/images/fb_icon_325x325.png',
    checked: true,
  },
  {
    id: 'producthunt',
    name: 'Product Hunt',
    icon: 'https://cdn.iconscout.com/icon/free/png-256/free-producthunt-logo-icon-download-in-svg-png-gif-file-formats--70-flat-social-icons-color-pack-logos-432534.png?f=webp',
    checked: true,
  },
]
