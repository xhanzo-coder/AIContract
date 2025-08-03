#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('final_pdf_converted.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

total_lines = len(lines)
non_empty_lines = len([l for l in lines if l.strip()])
content_lines = len([l for l in lines if l.strip() and not l.strip().startswith('【')])

print(f"📊 TXT文件统计：")
print(f"   - 总行数: {total_lines}")
print(f"   - 非空行数: {non_empty_lines}")
print(f"   - 内容段落数: {content_lines}")
print(f"   - 标题/标识行数: {non_empty_lines - content_lines}")

# 分析段落类型
title_lines = 0
list_lines = 0
table_lines = 0
normal_lines = 0

for line in lines:
    line = line.strip()
    if not line:
        continue
    if line.startswith('【H'):
        title_lines += 1
    elif line.startswith('•'):
        list_lines += 1
    elif line.startswith('【表格】'):
        table_lines += 1
    elif line.startswith('【'):
        pass  # 其他标识
    else:
        normal_lines += 1

print(f"\n📋 段落类型分析：")
print(f"   - 标题段落: {title_lines}")
print(f"   - 列表项: {list_lines}")
print(f"   - 表格内容: {table_lines}")
print(f"   - 普通段落: {normal_lines}")