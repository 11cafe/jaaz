# 🦄 Jaaz –⭐Open source AI Design Agent⭐
[![GitHub stars](https://img.shields.io/github/stars/11cafe/jaaz?style=social)](https://github.com/11cafe/jaaz/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/11cafe/jaaz?include_prereleases&label=latest)](https://github.com/11cafe/jaaz/releases)
[![Downloads](https://img.shields.io/github/downloads/11cafe/jaaz/total?color=blue&label=downloads)](https://github.com/11cafe/jaaz/releases)
[![Issues](https://img.shields.io/github/issues/11cafe/jaaz)](https://github.com/11cafe/jaaz/issues)

https://jaaz.app/

[🇨🇳 中文入门指南](https://mxnpt25l6k.feishu.cn/docx/LvcTdlVbFoRAZWxnhBYcqVydnpc)

> **Jaaz** is the world’s first fully open-source, locally deployed creative AI design tool.
> Generate & edit images, build infinite storyboards, or mass-produce stunning visuals — all through a smart conversational agent.
> Supports both local models and top cloud APIs, plus intelligent one-click batch creation.

---

<div align="center"> <a href="https://github.com/11cafe/jaaz/releases/download/v1.0.15/Jaaz-1.0.15-arm64.dmg"> <img src="https://user-images.githubusercontent.com/37590873/219133640-8b7a0179-20a7-4e02-8887-fbbd2eaad64b.png" alt="Download for macOS" width="300"/> </a> &nbsp;&nbsp; <a href="https://github.com/11cafe/jaaz/releases/download/v1.0.15/Jaaz-Setup-1.0.15.exe"> <img width="300" src="https://cdn.intheloop.io/wp-content/uploads/2020/08/windows-button.png" alt="Download for Windows" /> </a> </div>

---

## 🚀 Features at a Glance

✅ **Smart Prompt Agent**
Chat with an AI that understands your creative goals, writing optimal prompts to generate high-quality images, layouts, or storyboards.

✅ **Hybrid Model Deployment**

* Run 100% locally with [Ollama](https://github.com/ollama/ollama), ComfyUI
* Or seamlessly tap into cloud APIs (OpenAI, Claude, Google, Replicate).

✅ **Interactive Image Editing**
Add or remove objects, adjust styles, or ensure multiple characters match — controlled directly in natural language.

✅ **Infinite Canvas & Storyboarding**
Build complex storyboards, layouts, or scene flows with an intuitive drag-and-drop canvas.

✅ **Cutting-Edge Models & APIs**
Use Claude, GPT-4O, Recraft, Flux Kontext, Google Imagen and more. Mix local + cloud models for flexibility and cost efficiency.

✅ **Upcoming: Video Agent**
Generate & edit videos with models like Wan2.1, Kling — all tied into the same creative workflow.

---


## 🖼️ Showcases

### ✏️ Example: World Landmark Tour

**Prompt:**

> “Help me place this character in six different scenes, all in front of landmark buildings from around the world. The lighting is harmonious. He takes photos from all over the world, realistic, with warm light, high picture quality, and a picture ratio of 9:16”

![example](https://github.com/user-attachments/assets/4e2634b3-9068-47cd-a18f-ddde8f218d25)

<img width="900" alt="Screenshot 2025-06-02 at 3 51 56 AM" src="https://github.com/user-attachments/assets/56a15432-65ff-4e71-a2f2-4f159ffb304a" />

<img width="900" alt="Screenshot 2025-06-02 at 3 51 56 AM" src="https://github.com/user-attachments/assets/186982a9-5e4e-4ac1-a42c-c840092fd616" />

<img width="900" alt="Screenshot 2025-06-02 at 3 03 49 PM" src="https://github.com/user-attachments/assets/b8508efd-def8-40ed-8ab5-62ed3c26de67" />

<img width="1000" alt="Screenshot 2025-06-02 at 3 51 56 AM" src="https://github.com/user-attachments/assets/5d8efe74-99b0-41bc-aa3e-6f7b92b69c36" />

<img width="1000" alt="Screenshot 2025-06-02 at 3 03 49 PM" src="https://github.com/user-attachments/assets/6001af3a-2e2d-4bce-8112-7ee81cc75670" />

---

## ⚙️ Usage Guide
1. **Log in:**
   Click the `Login` button on the top right of the app to unlock all available API integrations. A small payment gives you smooth access to high-quality models.

<img width="400" alt="Screenshot 2025-06-02 at 3 08 51 PM" src="https://github.com/user-attachments/assets/0055557d-c247-4801-ac3f-01ed4fa775ae" />

2. You can also **customize** the binding API, add LLM API key like OpenAI or Claude, or install [Ollama](https://ollama.com/) to use local models
3. Add image generations API key like [Replicate](https://replicate.com/)

<img width="1485" alt="Screenshot 2025-06-02 at 3 08 51 PM" src="https://github.com/user-attachments/assets/80bf76b1-229b-4491-893e-3f5102062a37" />

4. Start chatting with agent to generate stories or storyboards!

<img width="900" alt="Screenshot 2025-06-18 at 16 09 05" src="https://github.com/user-attachments/assets/eacee793-3bc4-4fa2-9e23-94efa1e1f087" />

---

## 🔌 Supported Providers

| Provider      | Models Supported                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ollama**    | `qwen`                                                                                                                                                   |
| **OpenAI**    | `GPT-4o`, `gpt-4o-mini`, `GPT-Image-1`                                                                                                                   |
| **Anthropic** | `claude-3-7-sonnet-latest`                                                                                                                               |
| **Replicate** | `google/imagen-4`, `black-forest-labs/flux-1.1-pro`, `black-forest-labs/flux-kontext-pro`, `black-forest-labs/flux-kontext-max`, `recraft-ai/recraft-v3` |

✨ **Note:** You can also easily add other providers—such as Deepseek and Kimi—directly from the Settings page.


### ✅ DeepSeek Setup

<img width="900" alt="Screenshot 2025-06-10 at 12 05 35" src="https://github.com/user-attachments/assets/61cb1b87-065f-4376-b853-b0032d4d3be8" />

---
## 🚀 Manual Install

For Linux or if you’d like to run everything locally:

```bash
git clone https://github.com/11cafe/localart
cd server
pip install -r requirements.txt
python main.py
```

Frontend:

```bash
cd react
npm install --force
npm run dev
```

---

## 🛠 Development

Contribute or customize:

```bash
# Frontend (React)
cd react
npm install --force
npm run dev

# Backend (FastAPI / Python)
cd server
pip install -r requirements.txt
python main.py
```

---

## ⭐ Stay Updated

- 🌟 **Star Jaaz on GitHub** to get notified about new releases and features!

<img width="426" alt="Screenshot 2025-06-10 at 12 05 35" src="https://github.com/user-attachments/assets/e8779c10-dffd-46c3-bce6-88051cdc6c5e" />

- 💬 Join our discussions on issues or pull requests — contributions are welcome.

---

✅ **Ready to unleash your imagination?**
Download Jaaz for [macOS](https://github.com/11cafe/jaaz/releases/download/v1.0.15/Jaaz-1.0.15-arm64.dmg) or [Windows](https://github.com/11cafe/jaaz/releases/download/v1.0.15/Jaaz-Setup-1.0.15.exe) and start creating today!
