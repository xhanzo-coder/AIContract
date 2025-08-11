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
    file_path: Optional[str] = Field(None, description="文件路径")
    file_size: Optional[int] = Field(None, description="文件大小")
    file_format: Optional[str] = Field(None, description="文件格式")
    upload_time: datetime = Field(..., description="上传时间")
    ocr_status: Optional[str] = Field(None, description="OCR状态")
    content_status: Optional[str] = Field(None, description="内容状态")
    vector_status: Optional[str] = Field(None, description="向量状态")
    elasticsearch_sync_status: Optional[str] = Field(None, description="Elasticsearch同步状态")
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

# 内容分块相关模式
class ChunkMetadata(BaseModel):
    """分块元数据模式"""
    chunk_index: int = Field(..., description="分块索引")
    total_chunks: int = Field(..., description="总分块数")
    chunk_length: int = Field(..., description="分块长度")
    has_table: bool = Field(..., description="是否包含表格")
    has_title: bool = Field(..., description="是否包含标题")
    paragraph_count: int = Field(..., description="段落数量")
    content_type: str = Field(..., description="内容类型")

class ContractChunk(BaseModel):
    """合同分块模式"""
    id: int = Field(..., description="分块ID")
    chunk_index: int = Field(..., description="分块索引")
    content_text: str = Field(..., description="分块内容")
    chunk_type: str = Field(..., description="分块类型")
    chunk_size: int = Field(..., description="分块大小")
    chunk_metadata: Optional[dict] = Field(None, description="分块元数据")
    start_position: Optional[int] = Field(None, description="起始位置")
    end_position: Optional[int] = Field(None, description="结束位置")
    vector_status: Optional[str] = Field(None, description="向量状态")
    created_at: Optional[datetime] = Field(None, description="创建时间")

    class Config:
        from_attributes = True

class ContractChunkHighlighted(ContractChunk):
    """带高亮的合同分块模式"""
    highlighted_text: Optional[str] = Field(None, description="高亮文本")
    relevance_score: Optional[float] = Field(None, description="相关性分数")

class PaginationInfo(BaseModel):
    """分页信息模式"""
    page: int = Field(..., description="当前页码")
    size: int = Field(..., description="每页大小")
    total: int = Field(..., description="总记录数")
    total_pages: int = Field(..., description="总页数")
    has_next: bool = Field(..., description="是否有下一页")
    has_prev: bool = Field(..., description="是否有上一页")

class ChunkListResponse(BaseModel):
    """分块列表响应模式"""
    chunks: List[ContractChunk] = Field(..., description="分块列表")
    pagination: PaginationInfo = Field(..., description="分页信息")

class ChunkSearchResponse(BaseModel):
    """分块搜索响应模式"""
    chunks: List[ContractChunkHighlighted] = Field(..., description="搜索结果分块")
    pagination: PaginationInfo = Field(..., description="分页信息")
    query: str = Field(..., description="搜索关键词")

class ContentStatusResponse(BaseModel):
    """内容处理状态响应模式"""
    status: str = Field(..., description="处理状态")
    message: str = Field(..., description="状态消息")
    contract_id: int = Field(..., description="合同ID")
    chunk_count: Optional[int] = Field(None, description="分块数量")
    ocr_status: Optional[str] = Field(None, description="OCR状态")
    last_processed: Optional[datetime] = Field(None, description="最后处理时间")

class ContentProcessResponse(BaseModel):
    """内容处理响应模式"""
    status: str = Field(..., description="处理状态")
    message: str = Field(..., description="处理消息")
    contract_id: int = Field(..., description="合同ID")
    chunk_count: Optional[int] = Field(None, description="生成的分块数量")
    processed_at: Optional[str] = Field(None, description="处理时间")

class ChunkPreview(BaseModel):
    """分块预览模式"""
    chunk_index: int = Field(..., description="分块索引")
    content_preview: str = Field(..., description="内容预览")
    chunk_size: int = Field(..., description="分块大小")
    metadata: dict = Field(..., description="元数据")

# 对话相关模式
class QASessionCreate(BaseModel):
    """创建问答会话请求模式"""
    session_id: Optional[str] = Field(None, description="会话ID，不提供则自动生成")
    question: str = Field(..., description="用户问题")

class QASessionResponse(BaseModel):
    """问答响应模式"""
    id: int = Field(..., description="问答记录ID")
    session_id: str = Field(..., description="会话ID")
    session_title: Optional[str] = Field(None, description="会话标题")
    message_order: int = Field(..., description="消息顺序")
    question: str = Field(..., description="用户问题")
    answer: Optional[str] = Field(None, description="AI回答")
    source_contracts: Optional[List[int]] = Field(None, description="相关合同ID列表")
    source_chunks: Optional[List[int]] = Field(None, description="相关内容块ID列表")
    elasticsearch_results: Optional[dict] = Field(None, description="Elasticsearch搜索结果")
    search_method: Optional[str] = Field(None, description="搜索方法")
    ai_response_type: Optional[str] = Field(None, description="AI回答类型")
    response_time: Optional[float] = Field(None, description="响应时间")
    user_feedback: Optional[str] = Field(None, description="用户反馈")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True

class SessionListResponse(BaseModel):
    """会话列表响应模式"""
    sessions: List[dict] = Field(..., description="会话列表")
    total: int = Field(..., description="总会话数")

class SessionHistoryResponse(BaseModel):
    """会话历史响应模式"""
    session_id: str = Field(..., description="会话ID")
    session_title: Optional[str] = Field(None, description="会话标题")
    messages: List[QASessionResponse] = Field(..., description="消息列表")
    total_messages: int = Field(..., description="总消息数")

class FeedbackRequest(BaseModel):
    """反馈请求模式"""
    feedback: str = Field(..., description="反馈类型：helpful/not_helpful")