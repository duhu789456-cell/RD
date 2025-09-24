#!/usr/bin/env python3
"""
신기능 처방 감사 API 서버 실행 스크립트
"""

import uvicorn
from config import settings


def main():
    """서버를 실행합니다."""
    print("=" * 60)
    print(f"🚀 {settings.app_title}")
    print(f"📦 버전: {settings.app_version}")
    print("=" * 60)
    print("📖 API 문서:")
    print("   - Swagger UI: http://127.0.0.1:8000/docs")
    print("   - ReDoc: http://127.0.0.1:8000/redoc")
    print("🔗 API 엔드포인트:")
    print("   - 기본: http://127.0.0.1:8000/")
    print("   - 약물 검색: http://127.0.0.1:8000/api/drugs?query=검색어")
    print("   - 헬스 체크: http://127.0.0.1:8000/health")
    print("=" * 60)
    print("🔄 자동 새로고침 모드로 실행 중...")
    print("서버를 중지하려면 Ctrl+C를 누르세요.")
    print("=" * 60)
    
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )


if __name__ == "__main__":
    main() 