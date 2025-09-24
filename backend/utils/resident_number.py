import re
from typing import Tuple, Optional
from fastapi import HTTPException


def validate_and_parse_resident_number(resident_number: str) -> Tuple[str, str]:
    """
    주민등록번호를 검증하고 생년월일과 성별을 추출합니다.
    
    Args:
        resident_number: 주민등록번호 (예: "900101-1234567" 또는 "9001011234567")
        
    Returns:
        Tuple[str, str]: (생년월일, 성별) - 생년월일은 "YYYY-MM-DD" 형식, 성별은 "M" 또는 "F"
        
    Raises:
        HTTPException: 주민등록번호 형식이 올바르지 않은 경우
    """
    # 공백 제거 및 하이픈 제거
    cleaned_number = resident_number.replace(' ', '').replace('-', '')
    
    # 주민등록번호 형식 검증 (6자리-7자리)
    pattern = r'^(\d{6})(\d{7})$'
    match = re.match(pattern, cleaned_number)
    
    if not match:
        raise HTTPException(
            status_code=400, 
            detail="올바른 주민등록번호 형식이 아닙니다. (예: 900101-1234567)"
        )
    
    birth_part = match.group(1)
    identifier_part = match.group(2)
    
    # 생년월일 추출
    year = birth_part[:2]
    month = birth_part[2:4]
    day = birth_part[4:6]
    
    # 월과 일 유효성 검사
    try:
        month_int = int(month)
        day_int = int(day)
        
        if not (1 <= month_int <= 12):
            raise HTTPException(
                status_code=400, 
                detail="올바르지 않은 월입니다."
            )
        
        if not (1 <= day_int <= 31):
            raise HTTPException(
                status_code=400, 
                detail="올바르지 않은 일입니다."
            )
            
    except ValueError:
        raise HTTPException(
            status_code=400, 
            detail="주민등록번호의 월 또는 일이 숫자가 아닙니다."
        )
    
    # 1900년대 또는 2000년대 판단
    first_digit = int(identifier_part[0])
    
    if first_digit in [1, 2, 5, 6]:
        full_year = f"19{year}"
    elif first_digit in [3, 4, 7, 8]:
        full_year = f"20{year}"
    else:
        raise HTTPException(
            status_code=400, 
            detail="올바르지 않은 주민등록번호입니다. (첫 번째 자리 오류)"
        )
    
    birth_date = f"{full_year}-{month}-{day}"
    
    # 성별 추출
    sex = 'M' if first_digit in [1, 3, 5, 7] else 'F'
    
    return birth_date, sex


def find_patient_by_resident_number(db_session, resident_number: str):
    """
    주민등록번호로 환자를 찾습니다.
    
    Args:
        db_session: 데이터베이스 세션
        resident_number: 주민등록번호
        
    Returns:
        Patient: 찾은 환자 객체 또는 None
    """
    try:
        from models.patient import Patient
        
        birth_date, sex = validate_and_parse_resident_number(resident_number)
        
        patient = db_session.query(Patient).filter(
            Patient.birth_date == birth_date,
            Patient.sex == sex
        ).first()
        
        return patient
        
    except HTTPException:
        return None
    except Exception:
        return None


def create_patient_from_resident_number(db_session, name: str, resident_number: str):
    """
    주민등록번호로부터 환자 정보를 생성합니다.
    
    Args:
        db_session: 데이터베이스 세션
        name: 환자 이름
        resident_number: 주민등록번호
        
    Returns:
        Patient: 생성된 환자 객체
        
    Raises:
        HTTPException: 주민등록번호가 올바르지 않거나 환자가 이미 존재하는 경우
    """
    from models.patient import Patient
    
    birth_date, sex = validate_and_parse_resident_number(resident_number)
    
    # 중복 환자 체크 (이름, 생년월일, 성별 모두 확인)
    existing_patient = db_session.query(Patient).filter(
        Patient.name == name,
        Patient.birth_date == birth_date,
        Patient.sex == sex
    ).first()
    
    if existing_patient:
        raise HTTPException(
            status_code=400, 
            detail="이미 존재하는 환자입니다. (동일한 이름, 생년월일, 성별)"
        )
    
    # 새 환자 생성
    patient = Patient(
        name=name,
        sex=sex,
        birth_date=birth_date
    )
    
    db_session.add(patient)
    db_session.commit()
    db_session.refresh(patient)
    
    return patient 