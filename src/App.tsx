import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import QuickActions from './components/QuickActions';
import PrescriptionInput from './components/PrescriptionInput';
import AuditHistory from './components/AuditHistory';
import PatientManagement from './components/PatientManagement';
import NewAudit from './components/NewAudit';

function App() {

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={
            <div className="container">
              <div className="page-header">
                <h1>RenalDose</h1>
                <p>신기능 기반 처방 적정성 평가를 위한 약사용 임상의사결정지원 시스템</p>
              </div>
              <QuickActions />
            </div>
          } />
          <Route path="/prescription" element={<PrescriptionInput />} />
          <Route path="/audit-history" element={<AuditHistory />} />
          <Route path="/patient-management" element={<PatientManagement />} />
          <Route path="/test" element={<NewAudit />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 