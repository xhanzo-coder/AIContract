"""
合同档案管理系统 - FastAPI主应用
"""
import logging
import os

# 首先配置日志系统，必须在导入任何其他模块之前
from app.config import settings

# 配置基础日志 - 保留应用关键信息，屏蔽SQLAlchemy查询日志
logging.basicConfig(
    level=logging.INFO,  # 保持INFO级别以显示重要的应用信息
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# 完全禁用SQLAlchemy的所有日志输出 - 必须在导入models之前
logging.getLogger('sqlalchemy').disabled = True
logging.getLogger('sqlalchemy.engine').disabled = True
logging.getLogger('sqlalchemy.engine.base').disabled = True
logging.getLogger('sqlalchemy.engine.base.Engine').disabled = True
logging.getLogger('sqlalchemy.pool').disabled = True
logging.getLogger('sqlalchemy.pool.impl').disabled = True
logging.getLogger('sqlalchemy.pool.impl.QueuePool').disabled = True
logging.getLogger('sqlalchemy.dialects').disabled = True
logging.getLogger('sqlalchemy.orm').disabled = True
logging.getLogger('sqlalchemy.sql').disabled = True
logging.getLogger('sqlalchemy.engine.Engine').disabled = True
logging.getLogger('sqlalchemy.pool.Pool').disabled = True
logging.getLogger('sqlalchemy.pool.StaticPool').disabled = True
logging.getLogger('sqlalchemy.pool.NullPool').disabled = True

# 禁用其他冗余日志，但保留应用层重要信息
logging.getLogger('urllib3.connectionpool').disabled = True
logging.getLogger('uvicorn.access').disabled = True  # 禁用访问日志
# 注意：不禁用uvicorn.error，保留错误信息

# 设置应用日志记录器为INFO级别，显示重要操作信息
app_logger = logging.getLogger('app')
app_logger.setLevel(logging.INFO)

# 现在安全导入其他模块
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.models import Base, engine
from app.api import contracts_router, health_router
from app.api.qa_sessions import router as qa_router

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
        app_logger.info("✅ 数据库表创建/检查完成")
        
        # 确保上传目录存在
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        os.makedirs(os.path.join(settings.UPLOAD_DIR, "processed"), exist_ok=True)
        app_logger.info("📁 文件目录创建/检查完成")
        
        app_logger.info("🎉 系统初始化完成，准备接收请求")
        
    except Exception as e:
        app_logger.error(f"❌ 应用启动失败: {str(e)}")
        raise

# 挂载静态文件服务
if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# 注册API路由
app.include_router(contracts_router)
app.include_router(health_router)
app.include_router(qa_router, prefix="/api/v1")

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
    app_logger.error(f"❌ 未处理的异常: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "服务器内部错误",
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