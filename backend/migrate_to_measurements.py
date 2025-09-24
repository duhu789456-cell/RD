#!/usr/bin/env python3
"""
기존 patients 테이블의 검사수치를 새로운 patient_measurements 테이블로 마이그레이션
"""

import sqlite3
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from models.database import engine, Base
from models.patient import Patient
from models.patient_measurement import PatientMeasurement


def migrate_patient_data():
    """기존 환자 데이터를 새로운 구조로 마이그레이션"""
    
    print("🔄 환자 데이터 마이그레이션을 시작합니다...")
    
    # 직접 SQLite 연결을 사용하여 기존 데이터 조회
    conn = sqlite3.connect('./data/careplus.db')
    cursor = conn.cursor()
    
    try:
        # 기존 patients 테이블에서 데이터 조회
        cursor.execute("""
            SELECT id, name, sex, birth_date, weight_kg, height_cm, scr_mg_dl, 
                   egfr, crcl, crcl_normalized, bsa, is_hd, created_at
            FROM patients
        """)
        
        existing_patients = cursor.fetchall()
        print(f"📊 기존 환자 데이터: {len(existing_patients)}명")
        
        if not existing_patients:
            print("📭 마이그레이션할 데이터가 없습니다.")
            return
        
        # 새로운 테이블 구조 생성
        print("🏗️  새로운 테이블 구조를 생성합니다...")
        Base.metadata.create_all(bind=engine)
        
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            # 기존 patients 테이블 백업
            print("💾 기존 patients 테이블을 백업합니다...")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS patients_backup AS 
                SELECT * FROM patients
            """)
            
            # 새로운 patients 테이블 생성 (검사수치 제외)
            cursor.execute("""
                CREATE TABLE patients_new (
                    id INTEGER PRIMARY KEY,
                    name TEXT,
                    sex VARCHAR(1) NOT NULL,
                    birth_date VARCHAR(10) NOT NULL,
                    created_at DATETIME NOT NULL
                )
            """)
            
            # 기본 환자 정보만 새 테이블로 복사
            cursor.execute("""
                INSERT INTO patients_new (id, name, sex, birth_date, created_at)
                SELECT id, name, sex, birth_date, created_at FROM patients
            """)
            
            # 기존 patients 테이블 삭제하고 새 테이블로 교체
            cursor.execute("DROP TABLE patients")
            cursor.execute("ALTER TABLE patients_new RENAME TO patients")
            
            # 인덱스 재생성
            cursor.execute("CREATE INDEX ix_patients_id ON patients (id)")
            
            conn.commit()
            print("✅ 환자 기본정보 테이블 재구성 완료")
            
            # 검사수치 데이터를 patient_measurements로 이동
            print("📋 검사수치를 patient_measurements 테이블로 이동합니다...")
            
            for patient_data in existing_patients:
                (patient_id, name, sex, birth_date, weight_kg, height_cm, 
                 scr_mg_dl, egfr, crcl, crcl_normalized, bsa, is_hd, created_at) = patient_data
                
                # 검사수치가 모두 0이 아닌 경우만 저장
                if weight_kg or height_cm or scr_mg_dl or egfr or crcl or bsa:
                    measurement = PatientMeasurement(
                        patient_id=patient_id,
                        weight_kg=weight_kg or 0,
                        height_cm=height_cm or 0,
                        scr_mg_dl=scr_mg_dl or 0,
                        egfr=egfr or 0,
                        crcl=crcl or 0,
                        crcl_normalized=crcl_normalized or 0,
                        bsa=bsa or 0,
                        is_hd=bool(is_hd),
                        measured_at=datetime.fromisoformat(created_at.replace('Z', '+00:00')) if created_at else datetime.utcnow(),
                        created_at=datetime.utcnow()
                    )
                    
                    db.add(measurement)
            
            db.commit()
            print(f"✅ {len(existing_patients)}명의 검사수치 이력이 생성되었습니다.")
            
            # 마이그레이션 검증
            measurement_count = db.query(PatientMeasurement).count()
            patient_count = db.query(Patient).count()
            
            print(f"📊 마이그레이션 결과:")
            print(f"   - 환자: {patient_count}명")
            print(f"   - 검사수치 이력: {measurement_count}개")
            print("🎉 마이그레이션이 완료되었습니다!")
            
        except Exception as e:
            print(f"❌ 마이그레이션 중 오류 발생: {e}")
            db.rollback()
            raise e
            
        finally:
            db.close()
            
    except Exception as e:
        print(f"❌ 데이터베이스 오류: {e}")
        raise e
        
    finally:
        conn.close()


def rollback_migration():
    """마이그레이션을 롤백합니다 (백업에서 복원)"""
    
    print("⏪ 마이그레이션을 롤백합니다...")
    
    conn = sqlite3.connect('./data/careplus.db')
    cursor = conn.cursor()
    
    try:
        # 백업 테이블이 있는지 확인
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='patients_backup'
        """)
        
        if not cursor.fetchone():
            print("❌ 백업 테이블을 찾을 수 없습니다.")
            return
        
        # 현재 테이블들 삭제
        cursor.execute("DROP TABLE IF EXISTS patients")
        cursor.execute("DROP TABLE IF EXISTS patient_measurements")
        
        # 백업에서 복원
        cursor.execute("ALTER TABLE patients_backup RENAME TO patients")
        
        conn.commit()
        print("✅ 마이그레이션이 롤백되었습니다.")
        
    except Exception as e:
        print(f"❌ 롤백 중 오류 발생: {e}")
        raise e
        
    finally:
        conn.close()


def main():
    """메인 함수"""
    
    print("=" * 60)
    print("📋 CarePlus 데이터베이스 마이그레이션 도구")
    print("=" * 60)
    print("1. 새로운 구조로 마이그레이션")
    print("2. 마이그레이션 롤백")
    print("3. 취소")
    
    while True:
        choice = input("\n선택하세요 (1/2/3): ").strip()
        
        if choice == "1":
            confirm = input("⚠️  데이터베이스를 새로운 구조로 마이그레이션하시겠습니까? (y/N): ").strip().lower()
            if confirm == 'y' or confirm == 'yes':
                migrate_patient_data()
            else:
                print("❌ 취소되었습니다.")
            break
            
        elif choice == "2":
            confirm = input("⚠️  마이그레이션을 롤백하시겠습니까? (y/N): ").strip().lower()
            if confirm == 'y' or confirm == 'yes':
                rollback_migration()
            else:
                print("❌ 취소되었습니다.")
            break
            
        elif choice == "3":
            print("❌ 취소되었습니다.")
            break
            
        else:
            print("❌ 잘못된 선택입니다. 1, 2, 3 중에서 선택해주세요.")


if __name__ == "__main__":
    main() 