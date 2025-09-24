from datetime import datetime
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


class PrescriptionOrder(Base):
    __tablename__ = "prescription_orders"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    submitted_at = Column(DateTime, nullable=False)
    note = Column(Text, nullable=True)  # 선택적 필드

    # 관계 설정
    # 하나의 주문은 하나의 환자에 속함
    patient = relationship("Patient", back_populates="prescription_orders")
    # 하나의 주문은 여러 개의 개별 처방을 가질 수 있음
    prescriptions = relationship("Prescription", back_populates="order") 