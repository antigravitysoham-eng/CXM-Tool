import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import CashHorizon from './pages/CashHorizon';
import AgentHQ from './pages/AgentHQ';
import UserManagement from './pages/UserManagement';
import CLM from './pages/CLM';
import Documents from './pages/Documents';
import GPTView from './pages/GPTView';
import Onboarding from './pages/Onboarding';
import Training from './pages/Training';
import HealthChecks from './pages/HealthChecks';
import EBR from './pages/EBR';
import Surveys from './pages/Surveys';
import JourneyMap from './pages/JourneyMap';
import SupportMetrics from './pages/SupportMetrics';
import FeatureRequests from './pages/FeatureRequests';
import Upsells from './pages/Upsells';
import Comms from './pages/Comms';
import Events from './pages/Events';
import Login from './pages/Login';
import Referrals from './pages/Referrals';
import Connectivity from './pages/Connectivity';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ViewProvider } from './context/ViewContext';
import { useView } from './context/view';
import { CXProvider } from './context/CXContext';
import Toast from './components/Toast';

const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-spinner" role="status" aria-label="Loading" />
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

// The index route follows the user's chosen view, so the platform reopens the
// way they left it instead of always landing on the dashboard.
const IndexRoute = () => {
  const { view } = useView();
  return view === 'gpt' ? <Navigate to="/gpt" replace /> : <Dashboard />;
};

const AppRoutes = () => {
  const { token } = useAuth();
  return (
    <CXProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!token ? <Login /> : <Navigate to="/" replace />} />
          <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<IndexRoute />} />
            <Route path="gpt" element={<GPTView />} />
            <Route path="cash-horizon" element={<CashHorizon />} />
            <Route path="agents" element={<AgentHQ />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="directory" element={<Navigate to="/cash-horizon" replace />} />
            <Route path="clm" element={<CLM />} />
            <Route path="documents" element={<Documents />} />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="training" element={<Training />} />
            <Route path="health-checks" element={<HealthChecks />} />
            <Route path="ebrs" element={<EBR />} />
            <Route path="surveys" element={<Surveys />} />
            <Route path="journey" element={<JourneyMap />} />
            <Route path="support" element={<SupportMetrics />} />
            <Route path="feature-requests" element={<FeatureRequests />} />
            <Route path="upsells" element={<Upsells />} />
            <Route path="comms" element={<Comms />} />
            <Route path="events" element={<Events />} />
            <Route path="referrals" element={<Referrals />} />
            <Route path="connectivity" element={<Connectivity />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toast />
    </CXProvider>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ViewProvider>
          <AppRoutes />
        </ViewProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
