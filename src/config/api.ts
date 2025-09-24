// API 설정 파일
export const API_CONFIG = {
  // API 기본 URL
  BASE_URL: 'http://localhost:8000',
  
  // API 엔드포인트들
  ENDPOINTS: {
    // 약물 관련
    DRUGS: {
      SEARCH: '/api/drugs',
      DETAILS: '/api/drugs/details',
      BATCH_SEARCH: '/api/drugs/batch-search'
    },
    
    // 환자 관련
    PATIENTS: {
      LIST: '/api/patients',
      SEARCH_INFO: '/api/patients/search/info',
      SEARCH_RESIDENT: '/api/patients/search/resident',
      WITH_MEASUREMENT_DIRECT: '/api/patients/with-measurement-direct',
      WITH_MEASUREMENT: '/api/patients/with-measurement',
      BY_ID: '/api/patients'
    },
    
    // 처방 관련
    PRESCRIPTIONS: {
      ORDERS: '/api/prescriptions/orders',
      ORDERS_WITH_PATIENT_ID: '/api/prescriptions/orders/with-patient-id',
      INPUT: '/api/prescriptions/input',
      INPUT_WITH_PATIENT_ID: '/api/prescriptions/input/with-patient-id',
      BATCH: '/api/prescriptions/batch',
      ORDER_BY_ID: '/api/prescriptions/orders'
    },
    
    // 감사 관련
    AUDIT: {
      EXECUTE: '/api/audit/execute',
      HISTORY: '/api/audit/history'
    }
  }
};

// API URL 생성 헬퍼 함수
export const createApiUrl = (endpoint: string, params?: Record<string, string>): string => {
  let url = `${API_CONFIG.BASE_URL}${endpoint}`;
  
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }
  
  return url;
};

// API 요청 기본 설정
export const API_DEFAULT_CONFIG = {
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10초
};

// 에러 메시지
export const API_ERROR_MESSAGES = {
  NETWORK_ERROR: '네트워크 연결에 실패했습니다.',
  TIMEOUT_ERROR: '요청 시간이 초과되었습니다.',
  SERVER_ERROR: '서버 오류가 발생했습니다.',
  NOT_FOUND: '요청한 리소스를 찾을 수 없습니다.',
  UNAUTHORIZED: '인증이 필요합니다.',
  FORBIDDEN: '접근 권한이 없습니다.',
  VALIDATION_ERROR: '입력 데이터가 올바르지 않습니다.',
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.'
}; 