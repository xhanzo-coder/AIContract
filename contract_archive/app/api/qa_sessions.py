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

router = APIRouter(prefix="/qa", tags=["问答会话"])

# 初始化Elasticsearch服务
es_service = ElasticsearchService()

@router.post("/ask", response_model=BaseResponse, summary="提问并获取AI回答")
async def ask_question(
    request: QASessionCreate,
    db: Session = Depends(get_db)
):
    """提问并获取AI回答"""
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
        
        # 使用Elasticsearch搜索相关内容（搜索contract_contents索引）
        search_results = None
        source_contracts = []
        source_chunks = []
        
        try:
            # 调用search_content方法搜索内容块
            search_results = es_service.search_content(
                query=request.question,
                limit=10
            )
            
            # 提取相关合同和内容块ID
            if search_results and "hits" in search_results:
                for hit in search_results["hits"]["hits"]:
                    source_data = hit["_source"]
                    if "contract_id" in source_data:
                        source_contracts.append(source_data["contract_id"])
                    if "chunk_id" in source_data:
                        source_chunks.append(source_data["chunk_id"])
                        
        except Exception as e:
            print(f"Elasticsearch搜索失败: {e}")
            search_results = None
        
        # 暂时不提供AI回答，只返回搜索结果
        ai_answer = "已为您找到相关文档，请查看搜索结果。"
        
        # 生成会话标题（基于第一个问题）
        session_title = None
        if message_order == 1:
            session_title = request.question[:50] + "..." if len(request.question) > 50 else request.question
        
        # 计算响应时间
        response_time = (time.time() - start_time) * 1000  # 转换为毫秒
        
        # 将Elasticsearch结果转换为可序列化的格式
        serializable_results = None
        if search_results:
            try:
                # 将ObjectApiResponse转换为字典
                serializable_results = dict(search_results)
            except Exception as e:
                print(f"转换Elasticsearch结果失败: {e}")
                serializable_results = {"error": "无法序列化搜索结果"}
        
        # 创建问答记录
        qa_session = QASession(
            session_id=request.session_id,
            session_title=session_title,
            message_order=message_order,
            question=request.question,
            answer=ai_answer,
            source_contracts=source_contracts,
            source_chunks=source_chunks,
            elasticsearch_results=serializable_results,
            search_method="elasticsearch",
            ai_response_type="search_based" if search_results else "direct",
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