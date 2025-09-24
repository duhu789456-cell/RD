@echo off
echo ========================================
echo    CarePlus 개발 서버 시작
echo ========================================
echo.

echo [1/3] 백엔드 의존성 확인 중...
cd backend
if not exist "venv" (
    echo 가상환경이 없습니다. 생성 중...
    python -m venv venv
)

echo 가상환경 활성화 중...
call venv\Scripts\activate.bat

echo Python 패키지 설치 중...
pip install -r requirements.txt

echo.
echo [2/3] 프론트엔드 의존성 확인 중...
cd ..
if not exist "node_modules" (
    echo Node.js 패키지가 없습니다. 설치 중...
    npm install
)

echo.
echo [3/3] 개발 서버 시작 중...
echo.
echo 🚀 백엔드 서버: http://127.0.0.1:8000
echo 📖 API 문서: http://127.0.0.1:8000/docs
echo 🌐 프론트엔드: http://localhost:3000
echo.
echo 서버를 중지하려면 Ctrl+C를 누르세요.
echo.

start "백엔드 서버" cmd /k "cd backend && call venv\Scripts\activate.bat && python main.py"
timeout /t 3 /nobreak >nul
start "프론트엔드 서버" cmd /k "npm start"

echo.
echo ✅ 개발 서버가 시작되었습니다!
echo.
pause
