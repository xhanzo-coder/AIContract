import os
from typing import List
from pydantic import BaseModel

class Settings(BaseModel):
    """应用配置类"""
    
    # 数据库配置
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://contract_user:contract%402025@localhost:5432/contract_archive")
    
    # SiliconFlow BGE-M3 API配置
    SILICONFLOW_API_KEY: str = os.getenv("SILICONFLOW_API_KEY", "")
    SILICONFLOW_BGE_URL: str = os.getenv("SILICONFLOW_BGE_URL", "https://api.siliconflow.cn/v1/embeddings")
    
    # 火山引擎豆包API配置
    VOLCANO_API_KEY: str = os.getenv("VOLCANO_API_KEY", "")
    VOLCANO_API_SECRET: str = os.getenv("VOLCANO_API_SECRET", "")
    
    # 文件存储配置
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "data/uploads")
    FAISS_INDEX_PATH: str = os.getenv("FAISS_INDEX_PATH", "data/faiss_index")
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", "52428800"))  # 50MB
    
    # 支持的文件格式
    SUPPORTED_FORMATS: str = os.getenv("SUPPORTED_FORMATS", ".pdf,.doc,.docx,.txt,.jpg,.png,.jpeg")
    
    @property
    def supported_formats_list(self) -> List[str]:
        """将字符串格式的支持格式转换为列表"""
        return [fmt.strip() for fmt in self.SUPPORTED_FORMATS.split(",")]
    
    # 系统配置
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "WARNING")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    
    # API配置
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "合约档案智能检索系统"
    VERSION: str = "1.0.0"
    
    # CORS配置
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:8501", "http://127.0.0.1:8501"]
    
    # Elasticsearch配置
    ELASTICSEARCH_HOST: str = os.getenv("ELASTICSEARCH_HOST", "localhost")
    ELASTICSEARCH_PORT: int = int(os.getenv("ELASTICSEARCH_PORT", "9200"))
    ELASTICSEARCH_USER: str = os.getenv("ELASTICSEARCH_USER", "")
    ELASTICSEARCH_PASSWORD: str = os.getenv("ELASTICSEARCH_PASSWORD", "")
    ELASTICSEARCH_ENABLED: bool = os.getenv("ELASTICSEARCH_ENABLED", "True").lower() == "true"

# 创建全局配置实例
settings = Settings()

# 确保必要的目录存在
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.FAISS_INDEX_PATH, exist_ok=True)