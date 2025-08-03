#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF转HTML/TXT转换器 - 最终版本
使用Qwen2.5-VL API进行OCR识别
"""

import os
import sys
import base64
import json
from io import BytesIO
from openai import OpenAI
import time
import fitz  # PyMuPDF

# API配置
API_KEY = "sk-84acd4c7c5c746df8d8cec25c1e0fc60"
BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

def pdf_to_images(pdf_path):
    """使用PyMuPDF将PDF转换为图片"""
    try:
        print(f"正在转换PDF: {pdf_path}")
        doc = fitz.open(pdf_path)
        image_paths = []
        
        # 只处理前3页
        for page_num in range(min(3, len(doc))):
            page = doc.load_page(page_num)
            # 设置缩放比例以提高图片质量
            mat = fitz.Matrix(2.0, 2.0)  # 2倍缩放
            pix = page.get_pixmap(matrix=mat)
            
            image_path = f"pdf_page_{page_num+1}.png"
            pix.save(image_path)
            image_paths.append(image_path)
            print(f"✅ 页面 {page_num+1} 已保存: {image_path}")
        
        doc.close()
        return image_paths
    except Exception as e:
        print(f"❌ PDF转换失败: {e}")
        return None

def image_to_base64(image_path):
    """将图片转换为base64编码"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def call_qwen_api(image_base64, output_format="html"):
    """调用Qwen2.5-VL API进行OCR识别"""
    client = OpenAI(
        api_key=API_KEY,
        base_url=BASE_URL,
    )
    
    if output_format == "html":
        prompt = """请将这张图片中的文字内容转换为结构化的HTML格式。要求：
1. 保持原文的层次结构和格式
2. 使用适当的HTML标签（如h1, h2, p, table等）
3. 保留所有文字内容，包括标题、正文、表格等
4. 确保HTML格式规范且易于阅读"""
    else:
        prompt = "请提取这张图片中的所有文字内容，保持原有的格式和结构，输出为纯文本格式。"
    
    try:
        completion = client.chat.completions.create(
            model="qwen-vl-max-latest",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_base64}"
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ],
            max_tokens=4000,
            temperature=0.1
        )
        
        return completion.choices[0].message.content
        
    except Exception as e:
        print(f"❌ API调用失败: {e}")
        return None

def save_results(html_content, txt_content, pdf_file, output_prefix="real_pdf_converted"):
    """保存转换结果"""
    # 保存HTML文件
    html_file = f"{output_prefix}.html"
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF转换结果 - {pdf_file}</title>
    <style>
        body {{ font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 40px; line-height: 1.6; }}
        h1, h2, h3 {{ color: #333; }}
        p {{ margin: 10px 0; }}
        ol, ul {{ margin: 10px 0; padding-left: 30px; }}
        li {{ margin: 5px 0; }}
        .page {{ margin-bottom: 30px; border-bottom: 1px solid #ccc; padding-bottom: 20px; }}
    </style>
</head>
<body>
    <h1>PDF转换结果</h1>
    <p><strong>源文件:</strong> {pdf_file}</p>
    <div class="content">
{html_content}
    </div>
</body>
</html>""")
    
    # 保存TXT文件
    txt_file = f"{output_prefix}.txt"
    with open(txt_file, 'w', encoding='utf-8') as f:
        f.write(f"PDF转换结果\n")
        f.write(f"源文件: {pdf_file}\n")
        f.write(f"{'='*50}\n")
        f.write(txt_content)
    
    return html_file, txt_file

def main():
    """主函数"""
    print("=== 真实PDF转HTML/TXT转换器 ===")
    
    # 指定PDF文件
    pdf_file = "C230970483-再生資源.pdf"
    
    if not os.path.exists(pdf_file):
        print(f"❌ 找不到PDF文件: {pdf_file}")
        return
    
    print(f"✅ 找到PDF文件: {pdf_file}")
    
    # 第一步：PDF转图片
    print("\n=== 第一步：PDF转图片 ===")
    image_paths = pdf_to_images(pdf_file)
    
    if not image_paths:
        print("❌ PDF转图片失败")
        return
    
    # 第二步：OCR识别并转换
    print("\n=== 第二步：OCR识别 ===")
    html_content = ""
    txt_content = ""
    
    for i, image_path in enumerate(image_paths):
        print(f"正在处理页面 {i+1}...")
        
        # 转换为base64
        image_base64 = image_to_base64(image_path)
        
        # HTML格式识别
        print(f"  - HTML格式识别...")
        html_result = call_qwen_api(image_base64, "html")
        if html_result:
            html_content += f"\n<!-- 第{i+1}页 -->\n{html_result}\n"
        
        # 纯文本格式识别
        print(f"  - 纯文本格式识别...")
        txt_result = call_qwen_api(image_base64, "text")
        if txt_result:
            txt_content += f"\n=== 第{i+1}页 ===\n{txt_result}\n"
    
    # 第三步：保存结果
    print("\n=== 第三步：保存结果 ===")
    html_file, txt_file = save_results(html_content, txt_content, pdf_file)
    
    print(f"✅ HTML文件已保存: {html_file}")
    print(f"✅ TXT文件已保存: {txt_file}")
    
    # 清理临时图片文件
    print("\n=== 清理临时文件 ===")
    for image_path in image_paths:
        try:
            os.remove(image_path)
            print(f"✅ 已删除: {image_path}")
        except:
            pass
    
    print("\n🎉 PDF转换完成！")
    print(f"📄 HTML结果: {html_file}")
    print(f"📝 TXT结果: {txt_file}")

if __name__ == "__main__":
    main()