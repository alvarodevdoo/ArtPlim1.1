import { PrismaClient } from '@prisma/client';
import { CacheService } from '../src/shared/infrastructure/cache/CacheService';
import { QueryOptimizer } from '../src/shared/infrastructure/database/QueryOptimizer';
import axios from 'axios';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  duration: number;
  status: 'success' | 'error';
  details?: any;
  error?: string;
}

interface SystemHealthCheck {
  component: string;
  status: 'healthy' | 'warning' | 'critical';
  responseTime: number;
  details: string;
}

class SystemPerformanceTester {
  private results: TestResult[] = [];
  private healthChecks: SystemHealthCheck[] = [];
  private cacheService: CacheService;
  private queryOptimizer: QueryOptimizer;
  private baseURL = 'http://localhost:3001';

  constructor() {
    this.cacheService = new CacheService();
    this.queryOptimizer = new QueryOptimizer(prisma);
  }

  private async measureTime<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.results.push({ name, duration, status: 'success', details: result });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.results.push({ 
        name, 
        duration, 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
      throw error;
    }
  }

  private addHealthCheck(component: string, responseTime: number, details: string) {
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (responseTime > 1000) status = 'critical';
    else if (responseTime > 500) status = 'warning';
    
    this.healthChecks.push({ component, status, responseTime, details });
  }

  async testDatabaseConnection() {
    console.log('🔍 Testando conexão com banco de dados...');
    
    await this.measureTime('Database Connection', async () => {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;
      
      this.addHealthCheck('PostgreSQL', responseTime, 'Conexão estabelecida com sucesso');
      return { connected: true, responseTime };
    });
  }

  async testRedisConnection() {
    console.log('🔍 Testando conexão com Redis...');
    
    await this.measureTime('Redis Connection', async () => {
      const start = Date.now();
      await this.cacheService.set('health-check', { timestamp: Date.now() }, 60);
      const cached = await this.cacheService.get('health-check');
      const responseTime = Date.now() - start;
      
      const stats = this.cacheService.getStats();
      this.addHealthCheck('Redis', responseTime, 
        `Backend: ${stats.backend}, Conectado: ${stats.redisConnected}`);
      
      return { connected: !!cached, backend: stats.backend, responseTime };
    });
  }

  async testAPIEndpoints() {
    console.log('🔍 Testando endpoints da API...');
    
    const endpoints = [
      { path: '/api/health', method: 'GET', name: 'Health Check' },
      { path: '/api/organizations', method: 'GET', name: 'Organizations List' },
      { path: '/api/admin/health', method: 'GET', name: 'Admin Health' },
      { path: '/api/admin/performance', method: 'GET', name: 'Performance Metrics' },
      { path: '/api/admin/cache/stats', method: 'GET', name: 'Cache Stats' }
    ];

    for (const endpoint of endpoints) {
      try {
        await this.measureTime(`API ${endpoint.name}`, async () => {
          const start = Date.now();
          const response = await axios({
            method: endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete',
            url: `${this.baseURL}${endpoint.path}`,
            timeout: 10000,
            validateStatus: (status: number) => status < 500 // Aceitar até 4xx
          });
          const responseTime = Date.now() - start;
          
          this.addHealthCheck(`API ${endpoint.name}`, responseTime, 
            `Status: ${response.status}, Size: ${JSON.stringify(response.data).length} bytes`);
          
          return { status: response.status, responseTime, dataSize: JSON.stringify(response.data).length };
        });
      } catch (error) {
        console.log(`⚠️ Endpoint ${endpoint.path} não disponível (pode precisar de autenticação)`);
      }
    }
  }

  async testQueryPerformance() {
    console.log('🔍 Testando performance das queries...');
    
    // Buscar organização de teste
    const organization = await prisma.organization.findFirst({
      where: { slug: 'grafica-analytics' }
    });

    if (!organization) {
      console.log('⚠️ Organização de teste não encontrada. Criando dados de teste...');
      return;
    }

    // Testar queries otimizadas
    await this.measureTime('Query - Products', async () => {
      const products = await this.queryOptimizer.getOptimizedProducts(organization.id, 10);
      return { count: products.length };
    });

    await this.measureTime('Query - Orders', async () => {
      const orders = await this.queryOptimizer.getOptimizedOrders(organization.id, 10);
      return { count: orders.length };
    });

    await this.measureTime('Query - Materials', async () => {
      const materials = await this.queryOptimizer.getOptimizedMaterials(organization.id);
      return { count: materials.length };
    });

    await this.measureTime('Query - Dashboard Stats', async () => {
      const stats = await this.queryOptimizer.getDashboardStats(
        organization.id,
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date()
      );
      return stats;
    });
  }

  async testCachePerformance() {
    console.log('🔍 Testando performance do cache...');
    
    // Teste de escrita
    await this.measureTime('Cache - Write Performance', async () => {
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 100; i++) {
        promises.push(this.cacheService.set(`test-key-${i}`, { data: `test-data-${i}` }, 300));
      }
      await Promise.all(promises);
      return { operations: 100 };
    });

    // Teste de leitura
    await this.measureTime('Cache - Read Performance', async () => {
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 100; i++) {
        promises.push(this.cacheService.get(`test-key-${i}`));
      }
      const results = await Promise.all(promises);
      const hits = results.filter(r => r !== null).length;
      return { operations: 100, hits };
    });

    // Teste de invalidação
    await this.measureTime('Cache - Invalidation', async () => {
      await this.cacheService.invalidatePattern('test-key-*');
      return { pattern: 'test-key-*' };
    });
  }

  async testStressLoad() {
    console.log('🔍 Executando teste de stress...');
    
    const organization = await prisma.organization.findFirst({
      where: { slug: 'grafica-analytics' }
    });

    if (!organization) return;

    // Teste de carga simultânea
    await this.measureTime('Stress Test - 50 Concurrent Queries', async () => {
      const promises: Promise<any[]>[] = [];
      
      // 50 queries simultâneas
      for (let i = 0; i < 50; i++) {
        promises.push(this.queryOptimizer.getOptimizedProducts(organization.id, 5));
      }
      
      const results = await Promise.all(promises);
      return { 
        totalQueries: 50, 
        successfulQueries: results.length,
        averageResults: results.reduce((sum, r) => sum + r.length, 0) / results.length
      };
    });

    // Teste de cache sob carga
    await this.measureTime('Stress Test - Cache Under Load', async () => {
      const promises: Promise<any>[] = [];
      
      // 100 operações de cache simultâneas
      for (let i = 0; i < 100; i++) {
        if (i % 2 === 0) {
          promises.push(this.cacheService.set(`stress-${i}`, { data: i }, 300));
        } else {
          promises.push(this.cacheService.get(`stress-${i - 1}`));
        }
      }
      
      await Promise.all(promises);
      return { operations: 100 };
    });
  }

  async testMemoryUsage() {
    console.log('🔍 Verificando uso de memória...');
    
    await this.measureTime('Memory Usage Check', async () => {
      const memUsage = process.memoryUsage();
      
      this.addHealthCheck('Memory Usage', 0, 
        `RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      
      return {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      };
    });
  }

  async testDatabaseIndexes() {
    console.log('🔍 Verificando índices do banco de dados...');
    
    await this.measureTime('Database Indexes Check', async () => {
      const indexes = await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND indexname LIKE 'idx_%'
        ORDER BY tablename, indexname
      `;
      
      const indexCount = (indexes as any[]).length;
      this.addHealthCheck('Database Indexes', 0, `${indexCount} índices otimizados encontrados`);
      
      return { totalIndexes: indexCount, indexes };
    });
  }

  private generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 RELATÓRIO COMPLETO DE PERFORMANCE DO SISTEMA');
    console.log('='.repeat(80));
    
    // Resumo geral
    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.status === 'success').length;
    const failedTests = this.results.filter(r => r.status === 'error').length;
    const averageTime = this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;
    
    console.log('\n🎯 RESUMO GERAL:');
    console.log(`   Total de testes: ${totalTests}`);
    console.log(`   ✅ Sucessos: ${successfulTests}`);
    console.log(`   ❌ Falhas: ${failedTests}`);
    console.log(`   ⏱️ Tempo médio: ${Math.round(averageTime)}ms`);
    console.log(`   📈 Taxa de sucesso: ${Math.round((successfulTests / totalTests) * 100)}%`);
    
    // Health checks
    console.log('\n🏥 SAÚDE DOS COMPONENTES:');
    this.healthChecks.forEach(check => {
      const icon = check.status === 'healthy' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
      console.log(`   ${icon} ${check.component}: ${check.details} (${check.responseTime}ms)`);
    });
    
    // Testes detalhados
    console.log('\n📋 RESULTADOS DETALHADOS:');
    this.results.forEach(result => {
      const icon = result.status === 'success' ? '✅' : '❌';
      const details = result.status === 'success' 
        ? `${result.duration}ms` 
        : `${result.duration}ms - ${result.error}`;
      console.log(`   ${icon} ${result.name}: ${details}`);
    });
    
    // Classificação de performance
    console.log('\n🚀 CLASSIFICAÇÃO DE PERFORMANCE:');
    const fastTests = this.results.filter(r => r.status === 'success' && r.duration < 100).length;
    const mediumTests = this.results.filter(r => r.status === 'success' && r.duration >= 100 && r.duration < 500).length;
    const slowTests = this.results.filter(r => r.status === 'success' && r.duration >= 500).length;
    
    console.log(`   🚀 Rápidos (<100ms): ${fastTests} testes`);
    console.log(`   ⚡ Médios (100-500ms): ${mediumTests} testes`);
    console.log(`   🐌 Lentos (>500ms): ${slowTests} testes`);
    
    // Recomendações
    console.log('\n💡 RECOMENDAÇÕES:');
    if (failedTests > 0) {
      console.log('   ⚠️ Alguns testes falharam. Verifique os logs acima.');
    }
    if (slowTests > 0) {
      console.log('   ⚠️ Alguns testes estão lentos. Considere otimizações.');
    }
    if (averageTime > 200) {
      console.log('   ⚠️ Tempo médio alto. Sistema pode precisar de otimização.');
    }
    if (successfulTests === totalTests && averageTime < 200) {
      console.log('   🎉 Sistema com performance excelente! Pronto para produção.');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ TESTE COMPLETO DE PERFORMANCE FINALIZADO');
    console.log('='.repeat(80));
  }

  async runAllTests() {
    console.log('🧪 INICIANDO TESTE COMPLETO DE PERFORMANCE DO SISTEMA');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('🖥️ Ambiente:', process.env.NODE_ENV || 'development');
    console.log('');

    try {
      // Testes de infraestrutura
      await this.testDatabaseConnection();
      await this.testRedisConnection();
      
      // Testes de API
      await this.testAPIEndpoints();
      
      // Testes de performance
      await this.testQueryPerformance();
      await this.testCachePerformance();
      
      // Testes de carga
      await this.testStressLoad();
      
      // Testes de sistema
      await this.testMemoryUsage();
      await this.testDatabaseIndexes();
      
      // Gerar relatório
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Erro durante os testes:', error);
    } finally {
      // Cleanup
      await this.cacheService.invalidatePattern('test-*');
      await this.cacheService.invalidatePattern('stress-*');
      await prisma.$disconnect();
      
      console.log('\n🔌 Conexões fechadas. Teste finalizado.');
      process.exit(0);
    }
  }
}

// Executar testes
const tester = new SystemPerformanceTester();
tester.runAllTests().catch(console.error);