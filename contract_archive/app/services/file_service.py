"""
文件处理服务
"""
import os
import uuid
import shutil
from typing import Tuple, Optional
from pathlib import Path
from fastapi import UploadFile, HTTPException
from app.config import settings

class FileService:
    """文件处理服务"""
    
    @staticmethod
    def validate_file(file: UploadFile) -> None:
        """验证上传文件"""
        # 检查文件大小
        if file.size and file.size > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"文件大小超过限制 {settings.MAX_FILE_SIZE / 1024 / 1024:.1f}MB"
            )
        
        # 检查文件格式
        if file.filename:
            file_ext = Path(file.filename).suffix.lower()
            if file_ext not in settings.supported_formats_list:
                raise HTTPException(
                    status_code=400,
                    detail=f"不支持的文件格式 {file_ext}，支持格式：{', '.join(settings.supported_formats_list)}"
                )
    
    @staticmethod
    def generate_file_path(filename: str) -> Tuple[str, str]:
        """生成文件存储路径"""
        # 生成唯一文件名
        file_ext = Path(filename).suffix.lower()
        unique_filename = f"{uuid.uuid4().hex}{file_ext}"
        
        # 按日期分目录存储
        from datetime import datetime
        date_dir = datetime.now().strftime("%Y/%m/%d")
        relative_path = f"{date_dir}/{unique_filename}"
        full_path = os.path.join(settings.UPLOAD_DIR, relative_path)
        
        # 确保目录存在
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        return relative_path, full_path
    
    @staticmethod
    async def save_file(file: UploadFile) -> Tuple[str, str, int]:
        """保存上传文件"""
        # 验证文件
        FileService.validate_file(file)
        
        # 生成存储路径
        relative_path, full_path = FileService.generate_file_path(file.filename)
        
        # 保存文件
        try:
            with open(full_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # 获取文件大小
            file_size = os.path.getsize(full_path)
            
            return relative_path, full_path, file_size
            
        except Exception as e:
            # 清理可能创建的文件
            if os.path.exists(full_path):
                os.remove(full_path)
            raise HTTPException(status_code=500, detail=f"文件保存失败: {str(e)}")
    
    @staticmethod
    def delete_file(file_path: str) -> bool:
        """删除文件"""
        try:
            full_path = os.path.join(settings.UPLOAD_DIR, file_path)
            if os.path.exists(full_path):
                os.remove(full_path)
                return True
            return False
        except Exception:
            return False
    
    @staticmethod
    def get_file_info(file_path: str) -> Optional[dict]:
        """获取文件信息"""
        try:
            full_path = os.path.join(settings.UPLOAD_DIR, file_path)
            if os.path.exists(full_path):
                stat = os.stat(full_path)
                return {
                    "size": stat.st_size,
                    "modified_time": stat.st_mtime,
                    "exists": True
                }
            return {"exists": False}
        except Exception:
            return {"exists": False}

# 创建服务实例
file_service = FileService()