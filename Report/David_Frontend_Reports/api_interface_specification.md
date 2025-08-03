# 合约档案智能检索系统 - API接口规范文档

**项目**: 合约档案智能检索系统  
**负责人**: Alex Chen (Python后端工程师)  
**文档版本**: V1.0  
**创建时间**: 2024年12月  
**API基础路径**: `/api`

## 📋 目录

1. [接口概览](#接口概览)
2. [通用规范](#通用规范)
3. [文档管理接口](#文档管理接口)
4. [搜索功能接口](#搜索功能接口)
5. [统计分析接口](#统计分析接口)
6. [系统管理接口](#系统管理接口)
7. [错误码定义](#错误码定义)
8. [数据模型](#数据模型)

## 🎯 接口概览

### 核心功能模块
| 模块 | 接口数量 | 主要功能 |
|------|----------|----------|
| **文档管理** | 6个 | 文档上传、查询、删除、下载 |
| **智能搜索** | 3个 | 自然语言搜索、关键词搜索、高级筛选 |
| **统计分析** | 2个 | 数据统计、活动日志 |
| **系统管理** | 3个 | 健康检查、配置管理、用户管理 |

### 技术要求
- **框架**: FastAPI
- **认证**: JWT Token (可选)
- **文件上传**: 支持多文件上传，最大50MB
- **响应格式**: 统一JSON格式
- **错误处理**: 标准HTTP状态码 + 自定义错误码

## 📐 通用规范

### 请求头规范
```http
Content-Type: application/json
Authorization: Bearer <token>  # 可选
Accept: application/json
```

### 响应格式规范
```json
{
  "success": true,
  "data": {},
  "message": "操作成功",
  "error": null,
  "timestamp": "2024-12-24T10:30:00Z"
}
```

### 分页参数规范
```json
{
  "page": 1,
  "limit": 10,
  "total": 100,
  "has_next": true,
  "has_prev": false
}
```

## 📄 文档管理接口

### 1. 文档上传
**接口**: `POST /api/documents/upload`  
**功能**: 上传合约文档并进行智能处理  
**Content-Type**: `multipart/form-data`

#### 请求参数
```javascript
FormData {
  file: File,                    // 必需，文档文件
  title?: string,                // 可选，文档标题
  category?: string,             // 可选，文档分类
  tags?: string,                 // 可选，标签（逗号分隔）
  contract_type?: string,        // 可选，合同类型
  parties?: string,              // 可选，合同方（逗号分隔）
  amount?: string,               // 可选，合同金额
  sign_date?: string            // 可选，签署日期 (YYYY-MM-DD)
}
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "document_id": "doc_20241224_001",
    "title": "设备采购合同",
    "status": "processing",
    "estimated_time": "2-3分钟"
  },
  "message": "文档上传成功，正在进行智能处理"
}
```

#### 处理流程
1. 文件格式验证（PDF、DOC、DOCX、TXT）
2. 文件大小检查（最大50MB）
3. OCR文字识别（PaddleOCR）
4. AI信息提取（火山引擎豆包API）
5. 向量化处理（SiliconFlow BGE-M3）
6. 存储到数据库和Faiss索引

### 2. 获取文档列表
**接口**: `GET /api/documents`  
**功能**: 分页获取文档列表

#### 请求参数
```http
GET /api/documents?page=1&limit=10&category=采购合同&status=active&sort=upload_date&order=desc
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码，默认1 |
| limit | int | 否 | 每页数量，默认10，最大100 |
| category | string | 否 | 文档分类筛选 |
| status | string | 否 | 文档状态筛选 |
| sort | string | 否 | 排序字段，默认upload_date |
| order | string | 否 | 排序方向，asc/desc，默认desc |

#### 响应示例
```json
{
  "success": true,
  "data": {
    "contracts": [
      {
        "id": "doc_20241224_001",
        "title": "设备采购合同",
        "content_summary": "关于办公设备采购的合同，涉及电脑、打印机等设备...",
        "contract_info": {
          "contract_type": "采购合同",
          "amount": "50万元",
          "parties": ["公司A", "供应商B"],
          "sign_date": "2024-01-15",
          "status": "已签署"
        },
        "file_path": "/uploads/2024/12/contract_001.pdf",
        "upload_date": "2024-12-24T10:30:00Z",
        "tags": ["设备", "采购", "办公用品"]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 156,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

### 3. 获取单个文档详情
**接口**: `GET /api/documents/{document_id}`  
**功能**: 获取指定文档的详细信息

#### 响应示例
```json
{
  "success": true,
  "data": {
    "id": "doc_20241224_001",
    "title": "设备采购合同",
    "content_summary": "关于办公设备采购的合同...",
    "content_text": "完整的文档文本内容...",
    "contract_info": {
      "contract_type": "采购合同",
      "amount": "50万元",
      "parties": ["公司A", "供应商B"],
      "sign_date": "2024-01-15",
      "status": "已签署",
      "effective_date": "2024-01-15",
      "expiry_date": "2025-01-15"
    },
    "file_info": {
      "original_name": "设备采购合同.pdf",
      "file_size": 2048576,
      "file_type": "application/pdf",
      "file_path": "/uploads/2024/12/contract_001.pdf"
    },
    "processing_info": {
      "ocr_confidence": 0.95,
      "extraction_confidence": 0.88,
      "processing_time": "2.3秒"
    },
    "upload_date": "2024-12-24T10:30:00Z",
    "tags": ["设备", "采购", "办公用品"]
  }
}
```

### 4. 文档下载
**接口**: `GET /api/documents/{document_id}/download`  
**功能**: 下载原始文档文件

#### 响应
- **成功**: 返回文件流
- **失败**: 返回JSON错误信息

### 5. 更新文档信息
**接口**: `PUT /api/documents/{document_id}`  
**功能**: 更新文档的元数据信息

#### 请求体
```json
{
  "title": "更新后的标题",
  "category": "服务合同",
  "tags": ["软件", "开发", "外包"],
  "contract_info": {
    "contract_type": "服务合同",
    "amount": "120万元",
    "parties": ["公司A", "开发商C"],
    "sign_date": "2024-01-20"
  }
}
```

### 6. 删除文档
**接口**: `DELETE /api/documents/{document_id}`  
**功能**: 删除指定文档（软删除）

#### 响应示例
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "document_id": "doc_20241224_001"
  },
  "message": "文档删除成功"
}
```

## 🔍 搜索功能接口

### 1. 自然语言搜索
**接口**: `POST /api/search/natural`  
**功能**: 基于自然语言的智能搜索

#### 请求体
```json
{
  "query": "帮我找一下设备采购的合约",
  "limit": 10,
  "filters": {
    "contract_type": "采购合同",
    "amount_range": {
      "min": 10000,
      "max": 1000000
    },
    "date_range": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    },
    "parties": ["公司A"]
  }
}
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "doc_20241224_001",
        "title": "设备采购合同",
        "content_summary": "关于办公设备采购的合同...",
        "contract_info": {
          "contract_type": "采购合同",
          "amount": "50万元",
          "parties": ["公司A", "供应商B"],
          "sign_date": "2024-01-15"
        },
        "similarity": 0.95,
        "highlights": ["设备", "采购", "合同"],
        "upload_date": "2024-12-24T10:30:00Z"
      }
    ],
    "total": 15,
    "query": "帮我找一下设备采购的合约",
    "search_time": 0.35,
    "search_strategy": "semantic_vector",
    "suggestions": ["设备租赁合同", "办公用品采购", "IT设备采购"]
  }
}
```

### 2. 关键词搜索
**接口**: `GET /api/search/keyword`  
**功能**: 基于关键词的精确搜索

#### 请求参数
```http
GET /api/search/keyword?q=设备采购&limit=10&highlight=true&fuzzy=true
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| q | string | 是 | 搜索关键词 |
| limit | int | 否 | 结果数量限制，默认10 |
| highlight | bool | 否 | 是否高亮关键词，默认true |
| fuzzy | bool | 否 | 是否模糊匹配，默认false |

### 3. 高级搜索
**接口**: `POST /api/search/advanced`  
**功能**: 多条件组合搜索

#### 请求体
```json
{
  "conditions": [
    {
      "field": "contract_type",
      "operator": "equals",
      "value": "采购合同"
    },
    {
      "field": "amount",
      "operator": "between",
      "value": [100000, 1000000]
    },
    {
      "field": "content_text",
      "operator": "contains",
      "value": "设备"
    }
  ],
  "logic": "AND",
  "sort": {
    "field": "sign_date",
    "order": "desc"
  },
  "limit": 20
}
```

## 📊 统计分析接口

### 1. 获取统计数据
**接口**: `GET /api/statistics`  
**功能**: 获取系统整体统计数据

#### 响应示例
```json
{
  "success": true,
  "data": {
    "total_documents": 156,
    "total_amount": "1,256万元",
    "contract_types": {
      "采购合同": 45,
      "服务合同": 38,
      "劳务合同": 29,
      "租赁合同": 22,
      "其他合同": 22
    },
    "monthly_uploads": [
      { "month": "2024-07", "count": 12 },
      { "month": "2024-08", "count": 15 },
      { "month": "2024-09", "count": 18 },
      { "month": "2024-10", "count": 22 },
      { "month": "2024-11", "count": 25 },
      { "month": "2024-12", "count": 30 }
    ],
    "amount_distribution": {
      "0-10万": 45,
      "10-50万": 38,
      "50-100万": 29,
      "100万以上": 44
    },
    "recent_activities": [
      {
        "id": "act_001",
        "type": "upload",
        "description": "上传了"设备采购合同"",
        "timestamp": "2024-12-24T14:30:25Z",
        "user": "张三"
      }
    ]
  }
}
```

### 2. 获取活动日志
**接口**: `GET /api/activities`  
**功能**: 获取系统活动日志

#### 请求参数
```http
GET /api/activities?page=1&limit=20&type=upload&start_date=2024-12-01&end_date=2024-12-31
```

## ⚙️ 系统管理接口

### 1. 健康检查
**接口**: `GET /api/health`  
**功能**: 检查系统各组件状态

#### 响应示例
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-12-24T10:30:00Z",
    "components": {
      "database": {
        "status": "healthy",
        "response_time": "5ms"
      },
      "faiss_index": {
        "status": "healthy",
        "documents_count": 156
      },
      "ai_services": {
        "siliconflow_api": {
          "status": "healthy",
          "response_time": "120ms"
        },
        "volcano_api": {
          "status": "healthy",
          "response_time": "200ms"
        }
      },
      "storage": {
        "status": "healthy",
        "free_space": "50GB"
      }
    }
  }
}
```

### 2. 系统配置
**接口**: `GET /api/config`  
**功能**: 获取系统配置信息

### 3. 重建索引
**接口**: `POST /api/system/rebuild-index`  
**功能**: 重新构建Faiss向量索引

## ❌ 错误码定义

### HTTP状态码
| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 413 | 文件过大 |
| 422 | 参数验证失败 |
| 500 | 服务器内部错误 |

### 自定义错误码
```json
{
  "success": false,
  "error": {
    "code": "DOC_001",
    "message": "不支持的文件格式",
    "details": "仅支持PDF、DOC、DOCX、TXT格式"
  }
}
```

| 错误码 | 说明 |
|--------|------|
| DOC_001 | 不支持的文件格式 |
| DOC_002 | 文件大小超过限制 |
| DOC_003 | 文档处理失败 |
| DOC_004 | 文档不存在 |
| SEARCH_001 | 搜索查询为空 |
| SEARCH_002 | 搜索服务不可用 |
| AI_001 | AI服务调用失败 |
| AI_002 | OCR识别失败 |
| SYS_001 | 数据库连接失败 |
| SYS_002 | 存储空间不足 |

## 📋 数据模型

### Contract 文档模型
```typescript
interface Contract {
  id: string                    // 文档唯一ID
  title: string                 // 文档标题
  content_summary: string       // 内容摘要
  content_text?: string         // 完整文本内容
  contract_info: {
    contract_type: string       // 合同类型
    amount: string              // 合同金额
    parties: string[]           // 合同方
    sign_date: string           // 签署日期
    status?: string             // 合同状态
    effective_date?: string     // 生效日期
    expiry_date?: string        // 到期日期
  }
  file_info?: {
    original_name: string       // 原始文件名
    file_size: number           // 文件大小
    file_type: string           // 文件类型
    file_path: string           // 文件路径
  }
  processing_info?: {
    ocr_confidence: number      // OCR置信度
    extraction_confidence: number // 信息提取置信度
    processing_time: string     // 处理时间
  }
  similarity?: number           // 搜索相似度
  highlights?: string[]         // 高亮关键词
  upload_date: string          // 上传时间
  tags?: string[]              // 标签
}
```

### SearchResult 搜索结果模型
```typescript
interface SearchResult {
  documents: Contract[]         // 搜索结果文档列表
  total: number                // 总结果数
  query: string                // 查询语句
  search_time: number          // 搜索耗时（秒）
  search_strategy?: string     // 搜索策略
  suggestions?: string[]       // 搜索建议
}
```

## 🚀 实现优先级

### 第一阶段（核心功能）
1. ✅ 文档上传接口
2. ✅ 文档列表接口
3. ✅ 自然语言搜索接口
4. ✅ 关键词搜索接口
5. ✅ 文档详情接口

### 第二阶段（完善功能）
6. ✅ 统计数据接口
7. ✅ 文档删除接口
8. ✅ 健康检查接口
9. ✅ 高级搜索接口

### 第三阶段（扩展功能）
10. ✅ 文档更新接口
11. ✅ 活动日志接口
12. ✅ 系统配置接口
13. ✅ 重建索引接口

## 📝 开发注意事项

### 性能要求
- **搜索响应时间**: < 500ms
- **文档上传处理**: < 3分钟
- **并发支持**: 10+ 用户同时使用
- **文件大小限制**: 单文件最大50MB

### 安全要求
- 文件类型验证
- 文件大小限制
- SQL注入防护
- XSS攻击防护
- 敏感信息脱敏

### 日志记录
- 所有API调用日志
- 错误详细日志
- 性能监控日志
- 用户操作审计日志

### 测试要求
- 单元测试覆盖率 > 80%
- 集成测试覆盖核心流程
- 性能测试验证响应时间
- 安全测试验证防护措施

---

**文档状态**: 待实现  
**预计完成时间**: 30天  
**负责人**: Alex Chen  
**审核人**: 项目经理

**下一步**: 请Alex Chen根据此文档开始API接口的具体实现工作。