import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AuditResultPopup from './AuditResultPopup';
import './PrescriptionInput.css';
import apiService from '../services/api';
import { useAuditPopup } from '../hooks/useAuditPopup';

interface MedicationInfo {
  id: string;
  productName: string;
  ingredientName: string;
  dosage: string;
  frequency: string;
  duration: string;
  unit?: string;
}

interface PatientSearchResult {
  found: boolean;
  patient?: {
    id: number;
    name: string;
    sex: string;
    birth_date: string;
    created_at: string;
    latest_measurement?: {
      weight_kg: number;
      height_cm: number;
      scr_mg_dl: number;
      egfr: number;
      crcl: number;
      crcl_normalized: number;
      bsa: number;
      is_hd: boolean;
    };
  };
  message: string;
}

const PrescriptionInput: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    patientName: '',
    residentNumberFront: '',
    residentNumberBack: '',
  });

  const [medications, setMedications] = useState<MedicationInfo[]>([
    {
      id: '1',
      productName: '',
      ingredientName: '',
      dosage: '',
      frequency: '',
      duration: '',
      unit: ''
    }
  ]);

  // 환자 검색 결과
  const [patientSearchResult, setPatientSearchResult] = useState<PatientSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientStatus, setPatientStatus] = useState<'none' | 'searching' | 'found' | 'not-found'>('none');

  // 삭제 중인 약물 ID를 추적
  const [removingMedicationId, setRemovingMedicationId] = useState<string | null>(null);
  
  // 애니메이션을 적용할 약물 ID를 추적
  const [animatedMedicationIds, setAnimatedMedicationIds] = useState<string[]>([]);

  // 자동완성 관련 상태
  const [drugSuggestions, setDrugSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeInputId, setActiveInputId] = useState<string | null>(null);

  // 디바운싱을 위한 타이머
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // currentSearchId를 useRef로 변경
  const currentSearchId = useRef<string>('');

  // 자동완성 스크롤 관련 ref 추가
  const suggestionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 자동 스크롤을 위한 ref
  const lastMedicationRef = useRef<HTMLDivElement>(null);

  // 감사 결과 팝업 관련 상태 (커스텀 훅 사용)
  const { showAuditPopup, auditPopupData, openAuditPopup, closeAuditPopup } = useAuditPopup();
  
  // 토스트 팝업 관련 상태
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 약물이 추가될 때 자동 스크롤
  useEffect(() => {
    if (medications.length > 1) {
      lastMedicationRef.current?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [medications.length]);

  // 약물 검색 API 호출 함수
  const searchDrugs = useCallback(async (query: string): Promise<string[]> => {
    if (!query.trim()) return [];
    
    try {
      const data = await apiService.searchDrugs(query);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('약물 검색 오류:', error);
      return [];
    }
  }, []);

  // 디바운싱된 약물 검색
  const debouncedSearch = useCallback((query: string, searchId: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(async () => {
      if (currentSearchId.current === searchId) {
        setIsLoading(true);
        const results = await searchDrugs(query);
        if (currentSearchId.current === searchId) {
          setDrugSuggestions(results);
          setShowSuggestions(results.length > 0);
          setIsLoading(false);
        }
      }
    }, 300);

    setSearchTimeout(timeout);
  }, [searchTimeout, searchDrugs]);

  // 약물 상세 정보 조회 함수 (영문성분명 + 단위 한번에)
  const fetchDrugDetails = useCallback(async (drugName: string): Promise<{englishIngredient: string | null, unit: string | null}> => {
    console.log(`🔍 약물 상세 정보 조회 시작: ${drugName}`);
    try {
      const data = await apiService.getDrugDetails(drugName);
      console.log(`📋 응답 데이터:`, data);
      
      // message가 있다면 약물을 찾을 수 없는 경우
      if (data.message) {
        console.log(`❌ 약물을 찾을 수 없음: ${drugName}`);
        return { englishIngredient: null, unit: null };
      }
      
      const englishIngredient = data.영문성분명 === "-" ? null : data.영문성분명;
      const unit = data.단위 === "-" ? null : data.단위;
      
      console.log(`✅ 약물 상세 정보 결과: 영문성분명=${englishIngredient}, 단위=${unit}`);
      
      return { englishIngredient, unit };
    } catch (error) {
      console.error('🚨 약물 상세 정보 조회 오류:', error);
      return { englishIngredient: null, unit: null };
    }
  }, []);

  // 약물명 입력 처리
  const handleDrugNameChange = useCallback((id: string, value: string) => {
    const searchId = Date.now().toString();
    currentSearchId.current = searchId;

    setMedications(prev =>
      prev.map(med =>
        med.id === id ? { ...med, productName: value } : med
      )
    );

    if (value.trim()) {
      debouncedSearch(value, searchId);
    } else {
      setDrugSuggestions([]);
      setShowSuggestions(false);
      // 약물명이 비워지면 성분명도 초기화
      setMedications(prev =>
        prev.map(med =>
          med.id === id ? { ...med, ingredientName: '' } : med
        )
      );
    }
  }, [debouncedSearch]);

  // 약물명 입력 완료 처리 (blur 이벤트)
  const handleDrugNameBlur = useCallback(async (id: string, drugName: string) => {
    console.log(`🔍 약물명 blur 이벤트: ${drugName}`);
    
    // 자동완성이 표시되고 있다면 잠시 기다림
    setTimeout(async () => {
      console.log(`⏰ blur 타이머 실행 - showSuggestions: ${showSuggestions}, drugName: ${drugName.trim()}`);
      
      if (!showSuggestions && drugName.trim()) {
        // 현재 약물의 성분명이나 단위가 비어있다면 자동 조회
        const currentMed = medications.find(med => med.id === id);
        console.log(`🔍 현재 약물 정보:`, currentMed);
        
        if (currentMed) {
          const needsIngredient = !currentMed.ingredientName.trim();
          const needsUnit = !currentMed.unit?.trim();
          
          if (needsIngredient || needsUnit) {
            console.log(`🔄 약물 정보 조회 시작 (직접입력) - 성분명: ${needsIngredient}, 단위: ${needsUnit}`);
            
            // 약물 상세 정보를 한번에 조회
            const { englishIngredient, unit } = await fetchDrugDetails(drugName);
            
            // 조회 결과를 상태에 반영
            setMedications(prev => 
              prev.map(med => 
                med.id === id ? { 
                  ...med, 
                  ingredientName: needsIngredient ? (englishIngredient || med.ingredientName) : med.ingredientName,
                  unit: needsUnit ? (unit || med.unit || '') : med.unit
                } : med
              )
            );
            
            console.log(`✅ 약물 정보 자동 입력 성공 (직접입력): ${drugName} → 성분명: ${englishIngredient}, 단위: ${unit}`);
          } else {
            console.log(`⏭️ 이미 성분명과 단위가 모두 있음`);
          }
        } else {
          console.log(`⏭️ 약물 정보 없음`);
        }
      } else {
        console.log(`⏭️ 자동완성 표시 중이거나 약물명이 비어있음`);
      }
    }, 200);
  }, [showSuggestions, medications, fetchDrugDetails]);

  // 자동완성 선택 처리
  const handleSuggestionSelect = useCallback(async (id: string, suggestion: string) => {
    console.log(`🎯 자동완성 선택: ${suggestion}`);
    
    // 현재 진행 중인 검색을 무효화하여 재검색 방지
    currentSearchId.current = '';
    
    // 자동완성 상태 초기화
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    setDrugSuggestions([]);
    
    // 타이머가 있다면 취소
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      setSearchTimeout(null);
    }
    
    // 약물명 업데이트
    setMedications(prev => 
      prev.map(med => 
        med.id === id ? { ...med, productName: suggestion } : med
      )
    );

    // 약물 상세 정보를 한번에 조회 및 입력
    console.log(`🔄 약물 정보 조회 시작 (자동완성)`);
    const { englishIngredient, unit } = await fetchDrugDetails(suggestion);
    
    setMedications(prev => 
      prev.map(med => 
        med.id === id ? { 
          ...med, 
          ingredientName: englishIngredient || '',
          unit: unit || ''
        } : med
      )
    );
    
    console.log(`✅ 약물 정보 자동 입력 완료: ${suggestion} → 성분명: ${englishIngredient}, 단위: ${unit}`);
  }, [fetchDrugDetails, searchTimeout]);

  // 키보드 네비게이션
  const handleKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveSuggestionIndex(prev => 
          prev < drugSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : drugSuggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (activeSuggestionIndex >= 0 && drugSuggestions[activeSuggestionIndex]) {
          handleSuggestionSelect(id, drugSuggestions[activeSuggestionIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
        break;
    }
  }, [showSuggestions, drugSuggestions, activeSuggestionIndex, handleSuggestionSelect]);

  // 자동완성 목록이 변경될 때 refs 배열 크기 조정
  useEffect(() => {
    suggestionRefs.current = suggestionRefs.current.slice(0, drugSuggestions.length);
  }, [drugSuggestions.length]);

  // activeSuggestionIndex 변경 시 스크롤 조정
  useEffect(() => {
    if (activeSuggestionIndex >= 0 && suggestionRefs.current[activeSuggestionIndex]) {
      suggestionRefs.current[activeSuggestionIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [activeSuggestionIndex]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  // 주민등록번호에서 생년월일과 성별 추출
  const extractInfoFromResidentNumber = (front: string, back: string) => {
    if (front.length !== 6 || back.length !== 1) {
      return null;
    }

    const year = front.substring(0, 2);
    const month = front.substring(2, 4);
    const day = front.substring(4, 6);
    const genderDigit = parseInt(back); // 뒷자리 첫 번째 숫자만 사용

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
    
    return { birthDate, sex };
  };

  // 자동 환자 검색
  const autoSearchPatient = async (name: string, front: string, back: string) => {
    // 모든 필드가 완성되지 않았으면 기본 상태 유지
    if (!name || front.length !== 6 || back.length !== 1) {
      setPatientStatus('none');
      setSelectedPatient(null);
      return;
    }

    const extractedInfo = extractInfoFromResidentNumber(front, back);
    if (!extractedInfo) {
      setPatientStatus('none');
      setSelectedPatient(null);
      return;
    }

    // 검색 시작
    setPatientStatus('searching');
    setIsSearching(true);

    try {
      const result = await apiService.searchPatientByInfo(name, extractedInfo.birthDate, extractedInfo.sex);
      
      setPatientSearchResult(result);
      
      if (result.found && result.patient) {
        setSelectedPatient(result.patient);
        setPatientStatus('found');
      } else {
        setSelectedPatient(null);
        setPatientStatus('not-found');
      }
    } catch (error) {
      console.error('환자 검색 오류:', error);
      setPatientStatus('not-found');
      setSelectedPatient(null);
    } finally {
      setIsSearching(false);
    }
  };

  // 디바운스된 자동 검색 - 더 긴 딜레이로 수정
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      autoSearchPatient(formData.patientName, formData.residentNumberFront, formData.residentNumberBack);
    }, 1000); // 1초 딜레이로 증가

    return () => clearTimeout(timeoutId);
  }, [formData.patientName, formData.residentNumberFront, formData.residentNumberBack]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // 주민등록번호 필드의 경우 숫자만 입력 허용
    const processedValue = name.includes('residentNumber') ? value.replace(/[^0-9]/g, '') : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };

  const handleMedicationChange = (id: string, field: keyof MedicationInfo, value: string) => {
    setMedications(prev => 
      prev.map(med => 
        med.id === id ? { ...med, [field]: value } : med
      )
    );
  };

  const addMedication = () => {
    const newId = Date.now().toString() + Math.random().toString(36).slice(2);
    setMedications(prev => [...prev, {
      id: newId,
      productName: '',
      ingredientName: '',
      dosage: '',
      frequency: '',
      duration: '',
      unit: ''
    }]);
    
    // 새로 추가된 약물에 애니메이션 적용
    setTimeout(() => {
      setAnimatedMedicationIds(prev => [...prev, newId]);
    }, 10);
  };

  const removeMedication = (id: string) => {
    if (medications.length <= 1) {
      alert('최소 1개의 약물은 유지해야 합니다.');
      return;
    }

    // 삭제 애니메이션 시작
    setRemovingMedicationId(id);
    
    // 애니메이션 완료 후 실제 삭제
    setTimeout(() => {
      setMedications(prev => prev.filter(med => med.id !== id));
      setRemovingMedicationId(null);
    }, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 환자 검색 결과 확인
    if (!selectedPatient) {
      alert('환자 정보를 먼저 확인해주세요.');
      return;
    }

    // 약물 정보 검증
    const validMedications = medications.filter(med => 
      med.productName.trim() && med.dosage.trim() && 
      med.frequency.trim() && med.duration.trim()
    );

    if (validMedications.length === 0) {
      alert('적어도 하나의 약물 정보를 완전히 입력해주세요.');
      return;
    }

    try {
      // 약물 ID 조회 및 real_amount 계산을 위한 배치 요청
      const drugSearchPromises = validMedications.map(async (medication) => {
        try {
          const data = await apiService.getDrugDetails(medication.productName);
          let real_amount = parseFloat(medication.dosage) || 0;
          
          // 약품규격_숫자가 있으면 real_amount 계산 (newaudit과 동일한 로직)
          if (data["약품규격_숫자"]) {
            const specAmount = parseFloat(data["약품규격_숫자"]);
            const doseAmount = parseFloat(medication.dosage) || 1;
            real_amount = specAmount * doseAmount;
          }
          
          return {
            ...medication,
            drug_id: data["품목기준코드"] || null,
            real_amount: real_amount
          };
        } catch (error) {
          console.warn(`약물 ID 조회 실패: ${medication.productName}`, error);
        }
        return {
          ...medication,
          drug_id: null,
          real_amount: parseFloat(medication.dosage) || 0
        };
      });

      const medicationsWithDrugIds = await Promise.all(drugSearchPromises);

      // 처방 데이터 준비 (order_id는 서버에서 자동 생성)
      const prescriptionsData = medicationsWithDrugIds.map(medication => ({
        drug_id: medication.drug_id,
        drug_korean_name: medication.productName,
        drug_ingredient: medication.ingredientName || "",
        dose_amount: medication.dosage,
        dose_unit: medication.unit || "정",
        real_amount: medication.real_amount,
        doses_per_day: parseInt(medication.frequency) || 1,
        duration_days: parseInt(medication.duration) || 1
      }));

      // 환자 ID 기반 처방 입력 API 호출
      const result = await apiService.inputPrescriptionWithPatientId({
        patient_id: selectedPatient.id,
        medications: prescriptionsData as any
      });
      
      if (result.success) {
        // 처방 입력 성공 후 note 값에 따라 처리
        if (result.note === '정상') {
          // 정상인 경우 토스트 팝업 표시
          showToastMessage('✅ 처방에 이상이 없습니다.');
          
          // 잠시 후 홈으로 이동
          setTimeout(() => {
            navigate('/');
          }, 2000);
        } else {
          // 이상인 경우 상세 팝업 표시
          const patientInfo = {
            name: selectedPatient.name,
            gender: selectedPatient.sex === 'M' ? 'male' : 'female',
            birthDate: selectedPatient.birth_date,
            weight: selectedPatient.latest_measurement?.weight_kg?.toString() || '-',
            height: selectedPatient.latest_measurement?.height_cm?.toString() || '-',
            scr: selectedPatient.latest_measurement?.is_hd ? '투석 중' : (selectedPatient.latest_measurement?.scr_mg_dl?.toString() || '-'),
            crcl: selectedPatient.latest_measurement?.is_hd ? '투석 중' : (selectedPatient.latest_measurement?.crcl?.toString() || '-'),
            crclNormalized: selectedPatient.latest_measurement?.is_hd ? '투석 중' : (selectedPatient.latest_measurement?.crcl_normalized?.toString() || '-'),
            egfr: selectedPatient.latest_measurement?.is_hd ? '투석 중' : (selectedPatient.latest_measurement?.egfr?.toString() || '-'),
            bsa: selectedPatient.latest_measurement?.bsa?.toString() || '-',
            isOnDialysis: selectedPatient.latest_measurement?.is_hd || false
          };

          // API 응답에서 실제 DB 데이터 사용
          if (result.prescriptions && result.prescriptions.length > 0) {
            const prescriptionsForPopup = result.prescriptions.map(prescription => ({
              id: prescription.id,
              drug_korean_name: prescription.drug_korean_name,
              audit_result: prescription.audit_result,
              information: prescription.information,
              dose_amount: prescription.dose_amount,
              dose_unit: prescription.dose_unit,
              doses_per_day: prescription.doses_per_day,
              duration_days: prescription.duration_days
            }));

            openAuditPopup({
              patientInfo,
              prescriptions: prescriptionsForPopup
            });
          } else {
            // API 응답에 처방 데이터가 없는 경우 (fallback)
            const prescriptionsForPopup = validMedications.map(med => ({
              id: Math.random(),
              drug_korean_name: med.productName,
              audit_result: '-',
              information: '정상적정 용량입니다.',
              dose_amount: med.dosage,
              dose_unit: med.unit || '',
              doses_per_day: parseInt(med.frequency) || 1,
              duration_days: parseInt(med.duration) || 1
            }));

            openAuditPopup({
              patientInfo,
              prescriptions: prescriptionsForPopup
            });
          }
        }
      } else {
        alert(`처방 입력 실패: ${result.message}`);
      }

    } catch (error) {
      console.error('처방 입력 오류:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`처방 입력 중 오류가 발생했습니다: ${errorMessage}`);
    }
  };



  // 토스트 메시지 표시 함수
  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // 환자 상태 아이콘 렌더링
  const renderPatientStatusIcon = () => {
    if (patientStatus === 'found') {
      return <div className="status-icon found">✔</div>;
    } else if (patientStatus === 'not-found') {
      return <div className="status-icon not-found">✕</div>;
    } else {
      return <div className="status-icon default">👤</div>;
    }
  };

  return (
    <div className="prescription-container">
      <div className="prescription-header">
        <h1>💊 신기능 처방 적정성 평가</h1>
        <p>약사용 신기능 기반 처방 정보를 입력하고 적정성을 평가받으세요</p>
      </div>
      
      <form className="prescription-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>환자 정보</h3>
          <div className="form-row">
            <div className="form-group patient-name-group">
              <label htmlFor="patientName" style={{ textAlign: 'center', display: 'block', width: '100%', textAlignLast: 'center' }}>환자명</label>
              <div className="patient-name-input-container">
                <div className="status-icon-container">
                  {renderPatientStatusIcon()}
                </div>
              <input
                type="text"
                id="patientName"
                name="patientName"
                value={formData.patientName}
                onChange={handleInputChange}
                required
                placeholder="환자명"
              />
            </div>
            </div>
            <div className="form-group resident-number-group">
              <label htmlFor="residentNumber" style={{ textAlign: 'center', display: 'block', width: '100%', textAlignLast: 'center' }}>주민등록번호</label>
              <div className="resident-number-inputs">
                <div className="resident-input-wrapper">
                  <input
                    type="text"
                    id="residentNumberFront"
                    name="residentNumberFront"
                    value={formData.residentNumberFront}
                    onChange={handleInputChange}
                    required
                    placeholder="앞 6자리"
                    maxLength={6}
                    className="resident-number-front"
                  />
                </div>
                <span className="resident-number-separator">-</span>
                <div className="resident-input-wrapper">
                  <input
                    type="text"
                    id="residentNumberBack"
                    name="residentNumberBack"
                    value={formData.residentNumberBack}
                    onChange={handleInputChange}
                    required
                    placeholder="1"
                    maxLength={1}
                    className="resident-number-back"
                  />
                </div>
                <div className="resident-input-wrapper">
                  <input
                    type="password"
                    value="******"
                    disabled
                    className="resident-number-masked"
                  />
                </div>
              </div>
            </div>
          </div>
          
        </div>

        <div className="form-section">
          <div className="section-header">
            <h3>처방 정보</h3>
          </div>
          
          {medications.map((medication, index) => (
            <div 
              key={medication.id} 
              className={`medication-card ${removingMedicationId === medication.id ? 'removing' : ''} ${animatedMedicationIds.includes(medication.id) ? 'animate' : ''}`}
              ref={index === medications.length - 1 ? lastMedicationRef : null}
            >
              <div className="medication-header">
                <h3>약물 {index + 1}</h3>
                {medications.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeMedication(medication.id)}
                    className="btn-remove"
                  >
                    삭제
                  </button>
                )}
              </div>
              
              <div className="medication-grid-2row">
                <div className="medication-row">
                  <div className="form-group form-group-3x">
                    <label>한글 상품명</label>
                    <div className="autocomplete-container">
                    <input
                      type="text"
                      value={medication.productName}
                        onChange={(e) => handleDrugNameChange(medication.id, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, medication.id)}
                        onFocus={() => setActiveInputId(medication.id)}
                        onBlur={() => {
                          handleDrugNameBlur(medication.id, medication.productName);
                          setTimeout(() => setActiveInputId(null), 200);
                        }}
                        placeholder="약물명 입력 (자동완성)"
                        required
                        className="input-long"
                      />
                      {isLoading && (
                        <div className="loading-indicator">
                          <div className="spinner"></div>
                        </div>
                      )}
                      {showSuggestions && activeInputId === medication.id && drugSuggestions.length > 0 && (
                        <div className="suggestions-dropdown">
                          {drugSuggestions.map((suggestion, idx) => (
                            <div
                              key={idx}
                              className={`suggestion-item ${idx === activeSuggestionIndex ? 'active' : ''}`}
                              onMouseDown={(e) => {
                                e.preventDefault(); // input blur 방지
                                handleSuggestionSelect(medication.id, suggestion);
                              }}
                              onClick={() => handleSuggestionSelect(medication.id, suggestion)}
                              ref={(el) => (suggestionRefs.current[idx] = el)}
                            >
                              {suggestion}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="form-group form-group-1x">
                    <label>성분명</label>
                    <input
                      type="text"
                      value={medication.ingredientName}
                      readOnly
                      placeholder="자동입력"
                      className="input-short"
                    />
                  </div>
                </div>
                <div className="medication-row">
                  <div className="form-group form-group-equal">
                    <label>1회 투약용량</label>
                    <input
                      type="text"
                      value={medication.dosage}
                      onChange={(e) => handleMedicationChange(medication.id, 'dosage', e.target.value)}
                      placeholder="예: 1"
                      className="input-equal"
                      required
                    />
                  </div>
                  <div className="form-group form-group-equal">
                    <label>단위</label>
                    <input
                      type="text"
                      value={medication.unit || ''}
                      readOnly
                      placeholder="자동입력"
                      className="input-equal"
                    />
                  </div>
                  <div className="form-group form-group-equal">
                    <label>일투수</label>
                    <input
                      type="number"
                      value={medication.frequency}
                      onChange={(e) => handleMedicationChange(medication.id, 'frequency', e.target.value)}
                      placeholder="예: 3"
                      className="input-equal"
                      required
                      min="1"
                    />
                  </div>
                  <div className="form-group form-group-equal">
                    <label>투약 기간</label>
                    <input
                      type="number"
                      value={medication.duration}
                      onChange={(e) => handleMedicationChange(medication.id, 'duration', e.target.value)}
                      placeholder="예: 7"
                      className="input-equal"
                      required
                      min="1"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          <button type="button" onClick={addMedication} className="btn-add">
            + 약물 추가
          </button>
        </div>
      </form>
      
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={() => navigate('/')}>
          취소
        </button>
        <button 
          type="submit" 
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!selectedPatient}
        >
          처방 입력
        </button>
      </div>

      {/* 토스트 팝업 */}
      {showToast && (
        <div className="toast-notification">
          <div className="toast-content">
            <span className="toast-icon">✅</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
      
      {/* 감사 결과 팝업 */}
      {showAuditPopup && auditPopupData && (
        <AuditResultPopup
          isOpen={showAuditPopup}
          onClose={closeAuditPopup}
          patientInfo={auditPopupData.patientInfo}
          prescriptions={auditPopupData.prescriptions}
          medications={medications}
        />
      )}
    </div>
  );
};

export default PrescriptionInput; 