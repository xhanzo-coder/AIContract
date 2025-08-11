"""
合同管理API路由
"""
import os
import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks, Query, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pathlib import Path
import mimetypes
import urllib.parse

from app.models import get_db
from app.schemas import (
    BaseResponse, ContractResponse, ContractListResponse, 
    FileUploadResponse, OCRStatusResponse, ContractCreate, HTMLContentResponse,
    ContentStatusResponse, ContentProcessResponse, ChunkListResponse, ChunkSearchResponse
)
from app.crud import contract_crud, content_crud
from app.services import file_service, ocr_service
from app.services.content_service import ContentProcessingService
from app.services.elasticsearch_service import elasticsearch_service
from app.config import settings

router = APIRouter(prefix="/api/v1/contracts", tags=["合同管理"])

# 简单测试路由
@router.get("/simple-test", summary="简单测试路由")
async def simple_test():
    """最简单的测试路由"""
    print("DEBUG: simple_test 被调用")
    return {"message": "简单测试路由工作正常"}

# 测试elasticsearch路由是否工作
@router.get("/test-elasticsearch-simple", summary="测试elasticsearch路由")
async def test_elasticsearch_simple():
    """测试elasticsearch路由是否工作"""
    print("DEBUG: test_elasticsearch_simple 被调用")
    return {"message": "elasticsearch路由测试成功", "timestamp": "2025-08-06 00:32:00"}

def extract_contract_info(filename: str) -> tuple[str, str]:
    """从文件名提取合同信息"""
    # 移除扩展名
    name_without_ext = Path(filename).stem
    
    # 尝试提取合同编号（假设格式为：编号-名称）
    if '-' in name_without_ext:
        parts = name_without_ext.split('-', 1)
        contract_number = parts[0].strip()
        contract_name = parts[1].strip() if len(parts) > 1 else name_without_ext
    else:
        # 如果没有分隔符，使用文件名作为合同编号和名称
        contract_number = name_without_ext
        contract_name = name_without_ext
    
    return contract_number, contract_name

async def process_ocr_background(contract_id: int, file_path: str, db: Session):
    """后台处理OCR任务"""
    try:
        # 更新状态为处理中
        contract_crud.update_contract_status(db, contract_id, ocr_status="processing")
        
        # 执行OCR处理
        success, html_path, text_path = await ocr_service.process_document(file_path)
        
        if success:
            # 更新成功状态
            contract_crud.update_contract_status(
                db, contract_id,
                ocr_status="completed",
                content_status="completed",
                html_content_path=html_path,
                text_content_path=text_path
            )
        else:
            # 更新失败状态
            contract_crud.update_contract_status(db, contract_id, ocr_status="failed")
            
    except Exception as e:
        # 更新失败状态
        contract_crud.update_contract_status(db, contract_id, ocr_status="failed")
        print(f"OCR后台处理失败: {str(e)}")

@router.post("/upload", response_model=BaseResponse, summary="上传合同文件")
async def upload_contract(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="合同文件"),
    contract_type: Optional[str] = Query(None, description="合同类型"),
    db: Session = Depends(get_db)
):
    """
    上传合同文件并自动开始完整处理流程
    
    自动化处理流程：
    1. OCR识别 - 提取文档内容
    2. 文档切块 - 将内容分割成可搜索的块
    3. Elasticsearch同步 - 建立搜索索引
    
    - **file**: 合同文件（支持PDF、DOC、DOCX格式）
    - **contract_type**: 合同类型（可选）
    """
    try:
        # 保存文件
        relative_path, full_path, file_size = await file_service.save_file(file)
        
        # 提取合同信息
        contract_number, contract_name = extract_contract_info(file.filename)
        
        # 检查合同编号是否已存在
        existing_contract = contract_crud.get_contract_by_number(db, contract_number)
        if existing_contract:
            # 删除刚上传的文件
            file_service.delete_file(relative_path)
            raise HTTPException(status_code=400, detail=f"合同编号 {contract_number} 已存在")
        
        # 创建合同记录
        contract_data = ContractCreate(
            contract_number=contract_number,
            contract_name=contract_name,
            contract_type=contract_type,
            file_name=file.filename,
            file_path=relative_path,
            file_size=file_size,
            file_format=Path(file.filename).suffix.upper().replace('.', '')
        )
        
        contract = contract_crud.create_contract(db, contract_data)
        
        # 添加后台自动化处理任务（OCR + 切片 + ES同步）
        background_tasks.add_task(process_automated_background, contract.id, relative_path, False, db)
        
        # 构造响应数据
        response_data = FileUploadResponse(
            contract_id=contract.id,
            contract_number=contract.contract_number,
            file_name=contract.file_name,
            file_size=contract.file_size or 0,
            upload_time=contract.upload_time,
            ocr_status=contract.ocr_status or "pending"
        )
        
        return BaseResponse(
            success=True,
            message="文件上传成功，自动化处理已开始（OCR识别 → 文档切块 → Elasticsearch同步）",
            data=response_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")

@router.get("/", response_model=BaseResponse, summary="获取合同列表")
async def get_contracts(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db)
):
    """
    获取合同列表（分页）
    
    - **page**: 页码（从1开始）
    - **page_size**: 每页数量（1-100）
    """
    try:
        # 计算偏移量
        skip = (page - 1) * page_size
        
        # 获取合同列表和总数
        contracts = contract_crud.get_contracts(db, skip=skip, limit=page_size)
        total = contract_crud.get_contracts_count(db)
        
        # 转换为响应格式
        contract_responses = [ContractResponse.model_validate(contract) for contract in contracts]
        
        response_data = ContractListResponse(
            total=total,
            page=page,
            page_size=page_size,
            contracts=contract_responses
        )
        
        return BaseResponse(
            success=True,
            message="获取合同列表成功",
            data=response_data
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取合同列表失败: {str(e)}")

# 注意：所有具体路径必须放在通用路径之前，避免路由冲突

@router.get("/{contract_id:int}/test-download", summary="测试下载路由")
async def test_download_route(contract_id: int):
    """测试下载路由是否工作"""
    print(f"DEBUG: test_download_route 被调用，contract_id={contract_id}")
    return {"message": f"测试下载路由工作正常，合同ID: {contract_id}"}

@router.get("/{contract_id:int}/download", summary="下载合同原始文件")
async def download_contract_file(
    contract_id: int,
    db: Session = Depends(get_db)
):
    """
    下载指定合同的原始文件
    
    - **contract_id**: 合同ID
    
    返回原始文件的二进制流，浏览器会自动下载文件
    
    错误情况：
    - 合同不存在：404
    - 文件不存在或已被删除：404
    - 文件路径无效：500
    """
    print(f"DEBUG: download_contract_file 被调用，contract_id={contract_id}")
    try:
        # 获取合同信息
        contract = contract_crud.get_contract_by_id(db, contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="合同不存在")
        
        # 检查文件路径
        if not contract.file_path:
            raise HTTPException(status_code=404, detail="合同文件路径不存在")
        
        # 构建完整的文件路径
        file_full_path = os.path.join(settings.UPLOAD_DIR, contract.file_path)
        
        # 检查文件是否存在
        if not os.path.exists(file_full_path):
            raise HTTPException(status_code=404, detail="合同文件不存在或已被删除")
        
        # 检查是否为文件（而不是目录）
        if not os.path.isfile(file_full_path):
            raise HTTPException(status_code=500, detail="文件路径指向的不是有效文件")
        
        # 获取文件名（优先使用数据库中的file_name，确保中文显示正确）
        download_filename = contract.file_name or os.path.basename(file_full_path)
        
        # 获取文件的MIME类型
        mime_type, _ = mimetypes.guess_type(file_full_path)
        if mime_type is None:
            # 根据文件扩展名设置默认MIME类型
            file_ext = Path(file_full_path).suffix.lower()
            if file_ext == '.pdf':
                mime_type = 'application/pdf'
            elif file_ext in ['.doc', '.docx']:
                mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            elif file_ext in ['.xls', '.xlsx']:
                mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            else:
                mime_type = 'application/octet-stream'
        
        # URL编码文件名以支持中文文件名
        encoded_filename = urllib.parse.quote(download_filename.encode('utf-8'))
        
        # 返回文件响应
        return FileResponse(
            path=file_full_path,
            media_type=mime_type,
            filename=download_filename,
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下载文件失败: {str(e)}")

@router.get("/{contract_id:int}/ocr-status", response_model=BaseResponse, summary="获取OCR处理状态")
async def get_ocr_status(
    contract_id: int,
    db: Session = Depends(get_db)
):
    """
    获取合同的OCR处理状态
    
    - **contract_id**: 合同ID
    """
    try:
        contract = contract_crud.get_contract_by_id(db, contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="合同不存在")
        
        response_data = OCRStatusResponse(
            contract_id=contract.id,
            ocr_status=contract.ocr_status or "pending",
            content_status=contract.content_status or "pending",
            vector_status=contract.vector_status or "pending",
            html_content_path=contract.html_content_path,
            text_content_path=contract.text_content_path
        )
        
        return BaseResponse(
            success=True,
            message="获取OCR状态成功",
            data=response_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取OCR状态失败: {str(e)}")

@router.post("/{contract_id}/process-ocr", response_model=BaseResponse, summary="手动触发OCR处理")
async def process_contract_ocr(
    contract_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    手动触发合同的OCR处理（使用GLM-4.1V视觉模型）
    
    - **contract_id**: 合同ID
    """
    try:
        contract = contract_crud.get_contract_by_id(db, contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="合同不存在")
        
        # 检查文件是否存在
        full_file_path = os.path.join(settings.UPLOAD_DIR, contract.file_path)
        if not os.path.exists(full_file_path):
            raise HTTPException(status_code=404, detail="合同文件不存在")
        
        # 检查是否已经在处理中
        if contract.ocr_status == "processing":
            raise HTTPException(status_code=400, detail="OCR处理正在进行中，请稍后查询状态")
        
        # 添加后台OCR任务
        if ocr_service.is_available():
            background_tasks.add_task(process_ocr_background, contract.id, contract.file_path, db)
            # 立即更新状态为处理中
            contract_crud.update_contract_status(db, contract.id, ocr_status="processing")
        else:
            raise HTTPException(status_code=503, detail="OCR服务不可用")
        
        return BaseResponse(
            success=True,
            message="OCR处理已开始，请稍后查询处理状态",
            data={"contract_id": contract_id, "ocr_status": "processing"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动OCR处理失败: {str(e)}")

@router.get("/{contract_id:int}/html-content", response_model=BaseResponse, summary="获取合同HTML内容")
async def get_contract_html_content(
    contract_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定合同的HTML格式内容
    
    - **contract_id**: 合同ID
    
    返回HTML文件的内容（已渲染的HTML，不是纯代码）
    
    错误情况：
    - 合同不存在：404
    - HTML文件不存在或未生成：404  
    - OCR未完成：400
    """
    try:
        # 获取合同信息
        contract = contract_crud.get_contract_by_id(db, contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="合同不存在")
        
        # 检查OCR状态
        if contract.ocr_status != "completed":
            if contract.ocr_status == "processing":
                raise HTTPException(status_code=400, detail="OCR处理正在进行中，请稍后再试")
            elif contract.ocr_status == "failed":
                raise HTTPException(status_code=400, detail="OCR处理失败，无法获取HTML内容")
            else:
                raise HTTPException(status_code=400, detail="OCR处理未完成，无法获取HTML内容")
        
        # 检查HTML内容路径
        if not contract.html_content_path:
            raise HTTPException(status_code=404, detail="HTML内容文件路径不存在")
        
        # 构建完整的文件路径
        html_file_path = os.path.join(settings.UPLOAD_DIR, contract.html_content_path)
        
        # 检查HTML文件是否存在
        if not os.path.exists(html_file_path):
            raise HTTPException(status_code=404, detail="HTML内容文件不存在或已被删除")
        
        # 读取HTML文件内容
        try:
            with open(html_file_path, 'r', encoding='utf-8') as f:
                html_content = f.read()
        except UnicodeDecodeError:
            # 如果UTF-8解码失败，尝试其他编码
            try:
                with open(html_file_path, 'r', encoding='gbk') as f:
                    html_content = f.read()
            except UnicodeDecodeError:
                with open(html_file_path, 'r', encoding='latin-1') as f:
                    html_content = f.read()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"读取HTML文件失败: {str(e)}")
        
        # 构造响应数据
        response_data = HTMLContentResponse(
            html_content=html_content,
            content_type="text/html"
        )
        
        return BaseResponse(
            success=True,
            message="获取HTML内容成功",
            data=response_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取HTML内容失败: {str(e)}")

@router.delete("/{contract_id}", response_model=BaseResponse, summary="删除合同")
async def delete_contract(
    contract_id: int,
    db: Session = Depends(get_db)
):
    """
    删除指定合同及其相关文件
    
    - **contract_id**: 合同ID
    """
    try:
        # 获取合同信息
        contract = contract_crud.get_contract_by_id(db, contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="合同不存在")
        
        # 删除相关文件
        file_service.delete_file(contract.file_path)
        if contract.html_content_path:
            file_service.delete_file(contract.html_content_path)
        if contract.text_content_path:
            file_service.delete_file(contract.text_content_path)
        
        # 删除数据库记录
        success = contract_crud.delete_contract(db, contract_id)
        if not success:
            raise HTTPException(status_code=500, detail="删除合同记录失败")
        
        return BaseResponse(
            success=True,
            message="合同删除成功",
            data={"contract_id": contract_id}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除合同失败: {str(e)}")

# ==================== 内容分块处理相关接口 ====================

@router.get("/{contract_id:int}/content/status")
async def get_content_status_alias(
    contract_id: int,
    db: Session = Depends(get_db)
):
    """获取合同的内容处理状态（别名路由）"""
    service = ContentProcessingService()
    result = service.check_content_status(contract_id, db)
    
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    
    return {
        "success": True,
        "message": "获取内容状态成功",
        "data": result
    }

@router.post("/{contract_id}/content/process")
async def process_content_alias(
    contract_id: int,
    force_reprocess: bool = Query(False, description="是否强制重新处理"),
    db: Session = Depends(get_db)
):
    """处理合同内容分块（别名路由）"""
    service = ContentProcessingService()
    result = service.process_contract_content(contract_id, db)
    
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    
    return {
        "success": True,
        "message": "处理内容分块成功",
        "data": result
    }

@router.get("/{contract_id:int}/content-status", response_model=BaseResponse, summary="获取内容处理状态")
async def get_content_status(
    contract_id: int,
    db: Session = Depends(get_db)
):
    """
    获取合同的内容处理状态（包括OCR和分块状态）
    
    - **contract_id**: 合同ID
    """
    try:
        contract = contract_crud.get_contract_by_id(db, contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="合同不存在")
        
        # 使用内容处理服务检查状态
        content_service = ContentProcessingService()
        status_info = content_service.check_content_status(contract_id, db)
        
        response_data = ContentStatusResponse(
            status=status_info["status"],
            message=status_info["message"],
            contract_id=contract_id,
            chunk_count=status_info.get("chunk_count"),
            ocr_status=contract.ocr_status,
            last_processed=status_info.get("last_processed")
        )
        
        return BaseResponse(
            success=True,
            message="获取内容状态成功",
            data=response_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取内容状态失败: {str(e)}")

@router.post("/{contract_id}/process-content", response_model=BaseResponse, summary="处理合同内容分块")
async def process_contract_content(
    contract_id: int,
    background_tasks: BackgroundTasks,
    force_reprocess: bool = Query(False, description="是否强制重新处理"),
    db: Session = Depends(get_db)
):
    """
    处理合同内容分块（基于OCR生成的TXT文件）
    
    - **contract_id**: 合同ID
    - **force_reprocess**: 是否强制重新处理（默认false）
    """
    try:
        contract = contract_crud.get_contract_by_id(db, contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="合同不存在")
        
        # 检查OCR状态
        if contract.ocr_status != "completed":
            if contract.ocr_status == "processing":
                raise HTTPException(status_code=400, detail="OCR处理正在进行中，请等待OCR完成后再处理内容分块")
            elif contract.ocr_status == "failed":
                raise HTTPException(status_code=400, detail="OCR处理失败，无法进行内容分块")
            else:
                raise HTTPException(status_code=400, detail="OCR处理未完成，无法进行内容分块")
        
        # 检查TXT文件是否存在
        if not contract.text_content_path:
            raise HTTPException(status_code=404, detail="TXT内容文件路径不存在")
        
        txt_file_path = os.path.join(settings.UPLOAD_DIR, contract.text_content_path)
        if not os.path.exists(txt_file_path):
            raise HTTPException(status_code=404, detail="TXT内容文件不存在")
        
        # 使用内容处理服务
        content_service = ContentProcessingService()
        
        # 检查是否已经处理过
        if not force_reprocess:
            status_info = content_service.check_content_status(contract_id, db)
            if status_info["status"] == "completed":
                return BaseResponse(
                    success=True,
                    message="内容已经处理完成，如需重新处理请设置 force_reprocess=true",
                    data=ContentProcessResponse(
                        status="already_completed",
                        message="内容分块已存在",
                        contract_id=contract_id,
                        chunk_count=status_info.get("chunk_count")
                    )
                )
        
        # 异步处理内容分块
        def process_content_background():
            try:
                # 获取新的数据库会话用于后台任务
                from app.models.database import SessionLocal
                bg_db = SessionLocal()
                try:
                    result = content_service.process_contract_content(contract_id, bg_db)
                    print(f"内容分块处理完成: 合同ID={contract_id}, 分块数量={result.get('chunk_count', 0)}")
                finally:
                    bg_db.close()
            except Exception as e:
                print(f"内容分块处理失败: 合同ID={contract_id}, 错误={str(e)}")
        
        background_tasks.add_task(process_content_background)
        
        return BaseResponse(
            success=True,
            message="内容分块处理已开始，请稍后查询处理状态",
            data=ContentProcessResponse(
                status="processing",
                message="内容分块处理已开始",
                contract_id=contract_id,
                processed_at=None
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动内容分块处理失败: {str(e)}")

@router.get("/{contract_id:int}/content/chunks", response_model=BaseResponse, summary="获取合同分块内容")
async def get_contract_chunks(
    contract_id: int,
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(10, ge=1, le=100, description="每页大小"),
    chunk_type: Optional[str] = Query(None, description="分块类型过滤"),
    db: Session = Depends(get_db)
):
    """获取合同分块内容"""
    service = ContentProcessingService()
    result = service.get_contract_chunks(contract_id, db, page, size)
    
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    
    return {
        "success": True,
        "message": "获取分块内容成功",
        "data": result["data"]
    }

@router.get("/{contract_id:int}/content/search")
async def search_contract_chunks(
    contract_id: int,
    q: str = Query(..., description="搜索关键词"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(10, ge=1, le=100, description="每页大小"),
    db: Session = Depends(get_db)
):
    """在合同分块中搜索关键词"""
    service = ContentProcessingService()
    result = service.search_chunks(contract_id, q, db, page, size)
    
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    
    return {
        "success": True,
        "message": "搜索分块内容成功",
        "data": result["data"]
    }

@router.delete("/{contract_id}/content/chunks", response_model=BaseResponse, summary="删除合同分块内容")
async def delete_contract_chunks(
    contract_id: int,
    db: Session = Depends(get_db)
):
    """
    删除指定合同的所有分块内容
    
    - **contract_id**: 合同ID
    """
    try:
        contract = contract_crud.get_contract_by_id(db, contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="合同不存在")
        
        # 使用内容处理服务删除分块
        content_service = ContentProcessingService()
        deleted_count = await content_service.delete_contract_chunks(contract_id)
        
        return BaseResponse(
            success=True,
            message=f"成功删除 {deleted_count} 个分块",
            data={"contract_id": contract_id, "deleted_count": deleted_count}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除分块内容失败: {str(e)}")

# Elasticsearch 相关API端点

@router.get("/elasticsearch/status", response_model=BaseResponse, summary="检查Elasticsearch状态")
async def check_elasticsearch_status():
    """
    检查Elasticsearch服务状态
    """
    try:
        is_available = elasticsearch_service.is_available()
        
        if is_available:
            # 获取集群信息
            cluster_info = elasticsearch_service.client.info()
            return BaseResponse(
                success=True,
                message="Elasticsearch服务正常",
                data={
                    "status": "available",
                    "cluster_name": cluster_info.get("cluster_name"),
                    "version": cluster_info.get("version", {}).get("number"),
                    "host": f"{elasticsearch_service.host}:{elasticsearch_service.port}"
                }
            )
        else:
            return BaseResponse(
                success=False,
                message="Elasticsearch服务不可用",
                data={
                    "status": "unavailable",
                    "host": f"{elasticsearch_service.host}:{elasticsearch_service.port}"
                }
            )
            
    except Exception as e:
        return BaseResponse(
            success=False,
            message=f"检查Elasticsearch状态失败: {str(e)}",
            data={"status": "error", "error": str(e)}
        )

@router.post("/elasticsearch/init", response_model=BaseResponse, summary="初始化Elasticsearch索引")
async def init_elasticsearch_indices():
    """
    初始化Elasticsearch索引（创建contracts和contract_contents索引）
    """
    try:
        if not elasticsearch_service.is_available():
            raise HTTPException(status_code=503, detail="Elasticsearch服务不可用")
        
        # 检查索引是否存在
        contracts_exists = bool(elasticsearch_service.client.indices.exists(index="contracts"))
        contents_exists = bool(elasticsearch_service.client.indices.exists(index="contract_contents"))
        
        # 创建索引（如果不存在）
        contracts_created = elasticsearch_service.create_contracts_index()
        contents_created = elasticsearch_service.create_contract_contents_index()
        
        # 如果索引已存在或成功创建，都返回true
        contracts_ready = contracts_exists or contracts_created
        contents_ready = contents_exists or contents_created
        
        return BaseResponse(
            success=True,
            message="Elasticsearch索引初始化完成",
            data={
                "contracts_index_created": contracts_ready,
                "contents_index_created": contents_ready
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"初始化Elasticsearch索引失败: {str(e)}")

@router.post("/{contract_id}/elasticsearch/sync", response_model=BaseResponse, summary="同步合同数据到Elasticsearch")
async def sync_contract_to_elasticsearch(
    contract_id: int,
    db: Session = Depends(get_db)
):
    """
    将指定合同的数据同步到Elasticsearch
    
    - **contract_id**: 合同ID
    """
    try:
        if not elasticsearch_service.is_available():
            raise HTTPException(status_code=503, detail="Elasticsearch服务不可用")
        
        contract = contract_crud.get_contract_by_id(db, contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="合同不存在")
        
        # 使用内容处理服务同步数据
        content_service = ContentProcessingService()
        result = content_service.sync_to_elasticsearch(contract_id, db)
        
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])
        
        return BaseResponse(
            success=True,
            message="同步到Elasticsearch成功",
            data=result
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"同步到Elasticsearch失败: {str(e)}")

@router.post("/elasticsearch/sync-all", response_model=BaseResponse, summary="批量同步所有合同数据到Elasticsearch")
async def sync_all_contracts_to_elasticsearch(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    批量同步所有合同数据到Elasticsearch
    
    此接口会在后台异步处理所有合同的同步，避免长时间阻塞请求
    """
    try:
        if not elasticsearch_service.is_available():
            raise HTTPException(status_code=503, detail="Elasticsearch服务不可用")
        
        # 获取所有合同
        all_contracts = contract_crud.get_all_contracts(db)
        
        if not all_contracts:
            return BaseResponse(
                success=True,
                message="没有找到需要同步的合同",
                data={"total_contracts": 0, "sync_status": "completed"}
            )
        
        # 添加后台批量同步任务
        background_tasks.add_task(batch_sync_contracts_background, [contract.id for contract in all_contracts], db)
        
        return BaseResponse(
            success=True,
            message=f"批量同步任务已启动，共 {len(all_contracts)} 个合同将在后台同步",
            data={
                "total_contracts": len(all_contracts),
                "contract_ids": [contract.id for contract in all_contracts],
                "sync_status": "started"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动批量同步失败: {str(e)}")

@router.get("/elasticsearch/test-route", response_model=BaseResponse, summary="测试路由")
async def test_route():
    """测试路由是否正常工作"""
    print("DEBUG: elasticsearch test-route 被调用了！")
    return BaseResponse(
        success=True,
        message="测试路由工作正常 - 最新版本",
        data={"test": "ok", "timestamp": "2025-08-06 00:30:00"}
    )

@router.get("/elasticsearch/sync-status", response_model=BaseResponse, summary="查询批量同步状态")
async def get_elasticsearch_sync_status(
    db: Session = Depends(get_db)
):
    """
    查询所有合同的Elasticsearch同步状态
    
    返回每个合同的同步状态信息，包括：
    - 合同基本信息
    - Elasticsearch同步状态（从数据库字段读取）
    - 数据库中的内容块数量
    - 各种处理状态
    """
    try:
        
        # 获取所有合同
        all_contracts = contract_crud.get_all_contracts(db)
        
        sync_status_list = []
        total_synced = 0
        total_unsynced = 0
        
        for contract in all_contracts:
            # 从数据库字段获取Elasticsearch同步状态
            es_sync_status = contract.elasticsearch_sync_status or "pending"
            is_synced = es_sync_status == "completed"
            
            if is_synced:
                total_synced += 1
            else:
                total_unsynced += 1
            
            # 获取数据库中的内容块数量
            db_chunks = content_crud.get_content_by_contract(db, contract.id)
            db_chunk_count = len(db_chunks)
            
            sync_status_list.append({
                "contract_id": contract.id,
                "contract_number": contract.contract_number,
                "contract_name": contract.contract_name,
                "is_synced": is_synced,
                "elasticsearch_sync_status": es_sync_status,
                "database_chunks": db_chunk_count,
                "sync_complete": is_synced and db_chunk_count > 0,
                "ocr_status": contract.ocr_status,
                "content_status": contract.content_status,
                "vector_status": contract.vector_status,
                "created_at": contract.created_at.isoformat() if contract.created_at else None
            })
        
        return BaseResponse(
            success=True,
            message="批量同步状态查询完成",
            data={
                "total_contracts": len(all_contracts),
                "synced_contracts": total_synced,
                "unsynced_contracts": total_unsynced,
                "sync_completion_rate": f"{(total_synced / len(all_contracts) * 100):.1f}%" if all_contracts else "0%",
                "contracts": sync_status_list
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询同步状态失败: {str(e)}")

async def batch_sync_contracts_background(contract_ids: list[int], db: Session):
    """后台批量同步合同数据到Elasticsearch"""
    content_service = ContentProcessingService()
    success_count = 0
    failed_count = 0
    
    for contract_id in contract_ids:
        try:
            result = content_service.sync_to_elasticsearch(contract_id, db)
            if result["status"] == "success":
                success_count += 1
            else:
                failed_count += 1
                print(f"同步合同 {contract_id} 失败: {result.get('message', '未知错误')}")
        except Exception as e:
            failed_count += 1
            print(f"同步合同 {contract_id} 异常: {str(e)}")
    
    print(f"批量同步完成: 成功 {success_count} 个，失败 {failed_count} 个")

@router.get("/elasticsearch/search", response_model=BaseResponse, summary="使用Elasticsearch搜索合同内容")
async def elasticsearch_search_contracts(
    q: str = Query(..., description="搜索关键词"),
    contract_id: Optional[int] = Query(None, description="限制在特定合同中搜索"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(10, ge=1, le=100, description="每页大小"),
    db: Session = Depends(get_db)
):
    """
    使用Elasticsearch搜索合同内容
    
    - **q**: 搜索关键词
    - **contract_id**: 可选，限制在特定合同中搜索
    - **page**: 页码
    - **size**: 每页大小
    """
    try:
        if not elasticsearch_service.is_available():
            raise HTTPException(status_code=503, detail="Elasticsearch服务不可用，请使用基础搜索功能")
        
        # 使用内容处理服务进行搜索
        content_service = ContentProcessingService()
        result = content_service.search_chunks(contract_id, q, db, page, size)
        
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])
        
        return BaseResponse(
            success=True,
            message="Elasticsearch搜索完成",
            data=result["data"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Elasticsearch搜索失败: {str(e)}")

# 自动化处理流程API

@router.get("/{contract_id:int}/automated-status", response_model=BaseResponse, summary="获取自动化处理状态")
async def get_automated_processing_status(
    contract_id: int,
    db: Session = Depends(get_db)
):
    """
    获取合同自动化处理的综合状态
    
    返回OCR处理、内容切片、Elasticsearch同步的状态信息
    
    - **contract_id**: 合同ID
    """
    try:
        contract = contract_crud.get_contract_by_id(db, contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="合同不存在")
        
        # 获取内容切片状态
        from app.models.models import ContractContent
        chunk_count = db.query(ContractContent).filter(
            ContractContent.contract_id == contract_id
        ).count()
        
        # 获取Elasticsearch同步状态（从数据库字段读取）
        es_sync_status = contract.elasticsearch_sync_status or "pending"
        es_synced = es_sync_status == "completed"
        
        # 判断整体处理状态
        ocr_completed = contract.ocr_status == "completed"
        content_processed = chunk_count > 0
        
        if ocr_completed and content_processed and es_synced:
            overall_status = "completed"
        elif contract.ocr_status == "failed" or es_sync_status == "failed":
            overall_status = "failed"
        elif contract.ocr_status == "processing" or es_sync_status == "processing":
            overall_status = "processing"
        else:
            overall_status = "pending"
        
        response_data = {
            "contract_id": contract_id,
            "overall_status": overall_status,
            "ocr_status": contract.ocr_status or "pending",
            "content_chunks": chunk_count,
            "elasticsearch_synced": es_synced,
            "processing_steps": {
                "ocr_recognition": {
                    "status": contract.ocr_status or "pending",
                    "completed": ocr_completed
                },
                "content_chunking": {
                    "status": "completed" if content_processed else "pending",
                    "chunk_count": chunk_count,
                    "completed": content_processed
                },
                "elasticsearch_sync": {
                    "status": es_sync_status,
                    "completed": es_synced
                }
            }
        }
        
        return BaseResponse(
            success=True,
            message="获取自动化处理状态成功",
            data=response_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取自动化处理状态失败: {str(e)}")

@router.post("/{contract_id}/process-automated", response_model=BaseResponse, summary="自动化处理合同（OCR+切片+ES同步）")
async def process_contract_automated(
    contract_id: int,
    background_tasks: BackgroundTasks,
    force_reprocess: bool = Query(False, description="是否强制重新处理所有步骤"),
    db: Session = Depends(get_db)
):
    """
    自动化处理合同的完整流程：
    1. OCR处理（如果未完成）
    2. 内容切片处理
    3. 同步到Elasticsearch
    
    - **contract_id**: 合同ID
    - **force_reprocess**: 是否强制重新处理所有步骤（默认false）
    """
    try:
        contract = contract_crud.get_contract_by_id(db, contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="合同不存在")
        
        # 检查文件是否存在
        full_file_path = os.path.join(settings.UPLOAD_DIR, contract.file_path)
        if not os.path.exists(full_file_path):
            raise HTTPException(status_code=404, detail="合同文件不存在")
        
        # 添加后台自动化处理任务
        background_tasks.add_task(process_automated_background, contract.id, contract.file_path, force_reprocess, db)
        
        return BaseResponse(
            success=True,
            message="自动化处理已开始，将依次执行OCR处理、内容切片和Elasticsearch同步",
            data={
                "contract_id": contract_id,
                "processing_status": "started",
                "force_reprocess": force_reprocess
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动自动化处理失败: {str(e)}")

async def process_automated_background(contract_id: int, file_path: str, force_reprocess: bool, db: Session):
    """
    后台自动化处理任务：OCR -> 切片 -> ES同步
    """
    try:
        print(f"开始自动化处理合同 {contract_id}")
        
        # 步骤1: OCR处理
        contract = contract_crud.get_contract_by_id(db, contract_id)
        if force_reprocess or contract.ocr_status != "completed":
            print(f"执行OCR处理 contract_id={contract_id}")
            
            # 更新状态为处理中
            contract_crud.update_contract_status(db, contract_id, ocr_status="processing")
            
            # 执行OCR处理
            success, html_path, text_path = await ocr_service.process_document(file_path)
            
            if success:
                # 更新OCR成功状态
                contract_crud.update_contract_status(
                    db, contract_id,
                    ocr_status="completed",
                    content_status="completed",
                    html_content_path=html_path,
                    text_content_path=text_path
                )
                print(f"OCR处理完成 contract_id={contract_id}")
            else:
                # OCR失败，停止后续处理
                contract_crud.update_contract_status(db, contract_id, ocr_status="failed")
                print(f"OCR处理失败 contract_id={contract_id}")
                return
        else:
            print(f"OCR已完成，跳过OCR步骤 contract_id={contract_id}")
        
        # 步骤2: 内容切片处理
        print(f"执行内容切片处理 contract_id={contract_id}")
        content_service = ContentProcessingService()
        
        # 检查是否需要重新处理切片
        if force_reprocess:
            # 删除现有切片
            content_service.delete_contract_chunks(contract_id, db)
        
        # 执行切片处理
        chunk_result = content_service.process_contract_content(contract_id, db)
        
        if chunk_result["status"] != "success":
            print(f"内容切片处理失败 contract_id={contract_id}: {chunk_result['message']}")
            return
        
        print(f"内容切片处理完成 contract_id={contract_id}, 生成 {chunk_result['chunk_count']} 个切片")
        
        # 步骤3: 同步到Elasticsearch
        if elasticsearch_service.is_available():
            print(f"执行Elasticsearch同步 contract_id={contract_id}")
            
            sync_result = content_service.sync_to_elasticsearch(contract_id, db)
            
            if sync_result["status"] == "success":
                print(f"Elasticsearch同步完成 contract_id={contract_id}")
                print(f"自动化处理全部完成 contract_id={contract_id}")
            else:
                print(f"Elasticsearch同步失败 contract_id={contract_id}: {sync_result['message']}")
        else:
            print(f"Elasticsearch服务不可用，跳过同步步骤 contract_id={contract_id}")
            
    except Exception as e:
        print(f"自动化处理异常 contract_id={contract_id}: {str(e)}")
        # 更新失败状态
        try:
            contract_crud.update_contract_status(db, contract_id, ocr_status="failed")
        except:
            pass

# ==================== 通用路径（必须放在最后，避免拦截具体路径） ====================

@router.get("/{contract_id:int}", response_model=BaseResponse, summary="获取合同详情")
async def get_contract(
    contract_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定合同的详细信息
    
    - **contract_id**: 合同ID
    """
    try:
        contract = contract_crud.get_contract_by_id(db, contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="合同不存在")
        
        # 调试信息
        print(f"DEBUG: contract.file_path = {getattr(contract, 'file_path', 'NOT_FOUND')}")
        
        response_data = ContractResponse.model_validate(contract)
        
        # 调试信息
        print(f"DEBUG: response_data.file_path = {getattr(response_data, 'file_path', 'NOT_FOUND')}")
        
        return BaseResponse(
            success=True,
            message="获取合同详情成功",
            data=response_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取合同详情失败: {str(e)}")