import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../../cache/CacheService';

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
  userAgent?: string;
  organizationId?: string;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private cacheService: CacheService;
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 1000; // Manter apenas as últimas 1000 métricas

  constructor() {
    this.cacheService = new CacheService();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  recordMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    
    // Manter apenas as métricas mais recentes
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log de queries lentas
    if (metric.responseTime > 1000) {
      console.warn(`🐌 Slow request: ${metric.method} ${metric.endpoint} - ${metric.responseTime}ms`);
    }

    // Cache das métricas para dashboard
    this.cacheMetricsForDashboard();
  }

  private async cacheMetricsForDashboard() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentMetrics = this.metrics.filter(m => m.timestamp >= last24h);
    
    const summary = {
      totalRequests: recentMetrics.length,
      averageResponseTime: recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length || 0,
      slowRequests: recentMetrics.filter(m => m.responseTime > 1000).length,
      errorRequests: recentMetrics.filter(m => m.statusCode >= 400).length,
      topEndpoints: this.getTopEndpoints(recentMetrics),
      hourlyStats: this.getHourlyStats(recentMetrics)
    };

    await this.cacheService.set('performance:summary', summary, 300); // 5 minutos
  }

  private getTopEndpoints(metrics: PerformanceMetrics[]) {
    const endpointStats = new Map<string, { count: number; avgTime: number; totalTime: number }>();
    
    metrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`;
      const existing = endpointStats.get(key) || { count: 0, avgTime: 0, totalTime: 0 };
      
      existing.count++;
      existing.totalTime += metric.responseTime;
      existing.avgTime = existing.totalTime / existing.count;
      
      endpointStats.set(key, existing);
    });

    return Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({ endpoint, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getHourlyStats(metrics: PerformanceMetrics[]) {
    const hourlyStats = new Map<string, { count: number; avgTime: number }>();
    
    metrics.forEach(metric => {
      const hour = metric.timestamp.getHours();
      const key = `${hour}:00`;
      const existing = hourlyStats.get(key) || { count: 0, avgTime: 0 };
      
      existing.count++;
      existing.avgTime = (existing.avgTime * (existing.count - 1) + metric.responseTime) / existing.count;
      
      hourlyStats.set(key, existing);
    });

    return Array.from(hourlyStats.entries())
      .map(([hour, stats]) => ({ hour, ...stats }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  }

  async getPerformanceSummary() {
    return await this.cacheService.get('performance:summary') || {
      totalRequests: 0,
      averageResponseTime: 0,
      slowRequests: 0,
      errorRequests: 0,
      topEndpoints: [],
      hourlyStats: []
    };
  }

  getRecentMetrics(limit: number = 100): PerformanceMetrics[] {
    return this.metrics.slice(-limit);
  }

  clearMetrics() {
    this.metrics = [];
    console.log('✅ Performance metrics cleared');
  }
}

export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const monitor = PerformanceMonitor.getInstance();

  // Interceptar o final da resposta
  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    
    // Registrar métrica
    monitor.recordMetric({
      endpoint: req.path,
      method: req.method,
      responseTime,
      statusCode: res.statusCode,
      timestamp: new Date(),
      userAgent: req.get('User-Agent'),
      organizationId: (req as any).user?.organizationId
    });

    // Adicionar headers de performance
    res.set({
      'X-Response-Time': `${responseTime}ms`,
      'X-Timestamp': new Date().toISOString()
    });

    return originalSend.call(this, data);
  };

  next();
};

// Middleware específico para cache de responses
export const cacheMiddleware = (ttlSeconds: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Apenas cachear GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheService = new CacheService();
    const cacheKey = `response:${req.path}:${JSON.stringify(req.query)}:${(req as any).user?.organizationId}`;
    
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }
    } catch (error) {
      console.error('Cache middleware error:', error);
    }

    // Interceptar resposta para cachear
    const originalJson = res.json;
    res.json = function(data) {
      // Cachear apenas respostas de sucesso
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheService.set(cacheKey, data, ttlSeconds).catch(console.error);
        res.set('X-Cache', 'MISS');
      }
      
      return originalJson.call(this, data);
    };

    next();
  };
};