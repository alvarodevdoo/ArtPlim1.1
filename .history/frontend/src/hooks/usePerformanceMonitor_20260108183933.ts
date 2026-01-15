import { useEffect, useRef, useState, useCallback } from 'react';

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  type: 'navigation' | 'resource' | 'measure' | 'custom';
}

interface ComponentPerformance {
  componentName: string;
  renderTime: number;
  mountTime: number;
  updateCount: number;
  lastUpdate: number;
}

interface PerformanceStats {
  pageLoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  timeToInteractive: number;
  totalBlockingTime: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private componentMetrics = new Map<string, ComponentPerformance>();
  private observers: PerformanceObserver[] = [];
  private maxMetrics = 1000;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  constructor() {
    this.initializeObservers();
  }

  private initializeObservers() {
    // Observer para métricas de navegação
    if ('PerformanceObserver' in window) {
      try {
        const navObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.addMetric({
              name: entry.name,
              value: entry.duration || entry.startTime,
              timestamp: Date.now(),
              type: 'navigation'
            });
          }
        });
        navObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navObserver);

        // Observer para recursos
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.addMetric({
              name: entry.name,
              value: entry.duration,
              timestamp: Date.now(),
              type: 'resource'
            });
          }
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);

        // Observer para métricas de paint
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.addMetric({
              name: entry.name,
              value: entry.startTime,
              timestamp: Date.now(),
              type: 'measure'
            });
          }
        });
        paintObserver.observe({ entryTypes: ['paint'] });
        this.observers.push(paintObserver);

        // Observer para LCP
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.addMetric({
            name: 'largest-contentful-paint',
            value: lastEntry.startTime,
            timestamp: Date.now(),
            type: 'measure'
          });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);

        // Observer para CLS
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          this.addMetric({
            name: 'cumulative-layout-shift',
            value: clsValue,
            timestamp: Date.now(),
            type: 'measure'
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);

      } catch (error) {
        console.warn('Performance Observer not fully supported:', error);
      }
    }
  }

  addMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);
    
    // Manter apenas as métricas mais recentes
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  addCustomMetric(name: string, value: number) {
    this.addMetric({
      name,
      value,
      timestamp: Date.now(),
      type: 'custom'
    });
  }

  recordComponentPerformance(componentName: string, renderTime: number, isMount = false) {
    const existing = this.componentMetrics.get(componentName);
    
    if (existing) {
      this.componentMetrics.set(componentName, {
        ...existing,
        renderTime: (existing.renderTime + renderTime) / 2, // Média móvel
        updateCount: existing.updateCount + 1,
        lastUpdate: Date.now()
      });
    } else {
      this.componentMetrics.set(componentName, {
        componentName,
        renderTime,
        mountTime: isMount ? renderTime : 0,
        updateCount: 1,
        lastUpdate: Date.now()
      });
    }
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getComponentMetrics(): ComponentPerformance[] {
    return Array.from(this.componentMetrics.values());
  }

  getPerformanceStats(): PerformanceStats {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paintEntries = performance.getEntriesByType('paint');
    
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;
    const lcp = this.metrics.find(m => m.name === 'largest-contentful-paint')?.value || 0;
    const cls = this.metrics.find(m => m.name === 'cumulative-layout-shift')?.value || 0;

    return {
      pageLoadTime: navigation ? navigation.loadEventEnd - navigation.navigationStart : 0,
      firstContentfulPaint: fcp,
      largestContentfulPaint: lcp,
      cumulativeLayoutShift: cls,
      firstInputDelay: 0, // Seria medido com FID observer
      timeToInteractive: navigation ? navigation.domInteractive - navigation.navigationStart : 0,
      totalBlockingTime: 0 // Calculado a partir de long tasks
    };
  }

  clearMetrics() {
    this.metrics = [];
    this.componentMetrics.clear();
  }

  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Hook principal para monitoramento de performance
export const usePerformanceMonitor = () => {
  const monitor = PerformanceMonitor.getInstance();
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);

  const updateStats = useCallback(() => {
    setStats(monitor.getPerformanceStats());
    setMetrics(monitor.getMetrics());
  }, [monitor]);

  useEffect(() => {
    updateStats();
    
    const interval = setInterval(updateStats, 5000); // Atualizar a cada 5 segundos
    
    return () => clearInterval(interval);
  }, [updateStats]);

  const addCustomMetric = useCallback((name: string, value: number) => {
    monitor.addCustomMetric(name, value);
    updateStats();
  }, [monitor, updateStats]);

  return {
    stats,
    metrics,
    addCustomMetric,
    updateStats
  };
};

// Hook para monitorar performance de componentes
export const useComponentPerformance = (componentName: string) => {
  const monitor = PerformanceMonitor.getInstance();
  const renderStartRef = useRef<number>(0);
  const mountTimeRef = useRef<number>(0);
  const [renderCount, setRenderCount] = useState(0);

  // Marcar início do render
  const startRender = useCallback(() => {
    renderStartRef.current = performance.now();
  }, []);

  // Marcar fim do render
  const endRender = useCallback((isMount = false) => {
    if (renderStartRef.current > 0) {
      const renderTime = performance.now() - renderStartRef.current;
      monitor.recordComponentPerformance(componentName, renderTime, isMount);
      setRenderCount(prev => prev + 1);
      
      if (isMount) {
        mountTimeRef.current = renderTime;
      }
      
      renderStartRef.current = 0;
    }
  }, [componentName, monitor]);

  // Medir automaticamente renders
  useEffect(() => {
    startRender();
    return () => {
      endRender();
    };
  });

  // Medir mount time
  useEffect(() => {
    const mountStart = performance.now();
    return () => {
      const mountTime = performance.now() - mountStart;
      mountTimeRef.current = mountTime;
    };
  }, []);

  return {
    renderCount,
    mountTime: mountTimeRef.current,
    startRender,
    endRender
  };
};

// Hook para medir tempo de operações assíncronas
export const useAsyncPerformance = () => {
  const monitor = PerformanceMonitor.getInstance();

  const measureAsync = useCallback(async <T>(
    name: string,
    asyncOperation: () => Promise<T>
  ): Promise<T> => {
    const start = performance.now();
    
    try {
      const result = await asyncOperation();
      const duration = performance.now() - start;
      monitor.addCustomMetric(`async-${name}`, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      monitor.addCustomMetric(`async-${name}-error`, duration);
      throw error;
    }
  }, [monitor]);

  return { measureAsync };
};

// Hook para detectar performance issues
export const usePerformanceAlerts = (thresholds: {
  slowRender?: number;
  slowAsync?: number;
  highCLS?: number;
  slowLCP?: number;
}) => {
  const {
    slowRender = 16, // 16ms para 60fps
    slowAsync = 1000, // 1 segundo
    highCLS = 0.1,
    slowLCP = 2500 // 2.5 segundos
  } = thresholds;

  const [alerts, setAlerts] = useState<string[]>([]);
  const { stats, metrics } = usePerformanceMonitor();

  useEffect(() => {
    const newAlerts: string[] = [];

    // Verificar métricas de componentes
    const componentMetrics = PerformanceMonitor.getInstance().getComponentMetrics();
    componentMetrics.forEach(metric => {
      if (metric.renderTime > slowRender) {
        newAlerts.push(`Componente ${metric.componentName} renderizando lentamente: ${metric.renderTime.toFixed(2)}ms`);
      }
    });

    // Verificar métricas assíncronas
    metrics.forEach(metric => {
      if (metric.name.startsWith('async-') && metric.value > slowAsync) {
        newAlerts.push(`Operação assíncrona lenta: ${metric.name} - ${metric.value.toFixed(2)}ms`);
      }
    });

    // Verificar Core Web Vitals
    if (stats) {
      if (stats.cumulativeLayoutShift > highCLS) {
        newAlerts.push(`CLS alto: ${stats.cumulativeLayoutShift.toFixed(3)}`);
      }
      
      if (stats.largestContentfulPaint > slowLCP) {
        newAlerts.push(`LCP lento: ${stats.largestContentfulPaint.toFixed(2)}ms`);
      }
    }

    setAlerts(newAlerts);
  }, [stats, metrics, slowRender, slowAsync, highCLS, slowLCP]);

  return alerts;
};

// Hook para relatório de performance
export const usePerformanceReport = () => {
  const { stats, metrics } = usePerformanceMonitor();
  const monitor = PerformanceMonitor.getInstance();

  const generateReport = useCallback(() => {
    const componentMetrics = monitor.getComponentMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      coreWebVitals: stats,
      componentPerformance: componentMetrics,
      customMetrics: metrics.filter(m => m.type === 'custom'),
      resourceMetrics: metrics.filter(m => m.type === 'resource').slice(-10), // Últimos 10 recursos
      summary: {
        totalComponents: componentMetrics.length,
        slowComponents: componentMetrics.filter(c => c.renderTime > 16).length,
        averageRenderTime: componentMetrics.reduce((sum, c) => sum + c.renderTime, 0) / componentMetrics.length || 0,
        totalCustomMetrics: metrics.filter(m => m.type === 'custom').length
      }
    };
  }, [stats, metrics, monitor]);

  const exportReport = useCallback(() => {
    const report = generateReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generateReport]);

  return {
    generateReport,
    exportReport
  };
};