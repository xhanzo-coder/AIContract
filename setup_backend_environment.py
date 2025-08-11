#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
合约档案智能检索系统 - 后端环境自动配置脚本
作者：Alex Chen (Python后端工程师)
功能：自动检查和配置Python后端环境
"""

import os
import sys
import subprocess
import platform
from pathlib import Path
import shutil

def print_header(title):
    """打印标题"""
    print("\n" + "="*60)
    print(f"🔧 {title}")
    print("="*60)

def print_step(step, description):
    """打印步骤"""
    print(f"\n📋 步骤 {step}: {description}")
    print("-" * 40)

def run_command(command, description="", check=True):
    """执行命令并处理结果"""
    print(f"🔄 执行: {command}")
    try:
        if isinstance(command, str):
            result = subprocess.run(command, shell=True, capture_output=True, text=True, encoding='utf-8')
        else:
            result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8')
        
        if result.returncode == 0:
            print(f"✅ 成功: {description}")
            if result.stdout.strip():
                print(f"📤 输出: {result.stdout.strip()}")
            return True, result.stdout
        else:
            print(f"❌ 失败: {description}")
            if result.stderr.strip():
                print(f"📤 错误: {result.stderr.strip()}")
            if check:
                return False, result.stderr
            return True, result.stderr
    except Exception as e:
        print(f"❌ 异常: {str(e)}")
        if check:
            return False, str(e)
        return True, str(e)

def check_python_environment():
    """检查Python环境"""
    print_step(1, "检查Python环境")
    
    # 检查Python版本
    python_version = sys.version
    print(f"🐍 Python版本: {python_version}")
    
    # 检查是否在conda环境中
    conda_env = os.environ.get('CONDA_DEFAULT_ENV')
    if conda_env:
        print(f"🔗 当前Conda环境: {conda_env}")
        if conda_env != 'stock':
            print("⚠️  警告: 当前不在stock环境中")
            print("请执行: conda activate stock")
            return False
    else:
        print("⚠️  警告: 未检测到Conda环境")
        return False
    
    # 检查pip
    success, output = run_command([sys.executable, "-m", "pip", "--version"], "检查pip")
    if not success:
        return False
    
    print("✅ Python环境检查通过")
    return True

def check_project_structure():
    """检查项目结构"""
    print_step(2, "检查项目结构")
    
    current_dir = Path.cwd()
    print(f"📁 当前目录: {current_dir}")
    
    # 检查是否在正确的项目目录
    required_files = [
        "requirements.txt",
        "app/main.py",
        "app/models/models.py",
        ".env.example"
    ]
    
    missing_files = []
    for file_path in required_files:
        if not (current_dir / file_path).exists():
            missing_files.append(file_path)
    
    if missing_files:
        print(f"❌ 缺少必要文件: {missing_files}")
        print("请确保在contract_archive目录下运行此脚本")
        return False
    
    print("✅ 项目结构检查通过")
    return True

def create_directories():
    """创建必要的目录"""
    print_step(3, "创建必要的目录")
    
    directories = [
        "data/uploads",
        "data/uploads/temp",
        "data/uploads/processed",
        "data/uploads/2025",
        "data/faiss_index",
        "logs"
    ]
    
    for directory in directories:
        dir_path = Path(directory)
        if not dir_path.exists():
            dir_path.mkdir(parents=True, exist_ok=True)
            print(f"📁 创建目录: {directory}")
        else:
            print(f"📁 目录已存在: {directory}")
    
    print("✅ 目录创建完成")
    return True

def setup_environment_file():
    """设置环境配置文件"""
    print_step(4, "设置环境配置文件")
    
    env_file = Path(".env")
    env_example = Path(".env.example")
    
    if not env_file.exists():
        if env_example.exists():
            shutil.copy(env_example, env_file)
            print("📄 复制 .env.example 到 .env")
        else:
            print("❌ .env.example 文件不存在")
            return False
    else:
        print("📄 .env 文件已存在")
    
    # 读取并检查.env文件内容
    try:
        with open(env_file, 'r', encoding='utf-8') as f:
            env_content = f.read()
        
        # 检查关键配置项
        required_configs = [
            "DATABASE_URL",
            "SILICONFLOW_API_KEY",
            "ELASTICSEARCH_HOST"
        ]
        
        missing_configs = []
        for config in required_configs:
            if config not in env_content or f"{config}=your_" in env_content:
                missing_configs.append(config)
        
        if missing_configs:
            print(f"⚠️  需要配置的项目: {missing_configs}")
            print("请编辑 .env 文件，填入正确的配置值")
        else:
            print("✅ 环境配置检查通过")
        
    except Exception as e:
        print(f"❌ 读取.env文件失败: {e}")
        return False
    
    return True

def install_dependencies():
    """安装Python依赖包"""
    print_step(5, "安装Python依赖包")
    
    # 升级pip
    print("🔄 升级pip...")
    success, output = run_command([sys.executable, "-m", "pip", "install", "--upgrade", "pip"], "升级pip")
    if not success:
        print("⚠️  pip升级失败，继续安装依赖")
    
    # 安装依赖包
    print("🔄 安装项目依赖...")
    success, output = run_command([
        sys.executable, "-m", "pip", "install", "-r", "requirements.txt",
        "-i", "https://pypi.tuna.tsinghua.edu.cn/simple/"
    ], "安装依赖包")
    
    if not success:
        print("❌ 依赖包安装失败")
        print("请手动执行: pip install -r requirements.txt")
        return False
    
    print("✅ 依赖包安装完成")
    return True

def verify_key_packages():
    """验证关键包安装"""
    print_step(6, "验证关键包安装")
    
    key_packages = [
        ("fastapi", "FastAPI"),
        ("psycopg2", "PostgreSQL驱动"),
        ("elasticsearch", "Elasticsearch客户端"),
        ("paddleocr", "PaddleOCR"),
        ("faiss", "Faiss向量搜索"),
        ("langchain", "LangChain"),
        ("sqlalchemy", "SQLAlchemy ORM")
    ]
    
    failed_packages = []
    
    for package, description in key_packages:
        try:
            __import__(package)
            print(f"✅ {description}: 已安装")
        except ImportError:
            print(f"❌ {description}: 未安装")
            failed_packages.append(package)
    
    if failed_packages:
        print(f"\n❌ 以下包安装失败: {failed_packages}")
        print("请手动安装失败的包")
        return False
    
    print("✅ 所有关键包验证通过")
    return True

def test_database_connection():
    """测试数据库连接"""
    print_step(7, "测试数据库连接")
    
    try:
        # 尝试导入并测试数据库连接
        from app.models.database import engine
        from sqlalchemy import text
        
        with engine.connect() as connection:
            result = connection.execute(text("SELECT version();"))
            version = result.fetchone()[0]
            print(f"✅ 数据库连接成功")
            print(f"📊 PostgreSQL版本: {version}")
            return True
            
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        print("请检查:")
        print("1. PostgreSQL服务是否启动")
        print("2. .env文件中的DATABASE_URL配置是否正确")
        print("3. 数据库用户权限是否正确")
        return False

def test_elasticsearch_connection():
    """测试Elasticsearch连接"""
    print_step(8, "测试Elasticsearch连接")
    
    try:
        from app.services.elasticsearch_service import ElasticsearchService
        import asyncio
        
        async def test_es():
            es_service = ElasticsearchService()
            health = await es_service.get_health()
            return health
        
        health = asyncio.run(test_es())
        if health.get('status') == 'healthy':
            print("✅ Elasticsearch连接成功")
            print(f"📊 集群状态: {health}")
            return True
        else:
            print(f"⚠️  Elasticsearch状态异常: {health}")
            return False
            
    except Exception as e:
        print(f"❌ Elasticsearch连接失败: {e}")
        print("请检查:")
        print("1. Elasticsearch服务是否启动")
        print("2. 端口9200是否可访问")
        print("3. .env文件中的Elasticsearch配置是否正确")
        return False

def create_startup_script():
    """创建启动脚本"""
    print_step(9, "创建启动脚本")
    
    # 创建Python启动脚本
    startup_script = '''
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
合约档案智能检索系统 - 启动脚本
"""

import uvicorn
import os
from pathlib import Path

def main():
    """启动FastAPI应用"""
    # 确保在正确的目录
    os.chdir(Path(__file__).parent)
    
    print("🚀 启动合约档案智能检索系统...")
    print("📍 API文档: http://localhost:8000/docs")
    print("📍 健康检查: http://localhost:8000/api/v1/health")
    print("📍 按 Ctrl+C 停止服务")
    
    # 启动服务
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

if __name__ == "__main__":
    main()
'''
    
    with open("start_backend.py", "w", encoding="utf-8") as f:
        f.write(startup_script)
    
    print("📄 创建启动脚本: start_backend.py")
    
    # 创建批处理启动脚本
    batch_script = '''@echo off
echo 🚀 启动合约档案智能检索系统后端服务...
echo.

REM 激活conda环境
call conda activate stock

REM 启动服务
python start_backend.py

pause
'''
    
    with open("start_backend.bat", "w", encoding="gbk") as f:
        f.write(batch_script)
    
    print("📄 创建批处理启动脚本: start_backend.bat")
    print("✅ 启动脚本创建完成")
    return True

def main():
    """主函数"""
    print_header("合约档案智能检索系统 - 后端环境自动配置")
    print("🎯 此脚本将自动配置Python后端环境")
    print("👨‍💻 作者: Alex Chen (Python后端工程师)")
    print("📅 版本: 1.0.0")
    
    # 检查操作系统
    print(f"\n💻 操作系统: {platform.system()} {platform.release()}")
    print(f"🐍 Python版本: {sys.version}")
    
    # 执行配置步骤
    steps = [
        (check_python_environment, "Python环境检查"),
        (check_project_structure, "项目结构检查"),
        (create_directories, "创建目录"),
        (setup_environment_file, "环境配置"),
        (install_dependencies, "安装依赖"),
        (verify_key_packages, "验证包安装"),
        (test_database_connection, "数据库连接测试"),
        (test_elasticsearch_connection, "Elasticsearch连接测试"),
        (create_startup_script, "创建启动脚本")
    ]
    
    success_count = 0
    total_steps = len(steps)
    
    for step_func, step_name in steps:
        try:
            if step_func():
                success_count += 1
            else:
                print(f"\n⚠️  {step_name} 未完全成功，请检查上述错误信息")
        except Exception as e:
            print(f"\n❌ {step_name} 执行异常: {e}")
    
    # 总结
    print_header("配置完成总结")
    print(f"📊 成功步骤: {success_count}/{total_steps}")
    
    if success_count == total_steps:
        print("🎉 恭喜！后端环境配置完全成功！")
        print("\n🚀 下一步操作:")
        print("1. 运行 python start_backend.py 启动后端服务")
        print("2. 或者双击 start_backend.bat 启动服务")
        print("3. 访问 http://localhost:8000/docs 查看API文档")
        print("4. 访问 http://localhost:8000/api/v1/health 检查服务状态")
    elif success_count >= total_steps - 2:
        print("✅ 后端环境基本配置成功！")
        print("\n⚠️  部分功能可能需要手动配置:")
        print("1. 检查数据库连接配置")
        print("2. 检查Elasticsearch服务状态")
        print("3. 完善.env文件中的API密钥配置")
    else:
        print("❌ 后端环境配置存在问题")
        print("\n🔧 建议操作:")
        print("1. 检查Python环境和依赖包安装")
        print("2. 确认在正确的项目目录下运行")
        print("3. 检查网络连接和权限设置")
        print("4. 查看详细错误信息并逐步解决")
    
    print("\n📞 如需技术支持，请联系 Alex Chen")
    print("📧 专精: Python后端开发、数据库优化、AI系统集成")

if __name__ == "__main__":
    main()