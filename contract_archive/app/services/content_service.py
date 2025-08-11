"""
合同内容处理服务
整合文档分块处理和数据库存储功能
"""
import os
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session
from sqlalchemy import text, func

# 配置日志
logger = logging.getLogger(__name__)

from app.models.database import get_db
from app.models.models import Contract, ContractContent
from app.services.chunk_service import chunk_service
from app.services.elasticsearch_service import elasticsearch_service
from app.config import settings


class ContentProcessingService:
    """内容处理服务"""
    
    def __init__(self):
        """初始化内容处理服务"""
        self.chunk_service = chunk_service
        logger.info("ContentProcessingService 初始化完成")
    
    def check_content_status(self, contract_id: int, db: Session) -> Dict[str, Any]:
        """
        检查合同内容处理状态
        
        Returns:
            Dict: 包含处理状态信息
        """
        try:
            # 查询合同信息
            contract = db.query(Contract).filter(Contract.id == contract_id).first()
            if not contract:
                return {
                    "status": "not_found",
                    "message": "合同不存在",
                    "contract_id": contract_id
                }
            
            # 检查 OCR 状态
            if contract.ocr_status != "completed":
                return {
                    "status": "ocr_pending",
                    "message": "OCR处理未完成",
                    "contract_id": contract_id,
                    "ocr_status": contract.ocr_status
                }
            
            # 检查是否已有分块内容
            chunk_count = db.query(ContractContent).filter(
                ContractContent.contract_id == contract_id
            ).count()
            
            if chunk_count > 0:
                return {
                    "status": "completed",
                    "message": "内容处理已完成",
                    "contract_id": contract_id,
                    "chunk_count": chunk_count,
                    "last_processed": contract.updated_at
                }
            else:
                return {
                    "status": "ready",
                    "message": "可以开始内容处理",
                    "contract_id": contract_id,
                    "text_content_path": contract.text_content_path
                }
                
        except Exception as e:
            logger.error(f"检查内容状态失败 contract_id={contract_id}: {str(e)}")
            return {
                "status": "error",
                "message": f"检查状态失败: {str(e)}",
                "contract_id": contract_id
            }
    
    def process_contract_content(self, contract_id: int, db: Session) -> Dict[str, Any]:
        """
        处理合同内容分块
        
        Args:
            contract_id: 合同ID
            db: 数据库会话
            
        Returns:
            Dict: 处理结果
        """
        try:
            # 检查合同状态
            status_info = self.check_content_status(contract_id, db)
            
            if status_info["status"] != "ready":
                return status_info
            
            # 获取合同信息
            contract = db.query(Contract).filter(Contract.id == contract_id).first()
            text_content_path = contract.text_content_path
            
            if not text_content_path:
                return {
                    "status": "error",
                    "message": "TXT文件路径不存在",
                    "contract_id": contract_id
                }
            
            logger.info(f"开始处理合同内容 contract_id={contract_id}, file={text_content_path}")
            
            # 执行分块处理
            chunks = self.chunk_service.process_text_file(text_content_path)
            
            if not chunks:
                return {
                    "status": "error",
                    "message": "分块处理失败或文件为空",
                    "contract_id": contract_id
                }
            
            # 清理现有的分块数据（如果有）
            db.query(ContractContent).filter(
                ContractContent.contract_id == contract_id
            ).delete()
            
            # 批量插入分块数据
            content_records = []
            for i, chunk_data in enumerate(chunks):
                # 从分块服务返回的数据结构中提取信息
                metadata = chunk_data.get("metadata", {})
                
                content_record = ContractContent(
                    contract_id=contract_id,
                    chunk_index=metadata.get("chunk_index", i),
                    content_text=chunk_data["content"],
                    chunk_type="paragraph",  # 默认类型
                    chunk_size=metadata.get("chunk_length", len(chunk_data["content"])),
                    vector_status="pending"
                )
                content_records.append(content_record)
            
            # 批量插入
            db.bulk_save_objects(content_records)
            db.commit()
            
            logger.info(f"合同内容处理完成 contract_id={contract_id}, 共生成 {len(chunks)} 个分块")
            
            return {
                "status": "success",
                "message": "内容处理完成",
                "contract_id": contract_id,
                "chunk_count": len(chunks),
                "processed_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"合同内容处理失败 contract_id={contract_id}: {str(e)}")
            return {
                "status": "error",
                "message": f"处理失败: {str(e)}",
                "contract_id": contract_id
            }
    
    def get_contract_chunks(
        self, 
        contract_id: int, 
        db: Session, 
        page: int = 1, 
        size: int = 10,
        chunk_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取合同分块内容
        
        Args:
            contract_id: 合同ID
            db: 数据库会话
            page: 页码
            size: 每页大小
            chunk_type: 分块类型过滤
            
        Returns:
            Dict: 分块内容和分页信息
        """
        try:
            # 构建查询
            query = db.query(ContractContent).filter(
                ContractContent.contract_id == contract_id
            )
            
            if chunk_type:
                query = query.filter(ContractContent.chunk_type == chunk_type)
            
            # 按分块索引排序
            query = query.order_by(ContractContent.chunk_index)
            
            # 计算总数
            total = query.count()
            
            # 分页查询
            offset = (page - 1) * size
            chunks = query.offset(offset).limit(size).all()
            
            # 转换为字典格式
            chunk_list = []
            for chunk in chunks:
                chunk_dict = {
                    "id": chunk.id,
                    "chunk_index": chunk.chunk_index,
                    "content_text": chunk.content_text,
                    "chunk_type": chunk.chunk_type,
                    "chunk_size": chunk.chunk_size,
                    "vector_status": chunk.vector_status,
                    "created_at": chunk.created_at.isoformat() if chunk.created_at else None
                }
                chunk_list.append(chunk_dict)
            
            # 计算分页信息
            total_pages = (total + size - 1) // size
            
            return {
                "status": "success",
                "data": {
                    "chunks": chunk_list,
                    "pagination": {
                        "page": page,
                        "size": size,
                        "total": total,
                        "total_pages": total_pages,
                        "has_next": page < total_pages,
                        "has_prev": page > 1
                    }
                },
                "contract_id": contract_id
            }
            
        except Exception as e:
            logger.error(f"获取合同分块失败 contract_id={contract_id}: {str(e)}")
            return {
                "status": "error",
                "message": f"获取分块失败: {str(e)}",
                "contract_id": contract_id
            }
    
    def search_chunks(
        self, 
        contract_id: Optional[int], 
        query: str, 
        db: Session,
        page: int = 1,
        size: int = 10
    ) -> Dict[str, Any]:
        """
        在合同分块中搜索关键词
        
        Args:
            contract_id: 合同ID，None表示全局搜索
            query: 搜索关键词
            db: 数据库会话
            page: 页码
            size: 每页大小
            
        Returns:
            Dict: 搜索结果
        """
        try:
            # 优先使用Elasticsearch搜索
            if elasticsearch_service.is_available():
                logger.info(f"使用Elasticsearch搜索 contract_id={contract_id}, query={query}")
                
                # 使用Elasticsearch搜索
                contract_ids = [contract_id] if contract_id is not None else None
                es_results = elasticsearch_service.search_content(
                    query=query,
                    contract_ids=contract_ids,
                    limit=size * 2  # 获取更多结果以便分页
                )
                
                # 处理分页
                start_idx = (page - 1) * size
                end_idx = start_idx + size
                paginated_results = es_results[start_idx:end_idx]
                
                # 转换为标准格式
                chunk_list = []
                for result in paginated_results:
                    # 处理高亮文本
                    highlighted_text = result["content_text"]
                    if "highlights" in result and "content_text" in result["highlights"]:
                        highlighted_text = " ... ".join(result["highlights"]["content_text"])
                    
                    chunk_dict = {
                        "id": result["chunk_id"],
                        "chunk_index": result["chunk_index"],
                        "content_text": result["content_text"],
                        "highlighted_text": highlighted_text,
                        "chunk_type": result["chunk_type"],
                        "chunk_size": len(result["content_text"]),
                        "relevance_score": result["score"],
                        # 合同基础信息
                        "contract_id": result.get("contract_id"),
                        "contract_number": result.get("contract_number"),
                        "contract_name": result.get("contract_name"),
                        # 新添加的文档元信息字段
                        "file_name": result.get("file_name"),
                        "file_format": result.get("file_format"),
                        "upload_time": result.get("upload_time"),
                        "contract_type": result.get("contract_type")
                    }
                    chunk_list.append(chunk_dict)
                
                # 计算分页信息
                total = len(es_results)
                total_pages = (total + size - 1) // size
                
                return {
                    "status": "success",
                    "data": {
                        "chunks": chunk_list,
                        "pagination": {
                            "page": page,
                            "size": size,
                            "total": total,
                            "total_pages": total_pages,
                            "has_next": page < total_pages,
                            "has_prev": page > 1
                        },
                        "query": query,
                        "search_engine": "elasticsearch"
                    },
                    "contract_id": contract_id
                }
            
            else:
                # 回退到SQL搜索
                logger.info(f"Elasticsearch不可用，使用SQL搜索 contract_id={contract_id}, query={query}")
                
                # 构建搜索查询
                search_query = db.query(ContractContent).filter(
                    ContractContent.content_text.contains(query)
                )
                
                # 如果指定了合同ID，添加过滤条件
                if contract_id is not None:
                    search_query = search_query.filter(ContractContent.contract_id == contract_id)
                
                search_query = search_query.order_by(ContractContent.chunk_index)
                
                # 计算总数
                total = search_query.count()
                
                # 分页查询
                offset = (page - 1) * size
                chunks = search_query.offset(offset).limit(size).all()
                
                # 转换为字典格式并添加高亮信息
                chunk_list = []
                for chunk in chunks:
                    # 简单的关键词高亮
                    highlighted_text = chunk.content_text.replace(
                        query, f"<mark>{query}</mark>"
                    )
                    
                    chunk_dict = {
                        "id": chunk.id,
                        "chunk_index": chunk.chunk_index,
                        "content_text": chunk.content_text,
                        "highlighted_text": highlighted_text,
                        "chunk_type": chunk.chunk_type,
                        "chunk_size": chunk.chunk_size,
                        "relevance_score": 1.0
                    }
                    chunk_list.append(chunk_dict)
                
                # 计算分页信息
                total_pages = (total + size - 1) // size
                
                return {
                    "status": "success",
                    "data": {
                        "chunks": chunk_list,
                        "pagination": {
                            "page": page,
                            "size": size,
                            "total": total,
                            "total_pages": total_pages,
                            "has_next": page < total_pages,
                            "has_prev": page > 1
                        },
                        "query": query,
                        "search_engine": "sql"
                    },
                    "contract_id": contract_id
                }
            
        except Exception as e:
            logger.error(f"搜索合同分块失败 contract_id={contract_id}, query={query}: {str(e)}")
            return {
                "status": "error",
                "message": f"搜索失败: {str(e)}",
                "contract_id": contract_id
            }
    
    def sync_to_elasticsearch(self, contract_id: int, db: Session) -> Dict[str, Any]:
        """
        将合同数据同步到Elasticsearch
        
        Args:
            contract_id: 合同ID
            db: 数据库会话
            
        Returns:
            Dict: 同步结果
        """
        try:
            if not elasticsearch_service.is_available():
                # 更新状态为失败
                contract = db.query(Contract).filter(Contract.id == contract_id).first()
                if contract:
                    contract.elasticsearch_sync_status = "failed"
                    db.commit()
                return {
                    "status": "error",
                    "message": "Elasticsearch服务不可用",
                    "contract_id": contract_id
                }
            
            # 获取合同信息
            contract = db.query(Contract).filter(Contract.id == contract_id).first()
            if not contract:
                return {
                    "status": "error",
                    "message": "合同不存在",
                    "contract_id": contract_id
                }
            
            # 更新状态为处理中
            contract.elasticsearch_sync_status = "processing"
            db.commit()
            
            # 同步合同基本信息
            contract_data = {
                "id": contract.id,
                "contract_number": contract.contract_number,
                "contract_name": contract.contract_name,
                "contract_type": contract.contract_type or "",
                "file_name": contract.file_name,
                "upload_time": contract.upload_time,
                "created_at": contract.created_at
            }
            
            contract_synced = elasticsearch_service.index_contract(contract_data)
            
            # 获取合同内容块
            chunks = db.query(ContractContent).filter(
                ContractContent.contract_id == contract_id
            ).all()
            
            # 同步内容块
            chunks_synced = 0
            for chunk in chunks:
                chunk_data = {
                    "id": chunk.id,
                    "contract_id": chunk.contract_id,
                    "chunk_index": chunk.chunk_index,
                    "content_text": chunk.content_text,
                    "chunk_type": chunk.chunk_type,
                    "chunk_size": chunk.chunk_size,
                    "created_at": chunk.created_at
                }
                
                contract_info = {
                    "contract_number": contract.contract_number,
                    "contract_name": contract.contract_name,
                    "file_name": contract.file_name,
                    "file_format": contract.file_format,
                    "upload_time": contract.upload_time,
                    "contract_type": contract.contract_type
                }
                
                if elasticsearch_service.index_content_chunk(chunk_data, contract_info):
                    chunks_synced += 1
            
            # 检查同步结果并更新状态
            if contract_synced and chunks_synced == len(chunks):
                contract.elasticsearch_sync_status = "completed"
                logger.info(f"同步到Elasticsearch完成 contract_id={contract_id}, chunks={chunks_synced}")
            else:
                contract.elasticsearch_sync_status = "failed"
                logger.warning(f"同步到Elasticsearch部分失败 contract_id={contract_id}, chunks_synced={chunks_synced}, total={len(chunks)}")
            
            db.commit()
            
            return {
                "status": "success" if contract.elasticsearch_sync_status == "completed" else "partial",
                "message": "同步完成" if contract.elasticsearch_sync_status == "completed" else "部分同步失败",
                "contract_id": contract_id,
                "contract_synced": contract_synced,
                "chunks_synced": chunks_synced,
                "total_chunks": len(chunks)
            }
            
        except Exception as e:
            logger.error(f"同步到Elasticsearch失败 contract_id={contract_id}: {str(e)}")
            # 更新状态为失败
            try:
                contract = db.query(Contract).filter(Contract.id == contract_id).first()
                if contract:
                    contract.elasticsearch_sync_status = "failed"
                    db.commit()
            except Exception as db_error:
                logger.error(f"更新同步状态失败: {str(db_error)}")
            
            return {
                "status": "error",
                "message": f"同步失败: {str(e)}",
                "contract_id": contract_id
            }

    def delete_contract_chunks(self, contract_id: int, db: Session) -> Dict[str, Any]:
        """
        删除合同的所有分块内容，并重置相关状态
        
        Args:
            contract_id: 合同ID
            db: 数据库会话
            
        Returns:
            Dict: 删除结果
        """
        try:
            # 删除分块内容
            deleted_count = db.query(ContractContent).filter(
                ContractContent.contract_id == contract_id
            ).delete()
            
            # 更新合同状态，重置内容和向量状态为pending
            contract = db.query(Contract).filter(Contract.id == contract_id).first()
            if contract:
                contract.content_status = "pending"
                contract.vector_status = "pending"
                contract.elasticsearch_sync_status = "pending"
            
            db.commit()
            
            logger.info(f"删除合同分块完成 contract_id={contract_id}, 删除数量={deleted_count}")
            
            return {
                "status": "success",
                "message": "分块内容删除完成，状态已重置",
                "contract_id": contract_id,
                "deleted_count": deleted_count
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"删除合同分块失败 contract_id={contract_id}: {str(e)}")
            return {
                "status": "error",
                "message": f"删除失败: {str(e)}",
                "contract_id": contract_id
            }


# 创建服务实例
content_service = ContentProcessingService()