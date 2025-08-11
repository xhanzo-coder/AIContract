"""
OCR处理服务 - 集成SiliconFlow GLM-4.1V视觉模型
"""
import os
import asyncio
import base64
import json
import re
import time
import fitz  # PyMuPDF
from typing import Optional, Tuple, List
from pathlib import Path
import logging
from openai import OpenAI
from bs4 import BeautifulSoup
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor
import threading

from app.config import settings

logger = logging.getLogger(__name__)

class GLMOCRService:
    """基于SiliconFlow GLM-4.1V的OCR处理服务"""
    
    def __init__(self):
        # SiliconFlow GLM-4.1V配置
        self.api_key = "sk-jvzbrgzerhfbtetfuapjhwjwpzuwhfphiisvylabwesvzzza"
        self.base_url = "https://api.siliconflow.cn/v1"
        self.model = "THUDM/GLM-4.1V-9B-Thinking"
        self.max_workers = 5  # 并发处理数量，提高识别速度
        self.print_lock = threading.Lock()
        
        # 初始化OpenAI客户端
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
        )
        
        logger.info("GLM-4.1V OCR服务初始化成功")
    
    def _safe_log(self, message: str):
        """线程安全的日志记录"""
        with self.print_lock:
            logger.info(message)
    
    
    def _pdf_to_images(self, pdf_path: str) -> List[str]:
        """将PDF转换为图片"""
        try:
            doc = fitz.open(pdf_path)
            image_paths = []
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                mat = fitz.Matrix(2.0, 2.0)  # 2倍缩放提高清晰度
                pix = page.get_pixmap(matrix=mat)
                
                # 生成临时图片路径
                temp_dir = os.path.join(settings.UPLOAD_DIR, "temp")
                os.makedirs(temp_dir, exist_ok=True)
                
                image_path = os.path.join(temp_dir, f"page_{page_num+1}_{int(time.time())}.png")
                pix.save(image_path)
                image_paths.append(image_path)
            
            doc.close()
            return image_paths
            
        except Exception as e:
            logger.error(f"PDF转图片失败: {str(e)}")
            return []
    
    def _image_to_base64(self, image_path: str) -> str:
        """将图片转换为base64编码"""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def _call_glm4v_api(self, image_base64: str, page_num: int, total_pages: int) -> Optional[str]:
        """调用GLM-4.1V API进行OCR识别"""
        prompt = f"""请识别图片中的文字内容并转换为HTML格式。

要求：
1. 只输出HTML代码，不要任何解释
2. 不要输出思考过程或分析
3. 不要使用<think>标签
4. 空白页直接返回空字符串
5. 表格用<table>标签，标题用<h1>-<h3>标签

直接开始输出HTML："""
        
        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "你是一个专业的OCR识别工具。只输出HTML格式的识别结果，绝对不要输出任何思考过程、分析、解释或<think>标签内容。对于空白页面，直接返回空字符串。严格按照用户要求输出。"
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
                max_tokens=3000,
                temperature=0.01
            )
            
            return completion.choices[0].message.content
            
        except Exception as e:
            logger.error(f"GLM-4.1V API调用失败: {str(e)}")
            return None
    
    def _process_single_page(self, page_info: tuple, total_pages: int) -> dict:
        """处理单个页面"""
        page_num, image_path = page_info
        
        try:
            image_base64 = self._image_to_base64(image_path)
            content = self._call_glm4v_api(image_base64, page_num, total_pages)
            
            # 减少详细日志输出，只在出错时记录
            pass
            
            return {
                'page_num': page_num,
                'content': content,
                'success': content is not None
            }
            
        except Exception as e:
            logger.error(f"处理第{page_num}页失败: {str(e)}")
            return {
                'page_num': page_num,
                'content': None,
                'success': False
            }
    
    def _clean_content(self, content: str) -> str:
        """清理OCR识别的内容"""
        if not content:
            return ""
        
        # 检查是否为空白页面或只有页码的页面
        content_text = re.sub(r'<[^>]+>', '', content).strip()
        if not content_text or re.match(r'^\s*\d+\s*$', content_text):
            return ""
        
        # 移除GLM-4.1V-9B-Thinking模型的思考过程标记
        content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL)
        content = re.sub(r'<thinking>.*?</thinking>', '', content, flags=re.DOTALL)
        
        # 移除模型思考过程的常见模式
        content = re.sub(r'我需要.*?(?=<|$)', '', content, flags=re.DOTALL)
        content = re.sub(r'让我.*?(?=<|$)', '', content, flags=re.DOTALL)
        content = re.sub(r'现在我.*?(?=<|$)', '', content, flags=re.DOTALL)
        content = re.sub(r'接下来.*?(?=<|$)', '', content, flags=re.DOTALL)
        content = re.sub(r'首先.*?(?=<|$)', '', content, flags=re.DOTALL)
        content = re.sub(r'然后.*?(?=<|$)', '', content, flags=re.DOTALL)
        
        # 移除重复的附件标题和结构调整注释
        content = re.sub(r'《再生资源列表、处理价格》\s*(?=《再生资源列表、处理价格》)', '', content, flags=re.DOTALL)
        content = re.sub(r'附件.*?《再生资源列表、处理价格》\s*(?=附件)', '', content, flags=re.DOTALL)
        
        # 移除HTML结构调整的思考过程
        content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)
        content = re.sub(r'// 调整.*?(?=\n|$)', '', content, flags=re.MULTILINE)
        content = re.sub(r'尝试.*?结构.*?(?=<|$)', '', content, flags=re.DOTALL)
        
        # 移除思考过程相关的内容（包括括号内的解释）
        content = re.sub(r'（因为.*?所以.*?）', '', content, flags=re.DOTALL)
        content = re.sub(r'\(因为.*?所以.*?\)', '', content, flags=re.DOTALL)
        content = re.sub(r'```[^`]*因为.*?所以.*?[^`]*```', '', content, flags=re.DOTALL)
        
        # 移除空白页判断的思考过程
        content = re.sub(r'.*?空白页.*?返回空.*?字符串.*?', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'.*?图片.*?空白.*?返回.*?', '', content, flags=re.DOTALL | re.IGNORECASE)
        
        # 移除Markdown代码块标记
        content = re.sub(r'^```html?\s*\n?', '', content, flags=re.IGNORECASE)
        content = re.sub(r'\n?```\s*$', '', content)
        content = re.sub(r'```html?\s*\n?', '', content, flags=re.IGNORECASE)
        content = re.sub(r'\n?```', '', content)
        
        # 移除GLM模型的内部标记
        content = re.sub(r'<\|begin_of_box\|>', '', content)
        content = re.sub(r'<\|end_of_box\|>', '', content)
        content = re.sub(r'<\|begin_of_text\|>', '', content)
        content = re.sub(r'<\|end_of_text\|>', '', content)
        
        # 移除未闭合或错误的HTML标签
        content = re.sub(r'<table[^>]*>(?!.*</table>).*?(?=<|$)', '', content, flags=re.DOTALL)
        content = re.sub(r'<div[^>]*>(?!.*</div>).*?(?=<|$)', '', content, flags=re.DOTALL)
        content = re.sub(r'<svg[^>]*>(?!.*</svg>).*?(?=<|$)', '', content, flags=re.DOTALL)
        
        # 移除页码相关内容（更全面的匹配）
        content = re.sub(r'<p>\s*\d+\s*</p>', '', content)
        content = re.sub(r'<div>\s*\d+\s*</div>', '', content)
        content = re.sub(r'<span>\s*\d+\s*</span>', '', content)
        content = re.sub(r'<h[1-6]>\s*\d+\s*</h[1-6]>', '', content)
        
        # 移除重复的HTML结构声明
        content = re.sub(r'<!DOCTYPE html>\s*<html>\s*<head>.*?</head>\s*<body>\s*(?=<!DOCTYPE)', '', content, flags=re.DOTALL)
        
        # 移除重复的内容块（基于文本相似度）
        lines = content.split('\n')
        cleaned_lines = []
        seen_content = set()
        
        for line in lines:
            line = line.strip()
            if line:
                # 提取纯文本用于去重判断
                text_only = re.sub(r'<[^>]+>', '', line).strip()
                if text_only and text_only not in seen_content:
                    cleaned_lines.append(line)
                    seen_content.add(text_only)
                elif not text_only:  # 保留纯HTML标签行
                    cleaned_lines.append(line)
            else:
                # 避免连续空行
                if cleaned_lines and cleaned_lines[-1] != '':
                    cleaned_lines.append('')
        
        result = '\n'.join(cleaned_lines)
        
        # 最终检查：如果清理后内容为空或只剩HTML结构，返回空字符串
        final_text = re.sub(r'<[^>]+>', '', result).strip()
        if not final_text or len(final_text) < 3:
            return ""
        
        return result
    
    def _smart_merge_pages(self, page_results: List[dict]) -> str:
        """智能合并多页内容"""
        if not page_results:
            return ""
        
        # 按页码排序
        page_results.sort(key=lambda x: x['page_num'])
        
        merged_html = []
        seen_tables = set()  # 用于去重表格
        
        for i, result in enumerate(page_results):
            if not result['success'] or not result['content']:
                continue
                
            content = self._clean_content(result['content'])
            if not content:
                continue
            
            # 检查清理后的纯文本长度，避免误删有效内容
            text_only = re.sub(r'<[^>]+>', '', content).strip()
            if len(text_only) < 3:  # 只有极短的内容才跳过
                continue
            
            # 检查是否包含表格，进行去重处理
            if '<table>' in content.lower():
                tables = re.findall(r'<table.*?</table>', content, re.DOTALL | re.IGNORECASE)
                for table in tables:
                    table_text = re.sub(r'<[^>]+>', '', table).strip()
                    table_hash = hash(table_text)
                    
                    if table_hash in seen_tables:
                        content = content.replace(table, '')
                    else:
                        seen_tables.add(table_hash)
            
            # 处理页面间的文本连接
            if i > 0 and merged_html:
                prev_content = merged_html[-1] if merged_html else ""
                
                if prev_content and not prev_content.rstrip().endswith(('。', '！', '？', '；', '</p>', '</h1>', '</h2>', '</h3>', '</table>')):
                    content_start = re.search(r'<[^>]*>([^<]*)', content)
                    if content_start:
                        start_text = content_start.group(1).strip()
                        if start_text and (start_text[0].islower() or '\u4e00' <= start_text[0] <= '\u9fff'):
                            content = re.sub(r'^<[^>]*>', '', content, count=1)
            
            merged_html.append(content)
        
        return '\n\n'.join(merged_html)
    
    def _extract_text_from_html(self, html_content: str) -> str:
        """从HTML内容中提取纯文本"""
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            paragraphs = []
            
            for element in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'li', 'table']):
                if element.name == 'table':
                    # 处理表格
                    table_data = []
                    headers = []
                    
                    header_row = element.find('tr')
                    if header_row:
                        headers = [th.get_text().strip() for th in header_row.find_all(['th', 'td'])]
                        if headers:
                            table_data.append(headers)
                    
                    rows = element.find_all('tr')[1:] if element.find_all('tr') else []
                    for row in rows:
                        cells = [td.get_text().strip() for td in row.find_all(['td', 'th'])]
                        if cells and any(cell for cell in cells):
                            table_data.append(cells)
                    
                    if table_data:
                        paragraphs.append("【表格内容】")
                        if len(table_data) > 1 and headers:
                            paragraphs.append(f"表格列：{' | '.join(headers)}")
                        
                        if len(table_data) > 1:
                            headers = table_data[0]
                            for data_row in table_data[1:]:
                                row_text = []
                                for i, cell in enumerate(data_row):
                                    if i < len(headers) and cell:
                                        row_text.append(f"{headers[i]}：{cell}")
                                if row_text:
                                    paragraphs.append("；".join(row_text))
                        else:
                            paragraphs.append("；".join(table_data[0]))
                        
                        paragraphs.append("【表格结束】")
                else:
                    text = element.get_text().strip()
                    if text:
                        paragraphs.append(text)
            
            return '\n\n'.join(paragraphs)
            
        except Exception as e:
            logger.error(f"HTML转文本失败: {str(e)}")
            # 回退到简单的文本提取
            text = re.sub(r'<[^>]+>', '', html_content)
            return text.strip()

    async def process_document(self, file_path: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        处理文档OCR
        返回: (是否成功, HTML内容路径, 文本内容路径)
        """
        try:
            full_file_path = os.path.join(settings.UPLOAD_DIR, file_path)
            
            # 检查文件是否存在
            if not os.path.exists(full_file_path):
                logger.error(f"文件不存在: {full_file_path}")
                return False, None, None
            
            logger.info(f"开始OCR处理: {os.path.basename(file_path)}")
            
            # 将PDF转换为图片
            image_paths = self._pdf_to_images(full_file_path)
            if not image_paths:
                logger.error("PDF转图片失败")
                return False, None, None
            
            # 减少详细日志，只记录关键信息
            pass
            
            # 并发处理所有页面
            total_pages = len(image_paths)
            page_infos = [(i+1, path) for i, path in enumerate(image_paths)]
            
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                futures = [
                    loop.run_in_executor(executor, self._process_single_page, page_info, total_pages)
                    for page_info in page_infos
                ]
                
                page_results = await asyncio.gather(*futures)
            
            # 清理临时图片文件
            for image_path in image_paths:
                try:
                    os.remove(image_path)
                except:
                    pass
            
            # 合并页面内容
            merged_html = self._smart_merge_pages(page_results)
            
            if not merged_html:
                logger.error("OCR识别失败，未获取到内容")
                return False, None, None
            
            # 生成输出文件路径
            base_name = Path(file_path).stem
            output_dir = os.path.join(settings.UPLOAD_DIR, "processed")
            os.makedirs(output_dir, exist_ok=True)
            
            # 保存HTML文件
            html_filename = f"{base_name}_content.html"
            html_path = os.path.join(output_dir, html_filename)
            
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write('<!DOCTYPE html>\n')
                f.write('<html lang="zh-CN">\n')
                f.write('<head>\n')
                f.write('    <meta charset="UTF-8">\n')
                f.write('    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n')
                f.write('    <title>合同内容</title>\n')
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
            
            # 提取纯文本并保存
            text_content = self._extract_text_from_html(merged_html)
            text_filename = f"{base_name}_content.txt"
            text_path = os.path.join(output_dir, text_filename)
            
            with open(text_path, 'w', encoding='utf-8') as f:
                f.write(text_content)
            
            # 返回相对路径
            html_relative = f"processed/{html_filename}"
            text_relative = f"processed/{text_filename}"
            
            logger.info(f"OCR处理完成: {os.path.basename(file_path)}")
            return True, html_relative, text_relative
            
        except Exception as e:
            logger.error(f"OCR处理失败: {str(e)}")
            return False, None, None
    
    def is_available(self) -> bool:
        """检查OCR服务是否可用"""
        return True  # GLM-4.1V服务始终可用

# 创建服务实例
ocr_service = GLMOCRService()