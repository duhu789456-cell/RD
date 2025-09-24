import requests
import json

# 테스트 데이터
test_data = {
    "patient": {
        "name": "테스트 환자",
        "gender": "male",
        "birthDate": "1990-01-01",
        "weight": "70",
        "height": "170",
        "scr": "1.0",
        "bsa": "1.8",
        "isOnDialysis": False,
        "egfr": "90",
        "crcl": "100",
        "crclNormalized": "100"
    },
    "medications": [
        {
            "productName": "아스피린정100밀리그램",
            "ingredientName": "아스피린",
            "dosage": "100",
            "unit": "mg",
            "frequency": "1",
            "duration": "30"
        },
        {
            "productName": "리피토정10밀리그램",
            "ingredientName": "아토르바스타틴",
            "dosage": "10",
            "unit": "mg",
            "frequency": "1",
            "duration": "30"
        }
    ]
}

# 감사 실행 요청 보내기
try:
    response = requests.post(
        "http://localhost:8000/api/audit/execute",
        json=test_data,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"응답 상태 코드: {response.status_code}")
    print(f"응답 내용: {response.text}")
    
    if response.status_code == 200:
        result = response.json()
        order_id = result.get("order_id")
        print(f"✅ 감사 완료! Order ID: {order_id}")
        
        # 결과 확인을 위해 감사 기록 조회
        history_response = requests.get("http://localhost:8000/api/audit/history")
        if history_response.status_code == 200:
            history = history_response.json()
            print("\n📋 감사 기록:")
            for record in history["history"][:1]:  # 최신 1개만 확인
                print(f"  주문 ID: {record['order_id']}")
                print(f"  환자 ID: {record['patient_id']}")
                print(f"  환자 이름: {record['patient_name']}")
                print(f"  처방 개수: {record['prescription_count']}")
                print(f"  처방 목록:")
                for prescription in record["prescriptions"]:
                    print(f"    - {prescription['drug_name']}: {prescription['audit_result']}")
                    
    else:
        print(f"❌ 감사 실패: {response.status_code}")
        
except Exception as e:
    print(f"❌ 테스트 실행 중 오류: {e}") 