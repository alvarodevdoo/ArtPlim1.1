import Redis, { RedisOptions } from 'ioredis';
import 'dotenv/config';

/**
 * SOLID: Single Responsibility & Interface Segregation
 * Esta classe gerencia apenas a comunicação bruta com o Redis.
 * A lógica de "o que" cachear fica nos Services de cada feature.
 */
export class RedisService {
  private redis: Redis;
  private isConnected: boolean = false;

  constructor() {
    const config: RedisOptions = {
      // Forçamos 127.0.0.1 e a família IPv4 para evitar conflitos no Windows
      host: process.env.REDIS_HOST === 'localhost' ? '127.0.0.1' : (process.env.REDIS_HOST || '127.0.0.1'),
      port: Number(process.env.REDIS_PORT) || 6380,
      password: process.env.REDIS_PASSWORD,
      family: 4, // 💡 CRUCIAL: Força o uso de IPv4, resolvendo o erro ECONNREFUSED no Node 22+
      maxRetriesPerRequest: 1, // Falha rápido para acionar a estratégia de reconexão
      lazyConnect: true,
      retryStrategy(times) {
        // Estratégia de reconexão progressiva (máximo 2s de espera)
        return Math.min(times * 100, 2000);
      },
    };

    this.redis = new Redis(config);

    this.redis.on('connect', () => {
      console.log('✅ Redis connected successfully on port', config.port);
      this.isConnected = true;
    });

    this.redis.on('error', (error: any) => {
      // Logamos apenas em desenvolvimento para não sujar o log de produção
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Redis connection error:', error.message);
      }
      this.isConnected = false;
    });
  }

  /**
   * Tenta conectar manualmente se necessário.
   * O ioredis já faz isso automaticamente devido ao lazyConnect: true.
   */
  async connect(): Promise<void> {
    try {
      if (this.redis.status === 'wait' || this.redis.status === 'close') {
        await this.redis.connect();
      }
    } catch {
      console.error('⚠️ Redis unavailable. Falling back to Memory mode.');
    }
  }

  // --- Métodos Genéricos de Infraestrutura ---

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) return null;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch {
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

  async disconnect(): Promise<void> {
    await this.redis.quit();
    this.isConnected = false;
    console.log('✅ Redis disconnected');
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Exportamos uma instância única (Singleton)
export const redisService = new RedisService();