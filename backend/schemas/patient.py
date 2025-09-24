from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class PatientBase(BaseModel):
    """환자 기본 스키마"""
    name: Optional[str] = None
    sex: str = Field(..., pattern="^[MF]$", description="성별: M 또는 F")
    birth_date: str = Field(..., pattern="^\d{4}-\d{2}-\d{2}$", description="생년월일 (YYYY-MM-DD)")
    weight_kg: float = Field(..., gt=0, description="체중 (kg)")
    height_cm: float = Field(..., gt=0, description="키 (cm)")
    scr_mg_dl: float = Field(..., ge=0, description="혈청 크레아티닌 (mg/dL)")
    egfr: float = Field(..., ge=0, description="추정 사구체 여과율")
    crcl: float = Field(..., ge=0, description="크레아티닌 청소율")
    crcl_normalized: float = Field(..., ge=0, description="정규화된 크레아티닌 청소율 (BSA로 정규화)")
    bsa: float = Field(..., gt=0, description="체표면적 (Body Surface Area, m²)")
    is_hd: bool = Field(..., description="투석여부 (Hemodialysis)")


class PatientCreate(PatientBase):
    """환자 생성 스키마"""
    pass


class PatientUpdate(BaseModel):
    """환자 수정 스키마"""
    name: Optional[str] = None
    sex: Optional[str] = Field(None, pattern="^[MF]$", description="성별: M 또는 F")
    birth_date: Optional[str] = Field(None, pattern="^\d{4}-\d{2}-\d{2}$", description="생년월일 (YYYY-MM-DD)")
    weight_kg: Optional[float] = Field(None, gt=0, description="체중 (kg)")
    height_cm: Optional[float] = Field(None, gt=0, description="키 (cm)")
    scr_mg_dl: Optional[float] = Field(None, ge=0, description="혈청 크레아티닌 (mg/dL)")
    egfr: Optional[float] = Field(None, ge=0, description="추정 사구체 여과율")
    crcl: Optional[float] = Field(None, ge=0, description="크레아티닌 청소율")
    crcl_normalized: Optional[float] = Field(None, ge=0, description="정규화된 크레아티닌 청소율 (BSA로 정규화)")
    bsa: Optional[float] = Field(None, gt=0, description="체표면적 (Body Surface Area, m²)")
    is_hd: Optional[bool] = Field(None, description="투석여부 (Hemodialysis)")


class PatientResponse(PatientBase):
    """환자 응답 스키마"""
    id: int
    created_at: datetime

    class Config:
        from_attributes = True 