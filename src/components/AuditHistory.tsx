import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuditResultPopup from './AuditResultPopup';
import './AuditHistory.css';
import { useAuditPopup } from '../hooks/useAuditPopup';

interface Prescription {
  id: number;
  drug_name: string;
  audit_result: string;
  information?: string;
  dose_amount?: string;
  dose_unit?: string;
  doses_per_day?: number;
  duration_days?: number;
}

interface Patient {
  id: number;
  name: string;
  sex: string;
  birth_date: string;
}

interface Measurement {
  weight_kg: number;
  height_cm: number;
  scr_mg_dl: number;
  bsa: number;
  egfr: number;
  crcl: number;
  crcl_normalized: number;
  is_hd: boolean;
  measured_at: string;
}

interface AuditRecord {
  order_id: number;
  patient_id: number;
  patient_name: string;
  submitted_at: string;
  prescription_count: number;
  prescriptions: Prescription[];
  patient: Patient;
  measurement?: Measurement;
}

interface AuditHistoryProps {
}

const AuditHistory: React.FC<AuditHistoryProps> = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAudit, setSelectedAudit] = useState<AuditRecord | null>(null);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(30);
  const [showLoadMore, setShowLoadMore] = useState(true);
  // 감사 결과 팝업 관련 상태 (커스텀 훅 사용)
  const { showAuditPopup, auditPopupData, openAuditPopup, closeAuditPopup } = useAuditPopup();

  // 나이 계산 함수
  const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  // 성별 표시 함수
  const formatGender = (sex: string): string => {
    return sex === 'M' ? '남' : sex === 'F' ? '여' : '알 수 없음';
  };

  // 백엔드 API에서 처방 이력 가져오기
  useEffect(() => {
    const fetchAuditHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:8000/api/audit/history');
        
        if (!response.ok) {
          throw new Error('처방 이력을 가져오는데 실패했습니다.');
        }
        
        const data = await response.json();
        const records = data.history || [];

        setAuditRecords(records);
        setError(null);
      } catch (err) {
        console.error('처방 이력 조회 오류:', err);
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        setAuditRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAuditHistory();
  }, []);

  // 검색어나 필터가 변경될 때 표시 개수 초기화
  useEffect(() => {
    setDisplayCount(30);
  }, [searchTerm, statusFilter]);

  const filteredRecords = auditRecords.filter(record => {
    const matchesSearch = searchTerm === '' || 
                         record.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         record.order_id.toString().includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'completed' && record.prescriptions.every(p => p.audit_result === '-')) ||
                         (statusFilter === 'pending' && record.prescriptions.some(p => p.audit_result === '대기중')) ||
                         (statusFilter === 'failed' && record.prescriptions.some(p => p.audit_result !== '-' && p.audit_result !== '대기중'));
    return matchesSearch && matchesStatus;
  });

  // 표시할 레코드 수 제한
  const displayedRecords = filteredRecords.slice(0, displayCount);
  const hasMoreRecords = filteredRecords.length > displayCount;

  const getStatusBadge = (record: AuditRecord) => {
    const hasAbnormal = record.prescriptions.some(p => p.audit_result !== '-' && p.audit_result !== '대기중');
    const hasPending = record.prescriptions.some(p => p.audit_result === '대기중');
    
    if (hasPending) {
      return <span className="status-badge pending">대기중</span>;
    } else if (hasAbnormal) {
      return <span className="status-badge failed">이상</span>;
    } else {
      return <span className="status-badge completed">정상</span>;
    }
  };

  const getAbnormalCount = (record: AuditRecord) => {
    return record.prescriptions.filter(p => p.audit_result !== '-' && p.audit_result !== '대기중').length;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleAuditSelect = (audit: AuditRecord) => {
    setSelectedAudit(selectedAudit?.order_id === audit.order_id ? null : audit);
  };

  const handleViewDetails = (audit: AuditRecord) => {
    const patientInfo = convertToPatientInfo(audit);
    const prescriptions = convertToPopupPrescriptions(audit.prescriptions);
    
    openAuditPopup({
      patientInfo,
      prescriptions
    });
  };

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 30);
  };

  // AuditResultPopup용 환자 정보 변환
  const convertToPatientInfo = (audit: AuditRecord) => {
    if (!audit.measurement) {
      return {
        name: audit.patient.name,
        gender: audit.patient.sex === 'M' ? 'male' : 'female',
        birthDate: audit.patient.birth_date,
        weight: '-',
        height: '-',
        scr: '-',
        crcl: '-',
        crclNormalized: '-',
        egfr: '-',
        bsa: '-',
        isOnDialysis: false
      };
    }

    return {
      name: audit.patient.name,
      gender: audit.patient.sex === 'M' ? 'male' : 'female',
      birthDate: audit.patient.birth_date,
      weight: audit.measurement.weight_kg?.toString() || '-',
      height: audit.measurement.height_cm?.toString() || '-',
      scr: audit.measurement.is_hd ? '투석 중' : (audit.measurement.scr_mg_dl?.toString() || '-'),
      crcl: audit.measurement.is_hd ? '투석 중' : (audit.measurement.crcl?.toString() || '-'),
      crclNormalized: audit.measurement.is_hd ? '투석 중' : (audit.measurement.crcl_normalized?.toString() || '-'),
      egfr: audit.measurement.is_hd ? '투석 중' : (audit.measurement.egfr?.toString() || '-'),
      bsa: audit.measurement.bsa?.toString() || '-',
      isOnDialysis: audit.measurement.is_hd
    };
  };

  // AuditResultPopup용 처방 정보 변환
  const convertToPopupPrescriptions = (prescriptions: Prescription[]) => {
    return prescriptions.map(p => ({
      id: p.id,
      drug_korean_name: p.drug_name,
      audit_result: p.audit_result,
      information: p.information,
      dose_amount: p.dose_amount,
      dose_unit: p.dose_unit,
      doses_per_day: p.doses_per_day,
      duration_days: p.duration_days
    }));
  };

  if (loading) {
    return (
      <div className="audit-history-container">
        <div className="audit-history-header">
          <h1>📊 처방 감사 이력 관리</h1>
          <p>약사용 RenalDose 처방 적정성 평가 이력을 확인하고 관리하세요</p>
        </div>
        <div className="loading-message">
          <p>처방 이력을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="audit-history-container">
        <div className="audit-history-header">
          <h1>📊 처방 감사 이력 관리</h1>
          <p>약사용 RenalDose 처방 적정성 평가 이력을 확인하고 관리하세요</p>
        </div>
        <div className="error-message">
          <p>오류: {error}</p>
          <button onClick={() => window.location.reload()}>다시 시도</button>
        </div>
      </div>
    );
  }

  return (
    <div className="audit-history-container">
      <div className="audit-history-header">
        <h1>📊 처방 감사 이력 관리</h1>
        <p>약사용 RenalDose 처방 적정성 평가 이력을 확인하고 관리하세요</p>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="환자명으로 검색하세요..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-box">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
          >
            <option value="all">전체 상태</option>
            <option value="completed">정상</option>
            <option value="pending">대기중</option>
            <option value="failed">이상</option>
          </select>
        </div>
      </div>

      <div className="audit-content">
        {filteredRecords.length === 0 ? (
          <div className="no-audits">
            <p>
              {searchTerm ? `"${searchTerm}"에 대한 검색 결과가 없습니다.` : '처방 감사 이력이 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="audit-table">
            <div className="table-header">
              <div className="header-cell">주문 ID</div>
              <div className="header-cell">환자명</div>
              <div className="header-cell">나이/성별</div>
              <div className="header-cell">총 약물 수</div>
              <div className="header-cell">부적절 처방</div>
              <div className="header-cell">감사 시간</div>
              <div className="header-cell">상태</div>
              <div className="header-cell">액션</div>
            </div>
            
            <div className="table-body">
              {displayedRecords.map(audit => (
                <div
                  key={audit.order_id}
                  className={`table-row ${selectedAudit?.order_id === audit.order_id ? 'selected' : ''}`}
                  onClick={() => handleAuditSelect(audit)}
                >
                  <div className="table-cell">#{audit.order_id}</div>
                  <div className="table-cell patient-name">{audit.patient_name}</div>
                  <div className="table-cell">
                    {calculateAge(audit.patient.birth_date)}세 / {formatGender(audit.patient.sex)}
                  </div>
                  <div className="table-cell">{audit.prescription_count}개</div>
                  <div className={`table-cell ${getAbnormalCount(audit) > 0 ? 'warning' : 'success'}`}>
                    {getAbnormalCount(audit)}개
                  </div>
                  <div className="table-cell">{formatDate(audit.submitted_at)}</div>
                  <div className="table-cell">
                    {getStatusBadge(audit)}
                  </div>
                  <div className="table-cell">
                    <button 
                      className="action-btn view-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails(audit);
                      }}
                    >
                      상세보기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasMoreRecords && (
          <div className="load-more-section">
            <button className="load-more-btn" onClick={handleLoadMore}>
              더보기 ({displayedRecords.length} / {filteredRecords.length})
            </button>
          </div>
        )}
      </div>

      <div className="audit-history-actions">
        <button className="btn-secondary" onClick={() => navigate('/')}>
          메인으로 돌아가기
        </button>
      </div>

      {/* 감사 결과 팝업 */}
      {showAuditPopup && auditPopupData && (
        <AuditResultPopup
          isOpen={showAuditPopup}
          onClose={closeAuditPopup}
          patientInfo={auditPopupData.patientInfo}
          prescriptions={auditPopupData.prescriptions}
        />
      )}
    </div>
  );
};

export default AuditHistory; 