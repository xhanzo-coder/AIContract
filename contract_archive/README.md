# 合约档案智能检索系统

基于FastAPI + Streamlit的智能合约文档检索与问答系统

## 🚀 快速开始

### 1. 环境要求
- Python 3.8+
- Windows系统

### 2. 一键启动
```bash
# 双击运行或命令行执行
run.bat
```

**首次运行会自动**：
- 创建虚拟环境
- 安装所需依赖
- 创建必要目录
- 复制配置文件

### 3. 配置API密钥
编辑 `.env` 文件，填入以下密钥：
```env
# SiliconFlow API (申请地址: https://cloud.siliconflow.cn/)
SILICONFLOW_API_KEY=your_api_key

# 豆包API (申请地址: https://console.volcengine.com/ark/)
DOUBAO_API_KEY=your_api_key
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MODEL=ep-20241208-******
```

### 4. 访问系统
- **前端界面**: http://localhost:8501
- **后端API**: http://localhost:8000
- **API文档**: http://localhost:8000/docs

## 📦 跨电脑部署

### 传输文件
压缩以下文件到目标电脑：
```
✅ app/              # 后端代码
✅ frontend/         # 前端代码  
✅ requirements.txt  # 依赖列表
✅ .env.example     # 配置模板
✅ run.bat          # 启动脚本
✅ README.md        # 说明文档

❌ 不要传输: venv/, data/, .env
```

### 目标电脑要求
- Python 3.8+ (必须安装)
- 网络连接 (首次安装依赖)

### 部署步骤
1. 解压文件到任意目录
2. 双击 `run.bat` 启动
3. 编辑 `.env` 文件配置API密钥
4. 重新运行 `run.bat`

## 🔧 功能特性
- ✅ 文档上传与解析 (PDF、Word、图片)
- ✅ 智能语义检索 (BGE-M3向量化)
- ✅ 智能问答对话 (豆包大模型)
- ✅ 响应式Web界面
- ✅ RESTful API接口

## 📁 项目结构
```
contract_archive/
├── app/                # 后端API
├── frontend/           # 前端界面
├── venv/              # 虚拟环境(自动创建)
├── data/              # 数据目录(自动创建)
├── requirements.txt   # 依赖列表
├── .env              # 环境配置(自动创建)
└── run.bat           # 启动脚本
```

## ⚠️ 注意事项
- 首次运行需要网络连接安装依赖
- 确保8000和8501端口未被占用
- API密钥需要自行申请配置

---

💡 **一键启动，开箱即用！**