import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import ModuleProtectedRoute from '@/components/auth/ModuleProtectedRoute';
import Layout from '@/components/layout/Layout';

// Pages
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardSimple from '@/pages/DashboardSimple';
import Clientes from '@/pages/Clientes';
import Funcionarios from '@/pages/Funcionarios';
import Produtos from '@/pages/Produtos';
import Materiais from '@/pages/Materiais';
import Orcamentos from '@/pages/Orcamentos';
import Pedidos from '@/pages/Pedidos';
import CriarPedido from '@/pages/CriarPedido';
import Relatorios from '@/pages/Relatorios';
import Configuracoes from '@/pages/Configuracoes';
import Estoque from '@/pages/Estoque';
import Producao from '@/pages/Producao';
import Financeiro from '@/pages/Financeiro';

// Criar QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <div className="min-h-screen bg-background">
            <Routes>
              {/* Rotas públicas */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              
              {/* Rotas protegidas */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout>
                    <DashboardSimple />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/clientes" element={
                <ProtectedRoute>
                  <Layout>
                    <Clientes />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/funcionarios" element={
                <ProtectedRoute>
                  <Layout>
                    <Funcionarios />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/produtos" element={
                <ProtectedRoute>
                  <Layout>
                    <Produtos />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/materiais" element={
                <ProtectedRoute>
                  <Layout>
                    <Materiais />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/orcamentos" element={
                <ProtectedRoute>
                  <Layout>
                    <Orcamentos />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/pedidos" element={
                <ProtectedRoute>
                  <Layout>
                    <Pedidos />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/pedidos/criar" element={
                <ProtectedRoute>
                  <Layout>
                    <CriarPedido />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/relatorios" element={
                <ProtectedRoute>
                  <Layout>
                    <Relatorios />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/configuracoes" element={
                <ProtectedRoute>
                  <Layout>
                    <Configuracoes />
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/estoque" element={
                <ProtectedRoute>
                  <Layout>
                    <ModuleProtectedRoute requiredSetting="enableWMS">
                      <Estoque />
                    </ModuleProtectedRoute>
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/producao" element={
                <ProtectedRoute>
                  <Layout>
                    <ModuleProtectedRoute requiredSetting="enableProduction">
                      <Producao />
                    </ModuleProtectedRoute>
                  </Layout>
                </ProtectedRoute>
              } />
              
              <Route path="/financeiro" element={
                <ProtectedRoute>
                  <Layout>
                    <ModuleProtectedRoute requiredSetting="enableFinance">
                      <Financeiro />
                    </ModuleProtectedRoute>
                  </Layout>
                </ProtectedRoute>
              } />
              
              {/* Redirect para dashboard se logado */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            
            <Toaster position="top-right" />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;