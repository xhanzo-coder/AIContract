#!/usr/bin/env python3
"""
测试分块服务功能
"""
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.chunk_service import ContractChunkService

def test_chunk_service():
    """测试分块服务"""
    print("=== 测试分块服务 ===")
    
    # 创建分块服务实例
    chunk_service = ContractChunkService(chunk_size=200, chunk_overlap=50)
    print("✓ 分块服务创建成功")
    
    # 测试文本
    test_text = """
    这是一份测试合同文档。本合同由甲方和乙方共同签署。
    
    第一条：合同目的
    本合同旨在明确双方的权利和义务，确保合作顺利进行。
    
    第二条：合同期限
    本合同自签署之日起生效，有效期为一年。
    
    第三条：双方责任
    甲方负责提供必要的资源和支持。
    乙方负责按时完成约定的工作任务。
    
    第四条：违约责任
    任何一方违反本合同条款，应承担相应的法律责任。
    """
    
    # 测试分块预览
    print("\n--- 测试分块预览 ---")
    preview = chunk_service.get_chunk_preview(test_text, max_chunks=3)
    for i, chunk in enumerate(preview):
        print(f"分块 {i+1}:")
        print(f"  大小: {chunk['chunk_size']} 字符")
        print(f"  预览: {chunk['content_preview'][:100]}...")
        print(f"  元数据: {chunk['metadata']}")
        print()
    
    # 测试完整分块
    print("--- 测试完整分块 ---")
    # 创建临时测试文件
    test_file = "test_content.txt"
    with open(test_file, 'w', encoding='utf-8') as f:
        f.write(test_text)
    
    try:
        chunks = chunk_service.process_text_file(test_file)
        print(f"✓ 分块完成，共生成 {len(chunks)} 个分块")
        
        for i, chunk in enumerate(chunks):
            print(f"\n分块 {i+1}:")
            print(f"  内容长度: {len(chunk['content'])} 字符")
            print(f"  位置: {chunk['position']}")
            print(f"  元数据: {chunk['metadata']}")
            print(f"  内容预览: {chunk['content'][:100]}...")
            
    finally:
        # 清理测试文件
        if os.path.exists(test_file):
            os.remove(test_file)
    
    print("\n=== 测试完成 ===")

if __name__ == "__main__":
    test_chunk_service()