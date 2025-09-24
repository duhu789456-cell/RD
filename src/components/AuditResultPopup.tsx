import React, { useState } from 'react';
import './AuditResultPopup.css';

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

interface MedicationInfo {
  id: string;
  productName: string;
  ingredientName: string;
  dosage: string;
  frequency: string;
  duration: string;
  unit?: string;
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
  audit_comment?: string; // 감사 의견 (DB에서 가져올 수 있는 경우)
}

type AuditResultType = '금기' | '용량조절필요' | '투여간격조절필요' | '-' | '정상';

interface AuditResultInfo {
  icon: string;
  label: string;
  badgeClass: string;
  description: string;
}

interface AuditResultPopupProps {
  isOpen: boolean;
  onClose: () => void;
  patientInfo: PatientInfo;
  prescriptions: Prescription[];
  medications?: MedicationInfo[]; // NewAudit에서만 사용
}

const AuditResultPopup: React.FC<AuditResultPopupProps> = ({ 
  isOpen, 
  onClose, 
  patientInfo, 
  prescriptions,
  medications = [] 
}) => {
  const [showFaxModal, setShowFaxModal] = useState(false);
  const [selectedPrescriptions, setSelectedPrescriptions] = useState<number[]>([]);

  // 감사 결과별 정보 매핑 (DB 데이터 우선, 기본값은 fallback)
  const getAuditResultInfo = (prescription: Prescription): AuditResultInfo => {
    const getBaseInfo = (result: string) => {
      switch (result) {
        case '금기':
          return {
            icon: '🚫',
            label: '금기',
            badgeClass: 'contraindicated',
            description: '이 약물은 현재 상황에서 사용이 금기됩니다.'
          };
        case '용량조절필요':
          return {
            icon: '⚠️',
            label: '용량조절필요',
            badgeClass: 'dose-adjustment',
            description: '환자의 상태에 따라 용량 조절이 필요합니다.'
          };
        case '투여간격조절필요':
          return {
            icon: '⏰',
            label: '투여간격조절필요',
            badgeClass: 'interval-adjustment',
            description: '투여 간격을 조절해야 합니다.'
          };
        case '정상':
        case '-':
          return {
            icon: '✅',
            label: '정상',
            badgeClass: 'normal',
            description: '처방이 정상입니다.'
          };
        default:
          return {
            icon: '❓',
            label: '알 수 없음',
            badgeClass: 'unknown',
            description: '감사 결과를 확인할 수 없습니다.'
          };
      }
    };

    // DB에서 가져온 정보가 있으면 우선 사용
    if (prescription.information) {
      const baseInfo = getBaseInfo(prescription.audit_result);
      return {
        ...baseInfo,
        description: prescription.information
      };
    }

    // 기본 정보 반환
    return getBaseInfo(prescription.audit_result);
  };

  // 기본 설명 생성 함수
  const getDefaultDescription = (auditResult: string): string => {
    switch (auditResult) {
      case '금기':
        return '이 약물은 현재 상황에서 사용이 금기됩니다.';
      case '용량조절필요':
        return '환자의 상태에 따라 용량 조절이 필요합니다.';
      case '투여간격조절필요':
        return '투여 간격을 조절해야 합니다.';
      case '정상':
      case '-':
        return '처방이 정상입니다.';
      default:
        return '감사 결과를 확인할 수 없습니다.';
    }
  };

  // 팝업 제목 생성
  const getPopupTitle = () => {
    const hasIssues = prescriptions.some(p => p.audit_result !== '-' && p.audit_result !== '정상');
    return hasIssues ? '⚠️ 처방 이상 사항' : '✅ 처방 감사 결과';
  };

  // 섹션 제목 생성
  const getSectionTitle = () => {
    const hasIssues = prescriptions.some(p => p.audit_result !== '-' && p.audit_result !== '정상');
    const issueCount = prescriptions.filter(p => p.audit_result !== '-' && p.audit_result !== '정상').length;
    
    if (hasIssues) {
      return `처방 이상 사항 (${issueCount}건)`;
    }
    return '처방 감사 결과 (모두 정상)';
  };

  // 나이 계산 함수
  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
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

  // FAX 보내기 함수
  const handleSendFax = () => {
    setShowFaxModal(true);
  };

  const handleCloseFaxModal = () => {
    setShowFaxModal(false);
    setSelectedPrescriptions([]);
  };

  const handlePrescriptionToggle = (prescriptionId: number) => {
    setSelectedPrescriptions(prev => 
      prev.includes(prescriptionId) 
        ? prev.filter(id => id !== prescriptionId)
        : [...prev, prescriptionId]
    );
  };

  const handleGenerateFaxReport = () => {
    if (selectedPrescriptions.length === 0) {
      alert('선택된 처방이 없습니다. 하나 이상의 처방을 선택해주세요.');
      return;
    }
    
    const selectedPrescriptionData = prescriptions.filter(p => 
      selectedPrescriptions.includes(p.id || 0)
    );
    
    const faxContent = generateFaxContent(selectedPrescriptionData);
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>처방 감사 결과 FAX</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .patient-info { margin-bottom: 20px; }
              .prescription-item { margin-bottom: 15px; border: 1px solid #ccc; padding: 10px; }
              .issue-badge { padding: 5px 10px; border-radius: 15px; color: white; font-weight: bold; }
              .contraindicated { background: #e74c3c; }
              .dose-adjustment { background: #f39c12; }
              .interval-adjustment { background: #3498db; }
              .normal { background: #27ae60; }
              table { width: 100%; border-collapse: collapse; margin: 10px 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
              th { background: #f2f2f2; }
              @media print { body { font-size: 12px; } }
            </style>
          </head>
          <body>
            ${faxContent}
            <script>
              window.onload = function() {
                window.print();
              }
            </script>
          </body>
        </html>
      `);
      newWindow.document.close();
    }
    
    handleCloseFaxModal();
  };

  // FAX 내용 생성 함수
  const generateFaxContent = (selectedPrescriptions?: Prescription[]) => {
    const prescriptionsToUse = selectedPrescriptions || prescriptions;
    const hasIssues = prescriptionsToUse.some(p => p.audit_result !== '-' && p.audit_result !== '정상');
    const issueCount = prescriptionsToUse.filter(p => p.audit_result !== '-' && p.audit_result !== '정상').length;
    
    return `
      <div class="header">
        <h1>${hasIssues ? '⚠️ 처방 이상 사항 보고서' : '✅ 처방 감사 결과 보고서'}</h1>
        <p>생성일시: ${new Date().toLocaleString('ko-KR')}</p>
      </div>
      
      <div class="patient-info">
        <h2>환자 정보</h2>
        <table>
          <tr>
            <th>환자</th>
            <td colspan="3">${patientInfo.name || '미입력'} (${calculateAge(patientInfo.birthDate)}세/${patientInfo.gender === 'male' ? '남' : '여'})</td>
            <th>체중</th>
            <td>${patientInfo.weight && patientInfo.weight !== '-' ? `${patientInfo.weight} kg` : '-'}</td>
            <th>키</th>
            <td>${patientInfo.height && patientInfo.height !== '-' ? `${patientInfo.height} cm` : '-'}</td>
          </tr>
          <tr>
            <th>SCr (mg/dL)</th>
            <td>${patientInfo.isOnDialysis ? "투석 중" : (patientInfo.scr && patientInfo.scr !== '-' ? patientInfo.scr : "-")}</td>
            <th>eGFR (mL/min/1.73m²)</th>
            <td>${patientInfo.isOnDialysis ? "투석 중" : (patientInfo.egfr && patientInfo.egfr !== '-' ? patientInfo.egfr : "-")}</td>
            <th>CrCl (mL/min)</th>
            <td>${patientInfo.isOnDialysis ? "투석 중" : (patientInfo.crcl && patientInfo.crcl !== '-' ? patientInfo.crcl : "-")}</td>
            <th>정규화CrCl (mL/min/1.73m²)</th>
            <td>${patientInfo.isOnDialysis ? "투석 중" : (patientInfo.crclNormalized && patientInfo.crclNormalized !== '-' ? patientInfo.crclNormalized : "-")}</td>
          </tr>
        </table>
      </div>
      
      <div class="prescriptions">
        <h2>처방 감사 결과 (총 ${prescriptionsToUse.length}건${hasIssues ? `, 이상 ${issueCount}건` : ', 모두 정상'})</h2>
        ${prescriptionsToUse
          .sort((a, b) => {
            const aIsNormal = a.audit_result === '-' || a.audit_result === '정상';
            const bIsNormal = b.audit_result === '-' || b.audit_result === '정상';
            if (aIsNormal && !bIsNormal) return 1;
            if (!aIsNormal && bIsNormal) return -1;
            return 0;
          })
          .map((prescription, index) => {
            const auditInfo = getAuditResultInfo(prescription);
            const isNormal = prescription.audit_result === '-' || prescription.audit_result === '정상';
            
            return `
              <div class="prescription-item">
                <h3>${prescription.drug_korean_name}</h3>
                <span class="issue-badge ${auditInfo.badgeClass}">${auditInfo.icon} ${auditInfo.label}</span>
                <table>
                  <tr>
                    <th>1회 투약용량</th>
                    <td>${prescription.dose_amount && prescription.dose_unit ? `${prescription.dose_amount} ${prescription.dose_unit}` : '-'}</td>
                    <th>일투수</th>
                    <td>${prescription.doses_per_day ? `${prescription.doses_per_day} 회` : '-'}</td>
                    <th>투약기간</th>
                    <td>${prescription.duration_days ? `${prescription.duration_days} 일` : '-'}</td>
                  </tr>
                  <tr>
                    <th colspan="6">정보</th>
                  </tr>
                  <tr>
                    <td colspan="6">${prescription.information || auditInfo.description}</td>
                  </tr>
                  ${prescription.audit_comment ? `
                    <tr>
                      <th colspan="6">감사 의견</th>
                    </tr>
                    <tr>
                      <td colspan="6">${prescription.audit_comment}</td>
                    </tr>
                  ` : ''}
                </table>
              </div>
            `;
          }).join('')}
      </div>
    `;
  };

  // 팝업이 닫혀있으면 렌더링하지 않음
  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="audit-popup-overlay" onClick={onClose}>
        <div className="audit-popup" onClick={(e) => e.stopPropagation()}>
          <div className="audit-popup-header" style={{position: 'relative'}}>
            <h2>{getPopupTitle()}</h2>
            <button className="close-button" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="patient-info-sticky" style={{position: 'relative'}}>
            <table className="patient-info-table">
              <tbody>
                <tr>
                  <th>환자</th>
                  <td colSpan={3}>
                    <strong>
                      {patientInfo.name || '미입력'}
                      {patientInfo.birthDate && ` (${calculateAge(patientInfo.birthDate)}세)`}
                      {patientInfo.gender && `/${patientInfo.gender === 'male' ? '남' : '여'}`}
                    </strong>
                  </td>
                  <th>체중</th>
                  <td>
                    {patientInfo.weight && patientInfo.weight !== '-' ? `${patientInfo.weight} kg` : '-'}
                  </td>
                  <th>키</th>
                  <td>
                    {patientInfo.height && patientInfo.height !== '-' ? `${patientInfo.height} cm` : '-'}
                  </td>
                </tr>
                <tr>
                  <th>SCr <span className="unit">(mg/dL)</span></th>
                  <td>{patientInfo.isOnDialysis ? "투석 중" : (patientInfo.scr && patientInfo.scr !== '-' ? patientInfo.scr : "-")}</td>
                  <th>eGFR <span className="unit">(mL/min/1.73m<sup>2</sup>)</span></th>
                  <td>{patientInfo.isOnDialysis ? "투석 중" : (patientInfo.egfr && patientInfo.egfr !== '-' ? patientInfo.egfr : "-")}</td>
                  <th>CrCl <span className="unit">(mL/min)</span></th>
                  <td>{patientInfo.isOnDialysis ? "투석 중" : (patientInfo.crcl && patientInfo.crcl !== '-' ? patientInfo.crcl : "-")}</td>
                  <th>정규화CrCl <span className="unit">(mL/min/1.73m<sup>2</sup>)</span></th>
                  <td>{patientInfo.isOnDialysis ? "투석 중" : (patientInfo.crclNormalized && patientInfo.crclNormalized !== '-' ? patientInfo.crclNormalized : "-")}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="audit-popup-content">
            <div className="prescription-issues-section">
              <h3>{getSectionTitle()}</h3>
              <div className="prescription-issues-list">
                {prescriptions
                  .sort((a, b) => {
                    // 정상 처방을 맨 아래로 정렬
                    const aIsNormal = a.audit_result === '-' || a.audit_result === '정상';
                    const bIsNormal = b.audit_result === '-' || b.audit_result === '정상';
                    
                    if (aIsNormal && !bIsNormal) return 1;  // a가 정상이면 뒤로
                    if (!aIsNormal && bIsNormal) return -1; // b가 정상이면 뒤로
                    return 0; // 둘 다 정상이거나 둘 다 이상이면 순서 유지
                  })
                  .map((prescription: any, index: number) => {
                    const auditInfo = getAuditResultInfo(prescription);
                    const isNormal = prescription.audit_result === '-' || prescription.audit_result === '정상';
                    
                    return (
                      <div key={prescription.id || index} className={`prescription-issue-item ${isNormal ? 'normal-item' : ''}`}>
                        <div className="issue-header">
                          <span className="drug-name">{prescription.drug_korean_name}</span>
                          <span className={`issue-badge ${auditInfo.badgeClass}`}>
                            {auditInfo.icon} {auditInfo.label}
                          </span>
                        </div>
                        <div className="issue-details">
                          <table className="mini-prescription-table">
                            <tbody>
                              <tr>
                                <th>1회 투약용량</th>
                                <td>
                                  {(() => {
                                    // DB 데이터 우선 사용
                                    if (prescription.dose_amount && prescription.dose_unit) {
                                      return `${prescription.dose_amount} ${prescription.dose_unit}`;
                                    }
                                    // NewAudit에서만 사용하는 medications 데이터 fallback
                                    const medication = medications.find(m => m.productName === prescription.drug_korean_name);
                                    if (medication) {
                                      return `${medication.dosage} ${medication.unit || ''}`;
                                    }
                                    return '-';
                                  })()}
                                </td>
                                <th>일투수</th>
                                <td>
                                  {(() => {
                                    // DB 데이터 우선 사용
                                    if (prescription.doses_per_day) {
                                      return `${prescription.doses_per_day} 회`;
                                    }
                                    // NewAudit에서만 사용하는 medications 데이터 fallback
                                    const medication = medications.find(m => m.productName === prescription.drug_korean_name);
                                    if (medication) {
                                      return `${medication.frequency} 회`;
                                    }
                                    return '-';
                                  })()}
                                </td>
                                <th>투약기간</th>
                                <td>
                                  {(() => {
                                    // DB 데이터 우선 사용
                                    if (prescription.duration_days) {
                                      return `${prescription.duration_days} 일`;
                                    }
                                    // NewAudit에서만 사용하는 medications 데이터 fallback
                                    const medication = medications.find(m => m.productName === prescription.drug_korean_name);
                                    if (medication) {
                                      return `${medication.duration} 일`;
                                    }
                                    return '-';
                                  })()}
                                </td>
                              </tr>
                              <tr>
                                <th>정보</th>
                                <td colSpan={5}>
                                  {prescription.information || auditInfo.description}
                                </td>
                              </tr>
                              {prescription.audit_comment && (
                                <tr>
                                  <th>감사 의견</th>
                                  <td colSpan={5}>
                                    {prescription.audit_comment}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
          <div className="audit-popup-footer">
            <button className="btn-confirm" onClick={onClose}>
              확인
            </button>
            <button className="btn-fax" onClick={handleSendFax}>
              📠 FAX 보내기
            </button>
          </div>
        </div>
      </div>
      
      {/* FAX 모달 */}
      {showFaxModal && (
        <div className="audit-popup-overlay" onClick={handleCloseFaxModal}>
          <div className="fax-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fax-modal-header">
              <h2>📠 FAX 리포트 생성</h2>
              <button className="close-button" onClick={handleCloseFaxModal}>
                ×
              </button>
            </div>
            <div className="fax-modal-content">
              <p>처방 이상이 있는 약물들을 선택하여 FAX 리포트를 생성하세요.</p>
              <div className="prescription-selection-list">
                {prescriptions
                  .filter(p => p.audit_result !== '-' && p.audit_result !== '정상')
                  .map((prescription) => {
                    const auditInfo = getAuditResultInfo(prescription);
                    const isSelected = selectedPrescriptions.includes(prescription.id || 0);
                    
                    return (
                      <div 
                        key={prescription.id} 
                        className={`prescription-selection-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handlePrescriptionToggle(prescription.id || 0)}
                      >
                        <div className="selection-checkbox">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => handlePrescriptionToggle(prescription.id || 0)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="selection-content">
                          <div className="selection-header">
                            <span className="drug-name">{prescription.drug_korean_name}</span>
                            <span className={`issue-badge ${auditInfo.badgeClass}`}>
                              {auditInfo.icon} {auditInfo.label}
                            </span>
                          </div>
                          <div className="selection-details">
                            <span>1회 투약용량: {prescription.dose_amount && prescription.dose_unit ? `${prescription.dose_amount} ${prescription.dose_unit}` : '-'}</span>
                            <span>일투수: {prescription.doses_per_day ? `${prescription.doses_per_day} 회` : '-'}</span>
                            <span>투약기간: {prescription.duration_days ? `${prescription.duration_days} 일` : '-'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            <div className="fax-modal-footer">
              <button className="btn-cancel" onClick={handleCloseFaxModal}>
                취소
              </button>
              <button 
                className="btn-generate-fax" 
                onClick={handleGenerateFaxReport}
                disabled={selectedPrescriptions.length === 0}
              >
                📠 FAX 리포트 생성
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AuditResultPopup; 