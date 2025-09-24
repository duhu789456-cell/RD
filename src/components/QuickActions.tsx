import React from 'react';
import { useNavigate } from 'react-router-dom';
import './QuickActions.css';

const QuickActions: React.FC = () => {
  const navigate = useNavigate();
  
  const actions = [
    {
      title: '처방 입력',
      description: '등록된 환자의 처방 정보를 입력하고 적정성을 평가합니다',
      icon: '💊',
      color: '#3498db',
      path: '/prescription'
    },
    {
      title: '처방 감사 이력 관리',
      description: '처방 적정성 평가 이력을 확인하고 관리합니다',
      icon: '📊',
      color: '#9b59b6',
      path: '/audit-history'
    },
    {
      title: '환자 정보 관리',
      description: '신규 환자 등록, 기존 환자 정보 수정 및 삭제 등 환자 정보를 관리합니다',
      icon: '👥',
      color: '#27ae60',
      path: '/patient-management'
    },
    {
      title: '직접 입력',
      description: '검사 수치와 처방 정보를 직접 입력하고 처방 적정성을 평가합니다',
      icon: '🧪',
      color: '#e74c3c',
      path: '/test'
    }
  ];

  const handleActionClick = (path: string) => {
    navigate(path);
  };

  return (
    <div className="quick-actions-main">
      <div className="actions-grid-main">
        {actions.map((action, index) => (
          <button 
            key={index} 
            className="action-button-main" 
            onClick={() => handleActionClick(action.path)}
          >
            <div className="action-icon-main" style={{ backgroundColor: action.color }}>
              {action.icon}
            </div>
            <div className="action-content-main">
              <div className="action-title-main">{action.title}</div>
              <div className="action-description-main">{action.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions; 