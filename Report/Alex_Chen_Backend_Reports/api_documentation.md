# 合约档案智能检索系统 - API接口文档

## 📋 接口概览

本文档详细描述了合约档案智能检索系统的所有API接口，供前端开发人员参考。

**基础信息**:
- **Base URL**: `http://localhost:8000`
- **API版本**: v1
- **认证方式**: Bearer Token
- **数据格式**: JSON

---

## 🔐 认证接口

### 1. 用户登录
```http
POST /api/v1/auth/login
```

**请求参数**:
```json
{
  "username": "string",
  "password": "string"
}
```

**响应示例**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### 2. 刷新Token
```http
POST /api/v1/auth/refresh
```

**请求头**:
```
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### 3. 用户登出
```http
POST /api/v1/auth/logout
```

**请求头**:
```
Authorization: Bearer <access_token>
```

**响应示例**:
```json
{
  "message": "Successfully logged out"
}
```

---

## 📄 文档管理接口

### 1. 上传文档
```http
POST /api/v1/documents/upload
```

**请求类型**: `multipart/form-data`

**请求参数**:
```
file: File (必需) - 文档文件
contract_type: string (必需) - 合约类型 [purchase, sales, service, lease, labor, other]
tags: string (可选) - 标签，逗号分隔
amount: number (可选) - 合约金额（万元）
description: string (可选) - 描述信息
```

**响应示例**:
```json
{
  "id": 123,
  "filename": "contract_001.pdf",
  "original_filename": "采购合同.pdf",
  "file_size": 2048576,
  "file_type": "application/pdf",
  "contract_type": "purchase",
  "tags": ["采购", "设备"],
  "amount": 100.5,
  "description": "设备采购合同",
  "upload_time": "2024-01-15T10:30:00Z",
  "status": "processing",
  "extracted_text": null,
  "embeddings_status": "pending"
}
```

### 2. 获取文档列表
```http
GET /api/v1/documents
```

**查询参数**:
```
page: int = 1 - 页码
size: int = 20 - 每页数量
contract_type: string - 合约类型筛选
tags: string - 标签筛选
date_from: string - 开始日期 (YYYY-MM-DD)
date_to: string - 结束日期 (YYYY-MM-DD)
amount_min: number - 最小金额
amount_max: number - 最大金额
status: string - 状态筛选 [processing, completed, failed]
sort_by: string = "upload_time" - 排序字段
sort_order: string = "desc" - 排序方向 [asc, desc]
```

**响应示例**:
```json
{
  "documents": [
    {
      "id": 123,
      "filename": "contract_001.pdf",
      "original_filename": "采购合同.pdf",
      "file_size": 2048576,
      "contract_type": "purchase",
      "tags": ["采购", "设备"],
      "amount": 100.5,
      "upload_time": "2024-01-15T10:30:00Z",
      "status": "completed",
      "thumbnail_url": "/api/v1/documents/123/thumbnail"
    }
  ],
  "total": 150,
  "page": 1,
  "size": 20,
  "pages": 8
}
```

### 3. 获取文档详情
```http
GET /api/v1/documents/{document_id}
```

**响应示例**:
```json
{
  "id": 123,
  "filename": "contract_001.pdf",
  "original_filename": "采购合同.pdf",
  "file_size": 2048576,
  "file_type": "application/pdf",
  "contract_type": "purchase",
  "tags": ["采购", "设备"],
  "amount": 100.5,
  "description": "设备采购合同",
  "upload_time": "2024-01-15T10:30:00Z",
  "status": "completed",
  "extracted_text": "合同全文内容...",
  "embeddings_status": "completed",
  "processing_log": [
    {
      "step": "file_upload",
      "status": "completed",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    {
      "step": "text_extraction",
      "status": "completed",
      "timestamp": "2024-01-15T10:31:00Z"
    },
    {
      "step": "embedding_generation",
      "status": "completed",
      "timestamp": "2024-01-15T10:32:00Z"
    }
  ],
  "download_url": "/api/v1/documents/123/download",
  "preview_url": "/api/v1/documents/123/preview"
}
```

### 4. 下载文档
```http
GET /api/v1/documents/{document_id}/download
```

**响应**: 文件流

### 5. 预览文档
```http
GET /api/v1/documents/{document_id}/preview
```

**响应**: 文档预览图片或PDF

### 6. 获取文档缩略图
```http
GET /api/v1/documents/{document_id}/thumbnail
```

**响应**: 缩略图图片

### 7. 更新文档信息
```http
PUT /api/v1/documents/{document_id}
```

**请求参数**:
```json
{
  "contract_type": "purchase",
  "tags": ["采购", "设备", "重要"],
  "amount": 120.0,
  "description": "更新后的描述"
}
```

**响应示例**:
```json
{
  "id": 123,
  "message": "Document updated successfully",
  "updated_fields": ["tags", "amount", "description"]
}
```

### 8. 删除文档
```http
DELETE /api/v1/documents/{document_id}
```

**响应示例**:
```json
{
  "message": "Document deleted successfully",
  "deleted_id": 123
}
```

---

## 🔍 搜索接口

### 1. 智能搜索
```http
POST /api/v1/search/intelligent
```

**请求参数**:
```json
{
  "query": "查找关于设备采购的合同",
  "filters": {
    "contract_type": ["purchase"],
    "date_range": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    },
    "amount_range": {
      "min": 50,
      "max": 500
    },
    "tags": ["设备"]
  },
  "limit": 20,
  "offset": 0,
  "sort_by": "relevance"
}
```

**响应示例**:
```json
{
  "results": [
    {
      "document": {
        "id": 123,
        "filename": "contract_001.pdf",
        "original_filename": "采购合同.pdf",
        "contract_type": "purchase",
        "tags": ["采购", "设备"],
        "amount": 100.5,
        "upload_time": "2024-01-15T10:30:00Z"
      },
      "relevance_score": 0.95,
      "matched_segments": [
        {
          "text": "设备采购合同条款...",
          "start_position": 150,
          "end_position": 300,
          "highlight": "设备采购"
        }
      ],
      "summary": "这是一份关于设备采购的合同，金额为100.5万元"
    }
  ],
  "total": 15,
  "query_time": 0.25,
  "search_type": "intelligent",
  "suggestions": [
    "设备租赁合同",
    "采购协议",
    "设备维护合同"
  ]
}
```

### 2. 关键词搜索
```http
POST /api/v1/search/keyword
```

**请求参数**:
```json
{
  "keywords": ["设备", "采购", "合同"],
  "operator": "AND",
  "filters": {
    "contract_type": ["purchase"],
    "tags": ["设备"]
  },
  "limit": 20,
  "offset": 0,
  "highlight": true
}
```

**响应示例**:
```json
{
  "results": [
    {
      "document": {
        "id": 123,
        "filename": "contract_001.pdf",
        "original_filename": "采购合同.pdf",
        "contract_type": "purchase",
        "amount": 100.5
      },
      "matched_keywords": ["设备", "采购"],
      "keyword_positions": {
        "设备": [45, 120, 300],
        "采购": [12, 150]
      },
      "highlighted_text": "这是一份<mark>设备</mark><mark>采购</mark>合同..."
    }
  ],
  "total": 8,
  "query_time": 0.15
}
```

### 3. 向量搜索
```http
POST /api/v1/search/vector
```

**请求参数**:
```json
{
  "query": "寻找类似的服务合同",
  "similarity_threshold": 0.7,
  "limit": 10,
  "filters": {
    "contract_type": ["service"]
  }
}
```

**响应示例**:
```json
{
  "results": [
    {
      "document": {
        "id": 456,
        "filename": "service_contract.pdf",
        "contract_type": "service",
        "amount": 80.0
      },
      "similarity_score": 0.89,
      "vector_distance": 0.11
    }
  ],
  "total": 5,
  "query_time": 0.18
}
```

### 4. 获取搜索建议
```http
GET /api/v1/search/suggestions
```

**查询参数**:
```
q: string - 查询关键词
limit: int = 10 - 建议数量
```

**响应示例**:
```json
{
  "suggestions": [
    "设备采购合同",
    "设备租赁协议",
    "设备维护服务",
    "采购框架协议"
  ],
  "query": "设备"
}
```

### 5. 搜索历史
```http
GET /api/v1/search/history
```

**查询参数**:
```
limit: int = 20 - 历史记录数量
```

**响应示例**:
```json
{
  "history": [
    {
      "id": 1,
      "query": "设备采购合同",
      "search_type": "intelligent",
      "timestamp": "2024-01-15T14:30:00Z",
      "results_count": 15
    }
  ],
  "total": 50
}
```

---

## 📊 数据分析接口

### 1. 仪表板统计
```http
GET /api/v1/analytics/dashboard
```

**响应示例**:
```json
{
  "overview": {
    "total_documents": 1250,
    "total_contracts_value": 15680.5,
    "documents_this_month": 85,
    "processing_documents": 3
  },
  "contract_types": [
    {
      "type": "purchase",
      "count": 450,
      "percentage": 36.0,
      "total_value": 6800.2
    },
    {
      "type": "sales",
      "count": 380,
      "percentage": 30.4,
      "total_value": 5200.8
    }
  ],
  "monthly_trends": [
    {
      "month": "2024-01",
      "documents_count": 95,
      "total_value": 1200.5
    },
    {
      "month": "2024-02",
      "documents_count": 88,
      "total_value": 1150.3
    }
  ],
  "recent_activities": [
    {
      "type": "upload",
      "document_id": 123,
      "filename": "contract_001.pdf",
      "timestamp": "2024-01-15T14:30:00Z"
    }
  ]
}
```

### 2. 文档统计
```http
GET /api/v1/analytics/documents
```

**查询参数**:
```
time_range: string = "30d" - 时间范围 [7d, 30d, 90d, 1y]
group_by: string = "day" - 分组方式 [day, week, month]
```

**响应示例**:
```json
{
  "time_range": "30d",
  "statistics": [
    {
      "date": "2024-01-15",
      "uploads": 12,
      "total_size": 25600000,
      "contract_types": {
        "purchase": 5,
        "sales": 4,
        "service": 3
      }
    }
  ],
  "summary": {
    "total_uploads": 350,
    "average_daily_uploads": 11.7,
    "total_size": 890000000,
    "most_active_day": "2024-01-10"
  }
}
```

### 3. 搜索统计
```http
GET /api/v1/analytics/search
```

**查询参数**:
```
time_range: string = "30d" - 时间范围
```

**响应示例**:
```json
{
  "search_volume": [
    {
      "date": "2024-01-15",
      "searches": 45,
      "unique_users": 12
    }
  ],
  "popular_queries": [
    {
      "query": "设备采购",
      "count": 156,
      "success_rate": 0.89
    }
  ],
  "search_types": {
    "intelligent": 60.5,
    "keyword": 35.2,
    "vector": 4.3
  },
  "average_response_time": 0.23
}
```

---

## ⚙️ 系统管理接口

### 1. 系统信息
```http
GET /api/v1/system/info
```

**响应示例**:
```json
{
  "version": "1.0.0",
  "build_time": "2024-01-15T10:00:00Z",
  "environment": "production",
  "database": {
    "status": "connected",
    "version": "PostgreSQL 14.5"
  },
  "ai_services": {
    "embedding_model": "BGE-M3",
    "llm_model": "Doubao",
    "ocr_engine": "PaddleOCR",
    "status": "online"
  },
  "storage": {
    "total_space": "1TB",
    "used_space": "256GB",
    "available_space": "768GB"
  }
}
```

### 2. 健康检查
```http
GET /api/v1/health
```

**响应示例**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T14:30:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "ai_services": "healthy",
    "file_storage": "healthy"
  },
  "response_time": 0.05
}
```

### 3. 配置管理
```http
GET /api/v1/system/config
```

**响应示例**:
```json
{
  "upload": {
    "max_file_size": 52428800,
    "allowed_types": [".pdf", ".doc", ".docx", ".txt", ".jpg", ".png"],
    "storage_path": "/uploads"
  },
  "search": {
    "max_results": 100,
    "similarity_threshold": 0.7,
    "cache_ttl": 3600
  },
  "ai": {
    "embedding_model": "BGE-M3",
    "max_text_length": 8192,
    "batch_size": 32
  }
}
```

### 4. 更新配置
```http
PUT /api/v1/system/config
```

**请求参数**:
```json
{
  "upload": {
    "max_file_size": 104857600
  },
  "search": {
    "max_results": 50
  }
}
```

---

## 📝 操作日志接口

### 1. 获取操作日志
```http
GET /api/v1/logs/operations
```

**查询参数**:
```
page: int = 1
size: int = 20
user_id: int - 用户ID筛选
action: string - 操作类型筛选
date_from: string - 开始日期
date_to: string - 结束日期
```

**响应示例**:
```json
{
  "logs": [
    {
      "id": 1,
      "user_id": 1,
      "username": "admin",
      "action": "document_upload",
      "resource_type": "document",
      "resource_id": 123,
      "details": {
        "filename": "contract_001.pdf",
        "file_size": 2048576
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "timestamp": "2024-01-15T14:30:00Z"
    }
  ],
  "total": 500,
  "page": 1,
  "size": 20
}
```

### 2. 获取系统日志
```http
GET /api/v1/logs/system
```

**查询参数**:
```
level: string - 日志级别 [DEBUG, INFO, WARNING, ERROR]
component: string - 组件名称
```

**响应示例**:
```json
{
  "logs": [
    {
      "timestamp": "2024-01-15T14:30:00Z",
      "level": "INFO",
      "component": "document_processor",
      "message": "Document processing completed",
      "details": {
        "document_id": 123,
        "processing_time": 2.5
      }
    }
  ]
}
```

---

## 🚨 错误代码说明

### HTTP状态码
- `200` - 请求成功
- `201` - 创建成功
- `400` - 请求参数错误
- `401` - 未授权
- `403` - 禁止访问
- `404` - 资源不存在
- `422` - 请求参数验证失败
- `500` - 服务器内部错误

### 业务错误码
```json
{
  "error": {
    "code": "DOCUMENT_NOT_FOUND",
    "message": "Document not found",
    "details": {
      "document_id": 123
    }
  }
}
```

**常见错误码**:
- `INVALID_TOKEN` - Token无效或过期
- `DOCUMENT_NOT_FOUND` - 文档不存在
- `FILE_TOO_LARGE` - 文件过大
- `UNSUPPORTED_FILE_TYPE` - 不支持的文件类型
- `PROCESSING_FAILED` - 文档处理失败
- `SEARCH_TIMEOUT` - 搜索超时
- `QUOTA_EXCEEDED` - 配额超限

---

## 🔧 开发工具

### Postman集合
提供完整的Postman集合文件，包含所有接口的示例请求。

### OpenAPI文档
访问 `http://localhost:8000/docs` 查看交互式API文档。

### 接口测试
```bash
# 健康检查
curl -X GET "http://localhost:8000/api/v1/health"

# 获取系统信息
curl -X GET "http://localhost:8000/api/v1/system/info"

# 登录获取Token
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'
```

---

## 📞 技术支持

**后端开发**: Alex Chen  
**API文档**: http://localhost:8000/docs  
**技术文档**: `e:\AICode\Trae_Test\Report\Alex_Chen_Backend_Reports\`

---

*本API文档将随着后端开发进展持续更新，请前端开发人员及时关注最新版本。*