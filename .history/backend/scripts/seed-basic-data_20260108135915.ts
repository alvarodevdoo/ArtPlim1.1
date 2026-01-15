import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedBasicData() {
  console.log('🌱 Criando dados básicos para teste...');

  try {
    // Criar organização de teste
    const organization = await prisma.organization.upsert({
      where: { slug: 'test-org' },
      update: {},
      create: {
        name: 'Organização de Teste',
        slug: 'test-org',
        plan: 'pro',
        active: true
      }
    });

    console.log('✅ Organização criada:', organization.name);

    // Criar configurações da organização
    await prisma.organizationSettings.upsert({
      where: { organizationId: organization.id },
      update: {},
      create: {
        organizationId: organization.id,
        enableEngineering: true,
        enableWMS: true,
        enableProduction: true,
        enableFinance: true,
        defaultMarkup: 2.0,
        taxRate: 0.0,
        validadeOrcamento: 7
      }
    });

    // Criar usuário admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUser = await prisma.user.upsert({
      where: { 
        organizationId_email: {
          organizationId: organization.id,
          email: 'admin@test.com'
        }
      },
      update: {},
      create: {
        organizationId: organization.id,
        email: 'admin@test.com',
        password: hashedPassword,
        name: 'Admin Teste',
        role: 'ADMIN',
        active: true
      }
    });

    console.log('✅ Usuário admin criado:', adminUser.email);

    // Criar usuário operador
    const operatorUser = await prisma.user.upsert({
      where: { 
        organizationId_email: {
          organizationId: organization.id,
          email: 'operator@test.com'
        }
      },
      update: {},
      create: {
        organizationId: organization.id,
        email: 'operator@test.com',
        password: hashedPassword,
        name: 'Operador Teste',
        role: 'OPERATOR',
        active: true
      }
    });

    console.log('✅ Usuário operador criado:', operatorUser.email);

    // Criar usuário vendedor
    const salesUser = await prisma.user.upsert({
      where: { 
        organizationId_email: {
          organizationId: organization.id,
          email: 'sales@test.com'
        }
      },
      update: {},
      create: {
        organizationId: organization.id,
        email: 'sales@test.com',
        password: hashedPassword,
        name: 'Vendedor Teste',
        role: 'USER',
        active: true
      }
    });

    console.log('✅ Usuário vendedor criado:', salesUser.email);

    // Criar cliente de teste
    const customer = await prisma.profile.upsert({
      where: {
        organizationId_document: {
          organizationId: organization.id,
          document: '12345678901'
        }
      },
      update: {},
      create: {
        organizationId: organization.id,
        type: 'INDIVIDUAL',
        name: 'Cliente Teste',
        document: '12345678901',
        email: 'cliente@test.com',
        phone: '(11) 99999-9999',
        isCustomer: true,
        active: true
      }
    });

    console.log('✅ Cliente criado:', customer.name);

    // Criar produto de teste
    const product = await prisma.product.upsert({
      where: { id: 'test-product-id' },
      update: {},
      create: {
        id: 'test-product-id',
        organizationId: organization.id,
        name: 'Produto de Teste',
        description: 'Produto para testes do sistema',
        pricingMode: 'SIMPLE_AREA',
        salePrice: 50.00,
        minPrice: 30.00,
        markup: 2.0,
        active: true
      }
    });

    console.log('✅ Produto criado:', product.name);

    // Criar pedido de teste em produção
    const order = await prisma.order.create({
      data: {
        organizationId: organization.id,
        customerId: customer.id,
        orderNumber: 'TEST-001',
        status: 'IN_PRODUCTION',
        subtotal: 100.00,
        discount: 0,
        tax: 0,
        total: 100.00,
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
        notes: 'Pedido de teste para sistema de handshake',
        items: {
          create: {
            productId: product.id,
            width: 100,
            height: 150,
            quantity: 10,
            area: 0.15,
            costPrice: 20.00,
            calculatedPrice: 40.00,
            unitPrice: 50.00,
            totalPrice: 500.00,
            notes: 'Item de teste'
          }
        }
      }
    });

    console.log('✅ Pedido em produção criado:', order.orderNumber);

    console.log('\n🎉 Dados básicos criados com sucesso!');
    console.log('\n📋 Resumo:');
    console.log(`- Organização: ${organization.name} (${organization.slug})`);
    console.log(`- Admin: ${adminUser.email} / admin123`);
    console.log(`- Operador: ${operatorUser.email} / admin123`);
    console.log(`- Vendedor: ${salesUser.email} / admin123`);
    console.log(`- Cliente: ${customer.name}`);
    console.log(`- Produto: ${product.name}`);
    console.log(`- Pedido: ${order.orderNumber} (${order.status})`);

  } catch (error) {
    console.error('❌ Erro ao criar dados básicos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedBasicData().catch(console.error);