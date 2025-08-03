# 合同档案管理系统 API

## 项目概述

基于FastAPI开发的合同档案管理系统后端API，支持文件上传、OCR文字识别、合同管理等功能。

## 核心功能

### ✅ 已实现功能

1. **文件上传** - 支持PDF、DOC、DOCX格式的合同文件上传
2. **OCR识别** - 基于PaddleOCR的文字识别，自动提取合同内容
3. **合同管理** - 合同列表查询、详情查看、删除操作
4. **状态跟踪** - 实时跟踪OCR处理状态
5. **健康检查** - 系统状态监控和API信息查询

### 🚧 待开发功能

- 智能搜索（关键词搜索、语义搜索）
- 字段提取（合同关键信息自动提取）
- 向量化存储（支持RAG检索）
- 统计分析（使用情况统计）

## API接口

### 核心接口

| 接口 | 方法 | 路径 | 描述 |
|------|------|------|------|
| 文件上传 | POST | `/api/v1/contracts/upload` | 上传合同文件并开始OCR |
| 合同列表 | GET | `/api/v1/contracts/` | 获取合同列表（分页） |
| 合同详情 | GET | `/api/v1/contracts/{id}` | 获取合同详细信息 |
| OCR状态 | GET | `/api/v1/contracts/{id}/ocr-status` | 获取OCR处理状态 |
| HTML内容 | GET | `/api/v1/contracts/{id}/html-content` | 获取合同HTML格式内容 |
| 删除合同 | DELETE | `/api/v1/contracts/{id}` | 删除合同及相关文件 |
| 健康检查 | GET | `/api/v1/health` | 系统健康状态检查 |
| API信息 | GET | `/api/v1/info` | 获取API基本信息 |

### 接口详情

#### 1. 文件上传

```bash
POST /api/v1/contracts/upload
Content-Type: multipart/form-data

# 参数
file: 合同文件（必需）
contract_type: 合同类型（可选）

# 响应示例
{
  "success": true,
  "message": "文件上传成功，OCR处理已开始",
  "data": {
    "contract_id": 1,
    "contract_number": "C230970483",
    "file_name": "C230970483-再生資源.pdf",
    "file_size": 1024000,
    "upload_time": "2024-01-01T10:00:00Z",
    "ocr_status": "processing"
  }
}
```

#### 2. 合同列表

```bash
GET /api/v1/contracts/?page=1&page_size=20

# 响应示例
{
  "success": true,
  "message": "获取合同列表成功",
  "data": {
    "total": 100,
    "page": 1,
    "page_size": 20,
    "contracts": [
      {
        "id": 1,
        "contract_number": "C230970483",
        "contract_name": "再生資源回收合同",
        "contract_type": "再生资源",
        "file_name": "C230970483-再生資源.pdf",
        "file_size": 1024000,
        "file_format": "PDF",
        "upload_time": "2024-01-01T10:00:00Z",
        "ocr_status": "completed",
        "content_status": "completed",
        "vector_status": "pending",
        "created_at": "2024-01-01T10:00:00Z",
        "updated_at": "2024-01-01T10:05:00Z"
      }
    ]
  }
}
```

#### 3. OCR状态查询

```bash
GET /api/v1/contracts/1/ocr-status

# 响应示例
{
  "success": true,
  "message": "获取OCR状态成功",
  "data": {
    "contract_id": 1,
    "ocr_status": "completed",
    "content_status": "completed", 
    "vector_status": "pending",
    "html_content_path": "processed/abc123_content.html",
    "text_content_path": "processed/abc123_content.txt"
  }
}
```

#### 4. HTML内容预览

```bash
GET /api/v1/contracts/1/html-content

# 响应示例
{
  "success": true,
  "message": "获取HTML内容成功",
  "data": {
    "html_content": "<html><head><title>合同内容</title></head><body>...</body></html>",
    "content_type": "text/html"
  }
}

# 错误响应示例
{
  "detail": "合同不存在"  # 404
}
{
  "detail": "OCR处理未完成"  # 400
}
{
  "detail": "HTML文件不存在"  # 404
}
```

## 快速开始

### 1. 环境准备

```bash
# 安装Python依赖
pip install -r requirements.txt

# 配置数据库（PostgreSQL）
# 确保PostgreSQL服务运行，并创建数据库
```

### 2. 配置文件

检查 `app/config.py` 中的配置：

```python
# 数据库配置
DATABASE_URL = "postgresql://username:password@localhost:5432/contract_archive"

# 文件存储配置
UPLOAD_DIR = "uploads"
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# 支持的文件格式
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx"}
```

### 3. 启动服务

```bash
# 方式1：使用启动脚本
python run.py

# 方式2：直接使用uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. 访问API

- **API文档**: http://localhost:8000/docs
- **ReDoc文档**: http://localhost:8000/redoc  
- **健康检查**: http://localhost:8000/api/v1/health

## 数据库结构

系统使用PostgreSQL数据库，包含5张核心表：

1. **contracts** - 合同主表
2. **contract_content** - 合同内容分块表
3. **contract_fields** - 合同字段表
4. **search_logs** - 搜索日志表
5. **system_config** - 系统配置表

数据库表会在应用启动时自动创建。

## 文件处理流程

1. **上传** → 文件保存到 `uploads/YYYY/MM/DD/` 目录
2. **OCR** → PaddleOCR识别文字内容
3. **存储** → 生成HTML和TXT格式的内容文件
4. **状态** → 更新处理状态到数据库

## 开发说明

### 项目结构

```
contract_archive/
├── app/
│   ├── api/           # API路由
│   ├── models/        # 数据库模型
│   ├── services/      # 业务服务
│   ├── config.py      # 配置文件
│   ├── schemas.py     # Pydantic模式
│   ├── crud.py        # 数据库操作
│   └── main.py        # 主应用
├── uploads/           # 文件存储目录
├── requirements.txt   # 依赖包
└── run.py            # 启动脚本
```

### 扩展开发

1. **添加新接口** - 在 `app/api/` 目录下创建新的路由文件
2. **数据库操作** - 在 `app/crud.py` 中添加新的CRUD操作
3. **业务逻辑** - 在 `app/services/` 目录下创建新的服务模块
4. **数据模型** - 在 `app/schemas.py` 中定义新的Pydantic模式

## 注意事项

1. **文件大小限制** - 默认最大50MB，可在配置中调整
2. **OCR性能** - 大文件OCR处理时间较长，建议异步处理
3. **数据库连接** - 确保PostgreSQL服务正常运行
4. **文件存储** - 定期清理临时文件和处理失败的文件

## 技术栈

- **框架**: FastAPI 0.104.1
- **数据库**: PostgreSQL + SQLAlchemy
- **OCR**: PaddleOCR 2.7.3
- **文件处理**: python-multipart
- **异步**: uvicorn + asyncio

## 联系方式

如有问题或建议，请联系开发团队。