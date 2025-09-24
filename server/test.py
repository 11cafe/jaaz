from openai import OpenAI
import os


# 在这里填入你的API密钥和基础URL
client = OpenAI(
    api_key="sk-XOEGtZvvM6HyK2U14jNHjSqblTORsKfNTDtqU5FBbOsbTuUH",  # 请替换为你的实际API密钥
    base_url="https://api.tu-zi.com/v1",  # 请替换为你的实际基础URL
)

completion = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {
            "role": "user",
            "content": "联网检索下api.tu-zi.com网站，以及兔子@tuziapi这个推特用户"
        }
    ]
)

print(completion.choices[0].message.content)
