"""
服务模块包
"""
from .file_service import file_service
from .ocr_service import ocr_service

__all__ = [
    "file_service",
    "ocr_service"
]