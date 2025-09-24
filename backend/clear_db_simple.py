#!/usr/bin/env python3
"""
데이터베이스의 모든 데이터를 삭제하는 스크립트
실행하면 바로 모든 데이터가 삭제됩니다.

사용법: python clear_db_simple.py
"""

from sqlalchemy.orm import sessionmaker
from models.database import engine
from models.patient import Patient
from models.patient_measurement import PatientMeasurement
from models.prescription_order import PrescriptionOrder
from models.prescription import Prescription


def clear_all_data():
    """데이터베이스의 모든 데이터를 삭제합니다."""
    
    print("🧹 CarePlus 데이터베이스 정리 시작...")
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # 삭제 전 데이터 카운트
        prescription_count = db.query(Prescription).count()
        order_count = db.query(PrescriptionOrder).count()
        measurement_count = db.query(PatientMeasurement).count()
        patient_count = db.query(Patient).count()
        total_count = prescription_count + order_count + measurement_count + patient_count
        
        if total_count == 0:
            print("📭 데이터베이스가 이미 비어있습니다.")
            return
        
        print(f"📊 현재 데이터:")
        print(f"   - 처방: {prescription_count}개")
        print(f"   - 주문: {order_count}개")
        print(f"   - 검사수치 이력: {measurement_count}개")
        print(f"   - 환자: {patient_count}개")
        print(f"   - 총합: {total_count}개")
        print()
        
        # 외래키 제약조건을 고려하여 역순으로 삭제
        print("🗑️  데이터 삭제 중...")
        
        # 1. prescriptions 테이블 (자식 테이블)
        db.query(Prescription).delete()
        print("   ✅ prescriptions 테이블 삭제 완료")
        
        # 2. prescription_orders 테이블 (중간 테이블)
        db.query(PrescriptionOrder).delete()
        print("   ✅ prescription_orders 테이블 삭제 완료")
        
        # 3. patient_measurements 테이블 (환자 자식 테이블)
        db.query(PatientMeasurement).delete()
        print("   ✅ patient_measurements 테이블 삭제 완료")
        
        # 4. patients 테이블 (부모 테이블)
        db.query(Patient).delete()
        print("   ✅ patients 테이블 삭제 완료")
        
        # 변경사항 저장
        db.commit()
        print()
        print("🎉 모든 데이터 삭제가 완료되었습니다!")
        print(f"총 {total_count}개의 레코드가 삭제되었습니다.")
        
    except Exception as e:
        print(f"❌ 오류가 발생했습니다: {e}")
        db.rollback()
        print("⚠️  변경사항이 롤백되었습니다.")
        raise e
        
    finally:
        db.close()


if __name__ == "__main__":
    clear_all_data() 