import Redis from 'ioredis';

export class RedisService {
  private redis: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      onConnect: () => {
        console.log('✅ Redis connected successfully');
        this.isConnected = true;
      },
      onError: (error) => {
        console.error('❌ Redis connection error:', error);
        this.isConnected = false;
      }
    });
  }

  async connect(): Promise<void> {
    try {
      await this.redis.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      // Fallback para cache em memória se Redis não estiver disponível
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) return null;
      
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    try {
      if (!this.isConnected) return;
      
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (!this.isConnected) return;
      
      await this.redis.del(key);
    } catch (error) {
      console.error('Redis del error:', error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      if (!this.isConnected) return;
      
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Redis invalidation error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) return false;
      
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  async increment(key: string, ttlSeconds?: number): Promise<number> {
    try {
      if (!this.isConnected) return 0;
      
      const result = await this.redis.incr(key);
      
      if (ttlSeconds && result === 1) {
        await this.redis.expire(key, ttlSeconds);
      }
      
      return result;
    } catch (error) {
      console.error('Redis increment error:', error);
      return 0;
    }
  }

  async setHash(key: string, field: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      if (!this.isConnected) return;
      
      await this.redis.hset(key, field, JSON.stringify(value));
      
      if (ttlSeconds) {
        await this.redis.expire(key, ttlSeconds);
      }
    } catch (error) {
      console.error('Redis setHash error:', error);
    }
  }

  async getHash<T>(key: string, field: string): Promise<T | null> {
    try {
      if (!this.isConnected) return null;
      
      const cached = await this.redis.hget(key, field);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Redis getHash error:', error);
      return null;
    }
  }

  async getAllHash<T>(key: string): Promise<Record<string, T> | null> {
    try {
      if (!this.isConnected) return null;
      
      const cached = await this.redis.hgetall(key);
      if (!cached || Object.keys(cached).length === 0) return null;
      
      const result: Record<string, T> = {};
      for (const [field, value] of Object.entries(cached)) {
        result[field] = JSON.parse(value);
      }
      
      return result;
    } catch (error) {
      console.error('Redis getAllHash error:', error);
      return null;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.disconnect();
      this.isConnected = false;
      console.log('✅ Redis disconnected');
    } catch (error) {
      console.error('Redis disconnect error:', error);
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // Métodos específicos para o ERP
  async cacheProductCalculation(productId: string, dimensions: any, result: any, ttl: number = 300): Promise<void> {
    const key = `product:calc:${productId}:${JSON.stringify(dimensions)}`;
    await this.set(key, result, ttl);
  }

  async getCachedProductCalculation(productId: string, dimensions: any): Promise<any> {
    const key = `product:calc:${productId}:${JSON.stringify(dimensions)}`;
    return await this.get(key);
  }

  async cacheOrderItems(orderId: string, items: any[], ttl: number = 600): Promise<void> {
    const key = `order:items:${orderId}`;
    await this.set(key, items, ttl);
  }

  async getCachedOrderItems(orderId: string): Promise<any[] | null> {
    const key = `order:items:${orderId}`;
    return await this.get(key);
  }

  async invalidateOrderCache(orderId: string): Promise<void> {
    await this.invalidatePattern(`order:*:${orderId}*`);
  }

  async invalidateProductCache(productId: string): Promise<void> {
    await this.invalidatePattern(`product:*:${productId}*`);
  }
}