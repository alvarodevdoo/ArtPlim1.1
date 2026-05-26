import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { QuickLookupProvider } from '@/contexts/QuickLookupContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Layout from '@/components/layout/Layout';
import { QuickLookupTrigger } from '@/components/quick-lookup/QuickLookupTrigger';
import { QuickLookupDrawer } from '@/components/quick-lookup/QuickLookupDrawer';
import { QuickLookupOrderViewer } from '@/components/quick-lookup/QuickLookupOrderViewer';
import { QuickLookupRouteWatcher } from '@/components/quick-lookup/QuickLookupRouteWatcher';

// Pages
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import PublicOrderView from '@/pages/PublicOrderView';
import DashboardSimple from '@/pages/DashboardSimple';
import Clientes from '@/pages/Clientes';
import Fornecedores from '@/pages/Fornecedores';
import Funcionarios from '@/pages/Funcionarios';
import Produtos from '@/pages/Produtos';
import Insumos from '@/pages/Insumos';
import Orcamentos from '@/pages/Orcamentos';
import Pedidos from '@/pages/Pedidos';
import CriarPedido from '@/pages/CriarPedido';
import CriarOrcamento from '@/pages/CriarOrcamento';
import Relatorios from '@/pages/Relatorios';
import Configuracoes from '@/pages/Configuracoes';
import Estoque from '@/pages/Estoque';
import Producao from '@/pages/Producao';
import Financeiro from '@/pages/Financeiro';
import EntradaNota from '@/pages/EntradaNota';
import Lucratividade from '@/pages/Lucratividade';
import TerminalProducao from '@/pages/TerminalProducao';
import Pendencias from '@/pages/Pendencias';

// Criar QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PUBLIC_PATH_PREFIXES = ['/p/', '/login', '/register'];

function GlobalOverlays() {
  const location = useLocation();
  const isPublic = PUBLIC_PATH_PREFIXES.some(p => location.pathname.startsWith(p));
  if (isPublic) return null;
  return (
    <>
      <QuickLookupRouteWatcher />
      <QuickLookupTrigger />
      <QuickLookupDrawer />
      <QuickLookupOrderViewer />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <QuickLookupProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <div className="min-h-screen bg-background">
            <Routes>
              {/* Rotas públicas */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/p/pedido" element={<PublicOrderView />} />
              <Route path="/p/pedido/:token" element={<PublicOrderView />} />

              {/* Rotas protegidas */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout>
                    <DashboardSimple />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/fornecedores" element={
                <ProtectedRoute>
                  <Layout>
                    <Fornecedores />
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
                <ProtectedRoute permission="admin.users">
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
                <ProtectedRoute permission="inventory.view">
                  <Layout>
                    <Insumos />
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

              <Route path="/orcamentos/criar" element={
                <ProtectedRoute>
                  <Layout>
                    <CriarOrcamento />
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

              <Route path="/pendencias" element={
                <ProtectedRoute>
                  <Layout>
                    <Pendencias />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/relatorios" element={
                <ProtectedRoute permission="finance.reports">
                  <Layout>
                    <Relatorios />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/configuracoes" element={
                <ProtectedRoute permission="admin.settings">
                  <Layout>
                    <Configuracoes />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/estoque" element={
                <ProtectedRoute permission="inventory.view">
                  <Layout>
                    <Estoque />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/producao" element={
                <ProtectedRoute permission="production.view">
                  <Layout>
                    <Producao />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/lucratividade" element={
                <ProtectedRoute permission="finance.reports">
                  <Layout>
                    <Lucratividade />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/producao/terminal" element={
                <ProtectedRoute permission="production.view">
                  <TerminalProducao />
                </ProtectedRoute>
              } />

              {/* ... (existing routes) ... */}

              <Route path="/financeiro" element={
                <ProtectedRoute permission="finance.view">
                  <Layout>
                    <Financeiro />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/insumos" element={
                <ProtectedRoute permission="inventory.view">
                  <Layout>
                    <Insumos />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/entrada-nfe" element={
                <ProtectedRoute permission="inventory.view">
                  <Layout>
                    <EntradaNota />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/estoque-consumo" element={<Navigate to="/insumos" replace />} />

              {/* Redirect para dashboard se logado */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            <Toaster position="top-right" />

            {/* Consulta rápida global (drawer + popup + atalho Ctrl+K) — somente em rotas autenticadas */}
            <GlobalOverlays />
          </div>
        </Router>
          </QuickLookupProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;