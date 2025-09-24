from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import json
import os

from models.database import get_db
from models.patient import Patient
from models.patient_measurement import PatientMeasurement
from models.prescription_order import PrescriptionOrder
from models.prescription import Prescription
from services.prescription_audit_service import get_audit_service


def update_prescription_order_note(db: Session, order_id: int):
    """
    처방 주문의 note를 감사 결과에 따라 업데이트합니다.
    모든 처방의 audit_result가 "-"이면 "정상"을, 그렇지 않으면 "이상"을 추가합니다.
    """
    try:
        print(f"🔄 처방 주문 note 업데이트 시작: order_id={order_id}")
        
        # 해당 주문의 모든 처방들 조회
        prescriptions = db.query(Prescription).filter(Prescription.order_id == order_id).all()
        
        if not prescriptions:
            print(f"⚠️  주문 ID {order_id}에 대한 처방이 없습니다.")
            return
        
        print(f"📋 주문 ID {order_id}의 처방 개수: {len(prescriptions)}")
        
        # 각 처방의 audit_result 확인
        for i, prescription in enumerate(prescriptions):
            print(f"  처방 {i+1}: {prescription.drug_korean_name}, 감사결과: {prescription.audit_result}")
        
        # 모든 처방의 audit_result가 "-"인지 확인
        all_normal = all(prescription.audit_result == "-" for prescription in prescriptions)
        
        # 감사 결과에 따른 상태 결정
        audit_status = "정상" if all_normal else "이상"
        print(f"🎯 감사 결과 판정: {audit_status} (모든 처방 정상: {all_normal})")
        
        # prescription_order의 note 업데이트
        order = db.query(PrescriptionOrder).filter(PrescriptionOrder.id == order_id).first()
        if order:
            print(f"📝 기존 note: '{order.note}' -> 새 note: '{audit_status}'")
            # note를 감사 결과로 완전히 대체
            order.note = audit_status
                
            db.commit()
            print(f"✅ 처방 주문 ID {order_id}의 note가 업데이트되었습니다: {audit_status}")
        else:
            print(f"⚠️  주문 ID {order_id}를 찾을 수 없습니다.")
            
    except Exception as e:
        print(f"❌ 처방 주문 note 업데이트 중 오류: {e}")
        db.rollback()

# JSON 데이터를 모듈 레벨에서 한 번만 로드 (성능 최적화)
def load_hira_data():
    """HIRA 데이터를 로드합니다."""
    try:
        hira_data_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            "data", 
            "hira_data.json"
        )
        with open(hira_data_path, encoding="utf-8") as f:
            data = json.load(f)
            print(f"🗂️  HIRA 데이터 직접 로드 성공: {len(data)}개 항목")
            return data
    except Exception as e:
        print(f"❌ HIRA 데이터 로드 실패: {e}")
        return []

# 모듈 레벨에서 데이터 로드 (서버 시작 시 한 번만)
HIRA_DATA = load_hira_data()

def get_drug_info_direct(drug_korean_name: str) -> Optional[dict]:
    """
    한글상품명으로 직접 약물 정보를 검색합니다.
    성능 최적화를 위해 JSON을 직접 사용합니다.
    """
    if not HIRA_DATA:
        return None
    
    for item in HIRA_DATA:
        if isinstance(item, dict) and "한글상품명(약품규격)" in item:
            if item["한글상품명(약품규격)"] == drug_korean_name:
                return item
    return None

# 감사 실행을 위한 통합 스키마
class MedicationAuditInfo(BaseModel):
    """감사용 약물 정보"""
    productName: str = Field(..., description="한글 상품명")
    ingredientName: str = Field("", description="성분명")
    dosage: str = Field("", description="1회 투약용량")
    unit: Optional[str] = Field("", description="단위")
    frequency: str = Field("1", description="일투수")
    duration: str = Field("1", description="투약 기간")
    
    class Config:
        extra = "ignore"
        coerce_types = True


class PatientAuditInfo(BaseModel):
    """감사용 환자 정보"""
    name: Optional[str] = Field(None, description="환자 이름")
    gender: str = Field(..., description="성별 (male/female)")
    birthDate: str = Field(..., description="생년월일 (YYYY-MM-DD)")
    weight: str = Field(..., description="체중 (kg)")
    height: str = Field(..., description="키 (cm)")
    scr: str = Field(..., description="혈청 크레아티닌 (mg/dL)")
    bsa: str = Field("", description="체표면적 (m²)")
    isOnDialysis: bool = Field(False, description="투석 여부")
    egfr: str = Field("", description="eGFR")
    crcl: str = Field("", description="CrCl")
    crclNormalized: str = Field("", description="CrCl 정규화")
    
    class Config:
        # 추가 필드 허용 및 타입 강제 변환 활성화
        extra = "ignore"
        coerce_types = True


class AuditRequest(BaseModel):
    """감사 실행 요청"""
    patient: PatientAuditInfo
    medications: List[MedicationAuditInfo]


class AuditResponse(BaseModel):
    """감사 실행 응답"""
    success: bool
    message: str
    patient_id: Optional[int] = None
    order_id: Optional[int] = None
    prescription_ids: List[int] = []


# 감사 관련 API 라우터
router = APIRouter(
    prefix="/api/audit",
    tags=["audit"],
    responses={404: {"description": "Not found"}},
)


@router.post("/execute", response_model=AuditResponse)
def execute_audit(audit_request: AuditRequest, db: Session = Depends(get_db)):
    """
    처방 감사를 실행합니다. 환자 정보와 처방 정보를 데이터베이스에 저장합니다.
    """
    try:
        print(f"🔍 감사 요청 받음")
        print(f"🔍 환자 정보: {audit_request.patient}")
        print(f"🔍 약물 정보 개수: {len(audit_request.medications)}")
        for i, med in enumerate(audit_request.medications):
            print(f"🔍 약물 {i+1}: {med}")
        
    except Exception as validation_error:
        print(f"❌ 요청 데이터 검증 실패: {validation_error}")
        raise HTTPException(status_code=400, detail=f"잘못된 요청 형식: {str(validation_error)}")
    
    try:
        # 1. 환자 생성
        patient_data = audit_request.patient
        
        # 성별 변환
        sex_value = 'M' if patient_data.gender.lower() == 'male' else 'F'
        
        # 숫자 변환
        weight_kg = float(patient_data.weight) if patient_data.weight else 0
        height_cm = float(patient_data.height) if patient_data.height else 0
        scr_mg_dl = float(patient_data.scr) if patient_data.scr else 0
        bsa = float(patient_data.bsa) if patient_data.bsa else 0
        egfr = float(patient_data.egfr) if patient_data.egfr else 0
        crcl = float(patient_data.crcl) if patient_data.crcl else 0
        crcl_normalized = float(patient_data.crclNormalized) if patient_data.crclNormalized else 0
        
        # 투석 환자(is_hd=True)인 경우 SCr을 자동으로 10으로 설정
        if patient_data.isOnDialysis:
            scr_mg_dl = 10.0
            print(f"🩺 투석 환자 감지: SCr을 자동으로 10.0으로 설정")
        
        # 중복 환자 체크: name, sex, birth_date가 같은 환자가 있는지 확인
        existing_patient = db.query(Patient).filter(
            Patient.name == patient_data.name,
            Patient.sex == sex_value,
            Patient.birth_date == patient_data.birthDate
        ).first()
        
        if existing_patient:
            # 기존 환자가 있으면 해당 환자의 ID 사용
            db_patient = existing_patient
            print(f"👤 기존 환자 발견: ID={existing_patient.id}, 이름={existing_patient.name}")
        else:
            # 새로운 환자 생성 (기본 정보만)
            db_patient = Patient(
                name=patient_data.name,
                sex=sex_value,
                birth_date=patient_data.birthDate
            )
            
            db.add(db_patient)
            db.commit()
            db.refresh(db_patient)
            print(f"👤 새 환자 생성: ID={db_patient.id}, 이름={db_patient.name}")
        
        # 새로운 검사수치 이력 생성
        current_time = datetime.now()
        db_measurement = PatientMeasurement(
            patient_id=db_patient.id,
            weight_kg=weight_kg,
            height_cm=height_cm,
            scr_mg_dl=scr_mg_dl,
            egfr=egfr,
            crcl=crcl,
            crcl_normalized=crcl_normalized,
            bsa=bsa,
            is_hd=patient_data.isOnDialysis,
            measured_at=current_time
        )
        
        db.add(db_measurement)
        db.commit()
        db.refresh(db_measurement)
        print(f"📊 새로운 검사수치 이력 생성: ID={db_measurement.id}, 측정시간={current_time}")
        
        # 2. 처방 주문 생성
        current_time = datetime.now()
        print(f"🕒 현재 시간: {current_time}")
        
        db_order = PrescriptionOrder(
            patient_id=db_patient.id,
            submitted_at=current_time,
            note=None  # 나중에 감사 결과에 따라 업데이트됨
        )
        
        print(f"📦 생성된 PrescriptionOrder: patient_id={db_patient.id}, submitted_at={current_time}")
        
        db.add(db_order)
        db.commit()
        db.refresh(db_order)
        
        # 3. 개별 처방들 생성
        prescription_ids = []
        
        for medication in audit_request.medications:
            print(f"💊 처방 처리 중: {medication.productName}")
            
            # 약물명으로 상세 정보 조회
            drug_id = None
            calculated_real_amount = None
            
            try:
                # drug_service를 통해 약물 정보 조회
                drug_info = get_drug_info_direct(medication.productName)
                
                if drug_info and "품목기준코드" in drug_info:
                    # 품목기준코드를 drug_id로 사용
                    drug_id = int(drug_info["품목기준코드"]) if drug_info["품목기준코드"] else None
                    print(f"🔍 품목기준코드 찾음: {drug_id}")
                    
                    # 약품규격_숫자 필드에서 직접 값 가져와서 real_amount 계산
                    if "약품규격_숫자" in drug_info:
                        spec_amount = drug_info["약품규격_숫자"]
                        
                        if spec_amount is not None:
                            try:
                                spec_amount_float = float(spec_amount)
                                
                                # dose_amount와 곱하여 real_amount 계산
                                try:
                                    dose_value = float(medication.dosage) if medication.dosage and medication.dosage.strip() else 1
                                    calculated_real_amount = spec_amount_float * dose_value
                                    print(f"📊 real_amount 계산: {spec_amount_float} × {dose_value} = {calculated_real_amount}")
                                except ValueError:
                                    print(f"⚠️  dose_amount 변환 실패: {medication.dosage}")
                            except ValueError:
                                print(f"⚠️  약품규격_숫자 변환 실패: {spec_amount}")
                        else:
                            print(f"⚠️  약품규격_숫자 값이 없음")
                    else:
                        print(f"⚠️  약품규격_숫자 필드가 없음")
                else:
                    print(f"⚠️  약물 정보를 찾을 수 없음: {medication.productName}")
                    
            except Exception as e:
                print(f"❌ 약물 정보 조회 중 오류: {e}")
            
            # 기본 용량을 숫자로 변환 시도 (계산된 값이 없는 경우 대체)
            fallback_real_amount = None
            if calculated_real_amount is None:
                try:
                    if medication.dosage and medication.dosage.strip():
                        fallback_real_amount = float(medication.dosage)
                except ValueError:
                    pass
            
            # 투약 횟수와 기간을 숫자로 변환
            try:
                doses_per_day = int(medication.frequency) if medication.frequency else 1
            except ValueError:
                doses_per_day = 1
                
            try:
                duration_days = int(medication.duration) if medication.duration else 1
            except ValueError:
                duration_days = 1
            
            # 실제 감사 로직 실행
            print(f"🔍 감사 실행 중 - 약물: {medication.productName}, drug_id: {drug_id}")
            
            audit_result = "대기중"
            information = "감사 대기중"
            
            try:
                if drug_id:
                    # 최적화된 감사 서비스 사용 (싱글톤)
                    audit_service = get_audit_service()
                    
                    # 환자 데이터 구성 (최신 검사수치 사용)
                    patient_audit_data = {
                        "weight_kg": db_measurement.weight_kg,
                        "bsa": db_measurement.bsa,
                        "crcl": db_measurement.crcl,
                        "crcl_normalization": db_measurement.crcl_normalized,
                        "egfr": db_measurement.egfr,
                        "scr_mg_dl": db_measurement.scr_mg_dl,
                        "is_hd": db_measurement.is_hd
                    }
                    
                    # 처방 데이터 구성
                    prescription_audit_data = {
                        "dose_amount": medication.dosage,
                        "real_amount": calculated_real_amount or fallback_real_amount,
                        "doses_per_day": doses_per_day
                    }
                    
                    # 감사 실행
                    audit_result = audit_service.audit_prescription(
                        patient_audit_data, 
                        prescription_audit_data, 
                        drug_id
                    )
                    
                    # 감사 결과에 따른 권고사항 생성
                    recommendation_map = {
                        "금기": "해당 약물은 이 환자에게 금기입니다.",
                        "용량조절필요": "용량조절이 필요합니다.",
                        "투여간격조절필요": "투여 간격 조절이 필요합니다.",
                        "-": "정상적정 용량입니다."
                    }
                    
                    information = recommendation_map.get(audit_result, "감사 완료")
                    
                    print(f"✅ 감사 완료 - 결과: {audit_result}, 권고: {information}")
                else:
                    print(f"⚠️  drug_id가 없어 감사를 수행할 수 없습니다.")
                    audit_result = "대기중"
                    information = "약물 정보를 찾을 수 없어 감사할 수 없습니다."
                    
            except Exception as audit_error:
                print(f"❌ 감사 실행 오류: {audit_error}")
                audit_result = "대기중"
                information = f"감사 실행 중 오류 발생: {str(audit_error)}"
            
            db_prescription = Prescription(
                order_id=db_order.id,
                drug_id=drug_id,  # 품목기준코드로 설정
                drug_korean_name=medication.productName,
                drug_ingredient=medication.ingredientName,
                dose_amount=medication.dosage,
                dose_unit=medication.unit or "",
                real_amount=calculated_real_amount or fallback_real_amount,  # 계산된 값 또는 대체값
                doses_per_day=doses_per_day,
                duration_days=duration_days,
                audit_result=audit_result,
                information=information
            )
            
            db.add(db_prescription)
            db.commit()
            db.refresh(db_prescription)
            
            prescription_ids.append(db_prescription.id)
        
        # 모든 처방의 감사가 완료된 후 prescription_order의 note를 업데이트
        update_prescription_order_note(db, db_order.id)
        
        return AuditResponse(
            success=True,
            message=f"처방 감사가 완료되었습니다. 환자 ID: {db_patient.id}, 처방 주문 ID: {db_order.id}",
            patient_id=db_patient.id,
            order_id=db_order.id,
            prescription_ids=prescription_ids
        )
        
    except Exception as e:
        print(f"❌ 감사 실행 에러: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"❌ 에러 트레이스: {traceback.format_exc()}")
        db.rollback()
        raise HTTPException(status_code=400, detail=f"감사 실행 실패: {str(e)}")


@router.get("/history")
def get_audit_history(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    """
    감사 이력을 조회합니다. 처방 작성 시점의 환자 상태를 반영합니다.
    """
    try:
        # 최근 처방 주문들을 조회 (환자 정보와 함께)
        orders = (
            db.query(PrescriptionOrder)
            .join(Patient)
            .order_by(PrescriptionOrder.submitted_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        
        history = []
        for order in orders:
            # 해당 주문의 처방들 조회
            prescriptions = (
                db.query(Prescription)
                .filter(Prescription.order_id == order.id)
                .all()
            )
            
            # 처방 작성 시점(submitted_at) 이전의 가장 최근 환자 검사수치 조회
            latest_measurement = (
                db.query(PatientMeasurement)
                .filter(
                    PatientMeasurement.patient_id == order.patient_id,
                    PatientMeasurement.measured_at <= order.submitted_at
                )
                .order_by(PatientMeasurement.measured_at.desc())
                .first()
            )
            
            # 환자 기본 정보
            patient_info = {
                "id": order.patient.id,
                "name": order.patient.name,
                "sex": order.patient.sex,
                "birth_date": order.patient.birth_date
            }
            
            # 검사수치 정보 (있는 경우에만)
            measurement_info = None
            if latest_measurement:
                measurement_info = {
                    "weight_kg": latest_measurement.weight_kg,
                    "height_cm": latest_measurement.height_cm,
                    "scr_mg_dl": latest_measurement.scr_mg_dl,
                    "bsa": latest_measurement.bsa,
                    "egfr": latest_measurement.egfr,
                    "crcl": latest_measurement.crcl,
                    "crcl_normalized": latest_measurement.crcl_normalized,
                    "is_hd": latest_measurement.is_hd,
                    "measured_at": latest_measurement.measured_at
                }
            
            history.append({
                "order_id": order.id,
                "patient_id": order.patient_id,
                "patient_name": order.patient.name,
                "submitted_at": order.submitted_at,
                "prescription_count": len(prescriptions),
                "patient": patient_info,
                "measurement": measurement_info,
                "prescriptions": [
                    {
                        "id": p.id,
                        "drug_name": p.drug_korean_name,
                        "audit_result": p.audit_result,
                        "information": p.information,
                        "dose_amount": p.dose_amount,
                        "dose_unit": p.dose_unit,
                        "doses_per_day": p.doses_per_day,
                        "duration_days": p.duration_days
                    }
                    for p in prescriptions
                ]
            })
        
        return {"history": history}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"감사 이력 조회 실패: {str(e)}") 