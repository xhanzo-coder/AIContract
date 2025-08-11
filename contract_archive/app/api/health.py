"""
系统健康检查API路由
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models import get_db
from app.schemas import BaseResponse, HealthCheckResponse
from app.services import ocr_service
from app.services.elasticsearch_service import elasticsearch_service
from app.services.vector_service import vector_service
from app.models.models import Contract, ContractContent
from app.crud import contract_crud
from app.config import settings

router = APIRouter(tags=["系统状态"])

@router.get("/health", response_model=BaseResponse, summary="健康检查")
async def health_check(db: Session = Depends(get_db)):
    """
    系统健康检查
    
    检查以下组件状态：
    - API服务状态
    - 数据库连接状态
    - OCR服务状态
    """
    try:
        # 检查数据库连接
        try:
            db.execute(text("SELECT 1"))
            database_status = "healthy"
        except Exception as e:
            database_status = f"error: {str(e)}"
        
        # 检查OCR服务
        ocr_status = "healthy" if ocr_service.is_available() else "unavailable"
        
        # 构造响应数据
        response_data = HealthCheckResponse(
            status="healthy" if database_status == "healthy" else "degraded",
            timestamp=datetime.now(),
            version=settings.VERSION,
            database=database_status
        )
        
        # 添加OCR状态到响应数据
        response_data_dict = response_data.model_dump()
        response_data_dict["ocr_service"] = ocr_status
        
        return BaseResponse(
            success=True,
            message="系统状态检查完成",
            data=response_data_dict
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"健康检查失败: {str(e)}")

@router.get("/info", response_model=BaseResponse, summary="API信息")
async def api_info():
    """
    获取API基本信息
    """
    try:
        info_data = {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "description": "合同档案管理系统API",
            "docs_url": "/docs",
            "redoc_url": "/redoc",
            "max_file_size": f"{settings.MAX_FILE_SIZE / 1024 / 1024:.1f}MB",
            "supported_formats": settings.supported_formats_list,
            "features": [
                "文件上传",
                "OCR文字识别", 
                "合同管理",
                "状态跟踪"
            ]
        }
        
        return BaseResponse(
            success=True,
            message="API信息获取成功",
            data=info_data
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取API信息失败: {str(e)}")

@router.post("/maintenance/clear-all", response_model=BaseResponse, summary="一键清空所有已同步数据（仅开发环境）")
async def maintenance_clear_all(db: Session = Depends(get_db), reset_indices: bool = False):
    """
    一键清空系统中与检索相关的已同步数据，便于重新测试。
    注意：
    - 未实现用户/权限控制，仅供本地开发与测试使用
    - 默认仅清空Elasticsearch中所有文档，保留索引结构
    - 如需完全重置索引（删除并重新创建），可传入 reset_indices=true
    - 不删除数据库合同及分块记录，不删除本地上传文件
    - 不删除Faiss索引文件，但会重置所有合同与分块的向量状态为pending并清空映射
    """
    try:
        # 1) ES处理：清空或重建索引
        if reset_indices:
            es_ok = elasticsearch_service.recreate_indices()
            es_action = "recreate_indices"
        else:
            es_ok = elasticsearch_service.clear_all_indices()
            es_action = "clear_all_indices"

        # 2) 向量相关：加载索引并清空映射，重置所有合同与分块向量状态
        # 初始化Faiss索引（确保vector_service.index和映射已加载）
        try:
            if vector_service.index is None:
                vector_service.index = vector_service._initialize_faiss_index()
        except Exception:
            # 忽略加载失败以免阻塞后续状态重置
            pass

        # 清空内存中的映射并保存到磁盘
        removed_vectors = len(getattr(vector_service, 'vector_id_mapping', {}) or [])
        vector_service.vector_id_mapping = {}
        # 保存空映射与当前索引
        try:
            if vector_service.index is not None:
                vector_service._save_faiss_index()
        except Exception:
            # 保存失败不影响状态重置
            pass

        # 数据库层面重置所有合同与分块的向量状态
        updated_contracts = db.query(Contract).update({"vector_status": "pending"})
        updated_chunks = db.query(ContractContent).update({"vector_status": "pending", "vector_id": None})
        db.commit()

        return BaseResponse(
            success=True,
            message="清理完成",
            data={
                "elasticsearch": {
                    "action": es_action,
                    "success": es_ok
                },
                "vectors": {
                    "removed_mapping_count": removed_vectors,
                    "faiss_index_vectors": int(vector_service.index.ntotal) if getattr(vector_service, 'index', None) is not None else 0,
                    "contracts_reset": int(updated_contracts or 0),
                    "chunks_reset": int(updated_chunks or 0)
                },
                "notes": [
                    "未删除数据库合同与分块记录",
                    "未删除上传文件，只清空了ES文档与向量状态",
                    "生产环境请勿暴露该接口"
                ]
            }
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"清理失败: {str(e)}")