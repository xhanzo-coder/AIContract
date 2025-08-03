#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF转HTML/TXT转换器 - 优化版本
解决问题：
1. 处理所有页面（不限制为3页）
2. 优化提示词，避免生成HTML标签
3. 并行处理提升速度
"""

import os
import sys
import base64
import json
from io import BytesIO
from openai import OpenAI
import time
import fitz  # PyMuPDF
import concurrent.futures
from threading import Lock

# API配置
API_KEY = "sk-84acd4c7c5c746df8d8cec25c1e0fc60"
BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

# 线程锁，用于安全地打印日志
print_lock = Lock()

def safe_print(message):
    """线程安全的打印函数"""
    with print_lock:
        print(message)

def pdf_to_images(pdf_path):
    """使用PyMuPDF将PDF转换为图片 - 处理所有页面"""
    try:
        safe_print(f"正在转换PDF: {pdf_path}")
        doc = fitz.open(pdf_path)
        image_paths = []
        total_pages = len(doc)
        
        safe_print(f"PDF总页数: {total_pages}")
        
        # 处理所有页面（不再限制为3页）
        for page_num in range(total_pages):
            page = doc.load_page(page_num)
            # 设置缩放比例以提高图片质量
            mat = fitz.Matrix(2.0, 2.0)  # 2倍缩放
            pix = page.get_pixmap(matrix=mat)
            
            image_path = f"pdf_page_{page_num+1}.png"
            pix.save(image_path)
            image_paths.append(image_path)
            safe_print(f"✅ 页面 {page_num+1}/{total_pages} 已保存: {image_path}")
        
        doc.close()
        return image_paths
    except Exception as e:
        safe_print(f"❌ PDF转换失败: {e}")
        return None

def image_to_base64(image_path):
    """将图片转换为base64编码"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def call_qwen_api(image_base64, output_format="html"):
    """调用Qwen2.5-VL API进行OCR识别 - 优化提示词"""
    client = OpenAI(
        api_key=API_KEY,
        base_url=BASE_URL,
    )
    
    if output_format == "html":
        # 优化的HTML提示词 - 明确要求不生成HTML标签
        prompt = """请识别这张图片中的所有文字内容，并按照以下要求输出：

1. 只输出文字内容本身，不要生成任何HTML标签（如<html>、<head>、<body>、<p>、<div>等）
2. 保持原文的层次结构和格式
3. 使用适当的文本格式来表示结构（如用空行分段、用缩进表示层级）
4. 保留所有文字内容，包括标题、正文、表格等
5. 直接输出纯文本内容，不要添加任何解释性文字

请直接开始输出文字内容："""
    else:
        # 优化的纯文本提示词
        prompt = """请识别这张图片中的所有文字内容，要求：

1. 提取所有可见的文字
2. 保持原有的格式和结构
3. 用空行分段，用缩进表示层级关系
4. 不要添加任何解释性文字
5. 直接输出识别到的文字内容

请直接开始输出文字内容："""
    
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
        safe_print(f"❌ API调用失败: {e}")
        return None

def process_single_page(page_info):
    """处理单个页面的OCR识别"""
    page_num, image_path = page_info
    
    try:
        safe_print(f"正在处理页面 {page_num}...")
        
        # 转换为base64
        image_base64 = image_to_base64(image_path)
        
        # 同时进行HTML和TXT格式识别
        safe_print(f"  - 页面 {page_num}: 开始OCR识别...")
        
        # 创建两个API客户端实例以支持并发
        html_result = call_qwen_api(image_base64, "html")
        txt_result = call_qwen_api(image_base64, "text")
        
        safe_print(f"  - 页面 {page_num}: OCR识别完成")
        
        return {
            'page_num': page_num,
            'html_content': html_result if html_result else "",
            'txt_content': txt_result if txt_result else ""
        }
        
    except Exception as e:
        safe_print(f"❌ 页面 {page_num} 处理失败: {e}")
        return {
            'page_num': page_num,
            'html_content': "",
            'txt_content': ""
        }

def save_results(results, pdf_file, output_prefix="optimized_pdf_converted"):
    """保存转换结果 - 简化格式"""
    
    # 按页面顺序排序
    results.sort(key=lambda x: x['page_num'])
    
    # 合并所有页面的内容
    html_content = ""
    txt_content = ""
    
    for result in results:
        page_num = result['page_num']
        if result['html_content']:
            html_content += f"\n=== 第{page_num}页 ===\n{result['html_content']}\n"
        if result['txt_content']:
            txt_content += f"\n=== 第{page_num}页 ===\n{result['txt_content']}\n"
    
    # 保存简化的HTML文件（实际上是结构化文本）
    html_file = f"{output_prefix}.html"
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(f"PDF转换结果（结构化文本）\n")
        f.write(f"源文件: {pdf_file}\n")
        f.write(f"{'='*50}\n")
        f.write(html_content)
    
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
    print("=== 优化版PDF转换器 ===")
    print("优化内容：")
    print("1. 处理所有页面（不限制页数）")
    print("2. 优化提示词，避免生成HTML标签")
    print("3. 并行处理提升速度")
    print()
    
    # 指定PDF文件
    pdf_file = "C230970483-再生資源.pdf"
    
    if not os.path.exists(pdf_file):
        print(f"❌ 找不到PDF文件: {pdf_file}")
        return
    
    print(f"✅ 找到PDF文件: {pdf_file}")
    
    # 第一步：PDF转图片
    print("\n=== 第一步：PDF转图片 ===")
    start_time = time.time()
    image_paths = pdf_to_images(pdf_file)
    
    if not image_paths:
        print("❌ PDF转图片失败")
        return
    
    pdf_time = time.time() - start_time
    print(f"PDF转图片耗时: {pdf_time:.2f}秒")
    
    # 第二步：并行OCR识别
    print("\n=== 第二步：并行OCR识别 ===")
    ocr_start_time = time.time()
    
    # 准备页面信息
    page_infos = [(i+1, image_path) for i, image_path in enumerate(image_paths)]
    
    # 使用线程池进行并行处理
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        # 提交所有任务
        future_to_page = {executor.submit(process_single_page, page_info): page_info for page_info in page_infos}
        
        # 收集结果
        for future in concurrent.futures.as_completed(future_to_page):
            result = future.result()
            results.append(result)
    
    ocr_time = time.time() - ocr_start_time
    print(f"OCR识别耗时: {ocr_time:.2f}秒")
    
    # 第三步：保存结果
    print("\n=== 第三步：保存结果 ===")
    html_file, txt_file = save_results(results, pdf_file)
    
    print(f"✅ 结构化文本文件已保存: {html_file}")
    print(f"✅ 纯文本文件已保存: {txt_file}")
    
    # 清理临时图片文件
    print("\n=== 清理临时文件 ===")
    for image_path in image_paths:
        try:
            os.remove(image_path)
            print(f"✅ 已删除: {image_path}")
        except:
            pass
    
    total_time = time.time() - start_time
    print(f"\n🎉 PDF转换完成！")
    print(f"📊 性能统计：")
    print(f"   - 总耗时: {total_time:.2f}秒")
    print(f"   - PDF转图片: {pdf_time:.2f}秒")
    print(f"   - OCR识别: {ocr_time:.2f}秒")
    print(f"   - 处理页数: {len(image_paths)}页")
    print(f"📄 结构化文本结果: {html_file}")
    print(f"📝 纯文本结果: {txt_file}")

if __name__ == "__main__":
    main()