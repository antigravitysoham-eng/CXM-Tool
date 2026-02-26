import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Directory from './pages/Directory';
import CLM from './pages/CLM';
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

import { CXProvider } from './context/CXContext';
import Toast from './components/Toast';

function App() {
  return (
    <CXProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="directory" element={<Directory />} />
            <Route path="clm" element={<CLM />} />
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
          </Route>
        </Routes>
      </BrowserRouter>
      <Toast />
    </CXProvider>
  );
}

export default App;
