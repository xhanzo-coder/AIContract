"""
BGE Reranker服务 - 基于SiliconFlow API
提供文档重排序功能，提升RAG检索质量
"""
import requests
import logging
from typing import List, Dict, Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)

class RerankService:
    """BGE Reranker重排序服务"""
    
    def __init__(self):
        """初始化Rerank服务"""
        self.api_key = settings.SILICONFLOW_API_KEY
        self.base_url = "https://api.siliconflow.cn/v1"
        self.model_name = "BAAI/bge-reranker-v2-m3"
        
        logger.info("RerankService 初始化完成")
    
    def rerank_documents(
        self, 
        query: str, 
        documents: List[str], 
        top_k: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        对文档进行重排序
        
        Args:
            query: 用户查询
            documents: 待排序的文档列表
            top_k: 返回的top文档数量，不设置则返回全部
            
        Returns:
            Dict: 重排序结果
        """
        try:
            if not documents:
                return {
                    "status": "success",
                    "message": "没有文档需要重排序",
                    "results": [],
                    "rerank_time": 0.0
                }
                
            import time
            start_time = time.time()
            
            # 构建API请求
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.model_name,
                "query": query,
                "documents": documents
            }
            
            # 如果指定了top_k，添加到请求中
            if top_k is not None:
                payload["top_k"] = top_k
            
            # 调用重排序API
            response = requests.post(
                f"{self.base_url}/rerank",
                json=payload,
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            rerank_time = (time.time() - start_time) * 1000  # 转换为毫秒
            
            # 解析API响应
            rerank_results = []
            if "results" in result:
                for item in result["results"]:
                    rerank_results.append({
                        "index": item.get("index", 0),
                        "document": item.get("document", ""),
                        "relevance_score": item.get("relevance_score", 0.0)
                    })
            
            logger.info(f"重排序完成，查询: {query[:50]}..., 文档数: {len(documents)}, 结果数: {len(rerank_results)}, 耗时: {rerank_time:.2f}ms")
            
            return {
                "status": "success",
                "message": "重排序完成",
                "query": query,
                "total_documents": len(documents),
                "rerank_time": rerank_time,
                "results": rerank_results
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"重排序API调用失败: {str(e)}")
            return {
                "status": "error",
                "message": f"重排序API调用失败: {str(e)}",
                "results": [],
                "rerank_time": 0.0
            }
        except Exception as e:
            logger.error(f"重排序处理失败: {str(e)}")
            return {
                "status": "error",
                "message": f"重排序处理失败: {str(e)}",
                "results": [],
                "rerank_time": 0.0
            }
    
    def rerank_chunks_with_metadata(
        self, 
        query: str, 
        chunks_data: List[Dict[str, Any]], 
        content_field: str = "content_text",
        top_k: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        对带有元数据的文档块进行重排序
        
        Args:
            query: 用户查询
            chunks_data: 包含内容和元数据的文档块列表
            content_field: 内容字段名，默认为"content_text"
            top_k: 返回的top文档数量
            
        Returns:
            Dict: 重排序结果（包含原始元数据）
        """
        try:
            if not chunks_data:
                return {
                    "status": "success",
                    "message": "没有文档块需要重排序",
                    "results": [],
                    "rerank_time": 0.0
                }
            
            # 提取文档内容
            documents = []
            for chunk in chunks_data:
                content = chunk.get(content_field, "")
                if content:
                    documents.append(content)
                else:
                    documents.append("")  # 保持索引对应关系
            
            # 调用重排序
            rerank_result = self.rerank_documents(query, documents, top_k)
            
            if rerank_result["status"] != "success":
                return rerank_result
            
            # 将重排序结果与原始元数据关联
            ranked_chunks = []
            for rank_item in rerank_result["results"]:
                original_index = rank_item["index"]
                if 0 <= original_index < len(chunks_data):
                    original_chunk = chunks_data[original_index].copy()
                    original_chunk.update({
                        "rerank_score": rank_item["relevance_score"],
                        "rerank_position": len(ranked_chunks) + 1
                    })
                    ranked_chunks.append(original_chunk)
            
            return {
                "status": "success",
                "message": "文档块重排序完成",
                "query": query,
                "total_chunks": len(chunks_data),
                "rerank_time": rerank_result["rerank_time"],
                "results": ranked_chunks
            }
            
        except Exception as e:
            logger.error(f"文档块重排序失败: {str(e)}")
            return {
                "status": "error",
                "message": f"文档块重排序失败: {str(e)}",
                "results": [],
                "rerank_time": 0.0
            }

# 创建全局服务实例
rerank_service = RerankService()