#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试搜索API的正确调用方式
"""
import requests
import json
import urllib.parse

# 基础URL
base_url = 'http://localhost:8000'

def main():
    print('=== 正确的API端点路径 ===')
    print('1. Elasticsearch状态检查:')
    print(f'   GET {base_url}/api/v1/contracts/elasticsearch/status')
    print()

    print('2. 初始化Elasticsearch索引:')
    print(f'   POST {base_url}/api/v1/contracts/elasticsearch/init')
    print()

    print('3. 同步合同数据到Elasticsearch:')
    print(f'   POST {base_url}/api/v1/contracts/{{contract_id}}/elasticsearch/sync')
    print()

    print('4. 搜索合同内容:')
    search_term = "职业病危害因素分类目录"
    encoded_term = urllib.parse.quote(search_term)
    print(f'   GET {base_url}/api/v1/contracts/elasticsearch/search?q={encoded_term}&page=1&size=10')
    print()

    print('5. 在特定合同中搜索:')
    print(f'   GET {base_url}/api/v1/contracts/elasticsearch/search?q={encoded_term}&contract_id=1&page=1&size=10')
    print()

    print('=== 测试Elasticsearch状态 ===')
    try:
        response = requests.get(f'{base_url}/api/v1/contracts/elasticsearch/status')
        print(f'状态码: {response.status_code}')
        print(f'响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}')
    except Exception as e:
        print(f'请求失败: {e}')

    print()
    print('=== 搜索示例 ===')
    print(f'如果要搜索"{search_term}"，正确的请求是:')
    print(f'GET {base_url}/api/v1/contracts/elasticsearch/search?q={encoded_term}&page=1&size=10')
    print()
    print('预期的返回结果格式:')
    expected_response = {
        "success": True,
        "message": "Elasticsearch搜索完成",
        "data": {
            "total": 5,
            "page": 1,
            "size": 10,
            "chunks": [
                {
                    "id": 123,
                    "contract_id": 1,
                    "contract_name": "某某合同",
                    "chunk_index": 2,
                    "content": f"...{search_term}相关内容...",
                    "highlighted_content": f"...<em>{search_term}</em>相关内容...",
                    "score": 0.85
                }
            ]
        }
    }
    print(json.dumps(expected_response, ensure_ascii=False, indent=2))

    print()
    print('=== 实际测试搜索功能 ===')
    try:
        # 测试搜索
        search_url = f'{base_url}/api/v1/contracts/elasticsearch/search'
        params = {
            'q': search_term,
            'page': 1,
            'size': 10
        }
        response = requests.get(search_url, params=params)
        print(f'搜索请求状态码: {response.status_code}')
        print(f'搜索响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}')
    except Exception as e:
        print(f'搜索请求失败: {e}')

if __name__ == "__main__":
    main()