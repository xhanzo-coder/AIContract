"""
启动脚本 - 用于开发和测试
"""
import uvicorn
import sys
import os
from app.config import settings

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("🚀 启动合同档案管理系统...")
    print("📖 API文档: http://localhost:8000/docs")
    print("🔍 ReDoc文档: http://localhost:8000/redoc")
    print("❤️ 健康检查: http://localhost:8000/api/v1/health")
    print("📋 API信息: http://localhost:8000/api/v1/info")
    print("-" * 50)
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )