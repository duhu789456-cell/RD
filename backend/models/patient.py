from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from .database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(Text, nullable=True)  # 선택적 필드
    sex = Column(String(1), nullable=False)  # 'M' 또는 'F'
    birth_date = Column(String(10), nullable=False)  # YYYY-MM-DD 형식
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # 관계 설정
    # 한 환자는 여러 처방 주문을 가질 수 있음
    prescription_orders = relationship("PrescriptionOrder", back_populates="patient")
    # 한 환자는 여러 검사수치 이력을 가질 수 있음
    measurements = relationship("PatientMeasurement", back_populates="patient", order_by="PatientMeasurement.measured_at.desc()")
    
    @property
    def latest_measurement(self):
        """가장 최근 검사수치를 반환"""
        if self.measurements:
            return self.measurements[0]
        return None 