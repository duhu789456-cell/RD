from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from models.database import get_db
from models.patient import Patient
from models.patient_measurement import PatientMeasurement
from utils.resident_number import (
    validate_and_parse_resident_number, 
    find_patient_by_resident_number,
    create_patient_from_resident_number
)

# 환자 관련 API 라우터
router = APIRouter(prefix="/api/patients", tags=["patients"])


class PatientCreate(BaseModel):
    """환자 생성 요청 (기본 정보만)"""
    name: str = Field(..., description="환자 이름")
    sex: str = Field(..., description="성별 (M/F)")
    birth_date: str = Field(..., description="생년월일 (YYYY-MM-DD)")


class PatientCreateWithResident(BaseModel):
    """주민등록번호로 환자 생성 요청"""
    name: str = Field(..., description="환자 이름")
    resident_number: str = Field(..., description="주민등록번호")


class PatientMeasurementCreate(BaseModel):
    """환자 검사수치 생성 요청"""
    weight_kg: float = Field(..., description="체중 (kg)")
    height_cm: float = Field(..., description="키 (cm)")
    scr_mg_dl: float = Field(..., description="혈청 크레아티닌 (mg/dL)")
    egfr: float = Field(0.0, description="eGFR")
    crcl: float = Field(0.0, description="CrCl")
    crcl_normalized: float = Field(0.0, description="CrCl 정규화")
    bsa: float = Field(0.0, description="체표면적 (m²)")
    is_hd: bool = Field(False, description="투석 여부")


class PatientCreateWithMeasurement(BaseModel):
    """본인인증 완료 후 환자 정보와 검사수치를 함께 생성"""
    name: str = Field(..., description="환자 이름")
    resident_number: str = Field(..., description="주민등록번호")
    measurement: PatientMeasurementCreate = Field(..., description="검사수치")


class PatientResponse(BaseModel):
    """환자 기본 정보 응답"""
    id: int
    name: str
    sex: str
    birth_date: str
    created_at: datetime

    class Config:
        from_attributes = True


class PatientMeasurementResponse(BaseModel):
    """환자 검사수치 응답"""
    id: int
    weight_kg: float
    height_cm: float
    scr_mg_dl: float
    egfr: float
    crcl: float
    crcl_normalized: float
    bsa: float
    is_hd: bool
    measured_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class PatientInfoResponse(BaseModel):
    """환자 기본정보와 최신 검사수치 응답"""
    id: int
    name: str
    sex: str
    birth_date: str
    created_at: datetime
    latest_measurement: Optional[PatientMeasurementResponse] = None

    class Config:
        from_attributes = True


class PatientSearchResponse(BaseModel):
    """환자 검색 응답"""
    found: bool
    patient: Optional[PatientInfoResponse] = None
    message: str


class PatientCreateResponse(BaseModel):
    """환자 생성 응답 (환자 정보 + 검사수치)"""
    patient: PatientResponse
    measurement: PatientMeasurementResponse
    message: str


# 모든 환자 조회 (가장 먼저 정의)
@router.get("", response_model=List[PatientInfoResponse])
def get_all_patients(
    skip: int = Query(0, description="건너뛸 개수"),
    limit: int = Query(20, description="조회할 최대 개수"),
    db: Session = Depends(get_db)
):
    """
    모든 환자의 기본정보와 최신 검사수치를 조회합니다.
    """
    try:
        # 환자 목록 조회
        patients = (
            db.query(Patient)
            .order_by(Patient.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        
        result = []
        for patient in patients:
            # 각 환자의 최신 검사수치 조회
            latest_measurement = (
                db.query(PatientMeasurement)
                .filter(PatientMeasurement.patient_id == patient.id)
                .order_by(PatientMeasurement.measured_at.desc())
                .first()
            )
            
            result.append(PatientInfoResponse(
                id=patient.id,
                name=patient.name,
                sex=patient.sex,
                birth_date=patient.birth_date,
                created_at=patient.created_at,
                latest_measurement=latest_measurement
            ))
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"환자 목록 조회 실패: {str(e)}")


# 주민등록번호로 환자 검색 (구체적인 경로를 먼저 정의)
@router.get("/search/resident/{resident_number}", response_model=PatientSearchResponse)
def search_patient_by_resident(resident_number: str, db: Session = Depends(get_db)):
    """
    주민등록번호로 환자를 검색합니다.
    """
    try:
        patient = find_patient_by_resident_number(db, resident_number)
        
        if patient:
            # 최신 검사수치 조회
            latest_measurement = (
                db.query(PatientMeasurement)
                .filter(PatientMeasurement.patient_id == patient.id)
                .order_by(PatientMeasurement.measured_at.desc())
                .first()
            )
            
            patient_info = PatientInfoResponse(
                id=patient.id,
                name=patient.name,
                sex=patient.sex,
                birth_date=patient.birth_date,
                created_at=patient.created_at,
                latest_measurement=latest_measurement
            )
            
            return PatientSearchResponse(
                found=True,
                patient=patient_info,
                message="환자를 찾았습니다"
            )
        else:
            return PatientSearchResponse(
                found=False,
                patient=None,
                message="환자를 찾을 수 없습니다"
            )
            
    except HTTPException as e:
        return PatientSearchResponse(
            found=False,
            patient=None,
            message=f"주민등록번호 형식 오류: {e.detail}"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"환자 검색 실패: {str(e)}")


# 환자 검색 (이름, 생년월일, 성별 기반)
@router.get("/search/info", response_model=PatientSearchResponse)
def search_patient_by_info(
    name: str = Query(..., description="환자 이름"),
    birth_date: str = Query(..., description="생년월일 (YYYY-MM-DD)"),
    sex: str = Query(..., description="성별 (M/F)"),
    db: Session = Depends(get_db)
):
    """
    환자 이름, 생년월일, 성별로 환자를 검색합니다.
    """
    try:
        # 환자 검색
        patient = (
            db.query(Patient)
            .filter(
                Patient.name == name,
                Patient.birth_date == birth_date,
                Patient.sex == sex
            )
            .first()
        )
        
        if patient:
            # 최신 검사수치 조회
            latest_measurement = (
                db.query(PatientMeasurement)
                .filter(PatientMeasurement.patient_id == patient.id)
                .order_by(PatientMeasurement.measured_at.desc())
                .first()
            )
            
            patient_info = PatientInfoResponse(
                id=patient.id,
                name=patient.name,
                sex=patient.sex,
                birth_date=patient.birth_date,
                created_at=patient.created_at,
                latest_measurement=latest_measurement
            )
            
            return PatientSearchResponse(
                found=True,
                patient=patient_info,
                message="환자를 찾았습니다"
            )
        else:
            return PatientSearchResponse(
                found=False,
                patient=None,
                message="환자를 찾을 수 없습니다"
            )
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"환자 검색 실패: {str(e)}")


# 환자 중복 체크 (이름, 생년월일, 성별 기반)
@router.get("/check-duplicate", response_model=dict)
def check_patient_duplicate(
    name: str = Query(..., description="환자 이름"),
    birth_date: str = Query(..., description="생년월일 (YYYY-MM-DD)"),
    sex: str = Query(..., description="성별 (M/F)"),
    db: Session = Depends(get_db)
):
    """
    환자 이름, 생년월일, 성별로 중복 환자가 있는지 확인합니다.
    """
    try:
        # 환자 검색
        patient = (
            db.query(Patient)
            .filter(
                Patient.name == name,
                Patient.birth_date == birth_date,
                Patient.sex == sex
            )
            .first()
        )
        
        if patient:
            return {
                "is_duplicate": True,
                "message": "이미 등록된 환자입니다",
                "patient_id": patient.id,
                "patient_name": patient.name
            }
        else:
            return {
                "is_duplicate": False,
                "message": "등록 가능한 환자입니다"
            }
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"중복 체크 실패: {str(e)}")


# 환자 생성 (기본 정보만)
@router.post("", response_model=PatientResponse)
def create_patient(patient: PatientCreate, db: Session = Depends(get_db)):
    """
    새로운 환자를 생성합니다 (기본 정보만).
    """
    try:
        # 중복 환자 체크
        existing_patient = db.query(Patient).filter(
            Patient.name == patient.name,
            Patient.sex == patient.sex,
            Patient.birth_date == patient.birth_date
        ).first()
        
        if existing_patient:
            raise HTTPException(status_code=400, detail="이미 존재하는 환자입니다")
        
        # 환자 기본정보 생성
        db_patient = Patient(
            name=patient.name,
            sex=patient.sex,
            birth_date=patient.birth_date
        )
        
        db.add(db_patient)
        db.commit()
        db.refresh(db_patient)
        
        return db_patient
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"환자 생성 실패: {str(e)}")


# 주민등록번호로 환자 생성
@router.post("/with-resident", response_model=PatientResponse)
def create_patient_with_resident(patient: PatientCreateWithResident, db: Session = Depends(get_db)):
    """
    주민등록번호로부터 환자 정보를 생성합니다.
    """
    try:
        return create_patient_from_resident_number(db, patient.name, patient.resident_number)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"환자 생성 실패: {str(e)}")


# 본인인증 완료 후 환자 정보와 검사수치를 함께 생성
@router.post("/with-measurement", response_model=PatientCreateResponse)
def create_patient_with_measurement(patient_data: PatientCreateWithMeasurement, db: Session = Depends(get_db)):
    """
    본인인증 완료 후 환자 정보와 검사수치를 함께 생성합니다.
    """
    try:
        # 1. 주민등록번호로 환자 생성
        try:
            # 새 환자 생성 (기존 환자 검색 없이)
            db_patient = create_patient_from_resident_number(db, patient_data.name, patient_data.resident_number)
            print(f"👤 새 환자 생성: ID={db_patient.id}, 이름={db_patient.name}")
                
        except HTTPException as e:
            raise HTTPException(status_code=400, detail=f"환자 생성 실패: {e.detail}")
        
        # 2. 검사수치 생성
        db_measurement = PatientMeasurement(
            patient_id=db_patient.id,
            weight_kg=patient_data.measurement.weight_kg,
            height_cm=patient_data.measurement.height_cm,
            scr_mg_dl=patient_data.measurement.scr_mg_dl,
            egfr=patient_data.measurement.egfr,
            crcl=patient_data.measurement.crcl,
            crcl_normalized=patient_data.measurement.crcl_normalized,
            bsa=patient_data.measurement.bsa,
            is_hd=patient_data.measurement.is_hd
        )
        
        db.add(db_measurement)
        db.commit()
        db.refresh(db_measurement)
        
        return PatientCreateResponse(
            patient=db_patient,
            measurement=db_measurement,
            message="환자 정보와 검사수치가 성공적으로 등록되었습니다"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"환자 및 검사수치 등록 실패: {str(e)}")


# 환자 정보와 검사수치를 함께 생성 (NewAudit용)
@router.post("/with-measurement-direct", response_model=PatientCreateResponse)
def create_patient_with_measurement_direct(
    patient_data: dict, 
    db: Session = Depends(get_db)
):
    """
    NewAudit에서 사용하는 환자 정보와 검사수치를 함께 생성합니다.
    주민등록번호 없이도 작동합니다.
    """
    try:
        # 1. 환자 기본정보 생성
        db_patient = Patient(
            name=patient_data.get('name') or "Unknown",
            sex=patient_data.get('sex'),
            birth_date=patient_data.get('birth_date')
        )
        
        db.add(db_patient)
        db.commit()
        db.refresh(db_patient)
        
        print(f"👤 새 환자 생성: ID={db_patient.id}, 이름={db_patient.name}")
        
        # 2. 검사수치 생성
        db_measurement = PatientMeasurement(
            patient_id=db_patient.id,
            weight_kg=patient_data.get('weight_kg', 0),
            height_cm=patient_data.get('height_cm', 0),
            scr_mg_dl=patient_data.get('scr_mg_dl', 0),
            egfr=patient_data.get('egfr', 0),
            crcl=patient_data.get('crcl', 0),
            crcl_normalized=patient_data.get('crcl_normalized', 0),
            bsa=patient_data.get('bsa', 0),
            is_hd=patient_data.get('is_hd', False)
        )
        
        db.add(db_measurement)
        db.commit()
        db.refresh(db_measurement)
        
        return PatientCreateResponse(
            patient=db_patient,
            measurement=db_measurement,
            message="환자 정보와 검사수치가 성공적으로 등록되었습니다"
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"환자 및 검사수치 등록 실패: {str(e)}")


# 특정 환자 정보 조회
@router.get("/{patient_id}", response_model=PatientInfoResponse)
def get_patient_info(patient_id: int, db: Session = Depends(get_db)):
    """
    환자의 기본정보와 최신 검사수치를 조회합니다.
    """
    try:
        # 환자 기본정보 조회
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="환자를 찾을 수 없습니다")
        
        # 최신 검사수치 조회
        latest_measurement = (
            db.query(PatientMeasurement)
            .filter(PatientMeasurement.patient_id == patient_id)
            .order_by(PatientMeasurement.measured_at.desc())
            .first()
        )
        
        return PatientInfoResponse(
            id=patient.id,
            name=patient.name,
            sex=patient.sex,
            birth_date=patient.birth_date,
            created_at=patient.created_at,
            latest_measurement=latest_measurement
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"환자 정보 조회 실패: {str(e)}")


# 환자 검사수치 추가
@router.post("/{patient_id}/measurements", response_model=PatientMeasurementResponse)
def add_patient_measurement(
    patient_id: int, 
    measurement: PatientMeasurementCreate, 
    db: Session = Depends(get_db)
):
    """
    환자의 검사수치를 추가합니다.
    """
    try:
        # 환자 존재 확인
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="환자를 찾을 수 없습니다")
        
        # 검사수치 생성
        db_measurement = PatientMeasurement(
            patient_id=patient_id,
            weight_kg=measurement.weight_kg,
            height_cm=measurement.height_cm,
            scr_mg_dl=measurement.scr_mg_dl,
            egfr=measurement.egfr,
            crcl=measurement.crcl,
            crcl_normalized=measurement.crcl_normalized,
            bsa=measurement.bsa,
            is_hd=measurement.is_hd
        )
        
        db.add(db_measurement)
        db.commit()
        db.refresh(db_measurement)
        
        return db_measurement
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"검사수치 추가 실패: {str(e)}")


# 환자 검사수치 이력 조회
@router.get("/{patient_id}/measurements", response_model=List[PatientMeasurementResponse])
def get_patient_measurements(
    patient_id: int, 
    limit: int = Query(10, description="조회할 최대 개수"),
    db: Session = Depends(get_db)
):
    """
    특정 환자의 검사수치 이력을 조회합니다.
    최신 순으로 정렬됩니다.
    """
    try:
        # 환자 존재 확인
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="환자를 찾을 수 없습니다")
        
        # 검사수치 이력 조회
        measurements = (
            db.query(PatientMeasurement)
            .filter(PatientMeasurement.patient_id == patient_id)
            .order_by(PatientMeasurement.measured_at.desc())
            .limit(limit)
            .all()
        )
        
        return measurements
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"검사수치 조회 실패: {str(e)}")


# 환자 검사수치 추이 조회
@router.get("/{patient_id}/measurements/trend")
def get_measurement_trend(
    patient_id: int,
    parameter: str = Query(..., description="조회할 수치 (weight_kg, scr_mg_dl, egfr, crcl 등)"),
    limit: int = Query(10, description="조회할 최대 개수"),
    db: Session = Depends(get_db)
):
    """
    특정 환자의 검사수치 변화 추이를 조회합니다.
    """
    try:
        # 환자 존재 확인
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="환자를 찾을 수 없습니다")
        
        # 유효한 파라미터 확인
        valid_parameters = [
            'weight_kg', 'height_cm', 'scr_mg_dl', 'egfr', 
            'crcl', 'crcl_normalized', 'bsa'
        ]
        
        if parameter not in valid_parameters:
            raise HTTPException(
                status_code=400, 
                detail=f"잘못된 파라미터입니다. 사용 가능한 파라미터: {', '.join(valid_parameters)}"
            )
        
        # 검사수치 이력 조회
        measurements = (
            db.query(PatientMeasurement)
            .filter(PatientMeasurement.patient_id == patient_id)
            .order_by(PatientMeasurement.measured_at.desc())
            .limit(limit)
            .all()
        )
        
        # 추이 데이터 구성
        trend_data = []
        for measurement in measurements:
            value = getattr(measurement, parameter)
            trend_data.append({
                "measured_at": measurement.measured_at,
                "value": value,
                "measurement_id": measurement.id
            })
        
        # 시간순으로 정렬 (오래된 것부터)
        trend_data.reverse()
        
        return {
            "patient_id": patient_id,
            "patient_name": patient.name,
            "parameter": parameter,
            "trend_data": trend_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"추이 조회 실패: {str(e)}") 

@router.get("/{patient_id}/measurements/latest", response_model=PatientMeasurementResponse)
def get_latest_measurement(patient_id: int, db: Session = Depends(get_db)):
    """
    환자의 최신 검사기록을 조회합니다.
    """
    try:
        # 환자 존재 확인
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="환자를 찾을 수 없습니다")
        
        # 최신 검사수치 조회
        latest_measurement = (
            db.query(PatientMeasurement)
            .filter(PatientMeasurement.patient_id == patient_id)
            .order_by(PatientMeasurement.measured_at.desc())
            .first()
        )
        
        if not latest_measurement:
            raise HTTPException(
                status_code=404, 
                detail="환자의 검사기록이 없습니다"
            )
        
        return latest_measurement
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"검사기록 조회 실패: {str(e)}") 