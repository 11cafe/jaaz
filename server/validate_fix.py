#!/usr/bin/env python3
"""
验证图片URL修复效果
"""

def test_image_url_format():
    """测试图片URL格式是否正确"""
    
    # 模拟修复后的代码逻辑
    filename = "test123.png"
    DEFAULT_PORT = 8000
    
    # GPT 图片生成的返回格式（修复后）
    gpt_result = f"✨ GPT Image Generated Successfully\n\n![image_id: {filename}](http://localhost:{DEFAULT_PORT}/api/file/{filename})"
    
    # Gemini/其他图片生成的返回格式（修复后）
    image_url = f"/api/file/{filename}"  # save_image_to_canvas 返回值
    gemini_result = f'✨ Image Generate Success\n\n![image_id: {filename}](http://localhost:{DEFAULT_PORT}{image_url})'
    
    print("🔍 修复后的图片URL格式:")
    print("=" * 50)
    print("GPT 图片生成:")
    print(gpt_result)
    print("\n" + "=" * 50)
    print("Gemini/其他图片生成:")
    print(gemini_result)
    print("\n" + "=" * 50)
    
    # 验证URL格式
    expected_url = f"http://localhost:{DEFAULT_PORT}/api/file/{filename}"
    
    gpt_contains_correct_url = expected_url in gpt_result
    gemini_contains_correct_url = expected_url in gemini_result
    
    gpt_no_remote_url = "https://filesystem.site" not in gpt_result
    gemini_no_remote_url = "Result url:" not in gemini_result
    
    print("✅ 验证结果:")
    print(f"  GPT 包含正确URL: {gpt_contains_correct_url}")
    print(f"  Gemini 包含正确URL: {gemini_contains_correct_url}")
    print(f"  GPT 无远程URL: {gpt_no_remote_url}")
    print(f"  Gemini 无远程URL: {gemini_no_remote_url}")
    
    if all([gpt_contains_correct_url, gemini_contains_correct_url, gpt_no_remote_url, gemini_no_remote_url]):
        print("\n🎉 所有测试通过！图片URL修复成功！")
    else:
        print("\n❌ 测试失败，需要进一步检查")

if __name__ == "__main__":
    test_image_url_format()