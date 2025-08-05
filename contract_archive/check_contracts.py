#!/usr/bin/env python3
import requests
import json

def check_contracts():
    try:
        response = requests.get('http://localhost:8000/api/v1/contracts/')
        print(f'状态码: {response.status_code}')
        if response.status_code == 200:
            data = response.json()
            print(f'响应数据: {json.dumps(data, indent=2, ensure_ascii=False)}')
            if 'data' in data:
                contract_data = data['data']
                print(f'合同总数: {contract_data.get("total", 0)}')
                contracts = contract_data.get('contracts', [])
                for contract in contracts:
                    print(f'ID: {contract["id"]}, 文件名: {contract["file_name"]}, 状态: {contract["status"]}')
        else:
            print(f'错误: {response.text}')
    except Exception as e:
        print(f'请求失败: {e}')

if __name__ == "__main__":
    check_contracts()