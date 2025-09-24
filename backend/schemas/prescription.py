from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class PrescriptionBase(BaseModel):
    """처방 기본 스키마"""
    order_id: int = Field(..., description="처방 주문 ID")
    drug_id: Optional[int] = Field(None, description="약물 ID")
    drug_korean_name: str = Field(..., description="약물 한글명")
    drug_ingredient: str = Field(..., description="약물 성분")
    dose_amount: str = Field(..., description="용량")
    dose_unit: str = Field(..., description="용량 단위")
    real_amount: Optional[float] = Field(None, ge=0, description="실제 약물 용량")
    doses_per_day: int = Field(..., gt=0, description="1일 복용 횟수")
    duration_days: int = Field(..., gt=0, description="투약 기간 (일)")


class PrescriptionCreate(PrescriptionBase):
    """처방 생성 스키마 (감사 결과는 자동 생성됨)"""
    audit_result: Optional[str] = Field(None, description="감사 결과 (자동 생성)")
    information: Optional[str] = Field(None, description="정보 (자동 생성)")


class PrescriptionUpdate(BaseModel):
    """처방 수정 스키마"""
    order_id: Optional[int] = Field(None, description="처방 주문 ID")
    drug_id: Optional[int] = Field(None, description="약물 ID")
    drug_korean_name: Optional[str] = Field(None, description="약물 한글명")
    drug_ingredient: Optional[str] = Field(None, description="약물 성분")
    dose_amount: Optional[str] = Field(None, description="용량")
    dose_unit: Optional[str] = Field(None, description="용량 단위")
    real_amount: Optional[float] = Field(None, ge=0, description="실제 약물 용량")
    doses_per_day: Optional[int] = Field(None, gt=0, description="1일 복용 횟수")
    duration_days: Optional[int] = Field(None, gt=0, description="투약 기간 (일)")
    audit_result: Optional[str] = Field(None, description="감사 결과")
    information: Optional[str] = Field(None, description="정보")


class PrescriptionResponse(PrescriptionBase):
    """처방 응답 스키마"""
    id: int
    audit_result: str = Field(..., description="감사 결과")
    information: str = Field(..., description="정보")
    created_at: datetime

    class Config:
        from_attributes = True 