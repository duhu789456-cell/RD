from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from models.database import get_db
from models.prescription import Prescription
from models.prescription_order import PrescriptionOrder
from models.patient import Patient
from models.patient_measurement import PatientMeasurement
from services.prescription_audit_service import get_audit_service
from utils.resident_number import find_patient_by_resident_number

# 처방 관련 API 라우터
router = APIRouter(prefix="/api/prescriptions", tags=["prescriptions"])

# 환자 정보 캐시 (메모리 최적화)
_patient_cache = {}


class PrescriptionOrderCreate(BaseModel):
    """처방 주문 생성 요청 (주민등록번호 기반)"""
    patient_resident_number: str = Field(..., description="환자 주민등록번호")
    patient_name: str = Field(..., description="환자 이름")


class PrescriptionOrderCreateWithPatientId(BaseModel):
    """처방 주문 생성 요청 (환자 ID 기반)"""
    patient_id: int = Field(..., description="환자 ID")


class PrescriptionCreate(BaseModel):
    """처방 생성 요청"""
    order_id: int = Field(..., description="처방 주문 ID")
    drug_id: Optional[int] = Field(None, description="약물 ID")
    drug_korean_name: str = Field(..., description="약물 한글명")
    drug_ingredient: str = Field("", description="성분명")
    dose_amount: str = Field(..., description="투여 용량")
    dose_unit: str = Field("", description="용량 단위")
    real_amount: Optional[float] = Field(None, description="실제 약물 용량")
    doses_per_day: int = Field(1, description="일일 투여 횟수")
    duration_days: int = Field(1, description="투여 기간")


class PrescriptionOrderResponse(BaseModel):
    """처방 주문 응답"""
    id: int
    patient_id: int
    patient_name: str
    submitted_at: datetime
    note: Optional[str] = None

    class Config:
        from_attributes = True


class PrescriptionResponse(BaseModel):
    """처방 응답"""
    id: int
    order_id: int
    drug_id: Optional[int]
    drug_korean_name: str
    drug_ingredient: str
    dose_amount: str
    dose_unit: str
    real_amount: Optional[float]
    doses_per_day: int
    duration_days: int
    audit_result: str
    information: str
    created_at: datetime

    class Config:
        from_attributes = True


class PrescriptionInputRequest(BaseModel):
    """처방 입력 요청 (환자 검색 + 처방 입력)"""
    patient_name: str = Field(..., description="환자 이름")
    birth_date: str = Field(..., description="생년월일 (YYYY-MM-DD)")
    sex: str = Field(..., description="성별 (M/F)")
    medications: List[PrescriptionCreate] = Field(..., description="처방 약물 목록")


class PrescriptionInputResponse(BaseModel):
    """처방 입력 응답"""
    success: bool
    patient_id: Optional[int] = None
    order_id: Optional[int] = None
    prescriptions: List[PrescriptionResponse] = []
    message: str
    note: Optional[str] = None  # 처방 주문의 note (정상/이상)


class PrescriptionInputMedication(BaseModel):
    """처방 입력용 약물 정보 (order_id 없음)"""
    drug_id: Optional[int] = Field(None, description="약물 ID")
    drug_korean_name: str = Field(..., description="약물 한글명")
    drug_ingredient: str = Field("", description="성분명")
    dose_amount: str = Field(..., description="투여 용량")
    dose_unit: str = Field("", description="용량 단위")
    real_amount: Optional[float] = Field(None, description="실제 약물 용량")
    doses_per_day: int = Field(1, description="일일 투여 횟수")
    duration_days: int = Field(1, description="투여 기간")

class PrescriptionInputWithPatientIdRequest(BaseModel):
    """환자 ID 기반 처방 입력 요청"""
    patient_id: int = Field(..., description="환자 ID")
    medications: List[PrescriptionInputMedication] = Field(..., description="처방 약물 목록")


def get_patient_data_cached(order_id: int, db: Session) -> Optional[dict]:
    """환자 정보를 캐싱하여 반복 조회를 방지합니다."""
    if order_id in _patient_cache:
        return _patient_cache[order_id]
    
    patient = db.query(Patient).join(PrescriptionOrder).filter(
        PrescriptionOrder.id == order_id
    ).first()
    
    if patient:
        # 환자의 최신 검사 수치 조회
        latest_measurement = (
            db.query(PatientMeasurement)
            .filter(PatientMeasurement.patient_id == patient.id)
            .order_by(PatientMeasurement.measured_at.desc())
            .first()
        )
        
        if latest_measurement:
            patient_data = {
                "weight_kg": latest_measurement.weight_kg,
                "bsa": latest_measurement.bsa,
                "crcl": latest_measurement.crcl,
                "crcl_normalization": latest_measurement.crcl_normalized,
                "egfr": latest_measurement.egfr,
                "scr_mg_dl": latest_measurement.scr_mg_dl,
                "is_hd": latest_measurement.is_hd
            }
            _patient_cache[order_id] = patient_data
            return patient_data
    
    return None


def update_prescription_order_note(db: Session, order_id: int):
    """처방 주문의 note를 감사 결과에 따라 업데이트합니다."""
    try:
        # 해당 주문의 모든 처방들 조회
        prescriptions = db.query(Prescription).filter(Prescription.order_id == order_id).all()
        
        if not prescriptions:
            return
        
        # 모든 처방의 audit_result가 "-"인지 확인
        all_normal = all(prescription.audit_result == "-" for prescription in prescriptions)
        
        # 감사 결과에 따른 상태 결정
        audit_status = "정상" if all_normal else "이상"
        
        # prescription_order의 note 업데이트
        order = db.query(PrescriptionOrder).filter(PrescriptionOrder.id == order_id).first()
        if order:
            order.note = audit_status
            db.commit()
            
    except Exception as e:
        print(f"❌ 처방 주문 note 업데이트 중 오류: {e}")
        db.rollback()


@router.post("/orders", response_model=PrescriptionOrderResponse)
def create_prescription_order(order: PrescriptionOrderCreate, db: Session = Depends(get_db)):
    """
    주민등록번호로 환자를 찾아 처방 주문을 생성합니다.
    """
    try:
        # 주민등록번호로 환자 검색
        patient = find_patient_by_resident_number(db, order.patient_resident_number)
        
        if not patient:
            raise HTTPException(
                status_code=404, 
                detail="환자를 찾을 수 없습니다. 먼저 환자 정보를 등록해주세요."
            )
        
        # 환자 이름 확인 (선택적)
        if order.patient_name and patient.name != order.patient_name:
            print(f"⚠️  환자 이름 불일치: 입력={order.patient_name}, DB={patient.name}")
        
        # 최신 검사수치 확인
        latest_measurement = db.query(PatientMeasurement).filter(
            PatientMeasurement.patient_id == patient.id
        ).order_by(PatientMeasurement.measured_at.desc()).first()
        
        if not latest_measurement:
            raise HTTPException(
                status_code=400, 
                detail="환자의 검사수치가 없습니다. 먼저 검사수치를 입력해주세요."
            )
        
        # 처방 주문 생성
        current_time = datetime.now()
        db_order = PrescriptionOrder(
            patient_id=patient.id,
            submitted_at=current_time,
            note=None
        )
        
        db.add(db_order)
        db.commit()
        db.refresh(db_order)
        
        return PrescriptionOrderResponse(
            id=db_order.id,
            patient_id=patient.id,
            patient_name=patient.name,
            submitted_at=db_order.submitted_at,
            note=db_order.note
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"처방 주문 생성 실패: {str(e)}")


@router.post("/orders/with-patient-id", response_model=PrescriptionOrderResponse)
def create_prescription_order_with_patient_id(order: PrescriptionOrderCreateWithPatientId, db: Session = Depends(get_db)):
    """
    환자 ID로 처방 주문을 생성합니다.
    """
    try:
        # 환자 존재 확인
        patient = db.query(Patient).filter(Patient.id == order.patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="환자를 찾을 수 없습니다")
        
        # 최신 검사수치 확인
        latest_measurement = db.query(PatientMeasurement).filter(
            PatientMeasurement.patient_id == patient.id
        ).order_by(PatientMeasurement.measured_at.desc()).first()
        
        if not latest_measurement:
            raise HTTPException(
                status_code=400, 
                detail="환자의 검사수치가 없습니다. 먼저 검사수치를 입력해주세요."
            )
        
        # 처방 주문 생성
        current_time = datetime.now()
        db_order = PrescriptionOrder(
            patient_id=patient.id,
            submitted_at=current_time,
            note=None
        )
        
        db.add(db_order)
        db.commit()
        db.refresh(db_order)
        
        return PrescriptionOrderResponse(
            id=db_order.id,
            patient_id=patient.id,
            patient_name=patient.name,
            submitted_at=db_order.submitted_at,
            note=db_order.note
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"처방 주문 생성 실패: {str(e)}")


@router.post("", response_model=PrescriptionResponse)
def create_prescription(prescription: PrescriptionCreate, db: Session = Depends(get_db)):
    """
    새로운 처방을 생성하고 즉시 감사를 수행합니다.
    """
    try:
        # 1. 처방 데이터 생성 (임시 감사 결과로 시작)
        db_prescription = Prescription(
            order_id=prescription.order_id,
            drug_id=prescription.drug_id,
            drug_korean_name=prescription.drug_korean_name,
            drug_ingredient=prescription.drug_ingredient,
            dose_amount=prescription.dose_amount,
            dose_unit=prescription.dose_unit,
            real_amount=prescription.real_amount,
            doses_per_day=prescription.doses_per_day,
            duration_days=prescription.duration_days,
            audit_result="-",  # 기본값
            information="적정 용량입니다."  # 기본값
        )
        
        # 2. 환자 정보 조회 (캐싱 적용)
        patient_data = get_patient_data_cached(prescription.order_id, db)
        
        # 3. 감사 실행 (DB 저장 전에 완료)
        if patient_data and prescription.drug_id:
            try:
                audit_service = get_audit_service()
                
                prescription_data = {
                    "dose_amount": prescription.dose_amount,
                    "real_amount": prescription.real_amount,
                    "doses_per_day": prescription.doses_per_day
                }
                
                # 감사 실행 (새로운 메서드 사용)
                audit_result, information = audit_service._audit_single_prescription_with_info(
                    patient_data, 
                    prescription_data, 
                    prescription.drug_id
                )
                
                # 감사 결과 적용
                db_prescription.audit_result = audit_result
                db_prescription.information = information
                
            except Exception as audit_error:
                # 감사 실패시 기본값 유지
                db_prescription.audit_result = "-"
                db_prescription.information = f"감사 오류: {str(audit_error)}"
        
        # 4. DB 저장
        db.add(db_prescription)
        db.commit()
        db.refresh(db_prescription)
        
        # 5. 처방 주문 상태 업데이트
        update_prescription_order_note(db, prescription.order_id)
        
        return db_prescription
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"처방 생성 실패: {str(e)}")


@router.post("/batch", response_model=List[PrescriptionResponse])
def create_prescriptions_batch(prescriptions: List[PrescriptionCreate], db: Session = Depends(get_db)):
    """
    여러 처방을 배치로 생성하고 한 번에 감사를 수행합니다.
    """
    try:
        if not prescriptions:
            return []
        
        # 1. 환자 정보 미리 조회 (배치 최적화)
        order_ids = list(set(p.order_id for p in prescriptions))
        patient_data_cache = {}
        
        for order_id in order_ids:
            patient_data = get_patient_data_cached(order_id, db)
            if patient_data:
                patient_data_cache[order_id] = patient_data
        
        # 2. 감사 서비스 한 번만 초기화
        audit_service = get_audit_service()
        
        # 3. 배치 감사를 위한 데이터 준비
        order_groups = {}
        for prescription in prescriptions:
            order_id = prescription.order_id
            if order_id not in order_groups:
                order_groups[order_id] = []
            order_groups[order_id].append(prescription)
        
        # 4. 모든 처방 생성 및 배치 감사
        db_prescriptions = []
        
        for order_id, order_prescriptions in order_groups.items():
            patient_data = patient_data_cache.get(order_id)
            
            # 배치 감사를 위한 처방 데이터 준비
            prescriptions_data = []
            for prescription in order_prescriptions:
                prescriptions_data.append({
                    "drug_id": prescription.drug_id,
                    "dose_amount": prescription.dose_amount,
                    "real_amount": prescription.real_amount,
                    "doses_per_day": prescription.doses_per_day
                })
            
            # 배치 감사 실행
            audit_results = []
            if patient_data:
                try:
                    audit_results = audit_service.audit_prescriptions_batch(
                        patient_data, prescriptions_data
                    )
                except Exception:
                    audit_results = [{"audit_result": "-", "information": ""}] * len(prescriptions_data)
            else:
                audit_results = [{"audit_result": "-", "information": ""}] * len(prescriptions_data)
            
            # 처방 객체 생성 및 감사 결과 적용
            for i, prescription in enumerate(order_prescriptions):
                audit_result_data = audit_results[i] if i < len(audit_results) else {"audit_result": "-", "information": ""}
                audit_result = audit_result_data.get("audit_result", "-")
                information = audit_result_data.get("information", "")
                
                db_prescription = Prescription(
                    order_id=prescription.order_id,
                    drug_id=prescription.drug_id,
                    drug_korean_name=prescription.drug_korean_name,
                    drug_ingredient=prescription.drug_ingredient,
                    dose_amount=prescription.dose_amount,
                    dose_unit=prescription.dose_unit,
                    real_amount=prescription.real_amount,
                    doses_per_day=prescription.doses_per_day,
                    duration_days=prescription.duration_days,
                    audit_result=audit_result,
                    information=information
                )
                
                db_prescriptions.append(db_prescription)
        
        # 5. 한 번에 모든 처방 저장
        db.add_all(db_prescriptions)
        db.commit()
        
        # 6. 각 주문별로 note 업데이트
        for order_id in order_ids:
            update_prescription_order_note(db, order_id)
        
        return db_prescriptions
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"배치 처방 생성 실패: {str(e)}")


@router.get("/orders", response_model=List[PrescriptionOrderResponse])
def get_prescription_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    처방 주문 목록을 조회합니다.
    """
    orders = db.query(PrescriptionOrder).join(Patient).offset(skip).limit(limit).all()
    return [
        PrescriptionOrderResponse(
            id=order.id,
            patient_id=order.patient_id,
            patient_name=order.patient.name,
            submitted_at=order.submitted_at,
            note=order.note
        )
        for order in orders
    ]


@router.get("/orders/{order_id}", response_model=PrescriptionOrderResponse)
def get_prescription_order(order_id: int, db: Session = Depends(get_db)):
    """
    특정 처방 주문을 조회합니다.
    """
    order = db.query(PrescriptionOrder).join(Patient).filter(PrescriptionOrder.id == order_id).first()
    if order is None:
        raise HTTPException(status_code=404, detail="처방 주문을 찾을 수 없습니다")
    
    return PrescriptionOrderResponse(
        id=order.id,
        patient_id=order.patient_id,
        patient_name=order.patient.name,
        submitted_at=order.submitted_at,
        note=order.note
    )


@router.get("", response_model=List[PrescriptionResponse])
def get_prescriptions(order_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    처방 목록을 조회합니다.
    """
    query = db.query(Prescription)
    if order_id:
        query = query.filter(Prescription.order_id == order_id)
    
    prescriptions = query.offset(skip).limit(limit).all()
    return prescriptions


@router.get("/{prescription_id}", response_model=PrescriptionResponse)
def get_prescription(prescription_id: int, db: Session = Depends(get_db)):
    """
    특정 처방을 조회합니다.
    """
    prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
    if prescription is None:
        raise HTTPException(status_code=404, detail="처방을 찾을 수 없습니다")
    return prescription


@router.delete("/orders/{order_id}")
def delete_prescription_order(order_id: int, db: Session = Depends(get_db)):
    """
    처방 주문과 관련된 모든 처방을 삭제합니다.
    """
    try:
        # 관련된 모든 처방 삭제
        prescriptions = db.query(Prescription).filter(Prescription.order_id == order_id).all()
        for prescription in prescriptions:
            db.delete(prescription)
        
        # 처방 주문 삭제
        order = db.query(PrescriptionOrder).filter(PrescriptionOrder.id == order_id).first()
        if order:
            db.delete(order)
        
        db.commit()
        
        # 캐시 정리
        if order_id in _patient_cache:
            del _patient_cache[order_id]
        
        return {"message": "처방 주문과 관련 처방이 삭제되었습니다"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"삭제 실패: {str(e)}")


@router.delete("/{prescription_id}")
def delete_prescription(prescription_id: int, db: Session = Depends(get_db)):
    """
    특정 처방을 삭제합니다.
    """
    try:
        prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
        if prescription is None:
            raise HTTPException(status_code=404, detail="처방을 찾을 수 없습니다")
        
        order_id = prescription.order_id
        db.delete(prescription)
        db.commit()
        
        # 처방 주문 상태 업데이트
        update_prescription_order_note(db, order_id)
        
        return {"message": "처방이 삭제되었습니다"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"삭제 실패: {str(e)}")


@router.post("/input", response_model=PrescriptionInputResponse)
def input_prescription(request: PrescriptionInputRequest, db: Session = Depends(get_db)):
    """
    환자 검색 후 처방을 입력합니다.
    """
    try:
        # 1. 환자 검색
        patient = (
            db.query(Patient)
            .filter(
                Patient.name == request.patient_name,
                Patient.birth_date == request.birth_date,
                Patient.sex == request.sex
            )
            .first()
        )
        
        if not patient:
            return PrescriptionInputResponse(
                success=False,
                message="환자를 찾을 수 없습니다. 먼저 환자 정보를 등록해주세요."
            )
        
        # 2. 최신 검사수치 확인
        latest_measurement = (
            db.query(PatientMeasurement)
            .filter(PatientMeasurement.patient_id == patient.id)
            .order_by(PatientMeasurement.measured_at.desc())
            .first()
        )
        
        if not latest_measurement:
            return PrescriptionInputResponse(
                success=False,
                message="환자의 검사수치가 없습니다. 먼저 검사수치를 입력해주세요."
            )
        
        # 3. 처방 주문 생성
        current_time = datetime.now()
        db_order = PrescriptionOrder(
            patient_id=patient.id,
            submitted_at=current_time,
            note=None
        )
        
        db.add(db_order)
        db.commit()
        db.refresh(db_order)
        
        # 4. 처방 생성
        db_prescriptions = []
        for medication in request.medications:
            # 처방 데이터 생성
            db_prescription = Prescription(
                order_id=db_order.id,
                drug_id=medication.drug_id,
                drug_korean_name=medication.drug_korean_name,
                drug_ingredient=medication.drug_ingredient,
                dose_amount=medication.dose_amount,
                dose_unit=medication.dose_unit,
                real_amount=medication.real_amount,
                doses_per_day=medication.doses_per_day,
                duration_days=medication.duration_days,
                audit_result="-",  # 기본값
                information="적정 용량입니다."  # 기본값
            )
            
            # 환자 정보 조회
            patient_data = get_patient_data_cached(db_order.id, db)
            
            # 감사 실행
            if patient_data and medication.drug_id:
                try:
                    audit_service = get_audit_service()
                    
                    prescription_data = {
                        "dose_amount": medication.dose_amount,
                        "real_amount": medication.real_amount,
                        "doses_per_day": medication.doses_per_day
                    }
                    
                    # 감사 실행 (정보와 함께)
                    audit_result, information = audit_service._audit_single_prescription_with_info(
                        patient_data, 
                        prescription_data, 
                        medication.drug_id
                    )
                    
                    # 감사 결과 적용
                    db_prescription.audit_result = audit_result
                    db_prescription.information = information
                    
                except Exception as audit_error:
                    # 감사 실패시 기본값 유지
                    db_prescription.audit_result = "-"
                    db_prescription.information = f"감사 오류: {str(audit_error)}"
            
            db_prescriptions.append(db_prescription)
        
        # 5. 모든 처방 저장
        db.add_all(db_prescriptions)
        db.commit()
        
        # 6. 처방 주문 상태 업데이트
        update_prescription_order_note(db, db_order.id)
        
        return PrescriptionInputResponse(
            success=True,
            patient_id=patient.id,
            order_id=db_order.id,
            prescriptions=db_prescriptions,
            message="처방이 성공적으로 입력되었습니다.",
            note=db_order.note
        )
        
    except Exception as e:
        db.rollback()
        return PrescriptionInputResponse(
            success=False,
            message=f"처방 입력 실패: {str(e)}"
        )


@router.post("/input/with-patient-id", response_model=PrescriptionInputResponse)
def input_prescription_with_patient_id(request: PrescriptionInputWithPatientIdRequest, db: Session = Depends(get_db)):
    """
    환자 ID로 처방을 입력합니다 (PrescriptionInput용).
    """
    try:
        # 1. 환자 존재 확인
        patient = db.query(Patient).filter(Patient.id == request.patient_id).first()
        if not patient:
            return PrescriptionInputResponse(
                success=False,
                message="환자를 찾을 수 없습니다."
            )
        
        # 2. 최신 검사수치 확인
        latest_measurement = (
            db.query(PatientMeasurement)
            .filter(PatientMeasurement.patient_id == request.patient_id)
            .order_by(PatientMeasurement.measured_at.desc())
            .first()
        )
        
        if not latest_measurement:
            return PrescriptionInputResponse(
                success=False,
                message="환자의 검사수치가 없습니다. 먼저 검사수치를 입력해주세요."
            )
        
        # 3. 처방 주문 생성
        current_time = datetime.now()
        db_order = PrescriptionOrder(
            patient_id=request.patient_id,
            submitted_at=current_time,
            note=None
        )
        
        db.add(db_order)
        db.commit()
        db.refresh(db_order)
        
        # 4. 처방 생성
        db_prescriptions = []
        for medication in request.medications:
            # 처방 데이터 생성
            db_prescription = Prescription(
                order_id=db_order.id,
                drug_id=medication.drug_id,
                drug_korean_name=medication.drug_korean_name,
                drug_ingredient=medication.drug_ingredient,
                dose_amount=medication.dose_amount,
                dose_unit=medication.dose_unit,
                real_amount=medication.real_amount,
                doses_per_day=medication.doses_per_day,
                duration_days=medication.duration_days,
                audit_result="-",  # 기본값
                information="적정 용량입니다."  # 기본값
            )
            
            # 환자 정보 조회
            patient_data = get_patient_data_cached(db_order.id, db)
            
            # 감사 실행
            if patient_data and medication.drug_id:
                try:
                    audit_service = get_audit_service()
                    
                    prescription_data = {
                        "dose_amount": medication.dose_amount,
                        "real_amount": medication.real_amount,
                        "doses_per_day": medication.doses_per_day
                    }
                    
                    # 감사 실행 (정보와 함께)
                    audit_result, information = audit_service._audit_single_prescription_with_info(
                        patient_data, 
                        prescription_data, 
                        medication.drug_id
                    )
                    
                    # 감사 결과 적용
                    db_prescription.audit_result = audit_result
                    db_prescription.information = information
                    
                except Exception as audit_error:
                    # 감사 실패시 기본값 유지
                    db_prescription.audit_result = "-"
                    db_prescription.information = f"감사 오류: {str(audit_error)}"
            
            db_prescriptions.append(db_prescription)
        
        # 5. 모든 처방 저장
        db.add_all(db_prescriptions)
        db.commit()
        
        # 6. 처방 주문 상태 업데이트
        update_prescription_order_note(db, db_order.id)
        
        return PrescriptionInputResponse(
            success=True,
            patient_id=request.patient_id,
            order_id=db_order.id,
            prescriptions=db_prescriptions,
            message="처방이 성공적으로 입력되었습니다.",
            note=db_order.note
        )
        
    except Exception as e:
        db.rollback()
        return PrescriptionInputResponse(
            success=False,
            message=f"처방 입력 실패: {str(e)}"
        )


@router.post("/clear-cache")
def clear_patient_cache():
    """환자 정보 캐시를 초기화합니다 (개발/테스트용)."""
    global _patient_cache
    _patient_cache.clear()
    return {"message": "환자 정보 캐시가 초기화되었습니다."} 