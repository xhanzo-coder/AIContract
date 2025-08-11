"""
数据库模型定义
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float, JSON, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.database import Base

class Contract(Base):
    """合同主表"""
    __tablename__ = "contracts"
    
    # 主键
    id = Column(Integer, primary_key=True, index=True, comment="合同记录唯一标识符，主键，自增")
    
    # 基本信息
    contract_number = Column(String(50), unique=True, nullable=False, index=True, comment="合同编号，如C230970483，业务主键，建立唯一索引")
    contract_name = Column(String(200), nullable=False, comment="合同名称，如'再生资源回收合同'，用于显示和搜索")
    contract_type = Column(String(100), nullable=True, comment="合同类型分类，如'工程合约'、'再生资源'、'设备维护'等")
    
    # 文件信息
    file_path = Column(String(500), nullable=False, comment="原始文件存储路径，相对于uploads目录的路径")
    file_name = Column(String(200), nullable=False, comment="原始文件名，包含扩展名，如'C230970483-再生資源.pdf'")
    file_size = Column(BigInteger, nullable=True, comment="文件大小，单位字节，用于存储空间统计和上传限制检查")
    file_format = Column(String(10), nullable=True, default="PDF", comment="文件格式，如'PDF'、'DOC'、'DOCX'，默认'PDF'")
    
    # 处理状态
    upload_time = Column(DateTime(timezone=True), server_default=func.now(), comment="文件上传时间，默认当前时间，用于排序和统计")
    ocr_status = Column(String(20), nullable=True, default="pending", comment="OCR识别状态：pending/processing/completed/failed，默认pending")
    content_status = Column(String(20), nullable=True, default="pending", comment="内容提取状态：pending/processing/completed/failed，默认pending")
    vector_status = Column(String(20), nullable=True, default="pending", comment="向量化状态：pending/processing/completed/failed，默认pending")
    elasticsearch_sync_status = Column(String(20), nullable=True, default="pending", comment="Elasticsearch同步状态：pending/processing/completed/failed，默认pending")
    
    # 处理结果文件路径
    html_content_path = Column(String(500), nullable=True, comment="HTML格式内容文件路径，OCR后生成的结构化内容")
    text_content_path = Column(String(500), nullable=True, comment="TXT格式内容文件路径，用于RAG系统的智能分段文本")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="记录创建时间，默认当前时间，用于数据审计")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="记录最后更新时间，默认当前时间，自动更新")
    
    # 关系
    content_chunks = relationship("ContractContent", back_populates="contract", cascade="all, delete-orphan")
    fields = relationship("ContractField", back_populates="contract", cascade="all, delete-orphan")

class ContractContent(Base):
    """合同内容分块表"""
    __tablename__ = "contract_content"
    
    # 主键
    id = Column(Integer, primary_key=True, index=True, comment="内容块唯一标识符，主键，自增")
    
    # 外键
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False, index=True, comment="关联合同ID，外键引用contracts.id，建立索引")
    
    # 内容信息
    chunk_index = Column(Integer, nullable=False, comment="内容块在文档中的序号，从1开始，保持文档顺序")
    content_text = Column(Text, nullable=False, comment="分块的文本内容，经过智能分段处理的段落或表格数据")
    chunk_type = Column(String(20), nullable=True, default="paragraph", comment="内容块类型：paragraph/table/list/title，默认paragraph")
    chunk_size = Column(Integer, nullable=True, comment="内容块字符数，用于分块质量评估和检索优化")
    
    # 向量化信息
    vector_id = Column(String(50), nullable=True, comment="向量数据库中的ID，用于关联FAISS索引中的向量")
    vector_status = Column(String(20), nullable=True, default="pending", comment="向量化状态：pending/completed/failed，默认pending")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="记录创建时间，默认当前时间，用于数据审计")
    
    # 关系
    contract = relationship("Contract", back_populates="content_chunks")

class ContractField(Base):
    """合同字段表"""
    __tablename__ = "contract_fields"
    
    # 主键
    id = Column(Integer, primary_key=True, index=True, comment="字段记录唯一标识符，主键，自增")
    
    # 外键
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False, index=True, comment="关联合同ID，外键引用contracts.id，建立索引")
    
    # 字段信息
    field_name = Column(String(100), nullable=False, index=True, comment="字段名称，如'甲方'、'合同金额'、'签订日期'等")
    field_value = Column(Text, nullable=True, comment="字段值，支持长文本，如公司全称、详细地址等")
    field_type = Column(String(50), nullable=True, comment="字段数据类型：text/number/date/amount/company等")
    
    # 录入信息
    input_method = Column(String(20), nullable=True, default="auto", comment="录入方式：auto/manual，默认auto，标识是AI提取还是人工录入")
    is_verified = Column(Boolean, nullable=True, default=False, comment="是否已人工验证，默认false，用于数据质量控制")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="记录创建时间，默认当前时间，用于数据审计")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="记录最后更新时间，默认当前时间，自动更新")
    
    # 关系
    contract = relationship("Contract", back_populates="fields")

class SearchLog(Base):
    """搜索日志表"""
    __tablename__ = "search_logs"
    
    # 主键
    id = Column(Integer, primary_key=True, index=True, comment="搜索记录唯一标识符，主键，自增")
    
    # 搜索信息
    search_query = Column(Text, nullable=False, comment="用户搜索的查询内容，支持长文本和复杂查询")
    search_type = Column(String(20), nullable=False, comment="搜索类型：keyword/semantic/hybrid，标识搜索算法类型")
    results_count = Column(Integer, nullable=True, comment="搜索结果数量，用于搜索效果统计和优化")
    search_time = Column(Float, nullable=True, comment="搜索耗时，单位毫秒，精确到小数点后3位，性能监控")
    search_results = Column(JSON, nullable=True, comment="搜索结果详情，JSON格式存储，包含文档ID、相关度分数等")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True, comment="搜索时间，默认当前时间，用于使用统计和趋势分析")

class QASession(Base):
    """问答会话表"""
    __tablename__ = "qa_sessions"
    
    # 主键
    id = Column(Integer, primary_key=True, index=True, comment="问答记录唯一标识符，主键，自增")
    
    # 会话信息
    session_id = Column(String(100), nullable=False, index=True, comment="会话ID，用于关联同一次对话的多个问答")
    session_title = Column(String(200), nullable=True, comment="会话标题，基于首个问题生成")
    message_order = Column(Integer, nullable=False, comment="消息在会话中的顺序，从1开始")
    
    # 问答内容
    question = Column(Text, nullable=False, comment="用户提出的问题")
    answer = Column(Text, nullable=True, comment="AI生成的回答")
    
    # 搜索相关
    source_contracts = Column(JSON, nullable=True, comment="相关合同ID列表，JSON格式")
    source_chunks = Column(JSON, nullable=True, comment="相关内容块ID列表，JSON格式")
    elasticsearch_results = Column(JSON, nullable=True, comment="Elasticsearch搜索结果，JSON格式")
    search_method = Column(String(20), nullable=True, comment="搜索方法：keyword/semantic/hybrid")
    
    # AI回答相关
    ai_response_type = Column(String(20), nullable=True, comment="AI回答类型：direct/search_based/mixed")
    response_time = Column(Float, nullable=True, comment="响应时间，单位毫秒")
    
    # 用户反馈
    user_feedback = Column(String(20), nullable=True, comment="用户反馈：helpful/not_helpful")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True, comment="问答创建时间，默认当前时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="记录最后更新时间，默认当前时间，自动更新")

class SystemConfig(Base):
    """系统配置表"""
    __tablename__ = "system_config"
    
    # 主键
    id = Column(Integer, primary_key=True, index=True, comment="配置记录唯一标识符，主键，自增")
    
    # 配置信息
    config_key = Column(String(100), unique=True, nullable=False, index=True, comment="配置项键名，如'max_file_size'、'ocr_api_key'等，建立唯一索引")
    config_value = Column(Text, nullable=True, comment="配置项值，支持长文本，可存储JSON格式的复杂配置")
    config_type = Column(String(20), nullable=True, default="string", comment="配置类型：string/number/boolean/json，默认string")
    description = Column(Text, nullable=True, comment="配置项说明，详细描述配置的用途和取值范围")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="配置创建时间，默认当前时间，用于配置历史追踪")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="配置最后更新时间，默认当前时间，自动更新")