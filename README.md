# 🦄 Jaaz – AI Design Agent

[中文入门指南](https://mxnpt25l6k.feishu.cn/docx/LvcTdlVbFoRAZWxnhBYcqVydnpc)

AI design agent. Local and free alternative for Lovart. AI agent with ability to design, edit and generate images, posters, storyboards, etc. with a creative canvas board for fast iterations and layout publishing

<div align="center"> <a href="https://github.com/11cafe/localart/releases/latest/download/Jaaz-1.0.12-arm64.dmg"> <img src="https://user-images.githubusercontent.com/37590873/219133640-8b7a0179-20a7-4e02-8887-fbbd2eaad64b.png" alt="Download for macOS" width="300"/> </a> &nbsp;&nbsp; <a href="https://github.com/11cafe/localart/releases/latest/download/Jaaz-Setup-1.0.12.exe"> <img width="300" src="https://cdn.intheloop.io/wp-content/uploads/2020/08/windows-button.png" alt="Download for Windows" /> </a> </div>

<img width="900" alt="Screenshot 2025-06-02 at 3 51 56 AM" src="https://github.com/user-attachments/assets/5d8efe74-99b0-41bc-aa3e-6f7b92b69c36" />

<img width="900" alt="Screenshot 2025-06-02 at 3 03 49 PM" src="https://github.com/user-attachments/assets/6001af3a-2e2d-4bce-8112-7ee81cc75670" />
<img width="900" alt="Screenshot 2025-06-02 at 3 03 49 PM" src="https://github.com/user-attachments/assets/a1c949c4-d204-4976-9103-693180e5299d" />

## ✨ Key Features

- AI designer agent powered by LLM that can smartly write prompt and batch generate images or even a whole storyboard!
- Support Ollama for local LLM
- Support ComfyUI for free local image generations: Stable Diffusion, Flux Dev, etc.
- Edit images in conversation using Flux Kontext: object removal, style transfer, edit specific elements in image, consistent character generation etc. All through chat!
- Canvas and storyboard: unleash your creativity using our infinite canvas!
- [Upcoming] Video generations through Wan2.1, Kling, and video creation and editing agent

---

- Use Claude, OpenAI, Gemini via API key, or run locally with [Ollama](https://github.com/ollama/ollama) for **100% free** usage
- Use image generation models like **GPT-4O, Recraft, Flux, Google Imagen**, etc. through Replicate API key

---

## Usage

1. Add LLM API key like OpenAI or Claude, or install [Ollama](https://ollama.com/) to use local models
2. Add image generations API key like [Replicate](https://replicate.com/)

<img width="1485" alt="Screenshot 2025-06-02 at 3 08 51 PM" src="https://github.com/user-attachments/assets/80bf76b1-229b-4491-893e-3f5102062a37" />

3. Start chatting with agent to generate stories or storyboards!

<img width="1239" alt="Screenshot 2025-06-18 at 16 09 05" src="https://github.com/user-attachments/assets/eacee793-3bc4-4fa2-9e23-94efa1e1f087" />


## Cases

- Prompt: 帮我把这个角色放到 6 张不同的场景里，都是世界各地的地标建筑前，灯光和谐，他在世界各地拍照，写实，温暖的光线，高画质，画面比例 9:16

![814c563b08f6ef44de0c2c31f0fdd00b-min](https://github.com/user-attachments/assets/4e2634b3-9068-47cd-a18f-ddde8f218d25)

## API Providers

### Deepseek

To use deepseek as a provider, setup as below

<img width="900" alt="Screenshot 2025-06-10 at 12 05 35" src="https://github.com/user-attachments/assets/61cb1b87-065f-4376-b853-b0032d4d3be8" />

## Manual Install (For Linux or local builds)

First git clone this repo:

`git clone https://github.com/11cafe/localart`

`cd server`

`pip install -r requirements.txt`

`python main.py`

## Development

`cd react`

`npm install --force && npm run dev`

`cd server`

`pip install -r requirements.txt`

`python main.py`
