from fastapi import APIRouter, Query, HTTPException
from typing import List
from services.drug_service import drug_service
from pydantic import BaseModel
import json

# 약물 관련 API 라우터
router = APIRouter(
    prefix="/api/drugs",
    tags=["drugs"],
    responses={404: {"description": "Not found"}},
)


class BatchDrugSearchRequest(BaseModel):
    drug_names: List[str]

class DrugSearchResult(BaseModel):
    drug_name: str
    found: bool
    drug_data: dict = None


@router.get("", response_model=List[str])
def search_drugs(query: str = Query("", description="검색할 약물명")):
    """
    약물명으로 자동완성 검색을 수행합니다.
    
    - **query**: 검색어 (한글 상품명)
    - 최대 20개까지 결과 반환
    """
    return drug_service.search_drugs_by_name(query)


@router.get("/search")
def search_drugs_with_details(name: str = Query(..., description="검색할 약물명")):
    """
    약물명으로 상세 정보를 검색합니다 (프론트엔드 최적화용).
    """
    # drug_service의 기존 메서드를 사용
    drug_info = drug_service.get_drug_info_by_name(name)
    
    if drug_info:
        return [{
            "품목기준코드": drug_info.get("품목기준코드"),
            "한글상품명": drug_info.get("한글상품명(약품규격)"),
            "영문성분명": drug_info.get("영문성분명"),
            "약품규격_숫자": drug_info.get("약품규격_숫자"),
            "제형구분": drug_info.get("제형구분")
        }]
    
    return []


@router.get("/info")
def get_drug_info(drug_name: str = Query(..., description="약물명")):
    """
    특정 약물의 상세 정보를 가져옵니다.
    
    - **drug_name**: 정확한 약물명
    """
    drug_info = drug_service.get_drug_info_by_name(drug_name)
    if drug_info is None:
        return {"message": "약물 정보를 찾을 수 없습니다"}
    return drug_info


@router.get("/count")
def get_drug_count():
    """
    전체 약물 데이터 개수를 반환합니다.
    """
    return {
        "hira_count": drug_service.get_total_drug_count(),
        "fda_count": drug_service.get_total_fda_count()
    }


@router.get("/english-ingredient")
def get_english_ingredient(drug_name: str = Query(..., description="한글상품명(약품규격)")):
    """
    한글상품명(약품규격)으로 영문성분명을 가져옵니다.
    
    - **drug_name**: 정확한 한글상품명(약품규격)
    """
    english_ingredient = drug_service.get_english_ingredient_by_korean_name(drug_name)
    if english_ingredient is None:
        return {"message": "영문성분명을 찾을 수 없습니다", "english_ingredient": None}
    return {"english_ingredient": english_ingredient}


@router.get("/unit")
def get_drug_unit(drug_name: str = Query(..., description="한글상품명(약품규격)")):
    """
    한글상품명(약품규격)으로 단위(제형구분)를 가져옵니다.
    
    - **drug_name**: 정확한 한글상품명(약품규격)
    """
    unit = drug_service.get_unit_by_korean_name(drug_name)
    return {"unit": unit, "drug_name": drug_name}


@router.get("/details")
def get_drug_details_with_ingredient(drug_name: str = Query(..., description="한글상품명(약품규격)")):
    """
    한글상품명(약품규격)으로 상세 정보와 영문성분명, 단위를 함께 가져옵니다.
    
    - **drug_name**: 정확한 한글상품명(약품규격)
    """
    details = drug_service.get_drug_complete_info(drug_name)
    if details is None:
        return {"message": "약물 정보를 찾을 수 없습니다"}
    return details 


@router.post("/batch-search", response_model=List[DrugSearchResult])
async def batch_search_drugs(request: BatchDrugSearchRequest):
    """여러 약물을 한 번에 조회하는 배치 API (최적화됨)"""
    try:
        results = []
        
        for drug_name in request.drug_names:
            # drug_service의 메모리 캐시된 데이터 사용 (파일 I/O 제거!)
            drug_info = drug_service.get_drug_info_by_name(drug_name)
            
            if drug_info:
                # HIRA 데이터 구조에 맞춰 매핑
                results.append(DrugSearchResult(
                    drug_name=drug_name,
                    found=True,
                    drug_data={
                        "제품명": drug_info.get("한글상품명(약품규격)"),
                        "품목기준코드": drug_info.get("품목기준코드"),
                        "업체명": drug_info.get("업체명"),
                        "성분명": drug_info.get("성분명"),
                        "급여구분": drug_info.get("급여구분"),
                        "제형구분": drug_info.get("제형구분"),
                        "약품규격_숫자": drug_info.get("약품규격_숫자")
                    }
                ))
            else:
                results.append(DrugSearchResult(
                    drug_name=drug_name,
                    found=False,
                    drug_data=None
                ))
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"배치 약물 검색 오류: {str(e)}") 