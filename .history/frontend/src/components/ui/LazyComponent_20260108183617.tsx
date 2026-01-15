import React, { Suspense, lazy } from 'react';
import { InlineLoader } from './loading-states';

interface LazyComponentProps {
  importFn: () => Promise<{ default: React.ComponentType<any> }>;
  fallback?: React.ReactNode;
  errorFallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  [key: string]: any;
}

const DefaultErrorFallback: React.FC<{ error: Error; retry: () => void }> = ({ error, retry }) => (
  <div className="flex flex-col items-center justify-center p-8 text-center">
    <div className="text-red-500 mb-4">
      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold mb-2">Erro ao carregar componente</h3>
    <p className="text-gray-600 mb-4">{error.message}</p>
    <button
      onClick={retry}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
    >
      Tentar novamente
    </button>
  </div>
);

export const LazyComponent: React.FC<LazyComponentProps> = ({
  importFn,
  fallback = <InlineLoader text="Carregando componente..." />,
  errorFallback: ErrorFallback = DefaultErrorFallback,
  ...props
}) => {
  const [Component, setComponent] = React.useState<React.ComponentType<any> | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [loading, setLoading] = React.useState(false);

  const loadComponent = React.useCallback(async () => {
    if (Component) return;

    setLoading(true);
    setError(null);

    try {
      const module = await importFn();
      setComponent(() => module.default);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }, [importFn, Component]);

  React.useEffect(() => {
    loadComponent();
  }, [loadComponent]);

  const retry = React.useCallback(() => {
    setComponent(null);
    setError(null);
    loadComponent();
  }, [loadComponent]);

  if (error) {
    return <ErrorFallback error={error} retry={retry} />;
  }

  if (loading || !Component) {
    return <>{fallback}</>;
  }

  return <Component {...props} />;
};

// Hook para criar componentes lazy com cache
export const useLazyComponent = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) => {
  const LazyComp = React.useMemo(
    () => lazy(importFn),
    [importFn]
  );

  return React.useCallback(
    (props: React.ComponentProps<T>) => (
      <Suspense fallback={<InlineLoader text="Carregando..." />}>
        <LazyComp {...props} />
      </Suspense>
    ),
    [LazyComp]
  );
};

// Componentes lazy pré-configurados para o sistema
export const LazyDashboard = lazy(() => import('../pages/Dashboard'));
export const LazyProductos = lazy(() => import('../pages/Produtos'));
export const LazyPedidos = lazy(() => import('../pages/Pedidos'));
export const LazyProducao = lazy(() => import('../pages/Producao'));
export const LazyPerformanceMonitor = lazy(() => import('../admin/PerformanceMonitor'));

// Wrapper para componentes lazy com loading personalizado
export const withLazyLoading = <P extends object>(
  Component: React.ComponentType<P>,
  loadingComponent?: React.ReactNode
) => {
  return React.forwardRef<any, P>((props, ref) => (
    <Suspense fallback={loadingComponent || <InlineLoader />}>
      <Component {...props} ref={ref} />
    </Suspense>
  ));
};