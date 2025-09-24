"""
데이터베이스 초기화 스크립트
이 스크립트를 실행하면 SQLite 데이터베이스와 모든 테이블이 생성됩니다.
"""

from models.database import engine, Base
# patients 테이블을 맨 위로 올리기 위해 가장 먼저 import
from models.patient import Patient
from models.patient_measurement import PatientMeasurement
from models.prescription_order import PrescriptionOrder
from models.prescription import Prescription

def create_tables():
    """모든 테이블을 생성합니다."""
    print("데이터베이스 테이블을 생성하고 있습니다...")
    print("테이블 생성 순서: patients → patient_measurements → prescription_orders → prescriptions")
    Base.metadata.create_all(bind=engine)
    print("테이블 생성이 완료되었습니다!")
    print("생성된 테이블:")
    print("- patients (기본정보)")
    print("- patient_measurements (검사수치 이력)")
    print("- prescription_orders (처방전)") 
    print("- prescriptions (처방 상세)")

if __name__ == "__main__":
    create_tables() 