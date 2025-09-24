# CarePlus 개발 서버 시작 스크립트
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    CarePlus 개발 서버 시작" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 백엔드 설정
Write-Host "[1/3] 백엔드 의존성 확인 중..." -ForegroundColor Yellow
Set-Location backend

if (-not (Test-Path "venv")) {
    Write-Host "가상환경이 없습니다. 생성 중..." -ForegroundColor Yellow
    python -m venv venv
}

Write-Host "가상환경 활성화 중..." -ForegroundColor Green
& "venv\Scripts\Activate.ps1"

Write-Host "Python 패키지 설치 중..." -ForegroundColor Green
pip install -r requirements.txt

# 프론트엔드 설정
Write-Host ""
Write-Host "[2/3] 프론트엔드 의존성 확인 중..." -ForegroundColor Yellow
Set-Location ..

if (-not (Test-Path "node_modules")) {
    Write-Host "Node.js 패키지가 없습니다. 설치 중..." -ForegroundColor Yellow
    npm install
}

Write-Host ""
Write-Host "[3/3] 개발 서버 시작 중..." -ForegroundColor Yellow
Write-Host ""
Write-Host "🚀 백엔드 서버: http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "📖 API 문서: http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host "🌐 프론트엔드: http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "서버를 중지하려면 Ctrl+C를 누르세요." -ForegroundColor Red
Write-Host ""

# 백엔드 서버 시작 (백그라운드)
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD\backend
    & "venv\Scripts\Activate.ps1"
    python main.py
}

# 잠시 대기
Start-Sleep -Seconds 3

# 프론트엔드 서버 시작 (백그라운드)
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npm start
}

Write-Host ""
Write-Host "✅ 개발 서버가 시작되었습니다!" -ForegroundColor Green
Write-Host ""
Write-Host "서버 상태 확인:" -ForegroundColor Cyan
Write-Host "- 백엔드: $($backendJob.State)" -ForegroundColor White
Write-Host "- 프론트엔드: $($frontendJob.State)" -ForegroundColor White
Write-Host ""
Write-Host "서버를 중지하려면 아무 키나 누르세요..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# 작업 정리
Write-Host "서버를 중지하는 중..." -ForegroundColor Yellow
Stop-Job $backendJob, $frontendJob
Remove-Job $backendJob, $frontendJob
Write-Host "✅ 서버가 중지되었습니다." -ForegroundColor Green
