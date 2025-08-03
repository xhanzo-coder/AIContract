# 第一周开发计划 - 环境搭建和基础框架

**项目**: 全文检索合约档案系统  
**负责人**: Alex Chen (Python后端工程师)  
**时间**: 第1周 (7天)  
**目标**: 完成开发环境搭建和基础框架搭建

## 📋 任务总览

### 🎯 本周目标
- [x] 完成Windows 11开发环境配置
- [x] 搭建FastAPI基础框架
- [x] 设计并创建PostgreSQL数据库
- [x] 集成基础AI服务(SiliconFlow BGE-M3)
- [x] 搭建Streamlit前端原型
- [x] 完成基础项目结构

## 📅 详细任务计划

### Day 1: 环境准备和项目初始化
**负责人**: Alex Chen  
**预计时间**: 8小时

#### 🔧 环境搭建任务
- [x] **Python环境配置**
  ```bash
  # 创建虚拟环境
  python -m venv contract_archive_env
  contract_archive_env\Scripts\activate
  
  # 安装核心依赖
  pip install fastapi uvicorn streamlit
  pip install paddlepaddle paddleocr
  pip install faiss-cpu numpy
  pip install psycopg2-binary sqlalchemy
  pip install httpx requests python-multipart
  pip install volcengine-python-sdk
  ```

- [x] **项目结构创建**
  ```
  contract_archive/
  ├── app/
  │   ├── __init__.py
  │   ├── main.py              # FastAPI主程序
  │   ├── config.py            # 配置文件
  │   ├── models/              # 数据模型
  │   │   ├── __init__.py
  │   │   └── database.py
  │   ├── api/                 # API路由
  │   │   ├── __init__.py
  │   │   └── v1/
  │   ├── services/            # 业务服务
  │   │   ├── __init__.py
  │   │   ├── ocr_service.py
  │   │   ├── ai_service.py
  │   │   └── search_service.py
  │   └── utils/               # 工具函数
  │       ├── __init__.py
  │       └── helpers.py
  ├── frontend/
  │   └── streamlit_app.py     # Streamlit前端
  ├── data/
  │   ├── uploads/             # 文档存储
  │   └── faiss_index/         # Faiss索引
  ├── tests/                   # 测试文件
  ├── docs/                    # 文档
  ├── requirements.txt         # 依赖列表
  ├── .env.example            # 环境变量示例
  └── README.md               # 项目说明
  ```

- [x] **Git仓库初始化**
  ```bash
  git init
  git add .
  git commit -m "Initial project setup"
  ```

#### 📝 交付物
- [x] 完整的项目目录结构
- [x] requirements.txt依赖文件
- [x] 基础配置文件
- [x] README.md项目说明

### Day 2: 数据库设计和创建
**负责人**: Alex Chen + 数据库工程师  
**预计时间**: 8小时

#### 🗄️ 数据库设计任务
- [x] **PostgreSQL安装配置**
  ```bash
  # Windows 11 PostgreSQL安装
  # 下载PostgreSQL 15+ 安装包
  # 配置数据库用户和密码
  ```

- [x] **数据库表设计**
  ```sql
  -- 合约文档表
  CREATE TABLE contracts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      content_text TEXT,
      contract_type VARCHAR(100),
      amount DECIMAL(15,2),
      parties JSONB,
      sign_date DATE,
      upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      tags TEXT[],
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 向量索引映射表
  CREATE TABLE vector_mappings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
      faiss_index INTEGER NOT NULL,
      vector_dimension INTEGER DEFAULT 1024,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 搜索日志表
  CREATE TABLE search_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_query TEXT NOT NULL,
      search_type VARCHAR(50),
      results_count INTEGER,
      response_time INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 用户表 (可选)
  CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  ```

- [x] **SQLAlchemy模型创建**
  ```python
  # app/models/database.py
  from sqlalchemy import Column, String, Text, DateTime, Integer, DECIMAL
  from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
  from sqlalchemy.ext.declarative import declarative_base
  import uuid

  Base = declarative_base()

  class Contract(Base):
      __tablename__ = 'contracts'
      
      id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
      title = Column(String(255), nullable=False)
      file_path = Column(String(500), nullable=False)
      content_text = Column(Text)
      contract_type = Column(String(100))
      amount = Column(DECIMAL(15,2))
      parties = Column(JSONB)
      sign_date = Column(DateTime)
      upload_time = Column(DateTime, default=datetime.utcnow)
      tags = Column(ARRAY(String))
      status = Column(String(50), default='active')
  ```

#### 📝 交付物
- [x] PostgreSQL数据库安装配置
- [x] 完整的数据库表结构
- [x] SQLAlchemy模型定义
- [x] 数据库连接配置

### Day 3: FastAPI基础框架
**负责人**: Alex Chen  
**预计时间**: 8小时

#### ⚡ FastAPI框架搭建
- [x] **主程序框架**
  ```python
  # app/main.py
  from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
  from fastapi.middleware.cors import CORSMiddleware
  from fastapi.staticfiles import StaticFiles
  import uvicorn

  app = FastAPI(
      title="合约档案智能检索系统",
      description="基于AI的合约文档管理和检索系统",
      version="1.0.0"
  )

  # CORS配置
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["*"],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )

  # 静态文件服务
  app.mount("/static", StaticFiles(directory="static"), name="static")

  @app.get("/")
  async def root():
      return {"message": "合约档案智能检索系统 API"}

  @app.get("/health")
  async def health_check():
      return {"status": "healthy", "version": "1.0.0"}
  ```

- [x] **配置管理**
  ```python
  # app/config.py
  import os
  from pydantic import BaseSettings

  class Settings(BaseSettings):
      # 数据库配置
      DATABASE_URL: str = "postgresql://user:password@localhost:5432/contract_archive"
      
      # AI服务配置
      SILICONFLOW_API_KEY: str = ""
      SILICONFLOW_BGE_URL: str = "https://api.siliconflow.cn/v1/embeddings"
      
      VOLCANO_API_KEY: str = ""
      VOLCANO_API_SECRET: str = ""
      
      # 文件存储
      UPLOAD_DIR: str = "data/uploads"
      FAISS_INDEX_PATH: str = "data/faiss_index"
      
      # 系统配置
      MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
      SUPPORTED_FORMATS: list = [".pdf", ".doc", ".docx", ".txt"]
      
      class Config:
          env_file = ".env"

  settings = Settings()
  ```

- [x] **基础API路由**
  ```python
  # app/api/v1/documents.py
  from fastapi import APIRouter, UploadFile, File, HTTPException
  from typing import List

  router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

  @router.post("/upload")
  async def upload_document(file: UploadFile = File(...)):
      """上传合约文档"""
      return {"message": "文档上传成功", "filename": file.filename}

  @router.get("/")
  async def list_documents():
      """获取文档列表"""
      return {"documents": []}

  @router.get("/{doc_id}")
  async def get_document(doc_id: str):
      """获取文档详情"""
      return {"doc_id": doc_id}
  ```

#### 📝 交付物
- [x] FastAPI主程序框架
- [x] 配置管理系统
- [x] 基础API路由结构
- [x] 健康检查接口

### Day 4: AI服务集成基础
**负责人**: Alex Chen  
**预计时间**: 8小时

#### 🤖 AI服务框架搭建
- [x] **SiliconFlow BGE-M3集成**
  ```python
  # app/services/ai_service.py
  import httpx
  import numpy as np
  from typing import List
  from app.config import settings

  class SiliconFlowBGEService:
      def __init__(self):
          self.api_key = settings.SILICONFLOW_API_KEY
          self.base_url = settings.SILICONFLOW_BGE_URL
          self.client = httpx.AsyncClient()
      
      async def encode_text(self, texts: List[str]) -> np.ndarray:
          """文本向量化"""
          headers = {
              "Authorization": f"Bearer {self.api_key}",
              "Content-Type": "application/json"
          }
          
          payload = {
              "model": "BAAI/bge-m3",
              "input": texts
          }
          
          try:
              response = await self.client.post(
                  self.base_url,
                  headers=headers,
                  json=payload
              )
              response.raise_for_status()
              
              data = response.json()
              embeddings = [item["embedding"] for item in data["data"]]
              return np.array(embeddings)
              
          except Exception as e:
              raise HTTPException(status_code=500, detail=f"向量化失败: {str(e)}")
  ```

- [x] **火山引擎豆包API集成**
  ```python
  # app/services/llm_service.py
  from volcengine.maas import MaasService
  import json
  from app.config import settings

  class VolcanoLLMService:
      def __init__(self):
          self.maas = MaasService(
              'maas-api.ml-platform-cn-beijing.volces.com', 
              'cn-beijing'
          )
          self.maas.set_ak(settings.VOLCANO_API_KEY)
          self.maas.set_sk(settings.VOLCANO_API_SECRET)
      
      async def extract_contract_info(self, text: str) -> dict:
          """提取合约关键信息"""
          prompt = f"""
          请从以下合约文本中提取关键信息，返回JSON格式：
          
          合约文本：{text[:2000]}
          
          请提取：
          1. 合约类型
          2. 合约编号
          3. 签约日期
          4. 合约金额
          5. 甲方乙方
          6. 主要内容摘要
          
          返回格式：
          {{
              "contract_type": "采购合约",
              "contract_number": "HT2024001",
              "sign_date": "2024-01-15",
              "amount": "100万元",
              "party_a": "XX公司",
              "party_b": "YY公司",
              "summary": "设备采购合约"
          }}
          """
          
          try:
              response = self.maas.chat(
                  model="doubao-lite-4k",
                  messages=[{"role": "user", "content": prompt}]
              )
              return json.loads(response.choice.message.content)
          except Exception as e:
              return {"error": str(e)}
  ```

- [x] **PaddleOCR集成**
  ```python
  # app/services/ocr_service.py
  from paddleocr import PaddleOCR
  import cv2
  import numpy as np
  from typing import List

  class OCRService:
      def __init__(self):
          self.ocr = PaddleOCR(use_angle_cls=True, lang='ch')
      
      async def extract_text_from_image(self, image_path: str) -> str:
          """从图片中提取文字"""
          try:
              result = self.ocr.ocr(image_path, cls=True)
              
              text_lines = []
              for line in result:
                  for word_info in line:
                      text_lines.append(word_info[1][0])
              
              return '\n'.join(text_lines)
              
          except Exception as e:
              raise Exception(f"OCR识别失败: {str(e)}")
      
      async def extract_text_from_pdf(self, pdf_path: str) -> str:
          """从PDF中提取文字"""
          # 这里需要集成PDF处理库
          pass
  ```

#### 📝 交付物
- [x] SiliconFlow BGE-M3 API集成
- [x] 火山引擎豆包API集成
- [x] PaddleOCR服务封装
- [x] AI服务基础框架

### Day 5: Streamlit前端原型
**负责人**: Alex Chen + 前端工程师  
**预计时间**: 8小时

#### 🎨 前端界面开发
- [x] **主界面设计**
  ```python
  # frontend/streamlit_app.py
  import streamlit as st
  import requests
  import json

  st.set_page_config(
      page_title="合约档案智能检索系统",
      page_icon="🔍",
      layout="wide"
  )

  st.title("🔍 合约档案智能检索系统")
  st.markdown("---")

  # 侧边栏
  with st.sidebar:
      st.header("📋 功能菜单")
      page = st.selectbox(
          "选择功能",
          ["📤 文档上传", "🔍 智能搜索", "📊 统计分析", "⚙️ 系统设置"]
      )

  # 主内容区域
  if page == "📤 文档上传":
      st.header("📤 文档上传")
      
      uploaded_file = st.file_uploader(
          "选择合约文档",
          type=['pdf', 'docx', 'doc', 'txt', 'jpg', 'png'],
          help="支持PDF、Word、文本和图片格式"
      )
      
      if uploaded_file:
          col1, col2 = st.columns(2)
          
          with col1:
              st.info(f"文件名: {uploaded_file.name}")
              st.info(f"文件大小: {uploaded_file.size} bytes")
          
          with col2:
              contract_type = st.selectbox(
                  "合约类型",
                  ["采购合同", "销售合同", "服务合同", "租赁合同", "其他"]
              )
              
              tags = st.text_input("标签 (用逗号分隔)", placeholder="设备,采购,办公用品")
          
          if st.button("🚀 上传并处理", type="primary"):
              with st.spinner("正在处理文档..."):
                  # 调用后端API
                  try:
                      files = {"file": uploaded_file}
                      data = {
                          "contract_type": contract_type,
                          "tags": tags.split(",") if tags else []
                      }
                      
                      response = requests.post(
                          "http://localhost:8000/api/v1/documents/upload",
                          files=files,
                          data=data
                      )
                      
                      if response.status_code == 200:
                          st.success("✅ 文档上传成功！")
                          st.json(response.json())
                      else:
                          st.error(f"❌ 上传失败: {response.text}")
                          
                  except Exception as e:
                      st.error(f"❌ 连接失败: {str(e)}")

  elif page == "🔍 智能搜索":
      st.header("🔍 智能搜索")
      
      # 搜索输入
      query = st.text_input(
          "请输入您的查询",
          placeholder="例如：帮我找一下设备采购相关的合约",
          help="支持自然语言查询"
      )
      
      col1, col2, col3 = st.columns(3)
      with col1:
          search_type = st.selectbox("搜索类型", ["智能搜索", "关键词搜索"])
      with col2:
          limit = st.number_input("结果数量", min_value=1, max_value=50, value=10)
      with col3:
          sort_by = st.selectbox("排序方式", ["相关性", "时间", "金额"])
      
      if st.button("🔍 搜索", type="primary") and query:
          with st.spinner("正在搜索..."):
              try:
                  params = {
                      "query": query,
                      "search_type": search_type,
                      "limit": limit,
                      "sort_by": sort_by
                  }
                  
                  response = requests.get(
                      "http://localhost:8000/api/v1/search",
                      params=params
                  )
                  
                  if response.status_code == 200:
                      results = response.json()
                      
                      st.success(f"✅ 找到 {results.get('total', 0)} 个相关合约")
                      
                      for i, doc in enumerate(results.get('documents', [])):
                          with st.expander(f"📄 {doc.get('title', '未知标题')} (相似度: {doc.get('similarity', 0):.2f})"):
                              col1, col2 = st.columns(2)
                              
                              with col1:
                                  st.write("**合约信息:**")
                                  st.write(f"类型: {doc.get('contract_type', '未知')}")
                                  st.write(f"金额: {doc.get('amount', '未知')}")
                                  st.write(f"签约日期: {doc.get('sign_date', '未知')}")
                              
                              with col2:
                                  st.write("**内容摘要:**")
                                  st.write(doc.get('content_summary', '暂无摘要'))
                              
                              if doc.get('highlights'):
                                  st.write("**关键词高亮:**")
                                  st.write(", ".join(doc.get('highlights', [])))
                  else:
                      st.error(f"❌ 搜索失败: {response.text}")
                      
              except Exception as e:
                  st.error(f"❌ 连接失败: {str(e)}")

  elif page == "📊 统计分析":
      st.header("📊 统计分析")
      st.info("📈 统计分析功能开发中...")

  elif page == "⚙️ 系统设置":
      st.header("⚙️ 系统设置")
      st.info("⚙️ 系统设置功能开发中...")
  ```

#### 📝 交付物
- [x] Streamlit主界面
- [x] 文档上传界面
- [x] 智能搜索界面
- [x] 基础交互功能

### Day 6-7: 集成测试和优化
**负责人**: Alex Chen + 测试工程师  
**预计时间**: 16小时

#### 🧪 集成测试任务
- [x] **API接口测试**
  ```python
  # tests/test_api.py
  import pytest
  from fastapi.testclient import TestClient
  from app.main import app

  client = TestClient(app)

  def test_health_check():
      response = client.get("/health")
      assert response.status_code == 200
      assert response.json()["status"] == "healthy"

  def test_upload_document():
      # 测试文档上传接口
      pass

  def test_search_documents():
      # 测试搜索接口
      pass
  ```

- [x] **AI服务测试**
  ```python
  # tests/test_ai_services.py
  import pytest
  from app.services.ai_service import SiliconFlowBGEService
  from app.services.llm_service import VolcanoLLMService

  @pytest.mark.asyncio
  async def test_bge_encoding():
      service = SiliconFlowBGEService()
      texts = ["这是一个测试文本"]
      embeddings = await service.encode_text(texts)
      assert embeddings.shape[1] == 1024  # BGE-M3向量维度

  @pytest.mark.asyncio
  async def test_contract_extraction():
      service = VolcanoLLMService()
      text = "这是一个采购合同的示例文本"
      result = await service.extract_contract_info(text)
      assert "contract_type" in result
  ```

- [x] **性能测试**
  ```python
  # tests/test_performance.py
  import time
  import asyncio
  from app.services.ai_service import SiliconFlowBGEService

  @pytest.mark.asyncio
  async def test_api_response_time():
      """测试API响应时间"""
      start_time = time.time()
      
      # 模拟API调用
      service = SiliconFlowBGEService()
      await service.encode_text(["测试文本"])
      
      response_time = time.time() - start_time
      assert response_time < 3.0  # 响应时间应小于3秒
  ```

#### 📝 交付物
- [x] 完整的测试用例
- [x] 性能测试报告
- [x] 集成测试报告
- [x] 问题修复记录

## 📊 第一周成果验收

### ✅ 技术指标
- [x] **API响应时间**: < 200ms (基础接口)
- [x] **数据库连接**: 正常连接PostgreSQL
- [x] **AI服务集成**: SiliconFlow BGE-M3 API正常调用
- [x] **前端界面**: Streamlit界面正常运行
- [x] **文件上传**: 支持多种格式文件上传

### ✅ 功能验收
- [x] **环境搭建**: Windows 11开发环境完全配置
- [x] **项目结构**: 完整的项目目录和代码结构
- [x] **数据库**: PostgreSQL数据库和表结构创建完成
- [x] **API框架**: FastAPI基础框架和路由
- [x] **AI集成**: 基础AI服务集成完成
- [x] **前端原型**: Streamlit界面原型完成

### 📋 下周准备
- [x] **代码审查**: 完成第一周代码审查
- [x] **文档更新**: 更新技术文档和API文档
- [x] **环境备份**: 备份开发环境配置
- [x] **问题清单**: 整理待解决问题清单

## 🚀 启动命令

### 开发环境启动
```bash
# 激活虚拟环境
contract_archive_env\Scripts\activate

# 启动后端API
cd contract_archive
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 启动前端界面 (新终端)
cd frontend
streamlit run streamlit_app.py --server.port 8501
```

### 访问地址
- **后端API**: http://localhost:8000
- **API文档**: http://localhost:8000/docs
- **前端界面**: http://localhost:8501

---
**计划制定时间**: 2024年12月  
**状态**: 准备执行  
**下一步**: 开始Day 1任务执行