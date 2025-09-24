from datetime import datetime
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from .database import Base


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("prescription_orders.id"), nullable=False)
    drug_id = Column(Integer, nullable=True)  # 약물 ID (외래키 또는 참조 ID)
    drug_korean_name = Column(Text, nullable=False)
    drug_ingredient = Column(Text, nullable=False)
    dose_amount = Column(Text, nullable=False)
    dose_unit = Column(Text, nullable=False)
    real_amount = Column(Float, nullable=True)  # 실제 약물 용량
    doses_per_day = Column(Integer, nullable=False)
    duration_days = Column(Integer, nullable=False)
    audit_result = Column(Text, nullable=False)  # 예: "정상", "과다용량"
    information = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # 관계 설정
    # 하나의 처방은 하나의 처방 주문에 속함
    order = relationship("PrescriptionOrder", back_populates="prescriptions") 