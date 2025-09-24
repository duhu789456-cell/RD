import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './PatientManagement.css';
import apiService, { PatientInfoResponse, PatientCreateRequest, PatientMeasurement } from '../services/api';

interface Patient {
  id: string;
  patientId: string;
  name: string;
  birthDate: string;
  gender: string;
  phone: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  medicalHistory: string;
  allergies: string;
  notes: string;
  weight: string;
  height: string;
  scr: string;
  crcl: string;
  crclNormalized: string;
  egfr: string;
  bsa: string;
  isOnDialysis: boolean;
}

interface IdentityVerification {
  name: string;
  residentNumberFront: string;
  residentNumberBack: string;
  verificationCode: string;
  isVerified: boolean;
}



const PatientManagement: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'add' | 'edit'>('add');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [verificationStep, setVerificationStep] = useState<'input' | 'verify' | 'complete'>('input');
  const [identityVerification, setIdentityVerification] = useState<IdentityVerification>({
    name: '',
    residentNumberFront: '',
    residentNumberBack: '',
    verificationCode: '',
    isVerified: false
  });

  const [generatedPatientId, setGeneratedPatientId] = useState<string>('');
  const [patients, setPatients] = useState<PatientInfoResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 신규 환자 등록용 상태
  const [newPatientData, setNewPatientData] = useState<Patient>({
    id: '',
    patientId: '',
    name: '',
    birthDate: '',
    gender: '',
    phone: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    medicalHistory: '',
    allergies: '',
    notes: '',
    weight: '',
    height: '',
    scr: '',
    crcl: '',
    crclNormalized: '',
    egfr: '',
    bsa: '',
    isOnDialysis: false
  });

  // 환자 정보 수정용 상태
  const [editPatientData, setEditPatientData] = useState<Patient>({
    id: '',
    patientId: '',
    name: '',
    birthDate: '',
    gender: '',
    phone: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    medicalHistory: '',
    allergies: '',
    notes: '',
    weight: '',
    height: '',
    scr: '',
    crcl: '',
    crclNormalized: '',
    egfr: '',
    bsa: '',
    isOnDialysis: false
  });

  const filteredPatients = patients.filter(patient =>
    patient.name.includes(searchTerm) || patient.id.toString().includes(searchTerm)
  );

  const handlePatientSelect = (patient: PatientInfoResponse) => {
    setSelectedPatient({
      id: patient.id.toString(),
      patientId: patient.id.toString(),
      name: patient.name,
      birthDate: patient.birth_date,
      gender: patient.sex === 'M' ? 'male' : 'female',
      phone: '',
      address: '',
      emergencyContact: '',
      emergencyPhone: '',
      medicalHistory: '',
      allergies: '',
      notes: '',
      weight: patient.latest_measurement?.weight_kg.toString() || '',
      height: patient.latest_measurement?.height_cm.toString() || '',
      scr: patient.latest_measurement?.scr_mg_dl.toString() || '',
      crcl: patient.latest_measurement?.crcl.toString() || '',
      crclNormalized: patient.latest_measurement?.crcl_normalized.toString() || '',
      egfr: patient.latest_measurement?.egfr.toString() || '',
      bsa: patient.latest_measurement?.bsa.toString() || '',
      isOnDialysis: patient.latest_measurement?.is_hd || false
    });
    setEditPatientData({
      id: patient.id.toString(),
      patientId: patient.id.toString(),
      name: patient.name,
      birthDate: patient.birth_date,
      gender: patient.sex === 'M' ? 'male' : 'female',
      phone: '',
      address: '',
      emergencyContact: '',
      emergencyPhone: '',
      medicalHistory: '',
      allergies: '',
      notes: '',
      weight: patient.latest_measurement?.weight_kg.toString() || '',
      height: patient.latest_measurement?.height_cm.toString() || '',
      scr: patient.latest_measurement?.scr_mg_dl.toString() || '',
      crcl: patient.latest_measurement?.crcl.toString() || '',
      crclNormalized: patient.latest_measurement?.crcl_normalized.toString() || '',
      egfr: patient.latest_measurement?.egfr.toString() || '',
      bsa: patient.latest_measurement?.bsa.toString() || '',
      isOnDialysis: patient.latest_measurement?.is_hd || false
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>, type: 'new' | 'edit') => {
    const { name, value } = e.target;
    if (type === 'new') {
      setNewPatientData(prev => ({
        ...prev,
        [name]: value
      }));
    } else {
      setEditPatientData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleVerificationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // 숫자만 입력 허용 (주민등록번호 필드의 경우)
    const numericValue = name.includes('residentNumber') ? value.replace(/[^0-9]/g, '') : value;
    
    setIdentityVerification(prev => {
      const updated = {
        ...prev,
        [name]: numericValue
      };
      
      // 주민등록번호 앞자리가 6자리로 입력되면 생년월일 자동 설정
      if (name === 'residentNumberFront' && numericValue.length === 6) {
        const year = numericValue.substring(0, 2);
        const month = numericValue.substring(2, 4);
        const day = numericValue.substring(4, 6);
        
        // 뒷자리가 입력되어 있으면 정확한 출생년도 계산
        if (updated.residentNumberBack.length >= 1) {
          const genderDigit = parseInt(updated.residentNumberBack.charAt(0));
          const fullYear = (genderDigit === 1 || genderDigit === 2) ? `19${year}` : `20${year}`;
          const formattedBirthDate = `${fullYear}-${month}-${day}`;
          
          setNewPatientData(prevPatient => ({
            ...prevPatient,
            birthDate: formattedBirthDate
          }));
        }
      }
      
      // 주민등록번호 뒷자리가 7자리로 입력되면 성별 자동 설정
      if (name === 'residentNumberBack' && numericValue.length === 7) {
        const genderDigit = parseInt(numericValue.charAt(0));
        const gender = genderDigit % 2 === 1 ? 'male' : 'female';
        
        // 신규 환자 데이터에 성별 반영
        setNewPatientData(prevPatient => ({
          ...prevPatient,
          gender: gender
        }));
      }
      
      return updated;
    });
  };



  const generatePatientId = () => {
    const year = new Date().getFullYear();
    const existingIds = patients.map(p => p.id.toString());
    let newId = `P${year}001`;
    
    // 기존 ID 중에서 가장 큰 번호 찾기
    const maxNumber = Math.max(...existingIds.map(id => {
      const match = id.match(/P\d{4}(\d{3})/);
      return match ? parseInt(match[1]) : 0;
    }));
    
    const nextNumber = maxNumber + 1;
    newId = `P${year}${nextNumber.toString().padStart(3, '0')}`;
    
    return newId;
  };

  const handleSendVerificationCode = async () => {
    if (!identityVerification.name || !identityVerification.residentNumberFront || !identityVerification.residentNumberBack) {
      alert('이름과 주민등록번호를 모두 입력해주세요.');
      return;
    }

    // 주민등록번호 형식 검증
    const frontPattern = /^\d{6}$/;
    const backPattern = /^\d{7}$/;
    
    if (!frontPattern.test(identityVerification.residentNumberFront)) {
      alert('주민등록번호 앞자리가 올바르지 않습니다. (6자리 숫자)');
      return;
    }
    
    if (!backPattern.test(identityVerification.residentNumberBack)) {
      alert('주민등록번호 뒷자리가 올바르지 않습니다. (7자리 숫자)');
      return;
    }

    // 주민등록번호에서 생년월일과 성별 추출
    const front = identityVerification.residentNumberFront;
    const back = identityVerification.residentNumberBack;
    
    const year = front.substring(0, 2);
    const month = front.substring(2, 4);
    const day = front.substring(4, 6);
    const genderDigit = parseInt(back.charAt(0)); // 뒷자리 첫 번째 숫자만 사용

    // 성별 판별 (1,3: 남성, 2,4: 여성)
    const sex = genderDigit === 1 || genderDigit === 3 ? 'M' : 'F';

    // 생년도 판별 (1,2: 1900년대, 3,4: 2000년대)
    let fullYear;
    if (genderDigit === 1 || genderDigit === 2) {
      fullYear = `19${year}`;
    } else {
      fullYear = `20${year}`;
    }

    const birthDate = `${fullYear}-${month}-${day}`;

    try {
      // 중복 환자 체크
      const duplicateCheck = await apiService.checkPatientDuplicate(
        identityVerification.name,
        birthDate,
        sex
      );

      if (duplicateCheck.is_duplicate) {
        alert(`이미 등록된 환자입니다.\n환자 ID: ${duplicateCheck.patient_id}\n환자명: ${duplicateCheck.patient_name}`);
        return;
      }

      // 중복 환자가 없으면 본인인증 진행
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      setIdentityVerification(prev => ({
        ...prev,
        verificationCode: verificationCode
      }));
      
      alert(`인증번호 ${verificationCode}가 생성되었습니다. (실제로는 본인인증 서비스로 전송)`);
      setVerificationStep('verify');
      
    } catch (error) {
      console.error('중복 체크 실패:', error);
      alert('회원여부 확인 중 오류가 발생했습니다.');
    }
  };

  const handleVerifyCode = () => {
    // 실제로는 입력된 인증번호와 전송된 인증번호를 비교해야 함
    // 현재는 간단히 항상 성공하도록 구현
    setIdentityVerification(prev => ({
      ...prev,
      isVerified: true
    }));
    
    // 환자 ID 생성
    const patientId = generatePatientId();
    setGeneratedPatientId(patientId);
    
    // 주민등록번호에서 생년월일과 성별 추출
    const front = identityVerification.residentNumberFront;
    const back = identityVerification.residentNumberBack;
    
    const year = front.substring(0, 2);
    const month = front.substring(2, 4);
    const day = front.substring(4, 6);
    const genderDigit = parseInt(back.charAt(0)); // 뒷자리 첫 번째 숫자만 사용

    // 성별 판별 (1,3: 남성, 2,4: 여성)
    const sex = genderDigit === 1 || genderDigit === 3 ? 'M' : 'F';

    // 생년도 판별 (1,2: 1900년대, 3,4: 2000년대)
    let fullYear;
    if (genderDigit === 1 || genderDigit === 2) {
      fullYear = `19${year}`;
    } else {
      fullYear = `20${year}`;
    }

    const formattedBirthDate = `${fullYear}-${month}-${day}`;
    
    // 신규 환자 데이터에 본인인증 정보 반영
    setNewPatientData(prev => ({
      ...prev,
      patientId: patientId,
      name: identityVerification.name,
      birthDate: formattedBirthDate
    }));
    
    setVerificationStep('complete');
    alert('본인인증이 완료되었습니다. 환자 ID가 생성되었습니다.');
  };

  const handleResetVerification = () => {
    setVerificationStep('input');
    setIdentityVerification({
      name: '',
      residentNumberFront: '',
      residentNumberBack: '',
      verificationCode: '',
      isVerified: false
    });
    setGeneratedPatientId('');
  };

  // 신장 기능 계산 함수 (NewAudit.tsx에서 가져옴)
  const calculateKidneyFunction = (scr: number, weight: number, height: number, gender: string, birthDate: string) => {
    const age = calculateAge(birthDate);
    
    // Cockcroft-Gault 공식
    let crcl = ((140 - age) * weight) / (72 * scr);
    if (gender === 'female') {
      crcl *= 0.85;
    }
    
    // BSA 정규화 (DuBois & DuBois 공식)
    const bsa = 0.007184 * Math.pow(height, 0.725) * Math.pow(weight, 0.425);
    const crclNormalized = crcl * (1.73 / bsa);
    
    // MDRD 공식으로 eGFR 계산
    let egfr = 175 * Math.pow(scr, -1.154) * Math.pow(age, -0.203);
    if (gender === 'female') {
      egfr *= 0.742;
    }
    
    return {
      crcl: crcl.toFixed(1),
      crclNormalized: crclNormalized.toFixed(1),
      egfr: egfr.toFixed(1),
      bsa: bsa.toFixed(3)
    };
  };

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

  // 환자 정보 변경 처리 (신장 기능 자동 계산 포함)
  const handlePatientInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const type = (e.target as HTMLInputElement).type;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setNewPatientData(prev => {
      const updated = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
      
      // 체중과 키가 입력되면 BSA 자동 계산
      const weight = parseFloat(updated.weight);
      const height = parseFloat(updated.height);
      let bsa = '';
      
      if (!isNaN(weight) && !isNaN(height)) {
        const bsaValue = 0.007184 * Math.pow(height, 0.725) * Math.pow(weight, 0.425);
        bsa = bsaValue.toFixed(3);
      }
      
      // 체중, 키, SCr, 성별, 생년월일이 모두 입력되었을 때만 신장 기능 계산
      if (updated.weight && updated.height && updated.scr && updated.gender && updated.birthDate && !updated.isOnDialysis) {
        const scr = parseFloat(updated.scr);
        
        if (!isNaN(scr) && !isNaN(weight) && !isNaN(height)) {
          const kidneyFunction = calculateKidneyFunction(scr, weight, height, updated.gender, updated.birthDate);
          return {
            ...updated,
            bsa,
            crcl: kidneyFunction.crcl,
            crclNormalized: kidneyFunction.crclNormalized,
            egfr: kidneyFunction.egfr
          };
        }
      }
      
      // 필수 입력값 중 하나라도 누락되면 신기능 값들을 초기화
      return {
        ...updated,
        bsa,
        crcl: '',
        crclNormalized: '',
        egfr: ''
      };
    });
  };

  const handleNewPatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!identityVerification.isVerified) {
      alert('본인인증을 먼저 완료해주세요.');
      return;
    }

    // 필수 필드 검증
    if (!newPatientData.weight || !newPatientData.height || (!newPatientData.isOnDialysis && !newPatientData.scr)) {
      alert('체중, 키, 그리고 투석 중이 아닌 경우 SCr을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 주민등록번호에서 생년월일과 성별 추출
      const front = identityVerification.residentNumberFront;
      const back = identityVerification.residentNumberBack;
      
      if (front.length !== 6 || back.length !== 7) {
        alert('주민등록번호 형식이 올바르지 않습니다. (앞 6자리, 뒤 7자리)');
        return;
      }

      const year = front.substring(0, 2);
      const month = front.substring(2, 4);
      const day = front.substring(4, 6);
      const genderDigit = parseInt(back);

      // 성별 판별 (1,3: 남성, 2,4: 여성)
      const sex = genderDigit === 1 || genderDigit === 3 ? 'M' : 'F';

      // 생년도 판별 (1,2: 1900년대, 3,4: 2000년대)
      let fullYear;
      if (genderDigit === 1 || genderDigit === 2) {
        fullYear = `19${year}`;
      } else {
        fullYear = `20${year}`;
      }

      const birthDate = `${fullYear}-${month}-${day}`;

      // 주민등록번호 조합
      const residentNumber = `${identityVerification.residentNumberFront}${identityVerification.residentNumberBack}`;
      
      // 검사수치 데이터 준비
      const measurement: PatientMeasurement = {
        weight_kg: parseFloat(newPatientData.weight),
        height_cm: parseFloat(newPatientData.height),
        scr_mg_dl: newPatientData.isOnDialysis ? 10 : parseFloat(newPatientData.scr),
        egfr: newPatientData.isOnDialysis ? 0 : parseFloat(newPatientData.egfr || '0'),
        crcl: newPatientData.isOnDialysis ? 0 : parseFloat(newPatientData.crcl || '0'),
        crcl_normalized: newPatientData.isOnDialysis ? 0 : parseFloat(newPatientData.crclNormalized || '0'),
        bsa: parseFloat(newPatientData.bsa || '0'),
        is_hd: newPatientData.isOnDialysis
      };

      // API 호출
      const requestData: PatientCreateRequest = {
        name: identityVerification.name,
        resident_number: residentNumber,
        measurement: measurement
      };

      const response = await apiService.createPatientWithMeasurement(requestData);
      
      // 환자 목록 새로고침
      await loadPatients();
      
      // 폼 초기화
      setNewPatientData({
        id: '',
        patientId: '',
        name: '',
        birthDate: '',
        gender: '',
        phone: '',
        address: '',
        emergencyContact: '',
        emergencyPhone: '',
        medicalHistory: '',
        allergies: '',
        notes: '',
        weight: '',
        height: '',
        scr: '',
        crcl: '',
        crclNormalized: '',
        egfr: '',
        bsa: '',
        isOnDialysis: false
      });
      
      // 본인인증 상태 초기화
      handleResetVerification();
      
      alert(`환자가 성공적으로 등록되었습니다.\n환자 ID: ${response.patient.id}\n메인 페이지로 이동합니다.`);
      
      // 메인 페이지로 이동
      navigate('/');
      
    } catch (error) {
      console.error('환자 등록 실패:', error);
      setError(error instanceof Error ? error.message : '환자 등록에 실패했습니다.');
      alert(`환자 등록에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPatientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      alert('환자를 선택해주세요.');
      return;
    }
    
    // 실제로는 백엔드 API를 호출하여 수정해야 함
    alert('환자 정보 수정 기능은 아직 구현되지 않았습니다.');
  };

  // 환자 목록 로드
  const loadPatients = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const patientsData = await apiService.getAllPatients();
      setPatients(patientsData);
    } catch (error) {
      console.error('환자 목록 로드 실패:', error);
      setError(error instanceof Error ? error.message : '환자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 환자 목록 로드
  useEffect(() => {
    loadPatients();
  }, []);

  const handleDelete = () => {
    if (!selectedPatient) {
      alert('환자를 선택해주세요.');
      return;
    }
    
    if (window.confirm('정말로 이 환자를 삭제하시겠습니까?')) {
      // 실제로는 백엔드 API를 호출하여 삭제해야 함
      alert('환자 삭제 기능은 아직 구현되지 않았습니다.');
    }
  };

  return (
    <div className="new-audit-page">
      <div className="container">
        <div className="page-header">
          <h1>📋 환자 정보 관리</h1>
          <p>약사용 RenalDose 처방 적정성 평가를 위한 환자 정보를 관리하세요</p>
        </div>

              <div className="audit-form-container">
          {error && (
            <div style={{ 
              background: '#fee', 
              color: '#c33', 
              padding: '1rem', 
              borderRadius: '8px', 
              marginBottom: '1rem',
              border: '1px solid #fcc'
            }}>
              <strong>오류:</strong> {error}
            </div>
          )}
          
          <div className="tab-navigation">
            <button 
              className={`tab-button ${activeTab === 'add' ? 'active' : ''}`}
              onClick={() => setActiveTab('add')}
            >
              신규 환자 등록
            </button>
            <button 
              className={`tab-button ${activeTab === 'edit' ? 'active' : ''}`}
              onClick={() => setActiveTab('edit')}
            >
              환자 정보 수정
            </button>
          </div>
        <>
          {activeTab === 'add' && (
            <div className="add-patient-section">
              <h3>신규 환자 등록</h3>
              
              {/* 본인인증 단계 표시 */}
              <div className="verification-steps">
                <div className={`step ${verificationStep === 'input' ? 'active' : verificationStep === 'verify' || verificationStep === 'complete' ? 'completed' : ''}`}>
                  <span className="step-number">1</span>
                  <span className="step-text">본인인증</span>
                </div>
                <div className={`step ${verificationStep === 'verify' ? 'active' : verificationStep === 'complete' ? 'completed' : ''}`}>
                  <span className="step-number">2</span>
                  <span className="step-text">인증번호 확인</span>
                </div>
                <div className={`step ${verificationStep === 'complete' ? 'active' : ''}`}>
                  <span className="step-number">3</span>
                  <span className="step-text">환자 정보 입력</span>
                </div>
              </div>

              {/* 본인인증 입력 단계 */}
              {verificationStep === 'input' && (
                <div className="verification-section">
                  <h4>본인인증</h4>
                  <p className="verification-description">
                    환자 등록을 위해 본인인증을 진행해주세요. 인증 완료 후 환자 ID가 자동으로 생성됩니다.
                  </p>
                  
                  <div className="verification-form">
                    <div className="form-group verification-row">
                      <div className="name-group">
                        <label htmlFor="verification-name">이름</label>
                        <input
                          type="text"
                          id="verification-name"
                          name="name"
                          value={identityVerification.name}
                          onChange={handleVerificationInputChange}
                          required
                          placeholder="이름"
                          className="name-input"
                        />
                      </div>
                      
                      <div className="resident-group">
                        <label htmlFor="verification-residentNumber">주민등록번호(외국인등록번호)</label>
                        <div className="resident-number-inputs">
                          <div className="resident-input-wrapper">
                            <input
                              type="text"
                              id="verification-residentNumberFront"
                              name="residentNumberFront"
                              value={identityVerification.residentNumberFront}
                              onChange={handleVerificationInputChange}
                              required
                              placeholder="앞 6자리"
                              maxLength={6}
                              className="patient-resident-number-front"
                            />
                          </div>
                          <span className="resident-number-separator">-</span>
                          <div className="resident-input-wrapper">
                            <input
                              type="password"
                              id="verification-residentNumberBack"
                              name="residentNumberBack"
                              value={identityVerification.residentNumberBack}
                              onChange={handleVerificationInputChange}
                              required
                              placeholder="뒤 7자리"
                              maxLength={7}
                              className="patient-resident-number-back"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="verification-button-row">
                      <button 
                        type="button" 
                        className="btn-verify"
                        onClick={handleSendVerificationCode}
                      >
                        회원여부 확인
                      </button>
                    </div>
                    
                    <div className="info-message">
                      ※ 정확한 실명 조회 및 회원 여부 확인을 위해 주민번호 입력이 필요합니다.
                    </div>
                  </div>
                </div>
              )}

              {/* 인증번호 확인 단계 */}
              {verificationStep === 'verify' && (
                <div className="verification-section">
                  <h4>인증번호 확인</h4>
                  <p className="verification-description">
                    본인인증을 위해 생성된 인증번호를 입력해주세요.
                  </p>
                  
                  <div className="form-group">
                    <label htmlFor="verification-code">인증번호 *</label>
                    <div className="code-input-group">
                      <input
                        type="text"
                        id="verification-code"
                        name="verificationCode"
                        value={identityVerification.verificationCode}
                        onChange={handleVerificationInputChange}
                        required
                        placeholder="6자리 숫자"
                        maxLength={6}
                      />
                      <button 
                        type="button" 
                        className="btn-verify"
                        onClick={handleVerifyCode}
                      >
                        인증확인
                      </button>
                    </div>
                  </div>
                  
                  <div className="verification-actions">
                    <button 
                      type="button" 
                      className="btn-secondary"
                      onClick={handleResetVerification}
                    >
                      처음부터 다시하기
                    </button>
                  </div>
                </div>
              )}

              {/* 환자 정보 입력 단계 */}
              {verificationStep === 'complete' && (
                <div className="audit-form-container">
                  <div className="verification-success">
                    <div className="success-icon">✅</div>
                    <h4>본인인증 완료</h4>
                    <p>환자 ID: <strong>{generatedPatientId}</strong></p>
                  </div>
                  
                  <form onSubmit={handleNewPatientSubmit}>
                    {/* 1. 환자 정보 입력 영역 */}
                    <div className="section">
                      <h2>환자 정보</h2>
                      <div className="patient-info-row">
                        <div className="form-group">
                          <label htmlFor="new-name">이름 (선택)</label>
                          <input
                            type="text"
                            id="new-name"
                            name="name"
                            value={newPatientData.name}
                            readOnly
                            className="readonly-input"
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="new-gender">성별</label>
                          <input
                            type="text"
                            id="new-gender"
                            name="gender"
                            value={newPatientData.gender === 'male' ? '남성' : newPatientData.gender === 'female' ? '여성' : ''}
                            readOnly
                            className="readonly-input"
                            placeholder="주민등록번호에서 자동 설정"
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="new-birthDate">생년월일</label>
                          <input
                            type="text"
                            id="new-birthDate"
                            name="birthDate"
                            value={newPatientData.birthDate}
                            readOnly
                            className="readonly-input"
                            placeholder="주민등록번호에서 자동 설정"
                          />
                        </div>
                      </div>
                      <div className="patient-info-row">
                        <div className="form-group">
                          <label htmlFor="new-weight">체중 (kg)</label>
                          <input
                            type="number"
                            id="new-weight"
                            name="weight"
                            value={newPatientData.weight}
                            onChange={handlePatientInfoChange}
                            placeholder="체중"
                            step="0.1"
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="new-height">키 (cm)</label>
                          <input
                            type="number"
                            id="new-height"
                            name="height"
                            value={newPatientData.height}
                            onChange={handlePatientInfoChange}
                            placeholder="키"
                            step="0.1"
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="new-bsa">BSA (m²)</label>
                          <input
                            type="number"
                            id="new-bsa"
                            name="bsa"
                            value={newPatientData.bsa}
                            onChange={handlePatientInfoChange}
                            placeholder="자동 계산"
                            step="0.001"
                            readOnly
                          />
                        </div>
                      </div>
                      <div className="patient-info-row">
                        <div className="form-group">
                          <label htmlFor="new-scr">SCr (mg/dL)</label>
                          <input
                            type="number"
                            id="new-scr"
                            name="scr"
                            value={newPatientData.isOnDialysis ? "" : newPatientData.scr}
                            onChange={handlePatientInfoChange}
                            placeholder={newPatientData.isOnDialysis ? "투석 중" : "SCr"}
                            step="0.01"
                            disabled={newPatientData.isOnDialysis}
                            className={newPatientData.isOnDialysis ? "disabled" : ""}
                          />
                        </div>
                        <div className="form-group dialysis-form-group dialysis-wide">
                          <label>&nbsp;</label>
                          <div className="dialysis-toggle-inline">
                            <span className="dialysis-inline-label">투석여부</span>
                            <div className="toggle-switch">
                              <input
                                type="checkbox"
                                id="new-isOnDialysis"
                                name="isOnDialysis"
                                checked={newPatientData.isOnDialysis}
                                onChange={handlePatientInfoChange}
                              />
                              <label htmlFor="new-isOnDialysis" className="toggle-label">
                                <span className="toggle-slider"></span>
                              </label>
                              <span className={`toggle-text ${newPatientData.isOnDialysis ? 'active' : ''}`}>
                                {newPatientData.isOnDialysis ? '투석 중' : '투석 안함'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="patient-info-row">
                        <div className="form-group">
                          <label htmlFor="new-egfr">eGFR (mL/min/1.73m²)</label>
                          <input
                            type="number"
                            id="new-egfr"
                            name="egfr"
                            value={newPatientData.egfr}
                            onChange={handlePatientInfoChange}
                            placeholder={newPatientData.isOnDialysis ? "투석 중" : "자동 계산"}
                            step="0.01"
                            readOnly
                            className={newPatientData.isOnDialysis ? "disabled" : ""}
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="new-crcl">CrCl (mL/min)</label>
                          <input
                            type="number"
                            id="new-crcl"
                            name="crcl"
                            value={newPatientData.crcl}
                            onChange={handlePatientInfoChange}
                            placeholder={newPatientData.isOnDialysis ? "투석 중" : "자동 계산"}
                            step="0.01"
                            readOnly
                            className={newPatientData.isOnDialysis ? "disabled" : ""}
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="new-crclNormalized">CrCl (mL/min/1.73m²)</label>
                          <input
                            type="number"
                            id="new-crclNormalized"
                            name="crclNormalized"
                            value={newPatientData.crclNormalized}
                            onChange={handlePatientInfoChange}
                            placeholder={newPatientData.isOnDialysis ? "투석 중" : "자동 계산"}
                            step="0.01"
                            readOnly
                            className={newPatientData.isOnDialysis ? "disabled" : ""}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="audit-actions">
                      <button type="button" className="btn-cancel" onClick={() => navigate('/')}>취소</button>
                      <button 
                        type="submit" 
                        className="btn-audit" 
                        disabled={loading}
                      >
                        {loading ? '등록 중...' : '환자 등록'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {activeTab === 'edit' && (
            <div className="edit-patient-section">
              <div className="search-section">
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="환자명 또는 환자 ID로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>
                
                <div className="patient-list">
                  {loading ? (
                    <p className="no-patients">환자 목록을 불러오는 중...</p>
                  ) : filteredPatients.length === 0 ? (
                    <p className="no-patients">검색 결과가 없습니다.</p>
                  ) : (
                    filteredPatients.map(patient => (
                      <div
                        key={patient.id}
                        className={`patient-item ${selectedPatient?.id === patient.id.toString() ? 'selected' : ''}`}
                        onClick={() => handlePatientSelect(patient)}
                      >
                        <div className="patient-info">
                          <div className="patient-name">{patient.name}</div>
                          <div className="patient-id">ID: {patient.id}</div>
                        </div>
                        <div className="patient-details">
                          <span>{patient.birth_date}</span>
                          <span>{patient.sex === 'M' ? '남성' : '여성'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {selectedPatient && (
                <div className="edit-form-section">
                  <h3>환자 정보 수정</h3>
                  <form className="patient-form" onSubmit={handleEditPatientSubmit}>
                    <div className="form-section">
                      <h4>기본 정보</h4>
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="edit-patientId">환자 ID</label>
                          <input
                            type="text"
                            id="edit-patientId"
                            name="patientId"
                            value={editPatientData.patientId}
                            onChange={(e) => handleInputChange(e, 'edit')}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="edit-name">환자명</label>
                          <input
                            type="text"
                            id="edit-name"
                            name="name"
                            value={editPatientData.name}
                            onChange={(e) => handleInputChange(e, 'edit')}
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="edit-birthDate">생년월일</label>
                          <input
                            type="date"
                            id="edit-birthDate"
                            name="birthDate"
                            value={editPatientData.birthDate}
                            onChange={(e) => handleInputChange(e, 'edit')}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="edit-gender">성별</label>
                          <select
                            id="edit-gender"
                            name="gender"
                            value={editPatientData.gender}
                            onChange={(e) => handleInputChange(e, 'edit')}
                            required
                          >
                            <option value="male">남성</option>
                            <option value="female">여성</option>
                            <option value="other">기타</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="edit-phone">연락처</label>
                        <input
                          type="tel"
                          id="edit-phone"
                          name="phone"
                          value={editPatientData.phone}
                          onChange={(e) => handleInputChange(e, 'edit')}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="edit-address">주소</label>
                        <input
                          type="text"
                          id="edit-address"
                          name="address"
                          value={editPatientData.address}
                          onChange={(e) => handleInputChange(e, 'edit')}
                        />
                      </div>
                    </div>

                    <div className="form-section">
                      <h4>비상 연락처</h4>
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="edit-emergencyContact">비상 연락처명</label>
                          <input
                            type="text"
                            id="edit-emergencyContact"
                            name="emergencyContact"
                            value={editPatientData.emergencyContact}
                            onChange={(e) => handleInputChange(e, 'edit')}
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="edit-emergencyPhone">비상 연락처 번호</label>
                          <input
                            type="tel"
                            id="edit-emergencyPhone"
                            name="emergencyPhone"
                            value={editPatientData.emergencyPhone}
                            onChange={(e) => handleInputChange(e, 'edit')}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-section">
                      <h4>의료 정보</h4>
                      <div className="form-group">
                        <label htmlFor="edit-medicalHistory">과거 병력</label>
                        <textarea
                          id="edit-medicalHistory"
                          name="medicalHistory"
                          value={editPatientData.medicalHistory}
                          onChange={(e) => handleInputChange(e, 'edit')}
                          rows={3}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="edit-allergies">알레르기</label>
                        <textarea
                          id="edit-allergies"
                          name="allergies"
                          value={editPatientData.allergies}
                          onChange={(e) => handleInputChange(e, 'edit')}
                          rows={2}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="edit-notes">특이사항</label>
                        <textarea
                          id="edit-notes"
                          name="notes"
                          value={editPatientData.notes}
                          onChange={(e) => handleInputChange(e, 'edit')}
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="form-actions">
                      <button type="button" className="btn-danger" onClick={handleDelete}>
                        환자 삭제
                      </button>
                      <div className="action-buttons">
                        <button type="button" className="btn-secondary" onClick={() => navigate('/')}>
                          취소
                        </button>
                        <button type="submit" className="btn-primary">
                          정보 수정
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </>
        </div>
      </div>

      <div className="patient-management-actions">
        <button className="btn-secondary" onClick={() => navigate('/')}>
          메인으로 돌아가기
        </button>
      </div>
    </div>
  );
};

export default PatientManagement; 