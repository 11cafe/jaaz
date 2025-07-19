<h1 align="center">
  <a href="https://jaaz.app" target="_blank"> Jaaz.app</a>
  <p align="center">The World's First Open source AI Design Agent</p>
  <p align="center">Canva + Manus Local Version</p>

</h2>
[中文入门指南](https://mxnpt25l6k.feishu.cn/docx/LvcTdlVbFoRAZWxnhBYcqVydnpc)

The world's first open-source multimodal creative agent, a creative tool that prioritizes privacy, local usage, and ease of use, as an alternative to Lovart, Manus and Figma.

[Join our Discord](https://discord.gg/dS7kuT66wc) to get latest updates!

<div align="center"> <a href="https://jaaz.app/api/downloads/mac-latest"> <img src="https://user-images.githubusercontent.com/37590873/219133640-8b7a0179-20a7-4e02-8887-fbbd2eaad64b.png" alt="Download for macOS" width="300"/> </a> &nbsp;&nbsp; <a href="https://jaaz.app/api/downloads/windows-latest"> <img width="300" src="https://cdn.intheloop.io/wp-content/uploads/2020/08/windows-button.png" alt="Download for Windows" /> </a> </div>

## ✨ Getting started & staying tuned with us.

Star us, and you will receive all release notifications from GitHub without any delay!
<img width="900" alt="Screenshot 2025-06-02 at 3 03 49 PM" src="https://github.com/user-attachments/assets/1c9a3661-80a4-4fba-a30f-f469898b0aec" />

## ✨ Key Features

Smart Prompt Agent
Powered by LLMs, Jaaz can interpret your ideas and generate optimized prompts for high-quality image or storyboard creation.

Hybrid Model Deployment
Works with local models via Ollama, ComfyUI, and remote APIs like Replicate, OpenAI, or Claude. Run 100% locally or connect to the cloud.

Simply access all the strongest apis
After logging in, you can use all the latest models (gpt-image-1,flux kntext,google……)

Interactive Image Editing
Supports advanced operations such as object insertion, style transfer, and multi-character coherence via Flux Kontext — all controllable via chat.

Infinite Canvas & Storyboarding
Design layouts, plan scenes, and create visual storytelling flows with drag-and-drop simplicity.

(Coming Soon)
Video Agent：Video generation and editing via models like Wan2.1, Kling, and more, seamlessly integrated with your creative workflow.
Intelligently invoke custom comfyui workflows

---

- Use Claude, OpenAI, Gemini via API key, or run locally with [Ollama](https://github.com/ollama/ollama) for **100% free** usage
- Use image generation models like **GPT-4O, Recraft, Flux, Google Imagen**, etc. through Replicate API key

---

## Usage

1. Click on the "Log in" button at the top right corner of the program's home page, and then you can use the apis of each model. By paying a low price, you can smoothly use the API models

<img width="400" alt="Screenshot 2025-06-02 at 3 08 51 PM" src="https://github.com/user-attachments/assets/0055557d-c247-4801-ac3f-01ed4fa775ae" />

2. You can also customize the binding API,Add LLM API key like OpenAI or Claude, or install [Ollama](https://ollama.com/) to use local models
3. Add image generations API key like [Replicate](https://replicate.com/)

<img width="1485" alt="Screenshot 2025-06-02 at 3 08 51 PM" src="https://github.com/user-attachments/assets/80bf76b1-229b-4491-893e-3f5102062a37" />

4. Start chatting with agent to generate stories or storyboards!

<img width="900" alt="Screenshot 2025-06-18 at 16 09 05" src="https://github.com/user-attachments/assets/eacee793-3bc4-4fa2-9e23-94efa1e1f087" />

## Cases

- Prompt: Help me place this character in six different scenes, all in front of landmark buildings from around the world. The lighting is harmonious. He takes photos from all over the world, realistic, with warm light, high picture quality, and a picture ratio of 9:16

![814c563b08f6ef44de0c2c31f0fdd00b-min](https://github.com/user-attachments/assets/4e2634b3-9068-47cd-a18f-ddde8f218d25)

<img width="1000" alt="Screenshot 2025-06-02 at 3 51 56 AM" src="https://github.com/user-attachments/assets/5d8efe74-99b0-41bc-aa3e-6f7b92b69c36" />
<img width="900" alt="Screenshot 2025-06-02 at 3 51 56 AM" src="https://github.com/user-attachments/assets/56a15432-65ff-4e71-a2f2-4f159ffb304a" />

<img width="900" alt="Screenshot 2025-06-02 at 3 51 56 AM" src="https://github.com/user-attachments/assets/186982a9-5e4e-4ac1-a42c-c840092fd616" />

<img width="900" alt="Screenshot 2025-06-02 at 3 03 49 PM" src="https://github.com/user-attachments/assets/b8508efd-def8-40ed-8ab5-62ed3c26de67" />
<img width="1000" alt="Screenshot 2025-06-02 at 3 03 49 PM" src="https://github.com/user-attachments/assets/6001af3a-2e2d-4bce-8112-7ee81cc75670" />

## API Providers

### Deepseek

To use deepseek as a provider, setup as below

<img width="900" alt="Screenshot 2025-06-10 at 12 05 35" src="https://github.com/user-attachments/assets/61cb1b87-065f-4376-b853-b0032d4d3be8" />

## Manual Install (For Linux or local builds)

🟠 **Need Python version >=3.12**

First git clone this repo:

`git clone https://github.com/11cafe/localart`

`cd react`

`npm install --force`

`npx vite build`

`cd ../server`

`pip install -r requirements.txt`

`python main.py`

## Development

🟠 **Need Python version >=3.12**

VSCode/Cursor Install Extensions：

- Black Formatter by ms-python (ms-python.black-formatter)

`cd react`

`npm install --force && npm run dev`

`cd server`

`pip install -r requirements.txt`

`python main.py`
