"""
合同内容分块处理服务
基于文本分割的分块功能，专门针对合同文档进行优化
"""
import os
import re
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime

# 配置日志
logger = logging.getLogger(__name__)

from app.config import settings


class ContractChunkService:
    """合同文档分块处理服务"""
    
    def __init__(self, 
                 chunk_size: int = 1000,
                 chunk_overlap: int = 200,
                 separators: Optional[List[str]] = None):
        """
        初始化分块服务
        
        Args:
            chunk_size: 分块大小（字符数）
            chunk_overlap: 分块重叠大小
            separators: 自定义分隔符列表
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        # 针对中文合同文档优化的分隔符
        self.separators = separators or [
            "\n\n",  # 段落分隔
            "\n",    # 行分隔
            "。",    # 中文句号
            "；",    # 中文分号
            "，",    # 中文逗号
            ".",     # 英文句号
            ";",     # 英文分号
            ",",     # 英文逗号
            " ",     # 空格
            ""       # 字符级别分割
        ]
    
    def _split_text_recursive(self, text: str, separators: List[str], chunk_size: int, chunk_overlap: int) -> List[str]:
        """
        递归文本分割方法
        
        Args:
            text: 要分割的文本
            separators: 分隔符列表
            chunk_size: 分块大小
            chunk_overlap: 重叠大小
            
        Returns:
            分割后的文本块列表
        """
        if not text or len(text) <= chunk_size:
            return [text] if text else []
        
        # 尝试使用分隔符分割
        for separator in separators:
            if separator in text:
                splits = text.split(separator)
                if len(splits) > 1:
                    # 递归处理每个分割部分
                    chunks = []
                    current_chunk = ""
                    
                    for split in splits:
                        if not split:
                            continue
                            
                        # 如果当前块加上新分割会超过大小限制
                        if len(current_chunk) + len(split) + len(separator) > chunk_size:
                            if current_chunk:
                                chunks.append(current_chunk.strip())
                                # 处理重叠
                                if chunk_overlap > 0 and len(current_chunk) > chunk_overlap:
                                    current_chunk = current_chunk[-chunk_overlap:] + separator + split
                                else:
                                    current_chunk = split
                            else:
                                # 单个分割就超过大小，需要进一步分割
                                sub_chunks = self._split_text_recursive(split, separators[1:], chunk_size, chunk_overlap)
                                chunks.extend(sub_chunks)
                        else:
                            if current_chunk:
                                current_chunk += separator + split
                            else:
                                current_chunk = split
                    
                    # 添加最后一个块
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    
                    return [chunk for chunk in chunks if chunk.strip()]
        
        # 如果没有分隔符可用，按字符强制分割
        chunks = []
        for i in range(0, len(text), chunk_size - chunk_overlap):
            chunk = text[i:i + chunk_size]
            if chunk.strip():
                chunks.append(chunk.strip())
        
        return chunks
    
    def _preprocess_text(self, text: str) -> str:
        """
        文本预处理
        
        Args:
            text: 原始文本
            
        Returns:
            处理后的文本
        """
        if not text:
            return ""
            
        # 移除多余的空白字符
        text = re.sub(r'\s+', ' ', text)
        
        # 标准化换行符
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        
        return text.strip()
    
    def _calculate_positions(self, original_text: str, chunks: List[str]) -> List[Tuple[int, int]]:
        """计算每个分块在原文中的位置"""
        positions = []
        search_start = 0
        
        for chunk in chunks:
            # 清理分块文本用于匹配
            clean_chunk = chunk.strip()
            if not clean_chunk:
                positions.append((0, 0))
                continue
            
            # 在原文中查找分块位置
            start_pos = original_text.find(clean_chunk, search_start)
            
            if start_pos == -1:
                # 如果直接匹配失败，尝试模糊匹配
                # 取分块的前50个字符进行匹配
                chunk_prefix = clean_chunk[:50]
                start_pos = original_text.find(chunk_prefix, search_start)
                
                if start_pos != -1:
                    end_pos = start_pos + len(clean_chunk)
                else:
                    # 如果仍然失败，使用估算位置
                    start_pos = search_start
                    end_pos = search_start + len(clean_chunk)
            else:
                end_pos = start_pos + len(clean_chunk)
            
            positions.append((start_pos, end_pos))
            search_start = max(start_pos + 1, end_pos - self.chunk_overlap)
        
        return positions
    
    def _extract_metadata(self, chunk_text: str, chunk_index: int, total_chunks: int) -> Dict[str, Any]:
        """
        提取分块元数据
        
        Args:
            chunk_text: 分块文本
            chunk_index: 分块索引
            total_chunks: 总分块数
            
        Returns:
            元数据字典
        """
        metadata = {
            "chunk_index": chunk_index,
            "total_chunks": total_chunks,
            "chunk_length": len(chunk_text),
            "word_count": len(chunk_text.split()),
            "char_count": len(chunk_text),
            "has_chinese": bool(re.search(r'[\u4e00-\u9fff]', chunk_text)),
            "created_at": datetime.now().isoformat()
        }
        
        # 提取关键词（简单实现）
        keywords = self._extract_keywords(chunk_text)
        if keywords:
            metadata["keywords"] = keywords
            
        return metadata
    
    def _extract_keywords(self, text: str, max_keywords: int = 5) -> List[str]:
        """
        简单的关键词提取
        
        Args:
            text: 文本内容
            max_keywords: 最大关键词数量
            
        Returns:
            关键词列表
        """
        # 移除标点符号
        clean_text = re.sub(r'[^\u4e00-\u9fff\w\s]', ' ', text)
        
        # 分词（简单按空格分割）
        words = clean_text.split()
        
        # 过滤短词和常见词
        stop_words = {'的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'}
        keywords = [word for word in words if len(word) > 1 and word not in stop_words]
        
        # 统计词频
        word_freq = {}
        for word in keywords:
            word_freq[word] = word_freq.get(word, 0) + 1
        
        # 按频率排序并返回前N个
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        return [word for word, freq in sorted_words[:max_keywords]]
    
    def process_text_file(self, file_path: str) -> List[Dict[str, Any]]:
        """
        处理文本文件并返回分块结果
        
        Args:
            file_path: 文本文件路径（相对于UPLOAD_DIR）
            
        Returns:
            分块结果列表，每个元素包含文本内容和元数据
        """
        try:
            # 构建完整文件路径
            if not os.path.isabs(file_path):
                full_path = os.path.join(settings.UPLOAD_DIR, file_path)
            else:
                full_path = file_path
                
            # 检查文件是否存在
            if not os.path.exists(full_path):
                logger.error(f"文件不存在: {full_path}")
                return []
            
            # 读取文件内容
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if not content.strip():
                logger.warning(f"文件内容为空: {file_path}")
                return []
            
            # 预处理文本
            processed_content = self._preprocess_text(content)
            
            # 使用自定义方法分割文本
            chunks = self._split_text_recursive(
                processed_content, 
                self.separators, 
                self.chunk_size, 
                self.chunk_overlap
            )
            
            # 构建结果
            results = []
            for i, chunk in enumerate(chunks):
                if not chunk.strip():
                    continue
                    
                chunk_data = {
                    "content": chunk,
                    "metadata": self._extract_metadata(chunk, i, len(chunks)),
                    "position": {
                        "chunk_index": i,
                        "start_char": processed_content.find(chunk) if chunk in processed_content else -1
                    }
                }
                results.append(chunk_data)
            
            logger.info(f"文件分块完成: {file_path}, 共生成 {len(results)} 个分块")
            return results
            
        except Exception as e:
            logger.error(f"处理文件失败 {file_path}: {str(e)}")
            raise
    
    def update_chunk_config(self, chunk_size: int = None, chunk_overlap: int = None):
        """
        更新分块配置
        
        Args:
            chunk_size: 新的分块大小
            chunk_overlap: 新的重叠大小
        """
        if chunk_size is not None:
            self.chunk_size = chunk_size
            
        if chunk_overlap is not None:
            self.chunk_overlap = chunk_overlap
            
        logger.info(f"分块配置已更新: chunk_size={self.chunk_size}, chunk_overlap={self.chunk_overlap}")
    
    def get_chunk_preview(self, text: str, max_chunks: int = 3) -> List[Dict[str, Any]]:
        """
        获取文本分块预览
        
        Args:
            text: 要预览的文本
            max_chunks: 最大预览分块数
            
        Returns:
            预览分块列表
        """
        try:
            # 预处理文本
            processed_text = self._preprocess_text(text)
            
            # 执行分块
            chunks = self._split_text_recursive(
                processed_text, 
                self.separators, 
                self.chunk_size, 
                self.chunk_overlap
            )
            
            # 限制预览数量
            preview_chunks = chunks[:max_chunks]
            
            # 构建预览结果
            results = []
            for i, chunk in enumerate(preview_chunks):
                metadata = self._extract_metadata(chunk, i, len(preview_chunks))
                
                preview_data = {
                    "chunk_index": i,
                    "content_preview": chunk[:200] + "..." if len(chunk) > 200 else chunk,
                    "chunk_size": len(chunk),
                    "metadata": metadata
                }
                results.append(preview_data)
            
            return results
            
        except Exception as e:
            logger.error(f"获取分块预览失败: {str(e)}")
            return []


# 创建服务实例
chunk_service = ContractChunkService()