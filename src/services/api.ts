import { API_CONFIG, createApiUrl, API_DEFAULT_CONFIG, API_ERROR_MESSAGES } from '../config/api';

export interface PatientMeasurement {
  weight_kg: number;
  height_cm: number;
  scr_mg_dl: number;
  egfr: number;
  crcl: number;
  crcl_normalized: number;
  bsa: number;
  is_hd: boolean;
}

export interface PatientCreateRequest {
  name: string;
  resident_number: string;
  measurement: PatientMeasurement;
}

export interface PatientResponse {
  id: number;
  name: string;
  sex: string;
  birth_date: string;
  created_at: string;
}

export interface PatientMeasurementResponse {
  id: number;
  weight_kg: number;
  height_cm: number;
  scr_mg_dl: number;
  egfr: number;
  crcl: number;
  crcl_normalized: number;
  bsa: number;
  is_hd: boolean;
  measured_at: string;
  created_at: string;
}

export interface PatientCreateResponse {
  patient: PatientResponse;
  measurement: PatientMeasurementResponse;
  message: string;
}

export interface PatientInfoResponse {
  id: number;
  name: string;
  sex: string;
  birth_date: string;
  created_at: string;
  latest_measurement?: PatientMeasurementResponse;
}

// 약물 관련 인터페이스
export interface DrugSearchResponse {
  found: boolean;
  drug_data?: any;
  message?: string;
}

// 처방 관련 인터페이스
export interface PrescriptionCreateRequest {
  order_id: number;
  drug_id?: number;
  drug_korean_name: string;
  drug_ingredient: string;
  dose_amount: string;
  dose_unit: string;
  real_amount?: number;
  doses_per_day: number;
  duration_days: number;
}

export interface PrescriptionInputRequest {
  patient_id: number;
  medications: PrescriptionCreateRequest[];
}

export interface PrescriptionResponse {
  id: number;
  order_id: number;
  drug_id?: number;
  drug_korean_name: string;
  drug_ingredient: string;
  dose_amount: string;
  dose_unit: string;
  real_amount?: number;
  doses_per_day: number;
  duration_days: number;
  audit_result: string;
  information: string;
  created_at: string;
}

export interface PrescriptionInputResponse {
  success: boolean;
  patient_id?: number;
  order_id?: number;
  prescriptions: PrescriptionResponse[];
  message: string;
  note?: string;  // 처방 주문의 note (정상/이상)
}

// 감사 관련 인터페이스
export interface AuditHistoryResponse {
  id: number;
  patient_name: string;
  created_at: string;
  prescriptions: PrescriptionResponse[];
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_CONFIG.BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // 환자 생성 (본인인증 완료 후)
  async createPatientWithMeasurement(data: PatientCreateRequest): Promise<PatientCreateResponse> {
    return this.request<PatientCreateResponse>('/api/patients/with-measurement', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // 모든 환자 조회
  async getAllPatients(skip: number = 0, limit: number = 20): Promise<PatientInfoResponse[]> {
    return this.request<PatientInfoResponse[]>(`/api/patients?skip=${skip}&limit=${limit}`);
  }

  // 환자 정보 조회
  async getPatientInfo(patientId: number): Promise<PatientInfoResponse> {
    return this.request<PatientInfoResponse>(`/api/patients/${patientId}`);
  }

  // 주민등록번호로 환자 검색
  async searchPatientByResident(residentNumber: string): Promise<{ found: boolean; patient?: PatientInfoResponse; message: string }> {
    return this.request(`/api/patients/search/resident/${residentNumber}`);
  }

  // 환자 검사수치 추가
  async addPatientMeasurement(patientId: number, measurement: PatientMeasurement): Promise<PatientMeasurementResponse> {
    return this.request<PatientMeasurementResponse>(`/api/patients/${patientId}/measurements`, {
      method: 'POST',
      body: JSON.stringify(measurement),
    });
  }

  // ===== 약물 관련 API =====
  
  // 약물 검색 (자동완성)
  async searchDrugs(query: string): Promise<string[]> {
    return this.request<string[]>(`${API_CONFIG.ENDPOINTS.DRUGS.SEARCH}?query=${encodeURIComponent(query)}`);
  }

  // 약물 상세 정보 조회
  async getDrugDetails(drugName: string): Promise<any> {
    return this.request<any>(`${API_CONFIG.ENDPOINTS.DRUGS.DETAILS}?drug_name=${encodeURIComponent(drugName)}`);
  }

  // 배치 약물 검색
  async batchSearchDrugs(drugNames: string[]): Promise<DrugSearchResponse[]> {
    return this.request<DrugSearchResponse[]>(API_CONFIG.ENDPOINTS.DRUGS.BATCH_SEARCH, {
      method: 'POST',
      body: JSON.stringify({ drug_names: drugNames }),
    });
  }

  // ===== 환자 관련 API =====

  // 환자 정보로 검색
  async searchPatientByInfo(name: string, birthDate: string, sex: string): Promise<{ found: boolean; patient?: PatientInfoResponse; message: string }> {
    const params = { name, birth_date: birthDate, sex };
    return this.request(`${API_CONFIG.ENDPOINTS.PATIENTS.SEARCH_INFO}?${new URLSearchParams(params)}`);
  }

  // 환자 중복 체크
  async checkPatientDuplicate(name: string, birthDate: string, sex: string): Promise<{ is_duplicate: boolean; message: string; patient_id?: number; patient_name?: string }> {
    const params = { name, birth_date: birthDate, sex };
    return this.request(`/api/patients/check-duplicate?${new URLSearchParams(params)}`);
  }

  // 환자+검사수치 직접 생성 (NewAudit용)
  async createPatientWithMeasurementDirect(patientData: any): Promise<any> {
    return this.request<any>(API_CONFIG.ENDPOINTS.PATIENTS.WITH_MEASUREMENT_DIRECT, {
      method: 'POST',
      body: JSON.stringify(patientData),
    });
  }

  // ===== 처방 관련 API =====

  // 환자ID로 처방주문 생성
  async createPrescriptionOrderWithPatientId(patientId: number): Promise<any> {
    return this.request<any>(API_CONFIG.ENDPOINTS.PRESCRIPTIONS.ORDERS_WITH_PATIENT_ID, {
      method: 'POST',
      body: JSON.stringify({ patient_id: patientId }),
    });
  }

  // 환자ID로 처방 입력
  async inputPrescriptionWithPatientId(request: PrescriptionInputRequest): Promise<PrescriptionInputResponse> {
    return this.request<PrescriptionInputResponse>(API_CONFIG.ENDPOINTS.PRESCRIPTIONS.INPUT_WITH_PATIENT_ID, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // 배치 처방 생성
  async createPrescriptionsBatch(prescriptions: PrescriptionCreateRequest[]): Promise<PrescriptionResponse[]> {
    return this.request<PrescriptionResponse[]>(API_CONFIG.ENDPOINTS.PRESCRIPTIONS.BATCH, {
      method: 'POST',
      body: JSON.stringify(prescriptions),
    });
  }

  // 처방주문 조회
  async getPrescriptionOrder(orderId: number): Promise<any> {
    return this.request<any>(`${API_CONFIG.ENDPOINTS.PRESCRIPTIONS.ORDER_BY_ID}/${orderId}`);
  }

  // ===== 감사 관련 API =====

  // 감사 이력 조회
  async getAuditHistory(): Promise<AuditHistoryResponse[]> {
    return this.request<AuditHistoryResponse[]>(API_CONFIG.ENDPOINTS.AUDIT.HISTORY);
  }

  // 감사 실행
  async executeAudit(auditRequest: any): Promise<any> {
    return this.request<any>(API_CONFIG.ENDPOINTS.AUDIT.EXECUTE, {
      method: 'POST',
      body: JSON.stringify(auditRequest),
    });
  }
}

export const apiService = new ApiService();
export default apiService; 