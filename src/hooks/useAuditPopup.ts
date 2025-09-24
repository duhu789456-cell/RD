import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface PatientInfo {
  name: string;
  gender: string;
  birthDate: string;
  weight: string;
  height: string;
  scr: string;
  crcl: string;
  crclNormalized: string;
  egfr: string;
  bsa: string;
  isOnDialysis: boolean;
}

interface Prescription {
  id: number;
  drug_korean_name: string;
  audit_result: string;
  information?: string;
  dose_amount?: string;
  dose_unit?: string;
  doses_per_day?: number;
  duration_days?: number;
}

interface AuditPopupData {
  patientInfo: PatientInfo;
  prescriptions: Prescription[];
}

interface UseAuditPopupOptions {
  autoNavigate?: boolean; // NewAudit에서만 true
  navigatePath?: string;  // 기본값: '/'
}

export const useAuditPopup = (options: UseAuditPopupOptions = {}) => {
  const { autoNavigate = false, navigatePath = '/' } = options;
  const navigate = useNavigate();
  
  const [showAuditPopup, setShowAuditPopup] = useState(false);
  const [auditPopupData, setAuditPopupData] = useState<AuditPopupData | null>(null);

  // 팝업 열기
  const openAuditPopup = useCallback((data: AuditPopupData) => {
    setAuditPopupData(data);
    setShowAuditPopup(true);
  }, []);

  // 팝업 닫기
  const closeAuditPopup = useCallback(() => {
    setShowAuditPopup(false);
    setAuditPopupData(null);
    
    if (autoNavigate) {
      navigate(navigatePath);
    }
  }, [autoNavigate, navigatePath, navigate]);

  // 팝업 상태 초기화
  const resetAuditPopup = useCallback(() => {
    setShowAuditPopup(false);
    setAuditPopupData(null);
  }, []);

  return {
    showAuditPopup,
    auditPopupData,
    openAuditPopup,
    closeAuditPopup,
    resetAuditPopup
  };
}; 