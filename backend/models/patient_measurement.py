from datetime import datetime
from sqlalchemy import Column, Integer, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


class PatientMeasurement(Base):
    """환자 검사수치 이력 테이블"""
    __tablename__ = "patient_measurements"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    
    # 검사수치들
    weight_kg = Column(Float, nullable=False)
    height_cm = Column(Float, nullable=False)
    scr_mg_dl = Column(Float, nullable=False)  # 혈청 크레아티닌
    egfr = Column(Float, nullable=False)  # estimated Glomerular Filtration Rate
    crcl = Column(Float, nullable=False)  # 크레아티닌 청소율
    crcl_normalized = Column(Float, nullable=False)  # 정규화된 크레아티닌 청소율 (BSA로 정규화)
    bsa = Column(Float, nullable=False)  # 체표면적 (Body Surface Area)
    is_hd = Column(Boolean, nullable=False, default=False)  # 투석여부 (Hemodialysis)
    
    # 측정 시간
    measured_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # 관계 설정: 하나의 측정값은 하나의 환자에 속함
    patient = relationship("Patient", back_populates="measurements") 