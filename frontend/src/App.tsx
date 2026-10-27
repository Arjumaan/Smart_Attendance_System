import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import EnterpriseConsole from './pages/EnterpriseConsole';
import EmployeeLoginPage from './pages/EmployeeLoginPage';
import EmployeePortalPage from './pages/EmployeePortalPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main Enterprise Management & Live Kiosk Console */}
        <Route path="/" element={<EnterpriseConsole />} />

        {/* Dedicated Employee Login Page (/emp_login) - Completely separate, NO quick sign-ins */}
        <Route path="/emp_login" element={<EmployeeLoginPage />} />

        {/* Dedicated Employee Portal (/employee) - Personal attendance & leaves, NO Live Kiosk */}
        <Route path="/employee" element={<EmployeePortalPage />} />
        <Route path="/employee/portal" element={<Navigate to="/employee" replace />} />

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
