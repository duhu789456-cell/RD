from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class PrescriptionOrderBase(BaseModel):
    """처방 주문 기본 스키마"""
    patient_id: int = Field(..., description="환자 ID")
    note: Optional[str] = Field(None, description="메모")


class PrescriptionOrderCreate(BaseModel):
    """처방 주문 생성 스키마"""
    patient_id: int = Field(..., description="환자 ID")
    note: Optional[str] = Field(None, description="메모")
    submitted_at: Optional[datetime] = Field(None, description="제출 시간 (자동 설정)")


class PrescriptionOrderResponse(BaseModel):
    """처방 주문 응답 스키마"""
    id: int
    patient_id: int = Field(..., description="환자 ID")
    submitted_at: datetime = Field(..., description="제출 시간")
    note: Optional[str] = Field(None, description="메모")

    class Config:
        from_attributes = True 