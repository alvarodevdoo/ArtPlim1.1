import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionType } from '@/lib/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  permission?: PermissionType;
}

export function ProtectedRoute({ children, allowedRoles, permission }: ProtectedRouteProps) {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 1. Verificar permissão específica (RBAC + Settings)
  if (permission && !hasPermission(permission)) {
    console.warn(`Acesso negado para permissão: ${permission}`);
    return <Navigate to="/" replace />;
  }

  // 2. Verificar permissão genérica por cargo (RBAC legado)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    console.warn(`Acesso negado para o cargo: ${user.role}. Cargos permitidos: ${allowedRoles.join(', ')}`);
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}