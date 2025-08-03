"""
API请求和响应模式定义
"""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field

# 基础响应模式
class BaseResponse(BaseModel):
    """基础响应模式"""
    success: bool = Field(..., description="请求是否成功")
    message: str = Field(..., description="响应消息")
    data: Optional[Any] = Field(None, description="响应数据")

# 合同相关模式
class ContractBase(BaseModel):
    """合同基础模式"""
    contract_number: str = Field(..., description="合同编号")
    contract_name: str = Field(..., description="合同名称")
    contract_type: Optional[str] = Field(None, description="合同类型")

class ContractCreate(ContractBase):
    """创建合同请求模式"""
    file_name: str = Field(..., description="文件名")
    file_path: str = Field(..., description="文件路径")
    file_size: Optional[int] = Field(None, description="文件大小")
    file_format: Optional[str] = Field("PDF", description="文件格式")

class ContractResponse(ContractBase):
    """合同响应模式"""
    id: int = Field(..., description="合同ID")
    file_name: str = Field(..., description="文件名")
    file_size: Optional[int] = Field(None, description="文件大小")
    file_format: Optional[str] = Field(None, description="文件格式")
    upload_time: datetime = Field(..., description="上传时间")
    ocr_status: Optional[str] = Field(None, description="OCR状态")
    content_status: Optional[str] = Field(None, description="内容状态")
    vector_status: Optional[str] = Field(None, description="向量状态")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True

class ContractListResponse(BaseModel):
    """合同列表响应模式"""
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")
    contracts: List[ContractResponse] = Field(..., description="合同列表")

# 文件上传相关模式
class FileUploadResponse(BaseModel):
    """文件上传响应模式"""
    contract_id: int = Field(..., description="合同ID")
    contract_number: str = Field(..., description="合同编号")
    file_name: str = Field(..., description="文件名")
    file_size: int = Field(..., description="文件大小")
    upload_time: datetime = Field(..., description="上传时间")
    ocr_status: str = Field(..., description="OCR状态")

# OCR相关模式
class OCRStatusResponse(BaseModel):
    """OCR状态响应模式"""
    contract_id: int = Field(..., description="合同ID")
    ocr_status: str = Field(..., description="OCR状态")
    content_status: str = Field(..., description="内容状态")
    vector_status: str = Field(..., description="向量状态")
    html_content_path: Optional[str] = Field(None, description="HTML内容路径")
    text_content_path: Optional[str] = Field(None, description="文本内容路径")

class HTMLContentResponse(BaseModel):
    """HTML内容响应模式"""
    html_content: str = Field(..., description="HTML内容")
    content_type: str = Field(default="text/html", description="内容类型")

# 健康检查模式
class HealthCheckResponse(BaseModel):
    """健康检查响应模式"""
    status: str = Field(..., description="服务状态")
    timestamp: datetime = Field(..., description="检查时间")
    version: str = Field(..., description="API版本")
    database: str = Field(..., description="数据库状态")

# 错误响应模式
class ErrorResponse(BaseModel):
    """错误响应模式"""
    success: bool = Field(False, description="请求是否成功")
    message: str = Field(..., description="错误消息")
    error_code: Optional[str] = Field(None, description="错误代码")
    details: Optional[Any] = Field(None, description="错误详情")