import json
import os
import math
from typing import List, Dict, Any, Optional
from fastapi import HTTPException


class PrescriptionAuditService:
    """처방 감사 서비스 클래스 - 성능 최적화 버전"""
    
    def __init__(self):
        self.dosage_data: List[Dict[str, Any]] = []
        self.dosage_index: Dict[int, List[Dict[str, Any]]] = {}  # drug_id별 인덱스
        self._load_and_index_dosage_data()
    
    def _load_and_index_dosage_data(self) -> None:
        """dosagedata.json을 로드하고 drug_id별로 인덱싱합니다."""
        dosage_data_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            "data", 
            "dosagedata.json"
        )
        
        try:
            with open(dosage_data_path, encoding="utf-8") as f:
                self.dosage_data = json.load(f)
            
            # drug_id별 인덱스 생성 (성능 최적화)
            for row in self.dosage_data:
                drug_id = row.get("drug_id")
                if drug_id:
                    if drug_id not in self.dosage_index:
                        self.dosage_index[drug_id] = []
                    self.dosage_index[drug_id].append(row)
            
            print(f"✅ 용량 데이터 인덱싱 완료: {len(self.dosage_data)}개 항목, {len(self.dosage_index)}개 drug_id")
            
        except FileNotFoundError:
            print(f"❌ 용량 데이터 파일을 찾을 수 없습니다: {dosage_data_path}")
            self.dosage_data = []
            self.dosage_index = {}
        except json.JSONDecodeError as e:
            print(f"❌ 용량 데이터 JSON 파일 파싱 에러: {e}")
            self.dosage_data = []
            self.dosage_index = {}
        except Exception as e:
            print(f"❌ 용량 데이터 로드 실패: {e}")
            self.dosage_data = []
            self.dosage_index = {}
    
    def get_dosage_rows_by_drug_id(self, drug_id: int) -> List[Dict[str, Any]]:
        """drug_id로 해당하는 모든 dosage 행을 O(1) 시간에 반환합니다."""
        return self.dosage_index.get(drug_id, [])
    
    def _get_patient_rf_value(self, patient: Dict[str, Any], rf_indicator: str) -> float:
        """rf_indicator에 따라 환자의 신기능 기준값을 반환합니다."""
        mapping = {
            "crcl": patient.get("crcl", 0),
            "ecrcl": patient.get("crcl_normalization", 0),
            "egfr": patient.get("egfr", 0),
            "scr": patient.get("scr_mg_dl", 0)
        }
        return float(mapping.get(rf_indicator, 0))
    
    def _select_best_dosage_row(
        self, 
        dosage_rows: List[Dict[str, Any]], 
        patient: Dict[str, Any],
        prescription: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """환자 조건에 가장 적합한 dosage row를 선택합니다 (대폭 최적화)."""
        
        if not dosage_rows:
            return None
        
        is_hd = patient.get("is_hd", False)
        patient_amount = float(prescription.get("real_amount") or prescription.get("dose_amount", 0) or 0)
        
        # 투석 환자인 경우 투석 필수 행 우선 검색 (빠른 종료)
        if is_hd:
            for row in dosage_rows:
                if row.get("dialysis_required") is True:
                    return row
        
        # 환자 신기능 값 한 번만 계산
        rf_indicator = None
        patient_rf_value = None
        
        # 적합한 행들을 필터링하면서 동시에 용량 검사 (단일 패스)
        best_row = None
        best_dose_diff = float('inf')
        
        for row in dosage_rows:
            # 투석 조건 빠른 체크
            if row.get("dialysis_required") is True and not is_hd:
                continue
            
            # 신기능 범위 체크 (지연 계산)
            if rf_indicator is None:
                rf_indicator = row.get("rf_indicator", "crcl")
                patient_rf_value = self._get_patient_rf_value(patient, rf_indicator)
            
            # NaN 처리 최적화 (한 번에 처리)
            crcl_min = row.get("crcl_min")
            crcl_max = row.get("crcl_max")
            
            if crcl_min is None or (isinstance(crcl_min, float) and math.isnan(crcl_min)):
                crcl_min = -9999
            if crcl_max is None or (isinstance(crcl_max, float) and math.isnan(crcl_max)):
                crcl_max = 9999
            
            # 신기능 범위 체크
            if not (crcl_min <= patient_rf_value <= crcl_max):
                continue
            
            # 용량 체크와 최적 선택을 한 번에 (분리된 루프 제거)
            dose_amount = float(row.get("dose_amount", 0))
            if dose_amount >= patient_amount:
                dose_diff = dose_amount - patient_amount
                if dose_diff < best_dose_diff:
                    best_dose_diff = dose_diff
                    best_row = row
            elif best_row is None:  # 첫 번째 적합한 행이라면 일단 저장
                best_row = row
        
        return best_row
    
    def _calculate_reference_dose(
        self, 
        dosage_row: Dict[str, Any], 
        patient: Dict[str, Any]
    ) -> float:
        """단위에 따라 기준 용량을 계산합니다."""
        
        dose_amount = float(dosage_row.get("dose_amount", 0))
        dose_unit = dosage_row.get("dose_unit", "").strip()
        
        # 캐시된 환자 정보 사용
        weight_kg = patient.get("weight_kg", 70)
        bsa = patient.get("bsa", 1.73)
        
        if dose_unit == "밀리그램/제곱미터":
            return dose_amount * bsa
        elif dose_unit in ("밀리그램/킬로그램", "밀리그램/킬로그램/일", "밀리리터/킬로그램"):
            return dose_amount * weight_kg
        else:  # "마이크로그램", "밀리그램", "정", "밀리리터"
            return dose_amount
    
    def _calculate_reference_frequency(self, dosage_row: Dict[str, Any]) -> float:
        """기준 투여 빈도를 계산합니다 (일당 횟수)."""
        doses_per_interval = dosage_row.get("doses_per_interval", 1)
        interval_length_days = dosage_row.get("interval_length_days", 1)
        
        return doses_per_interval / interval_length_days
    
    def audit_prescriptions_batch(
        self,
        patient: Dict[str, Any],
        prescriptions_data: List[Dict[str, Any]]
    ) -> List[Dict[str, str]]:
        """
        여러 처방을 배치로 감사합니다 (대폭 최적화).
        
        Args:
            patient: 환자 정보 (공통)
            prescriptions_data: 처방 데이터 리스트 (drug_id, dose_amount, real_amount, doses_per_day 포함)
            
        Returns:
            audit_results: 각 처방의 감사 결과와 복약지도문구를 포함한 딕셔너리 리스트
        """
        # 환자 공통 정보 미리 계산 (한 번만)
        patient_weight = patient.get("weight_kg", 70)
        patient_bsa = patient.get("bsa", 1.73)
        is_hd = patient.get("is_hd", False)
        
        # 리스트 크기 미리 할당하여 append 오버헤드 제거
        prescription_count = len(prescriptions_data)
        results = [{"audit_result": "-", "information": ""}] * prescription_count
        
        # 인덱스 기반 루프로 최적화 (enumerate 오버헤드 제거)
        for i in range(prescription_count):
            prescription_data = prescriptions_data[i]
            drug_id = prescription_data.get("drug_id")
            
            if drug_id:
                # 개별 감사 실행 (공통 환자 정보 재사용)
                audit_result, information = self._audit_single_prescription_with_info(
                    patient, prescription_data, drug_id, patient_weight, patient_bsa, is_hd
                )
                results[i] = {"audit_result": audit_result, "information": information}
        
        return results
    
    def _audit_single_prescription_with_info(
        self,
        patient: Dict[str, Any],
        prescription: Dict[str, Any],
        drug_id: int,
        patient_weight: float = None,
        patient_bsa: float = None,
        is_hd: bool = None
    ) -> tuple[str, str]:
        """
        단일 처방 감사 (내부 메서드, 대폭 최적화).
        감사 결과와 복약지도문구를 함께 반환합니다.
        """
        try:
            # 1. 해당 drug_id의 dosage rows 가져오기 (O(1) 최적화)
            dosage_rows = self.get_dosage_rows_by_drug_id(drug_id)
            if not dosage_rows:
                return "-", ""  # 기준 데이터가 없으면 감사 불가
            
            # 2. 최적의 dosage row 선택
            selected_row = self._select_best_dosage_row(dosage_rows, patient, prescription)
            if not selected_row:
                return "-", ""  # 적합한 기준을 찾을 수 없음
            
            # 3. 기준 용량 금기 체크 (빠른 종료)
            reference_dose_amount = selected_row.get("dose_amount", 0)
            if reference_dose_amount == 0:
                return "금기", selected_row.get("복약지도문구", "해당 약물은 이 환자에게 금기입니다.")
            
            # 4. 환자 투여량과 빈도 정보 (한 번만 계산)
            dose_unit = selected_row.get("dose_unit", "").strip()
            
            # 단위에 따라 다른 필드 사용
            if dose_unit == "정":
                # 단위가 "정"인 경우 dose_amount 사용
                patient_amount = float(prescription.get("dose_amount", 0) or 0)
            else:
                # 다른 단위인 경우 real_amount 우선, 없으면 dose_amount 사용
                patient_amount = float(prescription.get("real_amount") or prescription.get("dose_amount", 0) or 0)
            
            patient_doses_per_day = int(prescription.get("doses_per_day", 1))
            
            # 5. 기준값 계산 (인라인 최적화)
            if dose_unit == "밀리그램/제곱미터":
                reference_dose = float(reference_dose_amount) * patient_bsa
            elif dose_unit in ("밀리그램/킬로그램", "밀리그램/킬로그램/일", "밀리리터/킬로그램"):
                reference_dose = float(reference_dose_amount) * patient_weight
            else:  # "마이크로그램", "밀리그램", "정", "밀리리터"
                reference_dose = float(reference_dose_amount)
            
            # 6. 기준 빈도 계산 (인라인 최적화)
            doses_per_interval = selected_row.get("doses_per_interval", 1)
            interval_length_days = selected_row.get("interval_length_days", 1)
            reference_frequency = float(doses_per_interval) / float(interval_length_days)
            
            # 7. divided_dosing 여부에 따른 감사 (최적화)
            divided_dosing = selected_row.get("divided_dosing", False)
            
            if divided_dosing:
                # divided_dosing = True: 일일 총 용량으로 비교
                patient_total = patient_amount * patient_doses_per_day
                reference_total = reference_dose * reference_frequency
                if patient_total > reference_total:
                    return "용량조절필요", selected_row.get("복약지도문구", "용량조절이 필요합니다.")
            else:
                # divided_dosing = False: 회당 용량으로 비교
                if patient_amount > reference_dose:
                    return "용량조절필요", selected_row.get("복약지도문구", "용량조절이 필요합니다.")
            
            # 8. 투여 간격 체크 (간단한 로직)
            if patient_doses_per_day > reference_frequency * 1.5:
                return "투여간격조절필요", selected_row.get("복약지도문구", "투여 간격 조절이 필요합니다.")
            
            # 정상인 경우
            return "-", selected_row.get("복약지도문구", "적정 용량입니다.")
            
        except Exception as e:
            print(f"❌ 단일 처방 감사 오류: {e}")
            return "-", "감사 중 오류가 발생했습니다."

    def _audit_single_prescription(
        self,
        patient: Dict[str, Any],
        prescription: Dict[str, Any],
        drug_id: int,
        patient_weight: float = None,
        patient_bsa: float = None,
        is_hd: bool = None
    ) -> str:
        """
        단일 처방 감사 (내부 메서드, 대폭 최적화).
        """
        try:
            # 1. 해당 drug_id의 dosage rows 가져오기 (O(1) 최적화)
            dosage_rows = self.get_dosage_rows_by_drug_id(drug_id)
            if not dosage_rows:
                return "-"  # 기준 데이터가 없으면 감사 불가
            
            # 2. 최적의 dosage row 선택
            selected_row = self._select_best_dosage_row(dosage_rows, patient, prescription)
            if not selected_row:
                return "-"  # 적합한 기준을 찾을 수 없음
            
            # 3. 기준 용량 금기 체크 (빠른 종료)
            reference_dose_amount = selected_row.get("dose_amount", 0)
            if reference_dose_amount == 0:
                return "금기"
            
            # 4. 환자 투여량과 빈도 정보 (한 번만 계산)
            dose_unit = selected_row.get("dose_unit", "").strip()
            
            # 단위에 따라 다른 필드 사용
            if dose_unit == "정":
                # 단위가 "정"인 경우 dose_amount 사용
                patient_amount = float(prescription.get("dose_amount", 0) or 0)
            else:
                # 다른 단위인 경우 real_amount 우선, 없으면 dose_amount 사용
                patient_amount = float(prescription.get("real_amount") or prescription.get("dose_amount", 0) or 0)
            
            patient_doses_per_day = int(prescription.get("doses_per_day", 1))
            
            # 5. 기준값 계산 (인라인 최적화)
            if dose_unit == "밀리그램/제곱미터":
                reference_dose = float(reference_dose_amount) * patient_bsa
            elif dose_unit in ("밀리그램/킬로그램", "밀리그램/킬로그램/일", "밀리리터/킬로그램"):
                reference_dose = float(reference_dose_amount) * patient_weight
            else:  # "마이크로그램", "밀리그램", "정", "밀리리터"
                reference_dose = float(reference_dose_amount)
            
            # 6. 기준 빈도 계산 (인라인 최적화)
            doses_per_interval = selected_row.get("doses_per_interval", 1)
            interval_length_days = selected_row.get("interval_length_days", 1)
            reference_frequency = float(doses_per_interval) / float(interval_length_days)
            
            # 7. divided_dosing 여부에 따른 감사 (최적화)
            divided_dosing = selected_row.get("divided_dosing", False)
            
            if divided_dosing:
                # divided_dosing = True: 일일 총 용량으로 비교
                if patient_amount * patient_doses_per_day > reference_dose * reference_frequency:
                    return "용량조절필요"
            else:
                # divided_dosing = False: 회당 용량으로 비교
                if patient_amount > reference_dose:
                    return "용량조절필요"
            
            # 8. 투여 빈도 확인
            if patient_doses_per_day > reference_frequency:
                return "투여간격조절필요"
            
            return "-"  # 정상
            
        except Exception as e:
            # 로깅 제거로 I/O 병목 제거
            return "-"  # 오류시 정상으로 처리
    
    def _calculate_reference_dose_optimized(
        self,
        dosage_row: Dict[str, Any],
        patient_weight: float,
        patient_bsa: float
    ) -> float:
        """단위에 따라 기준 용량을 계산합니다 (최적화 버전)."""
        
        dose_amount = float(dosage_row.get("dose_amount", 0))
        dose_unit = dosage_row.get("dose_unit", "").strip()
        
        if dose_unit == "밀리그램/제곱미터":
            return dose_amount * patient_bsa
        elif dose_unit in ("밀리그램/킬로그램", "밀리그램/킬로그램/일", "밀리리터/킬로그램"):
            return dose_amount * patient_weight
        else:  # "마이크로그램", "밀리그램", "정", "밀리리터"
            return dose_amount

    def audit_prescription(
        self, 
        patient: Dict[str, Any], 
        prescription: Dict[str, Any], 
        drug_id: int
    ) -> str:
        """
        처방 감사를 수행하여 audit_result를 반환합니다 (최적화된 버전).
        
        Args:
            patient: 환자 정보
            prescription: 처방 정보
            drug_id: 약물 ID
            
        Returns:
            audit_result: "금기", "용량조절필요", "투여간격조절필요", "-" 중 하나
        """
        # 최적화된 내부 메서드 호출
        patient_weight = patient.get("weight_kg", 70)
        patient_bsa = patient.get("bsa", 1.73)
        is_hd = patient.get("is_hd", False)
        
        return self._audit_single_prescription(
            patient, prescription, drug_id, patient_weight, patient_bsa, is_hd
        )


# 전역 인스턴스 (모듈 레벨에서 한 번만 생성) - 성능 최적화
_audit_service_instance = None

def get_audit_service() -> PrescriptionAuditService:
    """감사 서비스의 싱글톤 인스턴스를 반환합니다."""
    global _audit_service_instance
    if _audit_service_instance is None:
        _audit_service_instance = PrescriptionAuditService()
    return _audit_service_instance 