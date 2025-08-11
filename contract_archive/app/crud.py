"""
数据库CRUD操作
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.models import Contract, ContractContent, ContractField
from app.schemas import ContractCreate

class ContractCRUD:
    """合同CRUD操作"""
    
    @staticmethod
    def create_contract(db: Session, contract_data: ContractCreate) -> Contract:
        """创建合同记录"""
        db_contract = Contract(
            contract_number=contract_data.contract_number,
            contract_name=contract_data.contract_name,
            contract_type=contract_data.contract_type,
            file_name=contract_data.file_name,
            file_path=contract_data.file_path,
            file_size=contract_data.file_size,
            file_format=contract_data.file_format,
            ocr_status="pending",
            content_status="pending",
            vector_status="pending"
        )
        db.add(db_contract)
        db.commit()
        db.refresh(db_contract)
        return db_contract
    
    @staticmethod
    def get_contract_by_id(db: Session, contract_id: int) -> Optional[Contract]:
        """根据ID获取合同"""
        return db.query(Contract).filter(Contract.id == contract_id).first()
    
    @staticmethod
    def get_contract_by_number(db: Session, contract_number: str) -> Optional[Contract]:
        """根据合同编号获取合同"""
        return db.query(Contract).filter(Contract.contract_number == contract_number).first()
    
    @staticmethod
    def get_contracts(db: Session, skip: int = 0, limit: int = 20) -> List[Contract]:
        """获取合同列表"""
        return db.query(Contract).order_by(desc(Contract.created_at)).offset(skip).limit(limit).all()
    
    @staticmethod
    def get_contracts_count(db: Session) -> int:
        """获取合同总数"""
        return db.query(Contract).count()
    
    @staticmethod
    def get_all_contracts(db: Session) -> List[Contract]:
        """获取所有合同"""
        return db.query(Contract).order_by(desc(Contract.created_at)).all()
    
    @staticmethod
    def update_contract_status(
        db: Session, 
        contract_id: int, 
        ocr_status: Optional[str] = None,
        content_status: Optional[str] = None,
        vector_status: Optional[str] = None,
        elasticsearch_sync_status: Optional[str] = None,
        html_content_path: Optional[str] = None,
        text_content_path: Optional[str] = None
    ) -> Optional[Contract]:
        """更新合同状态"""
        contract = db.query(Contract).filter(Contract.id == contract_id).first()
        if contract:
            if ocr_status is not None:
                contract.ocr_status = ocr_status
            if content_status is not None:
                contract.content_status = content_status
            if vector_status is not None:
                contract.vector_status = vector_status
            if elasticsearch_sync_status is not None:
                contract.elasticsearch_sync_status = elasticsearch_sync_status
            if html_content_path is not None:
                contract.html_content_path = html_content_path
            if text_content_path is not None:
                contract.text_content_path = text_content_path
            
            db.commit()
            db.refresh(contract)
        return contract
    
    @staticmethod
    def delete_contract(db: Session, contract_id: int) -> bool:
        """删除合同"""
        contract = db.query(Contract).filter(Contract.id == contract_id).first()
        if contract:
            db.delete(contract)
            db.commit()
            return True
        return False

class ContractContentCRUD:
    """合同内容CRUD操作"""
    
    @staticmethod
    def create_content_chunk(
        db: Session,
        contract_id: int,
        chunk_index: int,
        content_text: str,
        chunk_type: str = "paragraph",
        chunk_size: Optional[int] = None
    ) -> ContractContent:
        """创建内容块"""
        db_content = ContractContent(
            contract_id=contract_id,
            chunk_index=chunk_index,
            content_text=content_text,
            chunk_type=chunk_type,
            chunk_size=chunk_size or len(content_text),
            vector_status="pending"
        )
        db.add(db_content)
        db.commit()
        db.refresh(db_content)
        return db_content
    
    @staticmethod
    def get_content_by_contract(db: Session, contract_id: int) -> List[ContractContent]:
        """获取合同的所有内容块"""
        return db.query(ContractContent).filter(
            ContractContent.contract_id == contract_id
        ).order_by(ContractContent.chunk_index).all()

class ContractFieldCRUD:
    """合同字段CRUD操作"""
    
    @staticmethod
    def create_field(
        db: Session,
        contract_id: int,
        field_name: str,
        field_value: Optional[str] = None,
        field_type: Optional[str] = None,
        input_method: str = "auto"
    ) -> ContractField:
        """创建字段记录"""
        db_field = ContractField(
            contract_id=contract_id,
            field_name=field_name,
            field_value=field_value,
            field_type=field_type,
            input_method=input_method,
            is_verified=False
        )
        db.add(db_field)
        db.commit()
        db.refresh(db_field)
        return db_field
    
    @staticmethod
    def get_fields_by_contract(db: Session, contract_id: int) -> List[ContractField]:
        """获取合同的所有字段"""
        return db.query(ContractField).filter(
            ContractField.contract_id == contract_id
        ).all()

# 创建CRUD实例
contract_crud = ContractCRUD()
content_crud = ContractContentCRUD()
field_crud = ContractFieldCRUD()