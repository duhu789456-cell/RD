# CarePlus - 신기능용량감사 시스템

CarePlus 신기능용량감사 시스템의 풀스택 애플리케이션입니다.

## 주요 기능

- 📊 대시보드: 감사 현황 및 통계 정보 표시
- 📋 감사 관리: 신기능용량감사 등록 및 관리
- 📈 데이터 분석: 감사 데이터 분석 및 시각화
- 📄 보고서: 감사 결과 보고서 생성

## 기술 스택

### 프론트엔드
- React 18
- TypeScript
- CSS3 (모던 레이아웃 및 애니메이션)

### 백엔드
- FastAPI
- Python 3.10+
- SQLAlchemy
- SQLite

## 🚀 원클릭 개발 서버 실행

### 방법 1: 배치 파일 사용 (추천)
```bash
# 더블클릭으로 실행
start_dev.bat
```

### 방법 2: PowerShell 스크립트 사용
```bash
# PowerShell에서 실행
.\start_dev.ps1
```

### 방법 3: npm 스크립트 사용
```bash
# 배치 파일 실행
npm run dev

# PowerShell 스크립트 실행
npm run dev:ps
```

## 📋 수동 설치 및 실행

### 필수 요구사항
- Node.js 16.0.0 이상
- Python 3.10 이상
- npm 또는 yarn

### 백엔드 설정
```bash
# 백엔드 디렉토리로 이동
cd backend

# 가상환경 생성 및 활성화
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# 의존성 설치
pip install -r requirements.txt

# 서버 실행
python main.py
```

### 프론트엔드 설정
```bash
# 루트 디렉토리에서
npm install
npm start
```

## 🌐 접속 정보

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://127.0.0.1:8000
- **API 문서**: http://127.0.0.1:8000/docs
- **ReDoc**: http://127.0.0.1:8000/redoc

## 📁 프로젝트 구조

```
CarePlus_frontend/
├── src/                    # React 프론트엔드
│   ├── components/         # React 컴포넌트
│   ├── services/          # API 서비스
│   └── hooks/             # 커스텀 훅
├── backend/               # FastAPI 백엔드
│   ├── models/            # 데이터베이스 모델
│   ├── routers/           # API 라우터
│   ├── services/          # 비즈니스 로직
│   └── schemas/           # Pydantic 스키마
├── start_dev.bat          # Windows 원클릭 실행
├── start_dev.ps1          # PowerShell 원클릭 실행
└── package.json           # npm 스크립트 설정
```

## 🛠️ 개발 도구

### 사용 가능한 npm 스크립트
```bash
npm run dev          # 원클릭 개발 서버 실행 (배치 파일)
npm run dev:ps       # PowerShell로 개발 서버 실행
npm run backend      # 백엔드만 실행
npm run backend:install  # 백엔드 의존성 설치
npm start            # 프론트엔드만 실행
npm run build        # 프로덕션 빌드
```

## 🎨 주요 컴포넌트

### Dashboard
- 감사 통계 정보 표시
- 최근 감사 현황
- 빠른 액션 버튼

### StatCard
- 통계 데이터를 카드 형태로 표시
- 색상별 구분 및 호버 효과

### RecentAudits
- 최근 감사 목록 표시
- 상태별 색상 구분

### QuickActions
- 주요 기능에 대한 빠른 접근 버튼
- 직관적인 아이콘과 설명

## 🎨 스타일링

- 모던하고 깔끔한 디자인
- 반응형 레이아웃
- 부드러운 애니메이션 효과
- 색상 테마: 파란색 계열 (#3498db, #2c3e50)

## 📄 라이선스

이 프로젝트는 내부 사용을 위한 것입니다. 