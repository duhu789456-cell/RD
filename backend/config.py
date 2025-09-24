from typing import List


class Settings:
    """애플리케이션 설정"""
    
    # 기본 설정
    app_title: str = "신기능 처방 감사 API"
    app_version: str = "1.0.0"
    app_description: str = "의료진을 위한 처방 감사 및 약물 정보 API 서버"
    
    # CORS 설정
    allowed_origins: List[str] = ["*"]  # 실제 배포시에는 특정 도메인으로 제한 권장
    allow_credentials: bool = True
    allowed_methods: List[str] = ["*"]
    allowed_headers: List[str] = ["*"]
    
    # 개발 모드
    debug: bool = True


# 설정 인스턴스
settings = Settings() 