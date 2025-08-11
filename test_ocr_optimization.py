#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OCR优化测试脚本
测试优化后的OCR提示词效果
"""

import os
import sys
import asyncio
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from contract_archive.app.services.ocr_service import ocr_service

async def test_ocr_optimization():
    """
    测试OCR优化效果
    """
    print("=== OCR优化测试开始 ===")
    
    # 测试文件路径（选择一些有代表性的PDF文件）
    test_files = [
        "d:\\File\\Code\\AI Code\\Trae_Test\\data\\uploads\\13d9f6b179774f13bc0f79f80f72b7d6.pdf",
        "d:\\File\\Code\\AI Code\\Trae_Test\\data\\uploads\\bad456f2b27741c19c8a3a0b5e60a311.pdf"
    ]
    
    for i, pdf_path in enumerate(test_files, 1):
        if not os.path.exists(pdf_path):
            print(f"测试文件 {i}: {pdf_path} 不存在，跳过")
            continue
            
        print(f"\n--- 测试文件 {i}: {os.path.basename(pdf_path)} ---")
        
        try:
            # 执行OCR处理
            success, html_path, txt_path = await ocr_service.process_document(pdf_path)
            
            if success:
                print(f"✅ OCR处理成功")
                print(f"HTML文件: {html_path}")
                print(f"TXT文件: {txt_path}")
                
                # 检查生成的HTML文件
                if html_path and os.path.exists(html_path):
                    with open(html_path, 'r', encoding='utf-8') as f:
                        html_content = f.read()
                    
                    # 分析HTML内容质量
                    print(f"\n📊 内容分析:")
                    print(f"  - HTML文件大小: {len(html_content)} 字符")
                    
                    # 检查是否有标题
                    title_count = html_content.count('<h1>') + html_content.count('<h2>') + html_content.count('<h3>')
                    print(f"  - 标题数量: {title_count}")
                    
                    # 检查是否有思考过程残留
                    thinking_keywords = ['等等', '不过', '现在', '最终', '确定', '总结', '重新考虑', '或者', '但根据', '所以']
                    thinking_count = sum(html_content.count(keyword) for keyword in thinking_keywords)
                    print(f"  - 思考过程残留: {thinking_count} 个关键词")
                    
                    # 检查段落数量
                    paragraph_count = html_content.count('<p>')
                    print(f"  - 段落数量: {paragraph_count}")
                    
                    # 检查表格数量
                    table_count = html_content.count('<table>')
                    print(f"  - 表格数量: {table_count}")
                    
                    # 显示前200个字符的内容预览
                    import re
                    text_content = re.sub(r'<[^>]+>', '', html_content).strip()
                    preview = text_content[:200] + '...' if len(text_content) > 200 else text_content
                    print(f"\n📝 内容预览:\n{preview}")
                    
                else:
                    print("❌ HTML文件未生成")
                    
            else:
                print(f"❌ OCR处理失败")
                
        except Exception as e:
            print(f"❌ 处理过程中出错: {str(e)}")
    
    print("\n=== OCR优化测试完成 ===")

if __name__ == "__main__":
    asyncio.run(test_ocr_optimization())