#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF转HTML/TXT转换器 - 最终优化版本
优化策略：
1. 只进行一次OCR识别（HTML格式）
2. 从HTML提取纯文本，避免重复API调用
3. 输出最纯净的内容，无多余标题
"""

import os
import sys
import base64
import json
import re
from io import BytesIO
from openai import OpenAI
import time
import fitz  # PyMuPDF
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor
import threading
from bs4 import BeautifulSoup

# API配置 - SiliconFlow GLM-4.1V
API_KEY = "sk-jvzbrgzerhfbtetfuapjhwjwpzuwhfphiisvylabwesvzzza"
BASE_URL = "https://api.siliconflow.cn/v1"

# 文件路径配置
PDF_PATH = "C230970483-再生資源.pdf"
HTML_OUTPUT_PATH = "glm4v_pdf_converted.html"
TXT_OUTPUT_PATH = "glm4v_pdf_converted.txt"

# 并发配置
MAX_WORKERS = 3

# 线程锁，用于安全地打印日志
print_lock = threading.Lock()

def safe_print(message):
    """线程安全的打印函数"""
    with print_lock:
        print(message)

def pdf_to_images(pdf_path):
    """使用PyMuPDF将PDF转换为图片"""
    try:
        doc = fitz.open(pdf_path)
        image_paths = []
        total_pages = len(doc)
        
        for page_num in range(total_pages):
            page = doc.load_page(page_num)
            mat = fitz.Matrix(2.0, 2.0)  # 2倍缩放
            pix = page.get_pixmap(matrix=mat)
            
            image_path = f"pdf_page_{page_num+1}.png"
            pix.save(image_path)
            image_paths.append(image_path)
        
        doc.close()
        return image_paths
    except Exception as e:
        safe_print(f"Error converting PDF: {e}")
        return None

def image_to_base64(image_path):
    """将图片转换为base64编码"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def call_glm4v_api_once(image_base64, page_num=1, total_pages=1):
    """调用GLM-4.1V API进行OCR识别，获取HTML格式的结构化内容"""
    client = OpenAI(
        api_key=API_KEY,
        base_url=BASE_URL,
    )
    
    # 激进优化：直接在think中给出输出指令
    prompt = f"""<think>
这是第{page_num}/{total_pages}页的OCR识别任务。我需要立即输出HTML格式的文字内容，不进行任何思考分析。直接识别图片中的文字并转换为HTML标签输出。
</think>

OCR第{page_num}/{total_pages}页，HTML输出："""
    
    try:
        completion = client.chat.completions.create(
            model="THUDM/GLM-4.1V-9B-Thinking",
            messages=[
                {
                    "role": "system",
                    "content": "OCR助手。禁止思考，直接输出HTML。快速识别，立即回答。"
                },
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
        print(f"API call failed: {e}")
        return None

def process_single_page(page_info, total_pages):
    """处理单个页面"""
    page_num, image_path = page_info
    
    try:
        image_base64 = image_to_base64(image_path)
        content = call_glm4v_api_once(image_base64, page_num, total_pages)
        
        return {
            'page_num': page_num,
            'content': content,
            'success': content is not None
        }
        
    except Exception as e:
        print(f"Error processing page {page_num}: {e}")
        return {
            'page_num': page_num,
            'content': None,
            'success': False
        }

def smart_merge_pages(page_results):
    """智能合并多页内容，处理断句连接和去重"""
    import re
    
    if not page_results:
        return ""
    
    # 按页码排序
    page_results.sort(key=lambda x: x['page_num'])
    
    merged_html = []
    seen_tables = set()  # 用于去重表格
    
    for i, result in enumerate(page_results):
        if not result['success'] or not result['content']:
            continue
            
        content = clean_content(result['content'])
        if not content:
            continue
        
        # 检查是否包含表格，进行去重处理
        if '<table>' in content.lower():
            # 提取表格内容进行去重
            tables = re.findall(r'<table.*?</table>', content, re.DOTALL | re.IGNORECASE)
            for table in tables:
                # 简化表格内容作为去重标识
                table_text = re.sub(r'<[^>]+>', '', table).strip()
                table_hash = hash(table_text)
                
                if table_hash in seen_tables:
                    # 移除重复的表格
                    content = content.replace(table, '')
                else:
                    seen_tables.add(table_hash)
        
        # 处理页面间的文本连接
        if i > 0 and merged_html:
            # 检查上一页末尾和当前页开头是否需要连接
            prev_content = merged_html[-1] if merged_html else ""
            
            # 如果上一页以不完整的句子结尾，尝试连接
            if prev_content and not prev_content.rstrip().endswith(('。', '！', '？', '；', '</p>', '</h1>', '</h2>', '</h3>', '</table>')):
                # 检查当前页是否以小写字母或中文字符开始（可能是连续文本）
                content_start = re.search(r'<[^>]*>([^<]*)', content)
                if content_start:
                    start_text = content_start.group(1).strip()
                    if start_text and (start_text[0].islower() or '\u4e00' <= start_text[0] <= '\u9fff'):
                        # 移除当前页开头的标签，直接连接文本
                        content = re.sub(r'^<[^>]*>', '', content, count=1)
        
        merged_html.append(content)
    
    return '\n\n'.join(merged_html)

def clean_content(content):
    """清理内容，移除多余的空行和格式，以及Markdown代码块标记"""
    if not content:
        return ""
    
    # 移除Markdown代码块标记
    import re
    # 移除开头的```html或```
    content = re.sub(r'^```html?\s*\n?', '', content, flags=re.IGNORECASE)
    # 移除结尾的```
    content = re.sub(r'\n?```\s*$', '', content)
    # 移除中间可能出现的```html标记
    content = re.sub(r'```html?\s*\n?', '', content, flags=re.IGNORECASE)
    content = re.sub(r'\n?```', '', content)
    
    # 移除GLM模型的内部标记
    content = re.sub(r'<\|begin_of_box\|>', '', content)
    content = re.sub(r'<\|end_of_box\|>', '', content)
    content = re.sub(r'<\|begin_of_text\|>', '', content)
    content = re.sub(r'<\|end_of_text\|>', '', content)
    
    # 移除页码相关内容
    # 移除单独的数字行（可能是页码）
    content = re.sub(r'<p>\s*\d+\s*</p>', '', content)
    content = re.sub(r'<div>\s*\d+\s*</div>', '', content)
    
    # 移除多余的空行
    lines = content.split('\n')
    cleaned_lines = []
    prev_empty = False
    
    for line in lines:
        line = line.strip()
        if line:
            cleaned_lines.append(line)
            prev_empty = False
        elif not prev_empty:
            cleaned_lines.append('')
            prev_empty = True
    
    return '\n'.join(cleaned_lines)

def process_table_for_rag(table_element):
    """
    专门为RAG系统处理表格的函数
    提供多种表格处理方案，适合不同的RAG应用场景
    """
    table_paragraphs = []
    
    try:
        table_data = []
        headers = []
        
        # 提取表头
        header_row = table_element.find('tr')
        if header_row:
            headers = [th.get_text().strip() for th in header_row.find_all(['th', 'td'])]
            if headers:
                table_data.append(headers)
        
        # 提取数据行（跳过第一行，因为已经作为表头处理）
        rows = table_element.find_all('tr')[1:] if table_element.find_all('tr') else []
        for row in rows:
            cells = [td.get_text().strip() for td in row.find_all(['td', 'th'])]
            if cells and any(cell for cell in cells):  # 确保行不为空
                table_data.append(cells)
        
        if table_data:
            # 方案1：表格标题（便于RAG识别表格开始）
            table_paragraphs.append("【表格内容】")
            
            # 方案2：表头信息（作为独立段落）
            if len(table_data) > 1 and headers:
                table_paragraphs.append(f"表格列：{' | '.join(headers)}")
            
            # 方案3：结构化数据行（键值对形式，最适合RAG检索）
            if len(table_data) > 1:  # 有表头和数据
                headers = table_data[0]
                for data_row in table_data[1:]:
                    # 创建键值对形式的文本，便于RAG检索
                    row_text = []
                    for i, cell in enumerate(data_row):
                        if i < len(headers) and cell:
                            row_text.append(f"{headers[i]}：{cell}")
                    if row_text:
                        table_paragraphs.append("；".join(row_text))
            else:
                # 只有一行数据，直接添加
                table_paragraphs.append("；".join(table_data[0]))
            
            # 方案4：表格结束标记（便于RAG识别表格结束）
            table_paragraphs.append("【表格结束】")
    
    except Exception as e:
        # 如果表格处理失败，回退到简单文本提取
        text = table_element.get_text().strip()
        if text:
            table_paragraphs.append(f"【表格】{text}")
    
    return table_paragraphs

def extract_semantic_paragraphs(html_content):
    """从HTML内容中提取语义完整的段落，适合RAG系统使用"""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')
        
        paragraphs = []
        
        # 按照文档顺序处理所有元素，保持原始结构
        for element in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'li', 'table']):
            if element.name == 'table':
                # 专门处理表格元素
                table_paragraphs = process_table_for_rag(element)
                paragraphs.extend(table_paragraphs)
            else:
                # 处理其他文本元素
                text = element.get_text().strip()
                if text:
                    paragraphs.append(text)
        
        return paragraphs
        
    except ImportError:
        # 如果没有BeautifulSoup，使用正则表达式进行简单处理
        import re
        
        # 移除HTML标签
        text = re.sub(r'<[^>]+>', '', html_content)
        
        # 按句号、问号、感叹号等分割
        sentences = re.split(r'[。！？；\n]+', text)
        
        paragraphs = []
        current_paragraph = ""
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            # 如果当前段落为空，直接添加
            if not current_paragraph:
                current_paragraph = sentence
            # 如果当前段落长度合适（50-300字符），保存并开始新段落
            elif len(current_paragraph) > 50 and len(current_paragraph + sentence) > 300:
                paragraphs.append(current_paragraph)
                current_paragraph = sentence
            # 否则继续累积
            else:
                current_paragraph += "。" + sentence
        
        # 添加最后一个段落
        if current_paragraph:
            paragraphs.append(current_paragraph)
        
        return paragraphs

def save_results(merged_html):
    """保存转换结果"""
    # 保存HTML文件
    with open(HTML_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write('<!DOCTYPE html>\n')
        f.write('<html lang="zh-CN">\n')
        f.write('<head>\n')
        f.write('    <meta charset="UTF-8">\n')
        f.write('    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n')
        f.write('    <title>PDF转换结果</title>\n')
        f.write('    <style>\n')
        f.write('        body { font-family: "Microsoft YaHei", Arial, sans-serif; line-height: 1.6; margin: 40px; }\n')
        f.write('        h1, h2, h3 { color: #333; }\n')
        f.write('        table { border-collapse: collapse; width: 100%; margin: 20px 0; }\n')
        f.write('        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }\n')
        f.write('        th { background-color: #f2f2f2; }\n')
        f.write('    </style>\n')
        f.write('</head>\n')
        f.write('<body>\n')
        f.write(merged_html)
        f.write('\n</body>\n')
        f.write('</html>')
    
    # 提取纯文本并保存TXT文件
    paragraphs = extract_semantic_paragraphs(merged_html)
    with open(TXT_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        for i, paragraph in enumerate(paragraphs):
            if paragraph.strip():
                f.write(paragraph.strip())
                if i < len(paragraphs) - 1:
                    f.write('\n\n')

def main():
    """主函数"""
    start_time = time.time()
    
    print("开始处理PDF文档...")
    
    # PDF转换为图片
    pdf_start = time.time()
    image_paths = pdf_to_images(PDF_PATH)
    if not image_paths:
        print("PDF转换失败")
        return
    
    pdf_time = time.time() - pdf_start
    print(f"PDF转换完成，耗时: {pdf_time:.2f}秒，共{len(image_paths)}页")
    
    # OCR识别
    ocr_start = time.time()
    total_pages = len(image_paths)
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # 传递总页数信息
        page_infos = [(i+1, path) for i, path in enumerate(image_paths)]
        futures = [executor.submit(process_single_page, page_info, total_pages) for page_info in page_infos]
        
        page_results = []
        for i, future in enumerate(futures):
            try:
                result = future.result(timeout=300)
                page_results.append(result)
                if result['success']:
                    print(f"第{result['page_num']}页处理完成")
                else:
                    print(f"第{result['page_num']}页处理失败")
            except Exception as e:
                print(f"第{i+1}页处理异常: {e}")
                page_results.append({
                    'page_num': i+1,
                    'content': None,
                    'success': False
                })
    
    ocr_time = time.time() - ocr_start
    print(f"OCR识别完成，耗时: {ocr_time:.2f}秒")
    
    # 使用智能合并函数
    merged_html = smart_merge_pages(page_results)
    
    # 保存结果
    save_results(merged_html)
    
    # 清理临时文件
    for image_path in image_paths:
        try:
            os.remove(image_path)
        except:
            pass
    
    total_time = time.time() - start_time
    print(f"处理完成，总耗时: {total_time:.2f}秒")
    print(f"HTML文件: {HTML_OUTPUT_PATH}")
    print(f"TXT文件: {TXT_OUTPUT_PATH}")

if __name__ == "__main__":
    main()