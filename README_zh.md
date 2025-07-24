<h1 align="center">
  <a href="https://jaaz.app" target="_blank"> Jaaz.app</a>
  <p align="center">世界上首个开源人工智能设计代理</p>
  <p align="center">本地版Canva + Manus</p>

</h2>
[中文入门指南](https://mxnpt25l6k.feishu.cn/docx/LvcTdlVbFoRAZWxnhBYcqVydnpc)

世界上首个开源多模态创意代理，这是一款注重隐私、本地使用和易用性的创意工具， Lovart、Manus 和 Figma 的结合产品。

[Join our Discord](https://discord.gg/dS7kuT66wc) to get latest updates!

<div align="center"> <a href="https://jaaz.app/api/downloads/mac-latest"> <img src="https://user-images.githubusercontent.com/37590873/219133640-8b7a0179-20a7-4e02-8887-fbbd2eaad64b.png" alt="Download for macOS" width="300"/> </a> &nbsp;&nbsp; <a href="https://jaaz.app/api/downloads/windows-latest"> <img width="300" src="https://cdn.intheloop.io/wp-content/uploads/2020/08/windows-button.png" alt="Download for Windows" /> </a> </div>

## ✨保持关注

给我们点个 Star，你将能第一时间从 GitHub 收到所有新版本的发布通知！
<img width="900" alt="Screenshot 2025-06-02 at 3 03 49 PM" src="https://github.com/user-attachments/assets/1c9a3661-80a4-4fba-a30f-f469898b0aec" />

## ✨主要功能

智能提示词代理
由大语言模型（LLM）驱动，Jaaz 能理解你的想法并生成优化的提示词，用于创作高质量的图像或故事板。

混合模型部署
支持通过 Ollama、ComfyUI 运行本地模型，也支持 Replicate、OpenAI 或 Claude 等远程 API。可实现 100% 本地运行或连接到云端。

轻松接入所有最强 API
登录后，你可以使用所有最新的模型（gpt-image-1, flux kntext, google……）。

交互式图像编辑
支持对象插入、风格迁移和通过 Flux Kontext 实现多角色一致性等高级操作——所有这些都可以通过聊天来控制。

无限画布 & 故事板
通过简单的拖放操作即可设计布局、规划场景和创建视觉叙事流程。


---

## 使用方法

1. 点击程序主页右上角的“登录”按钮，即可使用各个模型的 API。支付少量费用，你就可以顺畅地使用API 模型，切积分永不过期。

<img width="400" alt="Screenshot 2025-06-02 at 3 08 51 PM" src="https://github.com/user-attachments/assets/0055557d-c247-4801-ac3f-01ed4fa775ae" />

2. 你也可以自定义绑定的 API，添加像 OpenAI 或 Claude 这样的 LLM API 密钥，或者安装 Ollama 来使用本地模型。

添加像 Replicate 这样的图像生成 API 密钥。 [Replicate](https://replicate.com/)

<img width="1485" alt="Screenshot 2025-06-02 at 3 08 51 PM" src="https://github.com/user-attachments/assets/80bf76b1-229b-4491-893e-3f5102062a37" />

3. 开始聊天框输入，生成图片或视频！

<img width="900" alt="Screenshot 2025-06-18 at 16 09 05" src="https://github.com/user-attachments/assets/eacee793-3bc4-4fa2-9e23-94efa1e1f087" />

## 案例

- 提示词: 帮我把这个角色放置在六个不同的场景中，都在世界各地的地标建筑前。光线和谐。他在世界各地拍照，风格写实，暖光，画质高，图片比例为9:16。

![814c563b08f6ef44de0c2c31f0fdd00b-min](https://github.com/user-attachments/assets/4e2634b3-9068-47cd-a18f-ddde8f218d25)

<img width="1000" alt="Screenshot 2025-06-02 at 3 51 56 AM" src="https://github.com/user-attachments/assets/5d8efe74-99b0-41bc-aa3e-6f7b92b69c36" />
<img width="900" alt="Screenshot 2025-06-02 at 3 51 56 AM" src="https://github.com/user-attachments/assets/56a15432-65ff-4e71-a2f2-4f159ffb304a" />

<img width="900" alt="Screenshot 2025-06-02 at 3 51 56 AM" src="https://github.com/user-attachments/assets/186982a9-5e4e-4ac1-a42c-c840092fd616" />

<img width="900" alt="Screenshot 2025-06-02 at 3 03 49 PM" src="https://github.com/user-attachments/assets/b8508efd-def8-40ed-8ab5-62ed3c26de67" />
<img width="1000" alt="Screenshot 2025-06-02 at 3 03 49 PM" src="https://github.com/user-attachments/assets/6001af3a-2e2d-4bce-8112-7ee81cc75670" />

## 团队与企业支持：
支持企业团队的多用户私有化部署，保证隐私和安全。

请通过邮件联系：aifoxdw@gmail.com

微信：aifox1



## 手动安装 (适用于 Linux 或本地构建)

🟠 **Need Python version >=3.12**

首先 git clone 这个仓库：

`git clone https://github.com/11cafe/localart`

`cd react`

`npm install --force`

`npx vite build`

`cd ../server`

`pip install -r requirements.txt`

`python main.py`

## 开发

🟠 **Need Python version >=3.12**

VSCode/Cursor Install Extensions：

- Black Formatter by ms-python (ms-python.black-formatter)

`cd react`

`npm install --force && npm run dev`

`cd server`

`pip install -r requirements.txt`

`python main.py`



## 使用docker安装 

`git clone https://github.com/11cafe/localart`
`docker compose up -d`