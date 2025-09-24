import json
import os
from typing import List, Dict, Any, Optional
from fastapi import HTTPException


class DrugService:
    """약물 정보 관련 서비스 클래스"""
    
    def __init__(self):
        self.hira_data: List[Dict[str, Any]] = []
        self.fda_data: List[Dict[str, Any]] = []
        self._load_hira_data()
        self._load_fda_data()
    
    def _load_hira_data(self) -> None:
        """HIRA 데이터를 로드합니다."""
        hira_data_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            "data", 
            "hira_data.json"
        )
        
        try:
            with open(hira_data_path, encoding="utf-8") as f:
                self.hira_data = json.load(f)
            print(f"HIRA 데이터 로드 성공: {len(self.hira_data)}개 항목")
        except FileNotFoundError:
            print(f"HIRA 데이터 파일을 찾을 수 없습니다: {hira_data_path}")
            self.hira_data = []
        except json.JSONDecodeError as e:
            print(f"HIRA JSON 파일 파싱 에러: {e}")
            self.hira_data = []
        except Exception as e:
            print(f"HIRA 데이터 로드 실패: {e}")
            self.hira_data = []
    
    def _load_fda_data(self) -> None:
        """FDA 데이터를 로드하고 빠른 검색을 위한 인덱스를 생성합니다."""
        fda_data_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            "data", 
            "fda_data.json"
        )
        
        try:
            with open(fda_data_path, encoding="utf-8") as f:
                self.fda_data = json.load(f)
            print(f"FDA 데이터 로드 성공: {len(self.fda_data)}개 항목")
            
            # 빠른 검색을 위한 인덱스 생성 (품목일련번호 → FDA 항목)
            # HIRA 데이터의 품목기준코드는 문자열이므로, FDA 인덱스도 문자열 키로 생성
            self.fda_index = {}
            for item in self.fda_data:
                if isinstance(item, dict) and "품목일련번호" in item:
                    item_serial = item["품목일련번호"]
                    if item_serial:
                        # 문자열로 변환하여 키로 사용
                        self.fda_index[str(item_serial)] = item
            
            print(f"FDA 인덱스 생성 완료: {len(self.fda_index)}개 항목")
            
        except FileNotFoundError:
            print(f"FDA 데이터 파일을 찾을 수 없습니다: {fda_data_path}")
            self.fda_data = []
            self.fda_index = {}
        except json.JSONDecodeError as e:
            print(f"FDA JSON 파일 파싱 에러: {e}")
            self.fda_data = []
            self.fda_index = {}
        except Exception as e:
            print(f"FDA 데이터 로드 실패: {e}")
            self.fda_data = []
            self.fda_index = {}
    
    def search_drugs_by_name(self, query: str, limit: int = 20) -> List[str]:
        """
        한글 상품명으로 약물을 검색합니다.
        
        Args:
            query: 검색어
            limit: 최대 반환 개수 (기본값: 20)
            
        Returns:
            검색된 약물명 리스트
            
        Raises:
            HTTPException: 데이터 로드 실패 시
        """
        if not self.hira_data:
            raise HTTPException(
                status_code=500, 
                detail="약물 데이터를 로드할 수 없습니다"
            )
        
        if not query or not query.strip():
            return []
        
        try:
            result = []
            query = query.strip()
            
            for item in self.hira_data:
                if isinstance(item, dict) and "한글상품명(약품규격)" in item:
                    drug_name_with_spec = item["한글상품명(약품규격)"]
                    if query in drug_name_with_spec:
                        result.append(drug_name_with_spec)
            
            # 중복 제거 및 제한된 개수만 반환
            unique_result = list(dict.fromkeys(result))[:limit]
            print(f"약물 검색 쿼리 '{query}': {len(unique_result)}개 결과")
            
            return unique_result
            
        except Exception as e:
            print(f"약물 검색 에러: {e}")
            raise HTTPException(
                status_code=500, 
                detail=f"약물 검색 중 서버 에러가 발생했습니다: {str(e)}"
            )
    
    def get_drug_info_by_name(self, drug_name: str) -> Optional[Dict[str, Any]]:
        """
        약물명으로 상세 정보를 가져옵니다.
        
        Args:
            drug_name: 약물명 (한글상품명(약품규격) 형태)
            
        Returns:
            약물 정보 딕셔너리 또는 None
        """
        if not self.hira_data:
            return None
        
        for item in self.hira_data:
            if isinstance(item, dict) and "한글상품명(약품규격)" in item:
                if item["한글상품명(약품규격)"] == drug_name:
                    return item
        
        return None
    
    def get_english_ingredient_by_korean_name(self, korean_drug_name: str) -> str:
        """
        한글상품명(약품규격)으로 영문성분명을 가져옵니다.
        
        Args:
            korean_drug_name: 한글상품명(약품규격)
            
        Returns:
            영문성분명 또는 "-" (찾을 수 없는 경우)
        """
        try:
            # 1. HIRA 데이터에서 품목기준코드 찾기
            item_standard_code = None
            for hira_item in self.hira_data:
                if (isinstance(hira_item, dict) and 
                    "한글상품명(약품규격)" in hira_item and 
                    "품목기준코드" in hira_item):
                    
                    if hira_item["한글상품명(약품규격)"] == korean_drug_name:
                        item_standard_code = hira_item["품목기준코드"]
                        break
            
            if not item_standard_code:
                print(f"품목기준코드를 찾을 수 없습니다: {korean_drug_name}")
                return "-"
            
            # 2. FDA 데이터에서 품목일련번호로 영문성분명 찾기
            # 품목기준코드와 품목일련번호가 같은 값이라고 가정
            # 문자열로 변환하여 검색 (FDA 인덱스가 문자열 키로 구성됨)
            fda_item = self.fda_index.get(str(item_standard_code))
            
            if fda_item and "영문성분명" in fda_item:
                english_ingredient = fda_item["영문성분명"]
                print(f"영문성분명 찾음: {korean_drug_name} → {english_ingredient}")
                return english_ingredient
            else:
                print(f"영문성분명을 찾을 수 없습니다: {korean_drug_name} (코드: {item_standard_code})")
                return "-"
                
        except Exception as e:
            print(f"영문성분명 검색 중 에러: {e}")
            return "-"
    
    def get_unit_by_korean_name(self, korean_drug_name: str) -> str:
        """
        한글상품명(약품규격)으로 단위(제형구분)를 가져옵니다.
        
        Args:
            korean_drug_name: 한글상품명(약품규격)
            
        Returns:
            제형구분 또는 "-" (찾을 수 없는 경우)
        """
        if not self.hira_data:
            return "-"
        
        try:
            # 동일한 한글상품명을 가진 모든 항목을 찾아서
            # 첫 번째로 비어있지 않은 제형구분 값을 반환
            for item in self.hira_data:
                if (isinstance(item, dict) and 
                    "한글상품명(약품규격)" in item and 
                    item["한글상품명(약품규격)"] == korean_drug_name):
                    
                    # 제형구분 필드 확인
                    if "제형구분" in item:
                        unit_value = item["제형구분"]
                        # 값이 있고 비어있지 않은 경우 반환
                        if unit_value and str(unit_value).strip():
                            print(f"단위 찾음: {korean_drug_name} → {unit_value}")
                            return str(unit_value).strip()
            
            print(f"단위를 찾을 수 없습니다: {korean_drug_name}")
            return "-"
            
        except Exception as e:
            print(f"단위 검색 중 에러: {e}")
            return "-"

    def get_drug_details_with_unit(self, korean_drug_name: str) -> Optional[Dict[str, Any]]:
        """
        한글상품명(약품규격)으로 상세 정보와 단위를 함께 가져옵니다.
        
        Args:
            korean_drug_name: 한글상품명(약품규격)
            
        Returns:
            약물 상세 정보 + 단위
        """
        # HIRA 기본 정보 가져오기
        hira_info = self.get_drug_info_by_name(korean_drug_name)
        if not hira_info:
            return None
        
        # 단위 추가
        unit = self.get_unit_by_korean_name(korean_drug_name)
        
        result = hira_info.copy()
        result["단위"] = unit
        
        return result

    def get_drug_complete_info(self, korean_drug_name: str) -> Optional[Dict[str, Any]]:
        """
        한글상품명(약품규격)으로 완전한 정보(영문성분명 + 단위)를 가져옵니다.
        
        Args:
            korean_drug_name: 한글상품명(약품규격)
            
        Returns:
            약물 상세 정보 + 영문성분명 + 단위
        """
        # HIRA 기본 정보 가져오기
        hira_info = self.get_drug_info_by_name(korean_drug_name)
        if not hira_info:
            return None
        
        # 영문성분명과 단위 추가
        english_ingredient = self.get_english_ingredient_by_korean_name(korean_drug_name)
        unit = self.get_unit_by_korean_name(korean_drug_name)
        
        result = hira_info.copy()
        result["영문성분명"] = english_ingredient
        result["단위"] = unit
        
        return result

    def get_total_drug_count(self) -> int:
        """전체 약물 데이터 개수를 반환합니다."""
        return len(self.hira_data)
    
    def get_total_fda_count(self) -> int:
        """전체 FDA 데이터 개수를 반환합니다."""
        return len(self.fda_data)


# 싱글톤 인스턴스
drug_service = DrugService() 