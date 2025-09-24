from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import drug_router, patient_router, prescription_router, audit_router
from config import settings


def create_app() -> FastAPI:
    """FastAPI 애플리케이션을 생성하고 설정합니다."""
    
    # FastAPI 앱 생성
    app = FastAPI(
        title=settings.app_title,
        version=settings.app_version,
        description=settings.app_description,
        debug=settings.debug,
    )
    
    # CORS 미들웨어 추가
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=settings.allow_credentials,
        allow_methods=settings.allowed_methods,
        allow_headers=settings.allowed_headers,
    )
    
    # 라우터 등록
    app.include_router(drug_router.router)
    app.include_router(patient_router.router)
    app.include_router(prescription_router.router)
    app.include_router(audit_router.router)
    
    return app


# FastAPI 앱 인스턴스
app = create_app()


@app.get("/")
def read_root():
    """API 서버 상태 확인"""
    return {
        "message": f"{settings.app_title} 서버가 실행 중입니다",
        "version": settings.app_version,
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
def health_check():
    """헬스 체크 엔드포인트"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    
    print(f"🚀 {settings.app_title} v{settings.app_version} 시작 중...")
    print("📖 API 문서: http://127.0.0.1:8000/docs")
    print("🔄 자동 새로고침 모드로 실행")
    
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    ) 