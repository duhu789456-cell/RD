import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './NewAudit.css';
import AuditResultPopup from './AuditResultPopup';
import { useAuditPopup } from '../hooks/useAuditPopup';

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

const NewAudit: React.FC = () => {
  const navigate = useNavigate();
  
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: '',
    gender: '',
    birthDate: '',
    weight: '',
    height: '',
    scr: '',
    crcl: '',
    crclNormalized: '',
    egfr: '',
    bsa: '',
    isOnDialysis: false
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

  // 삭제 중인 약물 ID를 추적
  const [removingMedicationId, setRemovingMedicationId] = useState<string | null>(null);
  
  // 애니메이션을 적용할 약물 ID를 추적
  const [animatedMedicationIds, setAnimatedMedicationIds] = useState<string[]>([]);

  // 자동완성 관련 상태
  const [drugSuggestions, setDrugSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 토스트 및 팝업 관련 상태
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // 감사 결과 팝업 관련 상태 (커스텀 훅 사용)
  const { showAuditPopup, auditPopupData, openAuditPopup, closeAuditPopup } = useAuditPopup({
    autoNavigate: true,
    navigatePath: '/'
  });

  // 디바운싱을 위한 타이머
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // currentSearchId를 useRef로 변경
  const currentSearchId = useRef<string>('');

  // 자동완성 스크롤 관련 ref 추가
  const suggestionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 자동 스크롤을 위한 ref
  const medicationsEndRef = useRef<HTMLDivElement>(null);
  const lastMedicationRef = useRef<HTMLDivElement>(null);

  // 약물이 추가될 때 자동 스크롤
  useEffect(() => {
    if (medications.length > 1) {
      lastMedicationRef.current?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [medications.length]);

  // 토스트 표시 함수
  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // 약물 검색 API 호출 함수
  const searchDrugs = useCallback(async (query: string): Promise<string[]> => {
    if (!query.trim()) return [];
    
    try {
      const response = await fetch(`http://localhost:8000/api/drugs?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error('약물 검색에 실패했습니다');
      }
      const data = await response.json();
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
      const url = `http://localhost:8000/api/drugs/details?drug_name=${encodeURIComponent(drugName)}`;
      console.log(`📡 API 호출: ${url}`);
      
      const response = await fetch(url);
      console.log(`📊 응답 상태: ${response.status}`);
      
      if (!response.ok) {
        throw new Error(`약물 상세 정보 조회에 실패했습니다 (상태: ${response.status})`);
      }
      
      const data = await response.json();
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

  const [activeInputId, setActiveInputId] = useState<string | null>(null);

  const handlePatientInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checkedValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    // 먼저 상태를 업데이트
    setPatientInfo(prev => {
      const updatedInfo = {
        ...prev,
        [name]: type === 'checkbox' ? checkedValue : value
      };
      
      // 체중과 키가 있으면 체표면적 계산 (투석여부와 상관없이)
      const weight = parseFloat(updatedInfo.weight);
      const height = parseFloat(updatedInfo.height);
      let bsa = '';
      
      if (!isNaN(weight) && !isNaN(height)) {
        const bsaValue = 0.007184 * Math.pow(height, 0.725) * Math.pow(weight, 0.425);
        bsa = bsaValue.toFixed(3);
      }
      
      // 모든 필수 값이 있고 투석중이 아니면 신기능 계산 실행
      const scr = parseFloat(updatedInfo.scr);
      const gender = updatedInfo.gender;
      const birthDate = updatedInfo.birthDate;
      const isOnDialysis = updatedInfo.isOnDialysis;
      
      if (!isNaN(scr) && !isNaN(weight) && !isNaN(height) && gender && birthDate && !isOnDialysis) {
        const { egfr, crcl, crclNormalized } = calculateKidneyFunction(scr, weight, height, gender, birthDate);
        return {
          ...updatedInfo,
          bsa,
          egfr: egfr.toFixed(2),
          crcl: crcl.toFixed(2),
          crclNormalized: crclNormalized.toFixed(2)
        };
      } else if (isOnDialysis) {
        // 투석중이면 신기능 값들을 비워둠
        return {
          ...updatedInfo,
          bsa,
          egfr: '',
          crcl: '',
          crclNormalized: ''
        };
      }
      
      return {
        ...updatedInfo,
        bsa
      };
    });
  };

  const calculateKidneyFunction = (scr: number, weight: number, height: number, gender: string, birthDate: string) => {
    const age = new Date().getFullYear() - new Date(birthDate).getFullYear();
    
    // Cockcroft-Gault 공식으로 CrCl 계산 (mL/min)
    let crcl: number;
    if (gender === 'male') {
      crcl = ((140 - age) * weight) / (72 * scr);
    } else {
      crcl = ((140 - age) * weight * 0.85) / (72 * scr);
    }
    
    // 체표면적 계산 (DuBois & DuBois 공식)
    const bsa = 0.007184 * Math.pow(height, 0.725) * Math.pow(weight, 0.425);
    
    // CrCl을 1.73m²로 정규화
    const crclNormalized = (crcl * 1.73) / bsa;
    
    // MDRD 공식으로 eGFR 계산 (mL/min/1.73m²)
    let egfr: number;
    
    if (gender === 'male') {
      egfr = 175 * Math.pow(scr, -1.154) * Math.pow(age, -0.203);
    } else {
      egfr = 175 * Math.pow(scr, -1.154) * Math.pow(age, -0.203) * 0.742;
    }
    
    return {
      egfr: Math.max(egfr, 0), // 음수 방지
      crcl: Math.max(crcl, 0), // 음수 방지
      crclNormalized: Math.max(crclNormalized, 0) // 음수 방지
    };
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
    }, 200); // 매우 빠른 삭제로 끊김 최소화
  };

  const handleAuditExecution = async () => {
    try {
      // 필수 필드 검증
      if (!patientInfo.gender || !patientInfo.birthDate || !patientInfo.weight || !patientInfo.height) {
        alert('환자 정보를 모두 입력해주세요.');
        return;
      }
      // 투석중이 아닐 때만 SCr, eGFR, CrCl 필수
      if (!patientInfo.isOnDialysis) {
        if (!patientInfo.scr || !patientInfo.egfr || !patientInfo.crcl) {
          alert('환자 정보를 모두 입력해주세요.');
          return;
        }
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

      const totalStartTime = performance.now();
      console.log('🚀 최적화된 배치 처리로 감사 시작...');

      // 1단계: 환자 생성
      const patientStartTime = performance.now();
      const patientData = {
        name: patientInfo.name || null,
        sex: patientInfo.gender === 'male' ? 'M' : 'F',
        birth_date: patientInfo.birthDate,
        weight_kg: parseFloat(patientInfo.weight),
        height_cm: parseFloat(patientInfo.height),
        scr_mg_dl: patientInfo.isOnDialysis ? 10.0 : parseFloat(patientInfo.scr),
        egfr: parseFloat(patientInfo.egfr) || 0,
        crcl: parseFloat(patientInfo.crcl) || 0,
        crcl_normalized: parseFloat(patientInfo.crclNormalized) || 0,
        bsa: parseFloat(patientInfo.bsa) || 0,
        is_hd: patientInfo.isOnDialysis
      };

      console.log('👤 환자 생성 중...');
      const patientResponse = await fetch('http://localhost:8000/api/patients/with-measurement-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientData)
      });

      if (!patientResponse.ok) {
        const error = await patientResponse.json();
        throw new Error(error.detail || '환자 생성 실패');
      }

      const patientResult = await patientResponse.json();
      const patient = patientResult.patient;
      const patientTime = (performance.now() - patientStartTime).toFixed(1);
      console.log(`✅ 환자 생성 완료: ${patient.id} (${patientTime}ms)`);

      // 2단계: 처방 주문 생성
      const orderStartTime = performance.now();
      const orderData = {
        patient_id: patient.id,
        note: null  // 감사 완료 후 자동으로 업데이트됨
      };

      console.log('📋 처방 주문 생성 중...');
      const orderResponse = await fetch('http://localhost:8000/api/prescriptions/orders/with-patient-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (!orderResponse.ok) {
        const error = await orderResponse.json();
        throw new Error(error.detail || '처방 주문 생성 실패');
      }

      const order = await orderResponse.json();
      const orderTime = (performance.now() - orderStartTime).toFixed(1);
      console.log(`✅ 처방 주문 생성 완료: ${order.id} (${orderTime}ms)`);

      // 3단계: HIRA 데이터에서 drug_id 조회 (배치 API로 최적화)
      const drugSearchStartTime = performance.now();
      console.log(`🔍 약물 정보 조회 중... (${validMedications.length}건 배치 처리)`);
      
      let prescriptionsData;
      let drugSearchTime;
      
      try {
        // 모든 약물명을 한 번에 배치 조회
        const drugNames = validMedications.map(med => med.productName);
        const batchResponse = await fetch('http://localhost:8000/api/drugs/batch-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drug_names: drugNames })
        });

        if (!batchResponse.ok) {
          throw new Error('배치 약물 조회 실패');
        }

        const drugResults = await batchResponse.json();
        drugSearchTime = (performance.now() - drugSearchStartTime).toFixed(1);
        console.log(`✅ 약물 정보 조회 완료: ${drugResults.length}건 (${drugSearchTime}ms)`);

        // 조회 결과를 prescriptionsData로 변환
        prescriptionsData = validMedications.map((med, index) => {
          const drugResult = drugResults[index];
          let drug_id = null;
          let real_amount = parseFloat(med.dosage) || 0;

          if (drugResult.found && drugResult.drug_data) {
            drug_id = drugResult.drug_data.품목기준코드;
            
            // 약품규격_숫자가 있으면 real_amount 계산
            if (drugResult.drug_data.약품규격_숫자) {
              const specAmount = parseFloat(drugResult.drug_data.약품규격_숫자);
              const doseAmount = parseFloat(med.dosage) || 1;
              real_amount = specAmount * doseAmount;
            }
          }

          return {
            order_id: order.id,
            drug_id: drug_id,
            drug_korean_name: med.productName,
            drug_ingredient: med.ingredientName || "",
            dose_amount: med.dosage,
            dose_unit: med.unit || "정",
            real_amount: real_amount,
            doses_per_day: parseInt(med.frequency) || 1,
            duration_days: parseInt(med.duration) || 1
          };
        });

      } catch (error) {
        console.warn('⚠️ 배치 약물 조회 실패, 기본값으로 처리:', error);
        
        // 배치 조회 실패 시 기본값으로 처방 생성
        prescriptionsData = validMedications.map(med => ({
          order_id: order.id,
          drug_id: null,
          drug_korean_name: med.productName,
          drug_ingredient: med.ingredientName || "",
          dose_amount: med.dosage,
          dose_unit: med.unit || "정",
          real_amount: parseFloat(med.dosage) || 0,
          doses_per_day: parseInt(med.frequency) || 1,
          duration_days: parseInt(med.duration) || 1
        }));
        
        drugSearchTime = (performance.now() - drugSearchStartTime).toFixed(1);
        console.log(`✅ 기본값으로 처방 생성: ${prescriptionsData.length}건 (${drugSearchTime}ms)`);
      }

      // 4단계: 배치 처방 생성 및 즉시 감사 (최적화된 엔드포인트)
      const batchStartTime = performance.now();
      console.log('💊 배치 처방 생성 및 감사 중...');
      
      const batchResponse = await fetch('http://localhost:8000/api/prescriptions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prescriptionsData)
      });

      if (!batchResponse.ok) {
        const error = await batchResponse.json();
        throw new Error(error.detail || '배치 처방 생성 실패');
      }

      const prescriptions = await batchResponse.json();
      const batchTime = (performance.now() - batchStartTime).toFixed(1);
      const totalTime = (performance.now() - totalStartTime).toFixed(1);
      
      console.log(`✅ 배치 처방 생성 완료: ${prescriptions.length}건 (${batchTime}ms)`);
      console.log(`🎯 전체 처리 완료: ${totalTime}ms`);

      // 처방 주문의 note 조회
      console.log(`📋 처방 주문 조회 중... order_id: ${order.id}`);
      const orderCheckResponse = await fetch(`http://localhost:8000/api/prescriptions/orders/${order.id}`);
      
      if (!orderCheckResponse.ok) {
        console.error('처방 주문 조회 실패');
        throw new Error('처방 주문 조회 실패');
      }
      
      const orderCheckData = await orderCheckResponse.json();
      console.log(`📋 처방 주문 데이터:`, orderCheckData);
      
      // 감사 결과에 따른 팝업 표시
      if (orderCheckData.note === '정상') {
        // 정상인 경우 토스트 팝업
        showToastMessage('처방에 이상이 없습니다.');
        
        // 잠시 후 홈으로 이동
        setTimeout(() => {
          navigate('/');
        }, 2000);
             } else if (orderCheckData.note === '이상') {
        // 이상인 경우 상세 팝업
        openAuditPopup({
          patientInfo: patientInfo,
          prescriptions: prescriptions
        });
      } else {
        // 기본 처리 (이전 방식)
        const auditSummary: Record<string, number> = {};
        prescriptions.forEach((prescription: any) => {
          const result = prescription.audit_result;
          auditSummary[result] = (auditSummary[result] || 0) + 1;
        });

        try {
          const resultMessage = `
📊 처방 감사 완료!

⏱️ 성능 분석:
  • 환자 생성: ${patientTime}ms
  • 처방 주문: ${orderTime}ms  
  • 약물 조회 (배치): ${drugSearchTime}ms
  • 배치 감사: ${batchTime}ms
  ━━━━━━━━━━━━━━━━━━━━━━━━━━
  • 전체 시간: ${totalTime}ms

📋 총 처방 건수: ${prescriptions.length}건

📈 감사 결과:
${Object.entries(auditSummary).map(([result, count]) => {
  const label = result === '-' ? '정상' : 
                result === '금기' ? '⚠️ 금기' :
                result === '용량조절필요' ? '⚡ 용량조절필요' :
                result === '투여간격조절필요' ? '🕐 투여간격조절필요' : String(result);
  return `  • ${label}: ${count}건`;
}).join('\n')}
          `.trim();

          alert(resultMessage);
          navigate('/');
        } catch (messageError) {
          console.error('메시지 생성 오류:', messageError);
          alert(`처방 감사가 완료되었습니다. 총 ${prescriptions.length}건의 처방이 처리되었습니다.`);
          navigate('/');
        }
      }

    } catch (error) {
      console.error('💥 감사 실행 오류:', error);
      let errorMessage = '알 수 없는 오류가 발생했습니다.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // 객체인 경우 JSON.stringify로 안전하게 변환
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = '객체 형태의 오류가 발생했습니다.';
        }
      }
      
      alert(`감사 실행 중 오류가 발생했습니다: ${errorMessage}`);
    }
  };

  const handleCancel = () => {
    navigate('/');
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

  return (
    <div className="new-audit-page">
      <div className="container">
        <div className="page-header">
          <h1>🧪 RenalDose 테스트 모드</h1>
          <p>약사용 신기능 기반 처방 적정성 평가 테스트 및 감사 기능</p>
        </div>
        
        <div className="audit-form-container">
          {/* 1. 환자 정보 입력 영역 */}
          <div className="section">
            <h2>환자 정보</h2>
            <div className="patient-info-row">
              <div className="form-group">
                <label htmlFor="name">이름 (선택)</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={patientInfo.name}
                  onChange={handlePatientInfoChange}
                  placeholder="환자 이름"
                />
              </div>
              <div className="form-group">
                <label htmlFor="gender">성별</label>
                <select
                  id="gender"
                  name="gender"
                  value={patientInfo.gender}
                  onChange={handlePatientInfoChange}
                >
                  <option value="">선택하세요</option>
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="birthDate">생년월일</label>
                <input
                  type="date"
                  id="birthDate"
                  name="birthDate"
                  value={patientInfo.birthDate}
                  onChange={handlePatientInfoChange}
                  placeholder="YYYY-MM-DD"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            <div className="patient-info-row">
              <div className="form-group">
                <label htmlFor="weight">체중 (kg)</label>
                <input
                  type="number"
                  id="weight"
                  name="weight"
                  value={patientInfo.weight}
                  onChange={handlePatientInfoChange}
                  placeholder="체중"
                  step="0.1"
                />
              </div>
              <div className="form-group">
                <label htmlFor="height">키 (cm)</label>
                <input
                  type="number"
                  id="height"
                  name="height"
                  value={patientInfo.height}
                  onChange={handlePatientInfoChange}
                  placeholder="키"
                  step="0.1"
                />
              </div>
              <div className="form-group">
                <label htmlFor="bsa">BSA (m²)</label>
                <input
                  type="number"
                  id="bsa"
                  name="bsa"
                  value={patientInfo.bsa}
                  onChange={handlePatientInfoChange}
                  placeholder="자동 계산"
                  step="0.001"
                  readOnly
                />
              </div>
            </div>
            <div className="patient-info-row">
              <div className="form-group">
                <label htmlFor="scr">SCr (mg/dL)</label>
                <input
                  type="number"
                  id="scr"
                  name="scr"
                  value={patientInfo.isOnDialysis ? "" : patientInfo.scr}
                  onChange={handlePatientInfoChange}
                  placeholder={patientInfo.isOnDialysis ? "투석 중" : "SCr"}
                  step="0.01"
                  disabled={patientInfo.isOnDialysis}
                  className={patientInfo.isOnDialysis ? "disabled" : ""}
                />
              </div>
              <div className="form-group dialysis-form-group dialysis-wide">
                <label>&nbsp;</label>
                <div className="dialysis-toggle-inline">
                  <span className="dialysis-inline-label">투석여부</span>
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      id="isOnDialysis"
                      name="isOnDialysis"
                      checked={patientInfo.isOnDialysis}
                      onChange={handlePatientInfoChange}
                    />
                    <label htmlFor="isOnDialysis" className="toggle-label">
                      <span className="toggle-slider"></span>
                    </label>
                    <span className={`toggle-text ${patientInfo.isOnDialysis ? 'active' : ''}`}>
                      {patientInfo.isOnDialysis ? '투석 중' : '투석 안함'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="patient-info-row">
              <div className="form-group">
                <label htmlFor="egfr">eGFR (mL/min/1.73m²)</label>
                <input
                  type="number"
                  id="egfr"
                  name="egfr"
                  value={patientInfo.egfr}
                  onChange={handlePatientInfoChange}
                  placeholder={patientInfo.isOnDialysis ? "투석 중" : "자동 계산"}
                  step="0.01"
                  readOnly
                  className={patientInfo.isOnDialysis ? "disabled" : ""}
                />
              </div>
              <div className="form-group">
                <label htmlFor="crcl">CrCl (mL/min)</label>
                <input
                  type="number"
                  id="crcl"
                  name="crcl"
                  value={patientInfo.crcl}
                  onChange={handlePatientInfoChange}
                  placeholder={patientInfo.isOnDialysis ? "투석 중" : "자동 계산"}
                  step="0.01"
                  readOnly
                  className={patientInfo.isOnDialysis ? "disabled" : ""}
                />
              </div>
              <div className="form-group">
                <label htmlFor="crclNormalized">CrCl (mL/min/1.73m²)</label>
                <input
                  type="number"
                  id="crclNormalized"
                  name="crclNormalized"
                  value={patientInfo.crclNormalized}
                  onChange={handlePatientInfoChange}
                  placeholder={patientInfo.isOnDialysis ? "투석 중" : "자동 계산"}
                  step="0.01"
                  readOnly
                  className={patientInfo.isOnDialysis ? "disabled" : ""}
                />
              </div>
            </div>
          </div>

          {/* 2. 약물 정보 입력 영역 */}
          <div className="section">
            <div className="section-header">
              <h2>약물 정보</h2>
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
                    <div className="form-group form-group-1x">
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
                    <div className="form-group form-group-1x">
                      <label>1회 투약용량</label>
                      <input
                        type="text"
                        value={medication.dosage}
                        onChange={(e) => handleMedicationChange(medication.id, 'dosage', e.target.value)}
                        placeholder="예: 1"
                        className="input-equal"
                      />
                    </div>
                    <div className="form-group form-group-1x">
                      <label>단위</label>
                      <input
                        type="text"
                        value={medication.unit || ''}
                        readOnly
                        placeholder="자동입력"
                        className="input-equal"
                      />
                    </div>
                    <div className="form-group form-group-1x">
                      <label>일투수</label>
                      <input
                        type="text"
                        value={medication.frequency}
                        onChange={(e) => handleMedicationChange(medication.id, 'frequency', e.target.value)}
                        placeholder="예: 3"
                        className="input-equal"
                      />
                    </div>
                    <div className="form-group form-group-1x">
                      <label>투약 기간</label>
                      <input
                        type="text"
                        value={medication.duration}
                        onChange={(e) => handleMedicationChange(medication.id, 'duration', e.target.value)}
                        placeholder="예: 7"
                        className="input-equal"
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

          {/* 3. 감사 실행 버튼 */}
          <div className="audit-actions">
            <button type="button" onClick={handleCancel} className="btn-cancel">
              취소
            </button>
            <button type="button" onClick={handleAuditExecution} className="btn-audit">
              처방 감사 실행
            </button>
          </div>
        </div>
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

export default NewAudit; 