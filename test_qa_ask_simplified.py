#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试简化后的qa/ask接口
验证：
1. 移除了三种搜索方式的分类
2. 移除了AI大模型回答功能
3. 只返回Elasticsearch搜索结果
"""

import requests
import json

def test_qa_ask_simplified():
    """测试简化后的qa/ask接口"""
    
    # API端点
    url = "http://localhost:8000/qa/ask"
    
    # 测试数据
    test_data = {
        "question": "再生资源"
    }
    
    print("=== 测试简化后的qa/ask接口 ===")
    print(f"请求URL: {url}")
    print(f"请求数据: {json.dumps(test_data, ensure_ascii=False, indent=2)}")
    print()
    
    try:
        # 发送POST请求
        response = requests.post(url, json=test_data)
        
        print(f"响应状态码: {response.status_code}")
        print()
        
        if response.status_code == 200:
            result = response.json()
            print("=== 响应结果 ===")
            print(json.dumps(result, ensure_ascii=False, indent=2))
            print()
            
            # 验证响应结构
            if result.get("success"):
                data = result.get("data", {})
                
                print("=== 验证结果 ===")
                print(f"✓ 请求成功: {result.get('success')}")
                print(f"✓ 问题: {data.get('question')}")
                print(f"✓ 回答: {data.get('answer')}")
                print(f"✓ 搜索方法: {data.get('search_method')}")
                print(f"✓ 找到相关合同数: {len(data.get('source_contracts', []))}")
                print(f"✓ 找到相关内容块数: {len(data.get('source_chunks', []))}")
                
                # 检查Elasticsearch结果
                es_results = data.get('elasticsearch_results', {})
                if es_results and 'hits' in es_results:
                    hits = es_results['hits']['hits']
                    print(f"✓ Elasticsearch搜索结果数: {len(hits)}")
                    
                    if hits:
                        print("\n=== 搜索结果示例 ===")
                        for i, hit in enumerate(hits[:2]):  # 显示前2个结果
                            source = hit.get('_source', {})
                            print(f"结果 {i+1}:")
                            print(f"  - 合同ID: {source.get('contract_id')}")
                            print(f"  - 合同名称: {source.get('contract_name')}")
                            print(f"  - 内容预览: {source.get('content_text', '')[:100]}...")
                            print(f"  - 评分: {hit.get('_score')}")
                            print()
                else:
                    print("⚠ 未找到Elasticsearch搜索结果")
                    
            else:
                print(f"✗ 请求失败: {result.get('message')}")
                
        else:
            print(f"✗ HTTP请求失败: {response.status_code}")
            print(f"响应内容: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"✗ 请求异常: {e}")
    except json.JSONDecodeError as e:
        print(f"✗ JSON解析失败: {e}")
    except Exception as e:
        print(f"✗ 其他错误: {e}")

if __name__ == "__main__":
    test_qa_ask_simplified()