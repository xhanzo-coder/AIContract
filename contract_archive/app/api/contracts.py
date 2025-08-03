"""
合同管理API路由
"""
import os
import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from pathlib import Path

from app.models import get_db
from app.schemas import (
    BaseResponse, ContractResponse, ContractListResponse, 
    FileUploadResponse, OCRStatusResponse, ContractCreate, HTMLContentResponse
)
from app.crud import contract_crud
from app.services import file_service, ocr_service
from app.config import settings

router = APIRouter(prefix="/api/v1/contracts", tags=["合同管理"])

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
    上传合同文件并自动开始OCR处理
    
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
        
        # 添加后台OCR任务
        if ocr_service.is_available():
            background_tasks.add_task(process_ocr_background, contract.id, relative_path, db)
        else:
            # OCR服务不可用，更新状态
            contract_crud.update_contract_status(db, contract.id, ocr_status="failed")
        
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
            message="文件上传成功，OCR处理已开始",
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

@router.get("/{contract_id}", response_model=BaseResponse, summary="获取合同详情")
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
        
        response_data = ContractResponse.model_validate(contract)
        
        return BaseResponse(
            success=True,
            message="获取合同详情成功",
            data=response_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取合同详情失败: {str(e)}")

@router.get("/{contract_id}/ocr-status", response_model=BaseResponse, summary="获取OCR处理状态")
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

@router.get("/{contract_id}/html-content", response_model=BaseResponse, summary="获取合同HTML内容")
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