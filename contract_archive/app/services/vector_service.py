"""
BGE-M3向量化和Faiss存储服务
处理文档向量化和向量数据库存储
"""
import os
import json
import logging
import requests
import numpy as np
import faiss
from typing import List, Dict, Any, Optional
from pathlib import Path

from sqlalchemy.orm import Session
from app.models.models import Contract, ContractContent
from app.crud import contract_crud, content_crud
from app.config import settings

# 配置日志
logger = logging.getLogger(__name__)

class VectorService:
    """向量化服务"""
    
    def __init__(self):
        """初始化向量服务"""
        # BGE-M3 API配置
        self.api_url = settings.SILICONFLOW_BGE_URL
        self.api_key = settings.SILICONFLOW_API_KEY
        self.model_name = "BAAI/bge-m3"
        
        # Faiss索引配置
        self.vector_dimension = 1024  # BGE-M3向量维度
        self.faiss_index_path = Path(settings.FAISS_INDEX_PATH)
        self.faiss_index_path.mkdir(parents=True, exist_ok=True)
        
        # 初始化Faiss索引
        self.index = None
        self.vector_id_mapping = {}  # 向量ID到数据库ID的映射
        
        logger.info("VectorService 初始化完成")
    
    def _call_bge_m3_api(self, texts: List[str]) -> List[List[float]]:
        """
        调用BGE-M3 API获取向量
        
        Args:
            texts: 待向量化的文本列表
            
        Returns:
            List[List[float]]: 向量列表
        """
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            # 批量处理文本
            payload = {
                "model": self.model_name,
                "input": texts
            }
            
            response = requests.post(self.api_url, json=payload, headers=headers)
            response.raise_for_status()
            
            result = response.json()
            
            # 提取向量数据
            vectors = []
            if "data" in result:
                for item in result["data"]:
                    if "embedding" in item:
                        vectors.append(item["embedding"])
            
            logger.info(f"BGE-M3 API调用成功，处理了 {len(texts)} 个文本，生成 {len(vectors)} 个向量")
            return vectors
            
        except Exception as e:
            logger.error(f"BGE-M3 API调用失败: {str(e)}")
            raise Exception(f"向量化API调用失败: {str(e)}")
    
    def _initialize_faiss_index(self) -> faiss.Index:
        """
        初始化或加载Faiss索引
        
        Returns:
            faiss.Index: Faiss索引对象
        """
        try:
            index_file = self.faiss_index_path / "contract_vectors.index"
            mapping_file = self.faiss_index_path / "vector_mapping.json"
            
            # 尝试加载现有索引
            if index_file.exists() and mapping_file.exists():
                logger.info("加载现有Faiss索引")
                index = faiss.read_index(str(index_file))
                
                with open(mapping_file, 'r', encoding='utf-8') as f:
                    self.vector_id_mapping = json.load(f)
                
                logger.info(f"加载Faiss索引成功，包含 {index.ntotal} 个向量")
                return index
            else:
                # 创建新索引
                logger.info("创建新的Faiss索引")
                # 使用IndexFlatIP进行余弦相似度搜索
                index = faiss.IndexFlatIP(self.vector_dimension)
                
                # 保存空索引
                faiss.write_index(index, str(index_file))
                
                with open(mapping_file, 'w', encoding='utf-8') as f:
                    json.dump({}, f, ensure_ascii=False, indent=2)
                
                logger.info("创建Faiss索引成功")
                return index
                
        except Exception as e:
            logger.error(f"初始化Faiss索引失败: {str(e)}")
            raise Exception(f"Faiss索引初始化失败: {str(e)}")
    
    def _save_faiss_index(self):
        """保存Faiss索引到磁盘"""
        try:
            index_file = self.faiss_index_path / "contract_vectors.index"
            mapping_file = self.faiss_index_path / "vector_mapping.json"
            
            # 保存索引
            faiss.write_index(self.index, str(index_file))
            
            # 保存映射
            with open(mapping_file, 'w', encoding='utf-8') as f:
                json.dump(self.vector_id_mapping, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Faiss索引保存成功，包含 {self.index.ntotal} 个向量")
            
        except Exception as e:
            logger.error(f"保存Faiss索引失败: {str(e)}")
            raise Exception(f"保存Faiss索引失败: {str(e)}")
    
    def vectorize_contract_chunks(self, contract_id: int, db: Session) -> Dict[str, Any]:
        """
        对合同的所有分块进行向量化
        
        Args:
            contract_id: 合同ID
            db: 数据库会话
            
        Returns:
            Dict: 处理结果
        """
        try:
            # 检查合同是否存在
            contract = contract_crud.get_contract_by_id(db, contract_id)
            if not contract:
                return {
                    "status": "error",
                    "message": "合同不存在",
                    "contract_id": contract_id
                }
            
            # 更新合同向量化状态为处理中
            contract_crud.update_contract_status(
                db, contract_id, vector_status="processing"
            )
            
            # 获取所有未向量化的分块
            chunks = db.query(ContractContent).filter(
                ContractContent.contract_id == contract_id,
                ContractContent.vector_status == "pending"
            ).order_by(ContractContent.chunk_index).all()
            
            if not chunks:
                return {
                    "status": "error",
                    "message": "没有待处理的分块内容",
                    "contract_id": contract_id
                }
            
            logger.info(f"开始向量化合同 {contract_id} 的 {len(chunks)} 个分块")
            
            # 初始化Faiss索引
            if self.index is None:
                self.index = self._initialize_faiss_index()
            
            # 准备文本数据
            texts = [chunk.content_text for chunk in chunks]
            chunk_ids = [chunk.id for chunk in chunks]
            
            # 批量调用BGE-M3 API
            vectors = self._call_bge_m3_api(texts)
            
            if len(vectors) != len(chunks):
                raise Exception(f"向量数量({len(vectors)})与分块数量({len(chunks)})不匹配")
            
            # 转换为numpy数组并标准化
            vector_array = np.array(vectors, dtype=np.float32)
            
            # 对向量进行L2标准化（用于余弦相似度）
            faiss.normalize_L2(vector_array)
            
            # 获取当前索引大小作为起始ID
            start_vector_id = self.index.ntotal
            
            # 添加向量到Faiss索引
            self.index.add(vector_array)
            
            # 更新数据库记录
            for i, chunk in enumerate(chunks):
                vector_id = start_vector_id + i
                
                # 更新分块的向量ID和状态
                chunk.vector_id = str(vector_id)
                chunk.vector_status = "completed"
                
                # 更新向量ID映射
                self.vector_id_mapping[str(vector_id)] = {
                    "contract_id": contract_id,
                    "chunk_id": chunk.id,
                    "chunk_index": chunk.chunk_index
                }
            
            # 提交数据库更改
            db.commit()
            
            # 保存Faiss索引
            self._save_faiss_index()
            
            # 更新合同向量化状态为完成
            contract_crud.update_contract_status(
                db, contract_id, vector_status="completed"
            )
            
            logger.info(f"合同 {contract_id} 向量化完成，处理了 {len(chunks)} 个分块")
            
            return {
                "status": "success",
                "message": "向量化完成",
                "contract_id": contract_id,
                "processed_chunks": len(chunks),
                "total_vectors": self.index.ntotal
            }
            
        except Exception as e:
            db.rollback()
            # 更新合同状态为失败
            contract_crud.update_contract_status(
                db, contract_id, vector_status="failed"
            )
            
            logger.error(f"合同 {contract_id} 向量化失败: {str(e)}")
            return {
                "status": "error",
                "message": f"向量化失败: {str(e)}",
                "contract_id": contract_id
            }
    
    def vectorize_all_pending_contracts(self, db: Session) -> Dict[str, Any]:
        """
        向量化所有待处理的合同
        
        Args:
            db: 数据库会话
            
        Returns:
            Dict: 批量处理结果
        """
        try:
            # 获取所有向量状态为pending的合同
            pending_contracts = db.query(Contract).filter(
                Contract.vector_status == "pending",
                Contract.content_status == "completed"  # 确保内容处理已完成
            ).all()
            
            if not pending_contracts:
                return {
                    "status": "info",
                    "message": "没有待处理的合同",
                    "processed_contracts": 0
                }
            
            results = []
            success_count = 0
            failed_count = 0
            
            logger.info(f"开始批量向量化 {len(pending_contracts)} 个合同")
            
            for contract in pending_contracts:
                result = self.vectorize_contract_chunks(contract.id, db)
                results.append(result)
                
                if result["status"] == "success":
                    success_count += 1
                else:
                    failed_count += 1
            
            return {
                "status": "success",
                "message": f"批量向量化完成：成功 {success_count} 个，失败 {failed_count} 个",
                "total_contracts": len(pending_contracts),
                "success_count": success_count,
                "failed_count": failed_count,
                "results": results
            }
            
        except Exception as e:
            logger.error(f"批量向量化失败: {str(e)}")
            return {
                "status": "error",
                "message": f"批量向量化失败: {str(e)}",
                "processed_contracts": 0
            }
    
    def search_similar_vectors(self, query_text: str, top_k: int = 10) -> List[Dict[str, Any]]:
        """
        搜索相似向量
        
        Args:
            query_text: 查询文本
            top_k: 返回的相似向量数量
            
        Returns:
            List[Dict]: 相似度搜索结果
        """
        try:
            if self.index is None:
                self.index = self._initialize_faiss_index()
            
            if self.index.ntotal == 0:
                return []
            
            # 向量化查询文本
            query_vectors = self._call_bge_m3_api([query_text])
            
            if not query_vectors:
                return []
            
            # 转换为numpy数组并标准化
            query_vector = np.array([query_vectors[0]], dtype=np.float32)
            faiss.normalize_L2(query_vector)
            
            # 搜索相似向量
            scores, indices = self.index.search(query_vector, top_k)
            
            results = []
            for i, (score, idx) in enumerate(zip(scores[0], indices[0])):
                if idx >= 0:  # 有效索引
                    vector_id = str(idx)
                    if vector_id in self.vector_id_mapping:
                        mapping_info = self.vector_id_mapping[vector_id]
                        results.append({
                            "rank": i + 1,
                            "similarity_score": float(score),
                            "vector_id": vector_id,
                            "contract_id": mapping_info["contract_id"],
                            "chunk_id": mapping_info["chunk_id"],
                            "chunk_index": mapping_info["chunk_index"]
                        })
            
            return results
            
        except Exception as e:
            logger.error(f"向量搜索失败: {str(e)}")
            return []
    
    def search_vectors(self, query_text: str, top_k: int = 10, threshold: float = 0.7) -> Dict[str, Any]:
        """
        搜索相似向量
        
        Args:
            query_text: 查询文本
            top_k: 返回最相似的前K个结果
            threshold: 相似度阈值，低于此值的结果将被过滤
            
        Returns:
            Dict: 搜索结果
        """
        try:
            if self.index is None:
                self.index = self._initialize_faiss_index()
            
            if self.index.ntotal == 0:
                return {
                    "status": "info",
                    "message": "向量索引为空",
                    "results": []
                }
            
            # 向量化查询文本
            query_vectors = self._call_bge_m3_api([query_text])
            
            if not query_vectors:
                return {
                    "status": "error",
                    "message": "获取查询文本向量失败",
                    "results": []
                }
            
            # 转换为numpy数组并标准化
            query_vector = np.array([query_vectors[0]], dtype=np.float32)
            faiss.normalize_L2(query_vector)
            
            # 搜索相似向量
            scores, indices = self.index.search(query_vector.reshape(1, -1), top_k)
            
            # 构建结果
            results = []
            for i, (score, idx) in enumerate(zip(scores[0], indices[0])):
                if idx == -1:  # Faiss返回-1表示没有找到足够的向量
                    break
                    
                if score >= threshold:
                    vector_id = str(idx)
                    if vector_id in self.vector_id_mapping:
                        mapping_info = self.vector_id_mapping[vector_id]
                        results.append({
                            "contract_id": mapping_info["contract_id"],
                            "chunk_id": mapping_info["chunk_id"],
                            "similarity": float(score),
                            "rank": i + 1
                        })
            
            logger.info(f"向量搜索完成，查询: {query_text[:50]}..., 结果数: {len(results)}")
            
            return {
                "status": "success",
                "message": "向量搜索完成",
                "query": query_text,
                "total_results": len(results),
                "results": results
            }
            
        except Exception as e:
            logger.error(f"向量搜索失败: {str(e)}")
            return {
                "status": "error",
                "message": f"向量搜索失败: {str(e)}",
                "results": []
            }
    
    def remove_contract_vectors(self, contract_id: int, db: Session) -> Dict[str, Any]:
        """
        移除指定合同的所有向量数据
        
        Args:
            contract_id: 合同ID
            db: 数据库会话
            
        Returns:
            Dict: 删除结果
        """
        try:
            # 找到属于该合同的所有向量ID
            vectors_to_remove = []
            for vector_id, mapping in self.vector_id_mapping.items():
                if mapping["contract_id"] == contract_id:
                    vectors_to_remove.append(vector_id)
            
            if not vectors_to_remove:
                logger.info(f"合同 {contract_id} 没有找到向量数据")
                return {
                    "status": "success",
                    "message": "没有找到向量数据",
                    "contract_id": contract_id,
                    "removed_count": 0
                }
            
            # 从映射中删除
            for vector_id in vectors_to_remove:
                del self.vector_id_mapping[vector_id]
            
            # 保存更新后的映射
            self._save_faiss_index()
            
            # 重置合同的向量状态
            contract = db.query(Contract).filter(Contract.id == contract_id).first()
            if contract:
                contract.vector_status = "pending"
                
                # 同时重置所有分块的向量状态和vector_id
                db.query(ContractContent).filter(
                    ContractContent.contract_id == contract_id
                ).update({
                    "vector_status": "pending",
                    "vector_id": None
                })
                
                db.commit()
            
            logger.info(f"合同 {contract_id} 的向量数据清理完成，移除 {len(vectors_to_remove)} 个向量")
            
            return {
                "status": "success",
                "message": "向量数据清理完成",
                "contract_id": contract_id,
                "removed_count": len(vectors_to_remove)
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"移除合同向量数据失败 contract_id={contract_id}: {str(e)}")
            return {
                "status": "error",
                "message": f"移除失败: {str(e)}",
                "contract_id": contract_id
            }
    
    def reset_contract_vector_status(self, contract_id: int, db: Session) -> Dict[str, Any]:
        """
        重置合同的向量化状态为pending
        
        Args:
            contract_id: 合同ID
            db: 数据库会话
            
        Returns:
            Dict: 重置结果
        """
        try:
            contract = db.query(Contract).filter(Contract.id == contract_id).first()
            if not contract:
                return {
                    "status": "error",
                    "message": "合同不存在",
                    "contract_id": contract_id
                }
            
            # 重置合同向量状态
            contract.vector_status = "pending"
            
            # 重置所有分块的向量状态和vector_id
            updated_chunks = db.query(ContractContent).filter(
                ContractContent.contract_id == contract_id
            ).update({
                "vector_status": "pending",
                "vector_id": None
            })
            
            db.commit()
            
            logger.info(f"合同 {contract_id} 向量状态重置完成，影响 {updated_chunks} 个分块")
            
            return {
                "status": "success",
                "message": "向量状态重置完成",
                "contract_id": contract_id,
                "updated_chunks": updated_chunks
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"重置合同向量状态失败 contract_id={contract_id}: {str(e)}")
            return {
                "status": "error",
                "message": f"重置失败: {str(e)}",
                "contract_id": contract_id
            }


# 创建全局服务实例
vector_service = VectorService()