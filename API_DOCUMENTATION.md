# RenalDose API 문서

## 📋 개요
RenalDose 시스템의 컴포넌트별 API 사용 현황을 정리한 문서입니다.

---

## 🏗️ API 구조

### 1. 약물 관련 API (`/api/drugs`)
**라우터**: `backend/routers/drug_router.py`

| 엔드포인트 | 메서드 | 설명 | 사용 컴포넌트 |
|-----------|--------|------|---------------|
| `/api/drugs` | GET | 약물명 자동완성 검색 | PrescriptionInput, NewAudit |
| `/api/drugs/details` | GET | 약물 상세 정보 조회 | PrescriptionInput, NewAudit |
| `/api/drugs/batch-search` | POST | 배치 약물 검색 | NewAudit |

### 2. 환자 관련 API (`/api/patients`)
**라우터**: `backend/routers/patient_router.py`

| 엔드포인트 | 메서드 | 설명 | 사용 컴포넌트 |
|-----------|--------|------|---------------|
| `/api/patients` | GET | 모든 환자 조회 | PatientManagement |
| `/api/patients/search/info` | GET | 환자 정보로 검색 | PrescriptionInput |
| `/api/patients/search/resident/{id}` | GET | 주민등록번호로 검색 | - |
| `/api/patients/with-measurement-direct` | POST | 환자+검사수치 직접 생성 | NewAudit |
| `/api/patients/with-measurement` | POST | 본인인증 후 환자 생성 | - |
| `/api/patients/{id}` | GET | 특정 환자 정보 조회 | - |

### 3. 처방 관련 API (`/api/prescriptions`)
**라우터**: `backend/routers/prescription_router.py`

| 엔드포인트 | 메서드 | 설명 | 사용 컴포넌트 |
|-----------|--------|------|---------------|
| `/api/prescriptions/orders` | POST | 주민등록번호로 처방주문 생성 | - |
| `/api/prescriptions/orders/with-patient-id` | POST | 환자ID로 처방주문 생성 | NewAudit |
| `/api/prescriptions/input` | POST | 환자검색+처방입력 | - |
| `/api/prescriptions/input/with-patient-id` | POST | 환자ID로 처방입력 | PrescriptionInput |
| `/api/prescriptions/batch` | POST | 배치 처방 생성 | NewAudit |
| `/api/prescriptions/orders/{id}` | GET | 처방주문 조회 | NewAudit |

### 4. 감사 관련 API (`/api/audit`)
**라우터**: `backend/routers/audit_router.py`

| 엔드포인트 | 메서드 | 설명 | 사용 컴포넌트 |
|-----------|--------|------|---------------|
| `/api/audit/execute` | POST | 감사 실행 | - |
| `/api/audit/history` | GET | 감사 이력 조회 | AuditHistory |

---

## 🎯 컴포넌트별 API 사용 현황

### 1. PrescriptionInput 컴포넌트
**파일**: `src/components/PrescriptionInput.tsx`

#### 사용 API:
- `GET /api/drugs?query={검색어}` - 약물 자동완성
- `GET /api/drugs/details?drug_name={약물명}` - 약물 상세정보 (real_amount 계산용)
- `GET /api/patients/search/info` - 환자 검색
- `POST /api/prescriptions/input/with-patient-id` - 처방 입력

#### 주요 기능:
- 환자 검색 및 선택
- 약물 자동완성 검색
- real_amount 자동 계산
- 처방 입력 및 감사 실행

---

### 2. NewAudit 컴포넌트
**파일**: `src/components/NewAudit.tsx`

#### 사용 API:
- `GET /api/drugs?query={검색어}` - 약물 자동완성
- `POST /api/patients/with-measurement-direct` - 환자+검사수치 생성
- `POST /api/prescriptions/orders/with-patient-id` - 처방주문 생성
- `POST /api/drugs/batch-search` - 배치 약물 검색
- `POST /api/prescriptions/batch` - 배치 처방 생성
- `GET /api/prescriptions/orders/{id}` - 처방주문 조회

#### 주요 기능:
- 환자 정보 직접 입력
- 약물 정보 입력
- 배치 처방 생성 및 감사
- 최적화된 성능

---

### 3. AuditHistory 컴포넌트
**파일**: `src/components/AuditHistory.tsx`

#### 사용 API:
- `GET /api/audit/history` - 감사 이력 조회

#### 주요 기능:
- 감사 이력 조회
- 감사 결과 상세 보기

---

### 4. PatientManagement 컴포넌트
**파일**: `src/components/PatientManagement.tsx`

#### 사용 API:
- `GET /api/patients` - 환자 목록 조회
- `apiService` 클래스 사용 (추상화된 API 호출)

#### 주요 기능:
- 환자 목록 조회
- 환자 정보 수정
- 신규 환자 등록

---

## 🔧 API 서비스 구조

### 1. 직접 fetch 사용
- **PrescriptionInput**: 직접 fetch 호출
- **NewAudit**: 직접 fetch 호출
- **AuditHistory**: 직접 fetch 호출

### 2. apiService 클래스 사용
- **PatientManagement**: `src/services/api.ts`의 ApiService 클래스 사용

---

## 📊 API 호스트 주소

### 현재 사용 중인 주소:
- `http://localhost:8000` (대부분의 컴포넌트)
- `http://127.0.0.1:8000` (PrescriptionInput의 환자 검색)

### 권장사항:
- 모든 컴포넌트에서 `http://localhost:8000`로 통일
- 환경변수나 설정 파일로 관리

---

## 🚀 개선 완료 사항

### ✅ 1. API 호스트 통일
```typescript
// src/config/api.ts
export const API_CONFIG = {
  BASE_URL: 'http://localhost:8000',
  ENDPOINTS: { ... }
};
```

### ✅ 2. API 서비스 통합
```typescript
// src/services/api.ts 확장 완료
class ApiService {
  // 약물 관련
  searchDrugs(query: string): Promise<string[]>
  getDrugDetails(drugName: string): Promise<any>
  batchSearchDrugs(drugNames: string[]): Promise<DrugSearchResponse[]>
  
  // 환자 관련
  searchPatientByInfo(name: string, birthDate: string, sex: string): Promise<any>
  createPatientWithMeasurementDirect(patientData: any): Promise<any>
  
  // 처방 관련
  createPrescriptionOrderWithPatientId(patientId: number): Promise<any>
  inputPrescriptionWithPatientId(request: PrescriptionInputRequest): Promise<PrescriptionInputResponse>
  createPrescriptionsBatch(prescriptions: PrescriptionCreateRequest[]): Promise<PrescriptionResponse[]>
  getPrescriptionOrder(orderId: number): Promise<any>
  
  // 감사 관련
  getAuditHistory(): Promise<AuditHistoryResponse[]>
  executeAudit(auditRequest: any): Promise<any>
}
```

### ✅ 3. 컴포넌트별 API 사용 정리
- **PrescriptionInput**: ✅ apiService 사용으로 변경 완료
- **NewAudit**: 🔄 apiService 사용으로 변경 예정
- **AuditHistory**: 🔄 apiService 사용으로 변경 예정
- **PatientManagement**: ✅ 이미 apiService 사용 중

---

## 📝 참고사항

1. **real_amount 계산**: NewAudit과 PrescriptionInput에서 동일한 로직 사용
2. **감사 결과**: `_audit_single_prescription_with_info` 메서드로 상세 정보 제공
3. **배치 처리**: NewAudit에서 성능 최적화를 위한 배치 API 사용
4. **캐싱**: 처방 라우터에서 환자 정보 캐싱 적용 