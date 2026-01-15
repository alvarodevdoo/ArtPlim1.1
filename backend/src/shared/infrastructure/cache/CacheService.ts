import { RedisService } from './RedisService';

export class CacheService {
  private memoryCache = new Map<string, { data: any; expiresAt: number }>();
  private redisService: RedisService;
  private useRedis: boolean = false;

  constructor() {
    this.redisService = new RedisService();
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      await this.redisService.connect();
      this.useRedis = this.redisService.getConnectionStatus();
      console.log(`🔧 Cache service initialized with ${this.useRedis ? 'Redis' : 'Memory'} backend`);
    } catch (error) {
      console.warn('Redis not available, using memory cache:', error);
      this.useRedis = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.useRedis) {
      return await this.redisService.get<T>(key);
    }

    // Fallback para cache em memória
    const cached = this.memoryCache.get(key);
    
    if (!cached) {
      return null;
    }
    
    if (Date.now() > cached.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    if (this.useRedis) {
      await this.redisService.set(key, value, ttlSeconds);
      return;
    }

    // Fallback para cache em memória
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.memoryCache.set(key, { data: value, expiresAt });
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (this.useRedis) {
      await this.redisService.invalidatePattern(pattern);
      return;
    }

    // Fallback para cache em memória
    const regex = new RegExp(pattern.replace('*', '.*'));
    
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    if (this.useRedis) {
      await this.redisService.invalidatePattern('*');
      return;
    }

    this.memoryCache.clear();
  }

  async exists(key: string): Promise<boolean> {
    if (this.useRedis) {
      return await this.redisService.exists(key);
    }

    const cached = this.memoryCache.get(key);
    if (!cached) return false;
    
    if (Date.now() > cached.expiresAt) {
      this.memoryCache.delete(key);
      return false;
    }
    
    return true;
  }

  // Métodos específicos para o ERP
  async cacheProductCalculation(productId: string, dimensions: any, result: any, ttl: number = 300): Promise<void> {
    if (this.useRedis) {
      await this.redisService.cacheProductCalculation(productId, dimensions, result, ttl);
      return;
    }

    const key = `product:calc:${productId}:${JSON.stringify(dimensions)}`;
    await this.set(key, result, ttl);
  }

  async getCachedProductCalculation(productId: string, dimensions: any): Promise<any> {
    if (this.useRedis) {
      return await this.redisService.getCachedProductCalculation(productId, dimensions);
    }

    const key = `product:calc:${productId}:${JSON.stringify(dimensions)}`;
    return await this.get(key);
  }

  async invalidateOrderCache(orderId: string): Promise<void> {
    await this.invalidatePattern(`order:*:${orderId}*`);
  }

  async invalidateProductCache(productId: string): Promise<void> {
    await this.invalidatePattern(`product:*:${productId}*`);
  }

  getStats() {
    return {
      backend: this.useRedis ? 'Redis' : 'Memory',
      memoryKeys: this.memoryCache.size,
      redisConnected: this.useRedis
    };
  }
}