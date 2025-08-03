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