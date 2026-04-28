import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Clientes from './components/Clientes';
import HojasDeServicio from './components/HojasDeServicio';
import GestionU2 from './components/GestionU2';
import EntrevistaHub from './components/EntrevistaHub';
import AsesoriaAcompanamientoDashboard from './components/AsesoriaAcompanamientoDashboard';
import OperacionesDashboard from './components/OperacionesDashboard';
import TesoreriaDashboard from './components/TesoreriaDashboard';
import ContabilidadDashboard from './components/ContabilidadDashboard';
import CapitalHumanoDashboard from './components/CapitalHumanoDashboard';
import AdminPanel from './components/AdminPanel';
import ClientView from './components/ClientView';
import OnboardingExpress from './components/OnboardingExpress';
import ExternalSignature from './components/ExternalSignature';
import Login from './components/Login';
import AISidebar from './components/AISidebar';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { CaseProvider, useCase } from './components/CaseContext';
import { useLocation } from 'react-router-dom';

function AppRoutes() {
  const { user, loading } = useAuth();
  const { currentCase } = useCase();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isInterviewRoute = location.pathname === '/entrevista';

  const checkAccess = (allowedRoles: string[]) => {
    if (!user) return false;
    const roleLower = user.role?.toLowerCase() || '';
    const roleNormalized = roleLower.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    // Always grant access to Admin
    if (roleNormalized === 'admin') return true;

    return allowedRoles.some(allowed => {
      const allowedNormalized = allowed.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      return roleNormalized === allowedNormalized;
    });
  };

  return (
    <Routes>
      {/* Vista del Cliente (Sin Layout) */}
      <Route path="/firma/:clienteId" element={<ClientView />} />
      <Route path="/firma-externa/:clienteId" element={<ExternalSignature />} />
      <Route path="/onboarding" element={<OnboardingExpress />} />
      
      {/* Login */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />

      {/* App Protegida */}
      <Route path="/*" element={
        user ? (
          <Layout>
            <Routes>
              <Route path="/" element={checkAccess(['admin']) ? <Dashboard /> : <Navigate to="/entrevista" />} />
              <Route path="/entrevista" element={<EntrevistaHub />} />
              <Route path="/asesoria" element={checkAccess(['asesoria', 'admin']) ? <AsesoriaAcompanamientoDashboard /> : <Navigate to="/entrevista" />} />
              <Route path="/operaciones" element={checkAccess(['operaciones', 'admin']) ? <OperacionesDashboard /> : <Navigate to="/entrevista" />} />
              <Route path="/tesoreria" element={checkAccess(['tesoreria', 'admin']) ? <TesoreriaDashboard /> : <Navigate to="/entrevista" />} />
              <Route path="/contabilidad" element={checkAccess(['contabilidad', 'admin']) ? <ContabilidadDashboard /> : <Navigate to="/entrevista" />} />
              <Route path="/capital-humano" element={checkAccess(['capital humano', 'admin']) ? <CapitalHumanoDashboard /> : <Navigate to="/entrevista" />} />
              <Route path="/admin" element={checkAccess(['admin']) ? <AdminPanel /> : <Navigate to="/entrevista" />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/hojas" element={checkAccess(['admin']) ? <HojasDeServicio /> : <Navigate to="/entrevista" />} />
              <Route path="/gestion" element={checkAccess(['admin']) ? <GestionU2 /> : <Navigate to="/entrevista" />} />
            </Routes>
            {isInterviewRoute && <AISidebar context={{ user, currentCase }} />}
          </Layout>
        ) : (
          <Navigate to="/login" />
        )
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CaseProvider>
        <Router>
          <AppRoutes />
        </Router>
      </CaseProvider>
    </AuthProvider>
  );
}
