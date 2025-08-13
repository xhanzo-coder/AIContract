"""问答会话API路由"""
import uuid
import time
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models.database import get_db
from app.models.models import QASession, Contract, ContractContent
from app.schemas import (
    BaseResponse, QASessionCreate, QASessionResponse, 
    SessionListResponse, SessionHistoryResponse, FeedbackRequest
)
from app.services.elasticsearch_service import ElasticsearchService
from app.services.vector_service import vector_service
from app.services.rerank_service import rerank_service
from app.services.llm_service import llm_service

router = APIRouter(prefix="/qa", tags=["问答会话"]) 

# 初始化Elasticsearch服务
es_service = ElasticsearchService()

@router.post("/ask", response_model=BaseResponse, summary="提问并获取AI回答")
async def ask_question(
    request: QASessionCreate,
    db: Session = Depends(get_db)
):
    """提问并获取AI回答（混合RAG流程：Elasticsearch + 向量检索 + Rerank + LLM）"""
    try:
        start_time = time.time()
        
        # 生成会话ID（如果未提供）
        if not request.session_id:
            request.session_id = str(uuid.uuid4())
        
        # 获取当前会话的消息数量，确定消息顺序
        message_count = db.query(QASession).filter(
            QASession.session_id == request.session_id
        ).count()
        message_order = message_count + 1
        
        # 检索阶段：ES与向量双通道
        search_results = None
        es_chunks: List[dict] = []
        vector_results: List[dict] = []
        vector_chunks: List[dict] = []
        
        # 1) Elasticsearch基于关键词检索内容块
        try:
            search_results = es_service.search_content(
                query=request.question,
                limit=15
            )
            if search_results and "hits" in search_results:
                for hit in search_results["hits"]["hits"]:
                    src = hit.get("_source", {})
                    if not src:
                        continue
                    # 构建标准化的内容块结构（用于后续rerank/LLM）
                    es_chunks.append({
                        "chunk_id": src.get("chunk_id"),
                        "contract_id": src.get("contract_id"),
                        "chunk_index": src.get("chunk_index"),
                        "contract_name": src.get("contract_name"),
                        "contract_number": src.get("contract_number"),
                        "content_text": src.get("content_text", ""),
                        "es_score": hit.get("_score")
                    })
        except Exception as e:
            # ES失败不终止流程
            print(f"Elasticsearch搜索失败: {e}")
            search_results = None
        
        # 2) 向量检索（Faiss + BGE-M3）
        try:
            vector_results = vector_service.search_similar_vectors(
                query_text=request.question,
                top_k=15
            ) or []
            if vector_results:
                # 批量查询数据库，补全向量检索返回的块元数据
                vec_chunk_ids = [r["chunk_id"] for r in vector_results if r.get("chunk_id")]
                if vec_chunk_ids:
                    rows = db.query(ContractContent, Contract).join(
                        Contract, ContractContent.contract_id == Contract.id
                    ).filter(ContractContent.id.in_(vec_chunk_ids)).all()
                    # 建立映射，便于按chunk_id取回信息
                    by_chunk_id = {c.id: (c, ct) for (c, ct) in rows}
                    for r in vector_results:
                        cid = r.get("chunk_id")
                        if cid and cid in by_chunk_id:
                            content_obj, contract_obj = by_chunk_id[cid]
                            vector_chunks.append({
                                "chunk_id": content_obj.id,
                                "contract_id": content_obj.contract_id,
                                "chunk_index": content_obj.chunk_index,
                                "contract_name": contract_obj.contract_name,
                                "contract_number": contract_obj.contract_number,
                                "content_text": content_obj.content_text or "",
                                "vector_similarity": r.get("similarity_score")
                            })
        except Exception as e:
            print(f"向量检索失败: {e}")
            vector_results = []
        
        # 合并与去重（按chunk_id）
        merged_by_chunk: dict = {}
        for item in es_chunks:
            cid = item.get("chunk_id")
            if cid is not None:
                merged_by_chunk[cid] = item.copy()
        for item in vector_chunks:
            cid = item.get("chunk_id")
            if cid is None:
                continue
            if cid in merged_by_chunk:
                # 合并向量信息
                if item.get("vector_similarity") is not None:
                    merged_by_chunk[cid]["vector_similarity"] = item["vector_similarity"]
                # 优先保留有内容的文本
                if not merged_by_chunk[cid].get("content_text") and item.get("content_text"):
                    merged_by_chunk[cid]["content_text"] = item["content_text"]
                # 补齐合同基础信息
                for k in ("contract_name", "contract_number", "chunk_index"):
                    if merged_by_chunk[cid].get(k) is None and item.get(k) is not None:
                        merged_by_chunk[cid][k] = item[k]
            else:
                merged_by_chunk[cid] = item.copy()
        merged_chunks = list(merged_by_chunk.values())
        
        # Rerank排序（若有候选块）
        rerank_info = {"status": "skipped", "results": [], "rerank_time": 0.0}
        ranked_chunks = merged_chunks
        try:
            if merged_chunks:
                rerank_info = rerank_service.rerank_chunks_with_metadata(
                    query=request.question,
                    chunks_data=merged_chunks,
                    content_field="content_text",
                    top_k=min(10, len(merged_chunks))
                )
                if rerank_info.get("status") == "success" and rerank_info.get("results"):
                    ranked_chunks = rerank_info["results"]
        except Exception as e:
            print(f"Rerank失败: {e}")
        
        # 构造用于LLM的上下文（截取前N块）
        top_n_for_llm = min(6, len(ranked_chunks)) if ranked_chunks else 0
        selected_chunks = ranked_chunks[:top_n_for_llm] if top_n_for_llm > 0 else []
        
        # LLM生成回答
        llm_result = {
            "status": "skipped",
            "answer": "抱歉，未找到足够的相关内容来生成回答。",
            "llm_model": None,
            "llm_input_tokens": 0,
            "llm_output_tokens": 0,
            "llm_total_tokens": 0,
            "llm_time": 0.0,
            "finish_reason": None,
            "generation_status": "skipped"
        }
        try:
            llm_result = llm_service.generate_response(
                question=request.question,
                context_chunks=selected_chunks,
                max_tokens=800,
                temperature=0.7,
                top_p=0.9
            )
        except Exception as e:
            print(f"LLM生成失败: {e}")
        
        ai_answer = llm_result.get("answer") or "抱歉，暂时无法生成回答。"
        
        # 生成会话标题（基于第一个问题）
        session_title = None
        if message_order == 1:
            session_title = request.question[:50] + "..." if len(request.question) > 50 else request.question
        
        # 计算响应时间
        response_time = (time.time() - start_time) * 1000  # 毫秒
        
        # 将Elasticsearch结果转换为可序列化的格式，并包含RAG流程信息
        serializable_results = None
        if search_results:
            try:
                serializable_results = dict(search_results)
            except Exception as e:
                print(f"转换Elasticsearch结果失败: {e}")
                serializable_results = {"error": "无法序列化搜索结果"}
        
        # 汇总pipeline信息（存入elasticsearch_results字段）
        pipeline_results = {
            "pipeline": "hybrid_rag",
            "es": serializable_results,
            "vector": {"results": vector_results},
            "rerank": rerank_info,
            "llm": {
                "model": llm_result.get("llm_model"),
                "input_tokens": llm_result.get("llm_input_tokens"),
                "output_tokens": llm_result.get("llm_output_tokens"),
                "total_tokens": llm_result.get("llm_total_tokens"),
                "finish_reason": llm_result.get("finish_reason"),
                "time_ms": llm_result.get("llm_time")
            }
        }
        
        # 统计来源合同和内容块
        source_contracts = []
        source_chunks = []
        for ch in selected_chunks:
            if ch.get("contract_id") is not None:
                source_contracts.append(ch["contract_id"])
            if ch.get("chunk_id") is not None:
                source_chunks.append(ch["chunk_id"])
        # 去重
        source_contracts = list(dict.fromkeys(source_contracts))
        source_chunks = list(dict.fromkeys(source_chunks))
        
        # 搜索方法标记
        used_es = len(es_chunks) > 0
        used_vec = len(vector_chunks) > 0
        search_method = "hybrid" if (used_es and used_vec) else ("keyword" if used_es else ("semantic" if used_vec else None))
        
        # 创建问答记录
        qa_session = QASession(
            session_id=request.session_id,
            session_title=session_title,
            message_order=message_order,
            question=request.question,
            answer=ai_answer,
            source_contracts=source_contracts,
            source_chunks=source_chunks,
            elasticsearch_results=pipeline_results,
            search_method=search_method,
            ai_response_type="search_based",
            response_time=response_time
        )
        
        db.add(qa_session)
        db.commit()
        db.refresh(qa_session)
        
        # 如果是第一条消息，更新所有该会话的记录的标题
        if message_order == 1 and session_title:
            db.query(QASession).filter(
                QASession.session_id == request.session_id
            ).update({"session_title": session_title})
            db.commit()
        
        return BaseResponse(
            success=True,
            message="问答成功",
            data=QASessionResponse.from_orm(qa_session)
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"问答处理失败: {str(e)}"
        )

@router.get("/sessions", response_model=BaseResponse, summary="获取会话列表")
async def get_sessions(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    """获取会话列表"""
    try:
        # 获取所有会话的基本信息（每个会话只取第一条记录）
        subquery = db.query(
            QASession.session_id,
            func.min(QASession.id).label("first_id")
        ).group_by(QASession.session_id).subquery()
        
        # 获取会话详情
        sessions_query = db.query(QASession).join(
            subquery, QASession.id == subquery.c.first_id
        ).order_by(desc(QASession.created_at))
        
        # 分页
        total = sessions_query.count()
        sessions = sessions_query.offset((page - 1) * page_size).limit(page_size).all()
        
        # 构建响应数据
        session_list = []
        for session in sessions:
            # 获取该会话的消息数量
            message_count = db.query(QASession).filter(
                QASession.session_id == session.session_id
            ).count()
            
            session_list.append({
                "session_id": session.session_id,
                "session_title": session.session_title,
                "message_count": message_count,
                "last_message_time": session.created_at,
                "first_question": session.question
            })
        
        return BaseResponse(
            success=True,
            message="获取会话列表成功",
            data=SessionListResponse(
                sessions=session_list,
                total=total
            )
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取会话列表失败: {str(e)}"
        )

@router.get("/sessions/{session_id}", response_model=BaseResponse, summary="获取会话历史")
async def get_session_history(
    session_id: str,
    db: Session = Depends(get_db)
):
    """获取指定会话的历史记录"""
    try:
        # 获取会话中的所有消息
        messages = db.query(QASession).filter(
            QASession.session_id == session_id
        ).order_by(QASession.message_order).all()
        
        if not messages:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="会话不存在"
            )
        
        # 获取会话标题（从第一条消息）
        session_title = messages[0].session_title
        
        return BaseResponse(
            success=True,
            message="获取会话历史成功",
            data=SessionHistoryResponse(
                session_id=session_id,
                session_title=session_title,
                messages=[QASessionResponse.from_orm(msg) for msg in messages],
                total_messages=len(messages)
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取会话历史失败: {str(e)}"
        )

@router.post("/sessions/{session_id}/messages/{message_id}/feedback", response_model=BaseResponse, summary="提交用户反馈")
async def submit_feedback(
    session_id: str,
    message_id: int,
    request: FeedbackRequest,
    db: Session = Depends(get_db)
):
    """提交用户反馈"""
    try:
        # 查找指定的消息
        message = db.query(QASession).filter(
            QASession.id == message_id,
            QASession.session_id == session_id
        ).first()
        
        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="消息不存在"
            )
        
        # 更新反馈
        message.user_feedback = request.feedback
        db.commit()
        
        return BaseResponse(
            success=True,
            message="反馈提交成功",
            data=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"提交反馈失败: {str(e)}"
        )

@router.delete("/sessions/{session_id}", response_model=BaseResponse, summary="删除会话")
async def delete_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """删除指定会话及其所有消息"""
    try:
        # 查找会话中的所有消息
        messages = db.query(QASession).filter(
            QASession.session_id == session_id
        ).all()
        
        if not messages:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="会话不存在"
            )
        
        # 删除所有消息
        db.query(QASession).filter(
            QASession.session_id == session_id
        ).delete()
        
        db.commit()
        
        return BaseResponse(
            success=True,
            message="会话删除成功",
            data=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除会话失败: {str(e)}"
        )

# 注意：AI回答功能已移除，现在只提供Elasticsearch搜索结果