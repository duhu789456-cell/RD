# CarePlus 백엔드 SQLAlchemy 모델

이 폴더에는 처방전 감사 시스템을 위한 SQLAlchemy 모델들이 포함되어 있습니다.

## 모델 구조

### 1. Patient (환자)
- **테이블명**: `patients`
- **설명**: 환자 정보를 저장하는 테이블
- **주요 필드**:
  - `id`: 기본 키
  - `name`: 환자명 (선택적)
  - `sex`: 성별 ('M' 또는 'F')
  - `birth_date`: 생년월일 (YYYY-MM-DD)
  - `weight_kg`, `height_cm`: 체중, 키
  - `scr_mg_dl`, `egfr`, `crcl`: 신장 기능 지표

### 2. PrescriptionOrder (처방 주문)
- **테이블명**: `prescription_orders`
- **설명**: 처방전 제출 이벤트를 저장하는 테이블
- **주요 필드**:
  - `id`: 기본 키
  - `patient_id`: 환자 ID (외래 키)
  - `submitted_at`: 제출 시간
  - `note`: 메모 (선택적)

### 3. Prescription (개별 처방)
- **테이블명**: `prescriptions`
- **설명**: 개별 약물 처방을 저장하는 테이블
- **주요 필드**:
  - `id`: 기본 키
  - `order_id`: 처방 주문 ID (외래 키)
  - `drug_korean_name`: 약물 한글명
  - `drug_ingredient`: 약물 성분
  - `dose_amount`, `dose_unit`: 용량과 단위
  - `doses_per_day`: 1일 복용 횟수
  - `duration_days`: 투약 기간
  - `audit_result`: 감사 결과
  - `recommendation`: 권고사항

## 관계 (Relationships)

```
Patient (1) ←→ (N) PrescriptionOrder (1) ←→ (N) Prescription
```

- 한 환자는 여러 처방 주문을 가질 수 있음
- 한 처방 주문은 여러 개별 처방을 가질 수 있음

## 사용 방법

### 1. 데이터베이스 초기화

```bash
cd backend
python init_db.py
```

### 2. 환자 생성 예시

```python
from sqlalchemy.orm import Session
from models.database import SessionLocal
from models.patient import Patient
from datetime import datetime

# 세션 생성
db: Session = SessionLocal()

# 새 환자 생성
new_patient = Patient(
    name="홍길동",
    sex="M",
    birth_date="1980-05-15",
    weight_kg=70.0,
    height_cm=175.0,
    scr_mg_dl=1.1,
    egfr=85.0,
    crcl=90.0
)

# 데이터베이스에 저장
db.add(new_patient)
db.commit()
db.refresh(new_patient)

print(f"생성된 환자 ID: {new_patient.id}")
db.close()
```

### 3. 처방 주문 생성 예시

```python
from models.prescription_order import PrescriptionOrder

# 처방 주문 생성
order = PrescriptionOrder(
    patient_id=new_patient.id,
    submitted_at=datetime.utcnow(),
    note="정기 검진 후 처방"
)

db.add(order)
db.commit()
db.refresh(order)
```

### 4. 개별 처방 생성 예시

```python
from models.prescription import Prescription

# 개별 처방 생성
prescription = Prescription(
    order_id=order.id,
    drug_korean_name="아스피린",
    drug_ingredient="Aspirin",
    dose_amount="100",
    dose_unit="mg",
    doses_per_day=1,
    duration_days=30,
    audit_result="정상",
    recommendation="식후 복용"
)

db.add(prescription)
db.commit()
db.refresh(prescription)
```

### 5. 관계를 통한 데이터 조회

```python
# 환자의 모든 처방 주문 조회
patient = db.query(Patient).filter(Patient.id == 1).first()
for order in patient.prescription_orders:
    print(f"주문 ID: {order.id}, 제출일: {order.submitted_at}")
    
    # 각 주문의 처방들 조회
    for prescription in order.prescriptions:
        print(f"  - 약물: {prescription.drug_korean_name}")
```

## 파일 구조

```
models/
├── __init__.py          # 패키지 초기화
├── database.py          # 데이터베이스 설정
├── patient.py           # Patient 모델
├── prescription_order.py # PrescriptionOrder 모델
├── prescription.py      # Prescription 모델
└── README.md           # 이 파일
```

## 주의사항

1. **날짜 형식**: `birth_date`는 'YYYY-MM-DD' 형식의 문자열입니다.
2. **성별**: `sex` 필드는 'M' 또는 'F'만 허용됩니다.
3. **타임스탬프**: `created_at`과 `submitted_at`은 자동으로 UTC 시간이 설정됩니다.
4. **데이터베이스 파일**: SQLite 데이터베이스는 `careplus.db` 파일로 생성됩니다.

## 다음 단계

1. FastAPI 라우터에서 이 모델들을 사용하여 REST API 엔드포인트 구현
2. Pydantic 스키마와 함께 데이터 검증 및 직렬화
3. 처방 감사 로직 구현 