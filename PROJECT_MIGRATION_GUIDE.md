# 合约档案智能检索系统 - 项目迁移指南

## 概述
本指南将帮助您在新电脑上完整部署合约档案智能检索系统，包括数据库同步、搜索引擎安装和环境配置。

---

## 1. PostgreSQL 数据库完全同步

### 1.1 在原电脑上导出数据库

#### 步骤1：使用Navicat导出数据库结构和数据
1. 打开Navicat，连接到原数据库
2. 右键点击数据库 `contract_archive`
3. 选择 "转储SQL文件" → "结构和数据"
4. 保存为 `contract_archive_backup.sql`

#### 步骤2：导出用户权限信息
在原电脑的PostgreSQL中执行以下SQL，保存结果：
```sql
-- 查看用户信息
SELECT * FROM pg_user WHERE usename = 'contract_user';

-- 查看用户权限
\du contract_user

-- 查看数据库权限
SELECT datname, datacl FROM pg_database WHERE datname = 'contract_archive';
```

### 1.2 在新电脑上安装PostgreSQL

#### 步骤1：下载并安装PostgreSQL
1. 访问 https://www.postgresql.org/download/windows/
2. 下载 PostgreSQL 15.x 版本（推荐与原版本一致）
3. 安装时设置：
   - 超级用户密码：`postgres123`（请记住此密码）
   - 端口：`5432`（默认）
   - 区域设置：选择 "Chinese (Simplified), China"

#### 步骤2：创建数据库和用户
1. 打开 pgAdmin 或使用命令行
2. 连接到PostgreSQL（用户名：postgres，密码：postgres123）
3. 执行以下SQL命令：

```sql
-- 创建数据库
CREATE DATABASE contract_archive
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'Chinese (Simplified)_China.936'
    LC_CTYPE = 'Chinese (Simplified)_China.936'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

-- 创建用户
CREATE USER contract_user WITH PASSWORD 'contract@2025';

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE contract_archive TO contract_user;

-- 连接到contract_archive数据库
\c contract_archive

-- 授予schema权限
GRANT ALL ON SCHEMA public TO contract_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO contract_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO contract_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO contract_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO contract_user;
```

#### 步骤3：导入数据库备份
1. 在pgAdmin中右键点击 `contract_archive` 数据库
2. 选择 "还原"
3. 选择备份文件 `contract_archive_backup.sql`
4. 点击 "还原" 开始导入

### 1.3 使用Navicat连接新数据库

#### 连接配置：
- **连接名**：Contract Archive - New Server
- **主机**：localhost
- **端口**：5432
- **用户名**：contract_user
- **密码**：contract@2025
- **数据库**：contract_archive

#### 验证连接：
连接成功后，应该能看到以下表：
- contracts（合同主表）
- contract_content（合同内容分块表）
- contract_fields（合同字段表）
- search_logs（搜索日志表）
- system_config（系统配置表）

---

## 2. Elasticsearch 安装配置

### 2.1 下载和安装

#### 步骤1：下载Elasticsearch 8.11.3
1. 访问 https://www.elastic.co/downloads/past-releases
2. 找到 Elasticsearch 8.11.3
3. 下载 `elasticsearch-8.11.3-windows-x86_64.zip`

#### 步骤2：解压和配置
1. 解压到 `C:\elasticsearch-8.11.3`
2. 编辑 `C:\elasticsearch-8.11.3\config\elasticsearch.yml`：

```yaml
# 集群名称
cluster.name: contract-archive-cluster

# 节点名称
node.name: node-1

# 网络配置
network.host: localhost
http.port: 9200

# 发现配置
discovery.type: single-node

# 安全配置（开发环境）
xpack.security.enabled: false
xpack.security.enrollment.enabled: false
xpack.security.http.ssl.enabled: false
xpack.security.transport.ssl.enabled: false

# 内存配置
bootstrap.memory_lock: false
```

#### 步骤3：配置JVM内存
编辑 `C:\elasticsearch-8.11.3\config\jvm.options`：
```
# 根据您的电脑内存调整（推荐设置为总内存的1/4）
-Xms2g
-Xmx2g
```

### 2.2 启动Elasticsearch

#### 方法1：命令行启动
1. 打开命令提示符（管理员权限）
2. 切换到Elasticsearch目录：
```cmd
cd C:\elasticsearch-8.11.3\bin
```
3. 启动服务：
```cmd
elasticsearch.bat
```

#### 方法2：安装为Windows服务（推荐）
1. 打开命令提示符（管理员权限）
2. 切换到Elasticsearch目录：
```cmd
cd C:\elasticsearch-8.11.3\bin
```
3. 安装服务：
```cmd
elasticsearch-service.bat install
```
4. 启动服务：
```cmd
elasticsearch-service.bat start
```

### 2.3 验证安装
1. 打开浏览器访问：http://localhost:9200
2. 应该看到类似以下的JSON响应：
```json
{
  "name" : "node-1",
  "cluster_name" : "contract-archive-cluster",
  "cluster_uuid" : "...",
  "version" : {
    "number" : "8.11.3",
    "build_flavor" : "default",
    "build_type" : "zip",
    "build_hash" : "...",
    "build_date" : "...",
    "build_snapshot" : false,
    "lucene_version" : "9.8.0",
    "minimum_wire_compatibility_version" : "7.17.0",
    "minimum_index_compatibility_version" : "7.0.0"
  },
  "tagline" : "You Know, for Search"
}
```

---

## 3. Python后端环境配置

### 3.1 检查Python环境

#### 步骤1：确认Miniconda安装
打开PowerShell，执行：
```powershell
conda --version
python --version
```

#### 步骤2：激活stock虚拟环境
```powershell
conda activate stock
```

### 3.2 安装项目依赖

#### 步骤1：切换到项目目录
```powershell
cd "d:\File\Code\AI Code\Trae_Test\contract_archive"
```

#### 步骤2：安装Python依赖包
```powershell
# 确保在stock环境中
conda activate stock

# 升级pip
python -m pip install --upgrade pip

# 安装项目依赖
pip install -r requirements.txt
```

#### 步骤3：验证关键包安装
```powershell
# 验证FastAPI
python -c "import fastapi; print('FastAPI version:', fastapi.__version__)"

# 验证数据库连接
python -c "import psycopg2; print('PostgreSQL driver OK')"

# 验证Elasticsearch
python -c "import elasticsearch; print('Elasticsearch client OK')"

# 验证AI相关包
python -c "import paddleocr; print('PaddleOCR OK')"
python -c "import faiss; print('Faiss OK')"
```

### 3.3 配置环境变量

#### 步骤1：复制环境配置文件
```powershell
cp .env.example .env
```

#### 步骤2：编辑.env文件
使用记事本或VS Code编辑 `.env` 文件：

```env
# 数据库配置
DATABASE_URL=postgresql://contract_user:contract%402025@localhost:5432/contract_archive

# SiliconFlow BGE-M3 API配置
SILICONFLOW_API_KEY=sk-jvzbrgzerhfbtetfuapjhwjwpzuwhfphiisvylabwesvzzza
SILICONFLOW_BGE_URL=https://api.siliconflow.cn/v1/embeddings

# 火山引擎豆包API配置（需要您提供）
VOLCANO_API_KEY=your_volcano_api_key
VOLCANO_API_SECRET=your_volcano_api_secret

# 文件存储配置
UPLOAD_DIR=data/uploads
FAISS_INDEX_PATH=data/faiss_index
MAX_FILE_SIZE=52428800

# 系统配置
DEBUG=True
LOG_LEVEL=INFO
SECRET_KEY=your_secret_key_here_change_in_production

# 支持的文件格式
SUPPORTED_FORMATS=.pdf,.doc,.docx,.txt,.jpg,.png,.jpeg

# Elasticsearch配置
ELASTICSEARCH_HOST=localhost
ELASTICSEARCH_PORT=9200
ELASTICSEARCH_USER=
ELASTICSEARCH_PASSWORD=
ELASTICSEARCH_ENABLED=True
```

### 3.4 创建必要的目录
```powershell
# 创建数据目录
New-Item -ItemType Directory -Force -Path "data\uploads"
New-Item -ItemType Directory -Force -Path "data\faiss_index"
New-Item -ItemType Directory -Force -Path "data\uploads\temp"
New-Item -ItemType Directory -Force -Path "data\uploads\processed"
```

### 3.5 启动后端服务

#### 方法1：使用Python脚本启动
```powershell
python run.py
```

#### 方法2：使用批处理文件启动
```powershell
.\run.bat
```

#### 方法3：直接使用uvicorn启动
```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3.6 验证后端服务

1. **检查服务状态**：
   - 访问：http://localhost:8000
   - 应该看到：`{"message":"Contract Archive API is running"}`

2. **检查API文档**：
   - 访问：http://localhost:8000/docs
   - 应该看到完整的API文档界面

3. **检查健康状态**：
   - 访问：http://localhost:8000/api/v1/health
   - 应该看到数据库和Elasticsearch的连接状态

---

## 4. 数据同步验证

### 4.1 检查数据库数据
使用Navicat查询：
```sql
-- 检查合同数据
SELECT count(*) FROM contracts;

-- 检查内容分块数据
SELECT count(*) FROM contract_content;

-- 查看最新的合同记录
SELECT contract_number, contract_name, ocr_status, created_at 
FROM contracts 
ORDER BY created_at DESC 
LIMIT 5;
```

### 4.2 同步Elasticsearch数据
如果原系统中有Elasticsearch数据，需要重新同步：

```powershell
# 在项目目录下执行
python -c "
from app.services.elasticsearch_service import ElasticsearchService
import asyncio

async def sync_data():
    es_service = ElasticsearchService()
    result = await es_service.sync_all_contracts()
    print(f'同步结果: {result}')

asyncio.run(sync_data())
"
```

---

## 5. 常见问题解决

### 5.1 PostgreSQL连接问题
**问题**：连接被拒绝
**解决**：
1. 检查PostgreSQL服务是否启动
2. 检查防火墙设置
3. 确认pg_hba.conf配置允许本地连接

### 5.2 Elasticsearch启动失败
**问题**：内存不足或端口占用
**解决**：
1. 调整JVM内存设置
2. 检查9200端口是否被占用
3. 查看logs目录下的错误日志

### 5.3 Python包安装失败
**问题**：某些包安装失败
**解决**：
```powershell
# 清理pip缓存
pip cache purge

# 使用国内镜像源
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple/

# 单独安装失败的包
pip install package_name --no-cache-dir
```

### 5.4 文件权限问题
**问题**：无法创建文件或目录
**解决**：
1. 以管理员权限运行PowerShell
2. 检查项目目录的写入权限
3. 确保data目录存在且可写

---

## 6. 迁移检查清单

### 6.1 数据库迁移检查
- [ ] PostgreSQL服务正常启动
- [ ] contract_user用户创建成功
- [ ] 数据库权限配置正确
- [ ] 所有表结构导入成功
- [ ] 历史数据完整导入
- [ ] Navicat可以正常连接

### 6.2 Elasticsearch检查
- [ ] Elasticsearch服务正常启动
- [ ] 可以访问http://localhost:9200
- [ ] 集群状态为green或yellow
- [ ] 索引创建成功

### 6.3 Python环境检查
- [ ] stock虚拟环境激活成功
- [ ] 所有依赖包安装完成
- [ ] .env文件配置正确
- [ ] 数据目录创建成功
- [ ] 后端服务启动成功
- [ ] API文档可以访问
- [ ] 健康检查通过

### 6.4 功能验证检查
- [ ] 文件上传功能正常
- [ ] OCR处理功能正常
- [ ] 搜索功能正常
- [ ] 数据库查询正常
- [ ] Elasticsearch搜索正常

---

## 7. 联系支持

如果在迁移过程中遇到问题，请提供以下信息：
1. 错误信息的完整截图
2. 相关的日志文件内容
3. 操作系统版本和配置
4. Python和相关包的版本信息

**Alex Chen (Python后端工程师)**
- 专精：Python后端开发、数据库优化、AI系统集成
- 经验：8年Python开发经验，熟悉FastAPI、PostgreSQL、Elasticsearch

---

*本指南最后更新：2025年1月19日*