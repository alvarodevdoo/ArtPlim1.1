import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ModuleProtectedRouteProps {
  children: React.ReactNode;
  requiredSetting: 'enableEngineering' | 'enableWMS' | 'enableProduction' | 'enableFinance';
  redirectTo?: string;
}

const ModuleProtectedRoute: React.FC<ModuleProtectedRouteProps> = ({ 
  children, 
  requiredSetting, 
  redirectTo = '/' 
}) => {
  const { settings, loading } = useAuth();

  // Se ainda está carregando, mostrar loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se não há configurações ou o módulo está desabilitado, redirecionar
  if (!settings || !settings[requiredSetting]) {
    return <Navigate to={redirectTo} replace />;
  }

  // Se o módulo está habilitado, renderizar o componente
  return <>{children}</>;
};

export default ModuleProtectedRoute;