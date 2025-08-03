"""
合同档案管理系统 - FastAPI主应用
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import logging
import os

from app.config import settings
from app.models import Base, engine
from app.api import contracts_router, health_router

# 配置日志
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# 创建FastAPI应用实例
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="合同档案管理系统API",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# 配置CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建数据库表
@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化操作"""
    try:
        # 创建数据库表（如果不存在）
        Base.metadata.create_all(bind=engine)
        logging.info("数据库表创建/检查完成")
        
        # 确保上传目录存在
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        os.makedirs(os.path.join(settings.UPLOAD_DIR, "processed"), exist_ok=True)
        logging.info("文件目录创建/检查完成")
        
    except Exception as e:
        logging.error(f"应用启动失败: {str(e)}")
        raise

# 挂载静态文件服务
if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# 注册API路由
app.include_router(contracts_router)
app.include_router(health_router)

# 根路径
@app.get("/", tags=["根路径"])
async def root():
    """根路径欢迎信息"""
    return JSONResponse({
        "message": f"欢迎使用{settings.PROJECT_NAME}",
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/api/v1/health"
    })

# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """全局异常处理器"""
    logging.error(f"未处理的异常: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "服务器内部错误",
            "error": str(exc) if settings.DEBUG else "Internal Server Error"
        }
    )

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )