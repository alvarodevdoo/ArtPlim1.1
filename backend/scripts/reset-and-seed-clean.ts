import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️ Limpando banco de dados...');

  // Limpar todas as tabelas na ordem correta
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productComponent.deleteMany();
  await prisma.productConfiguration.deleteMany();
  await prisma.product.deleteMany();
  await prisma.material.deleteMany();
  await prisma.profile.deleteMany(); // Corrigido de customer para profile
  await prisma.user.deleteMany();
  await prisma.organizationSettings.deleteMany();
  await prisma.organization.deleteMany();

  console.log('✅ Banco de dados limpo');

  console.log('🌱 Criando dados básicos...');

  // Criar organização
  const organization = await prisma.organization.create({
    data: {
      name: 'ArtPlim Gráfica',
      slug: 'artplim',
      active: true,
      plan: 'PREMIUM'
    }
  });

  // Criar configurações da organização
  await prisma.organizationSettings.create({
    data: {
      organizationId: organization.id,
      enableWMS: true, // Corrigido de enableWms para enableWMS
      enableProduction: true,
      enableFinance: true,
      defaultMarkup: 2.0,
      taxRate: 0.0,
      validadeOrcamento: 7
    }
  });

  // Criar usuário admin
  const hashedPassword = await bcrypt.hash('123456', 10);

  const adminUser = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: 'Admin',
      email: 'admin@artplim.com',
      password: hashedPassword,
      role: 'OWNER',
      active: true
    }
  });

  // Criar alguns materiais básicos
  const materials = await Promise.all([
    prisma.material.create({
      data: {
        organizationId: organization.id,
        name: 'Papel Couché 300g',
        format: 'SHEET',
        costPerUnit: 0.50,
        unit: 'm²',
        standardWidth: 210,
        standardLength: 297,
      }
    }),
    prisma.material.create({
      data: {
        organizationId: organization.id,
        name: 'Vinil Adesivo',
        format: 'ROLL',
        costPerUnit: 15.00,
        unit: 'm²',
        standardWidth: 1000,
      }
    }),
    prisma.material.create({
      data: {
        organizationId: organization.id,
        name: 'MDF 3mm',
        format: 'SHEET',
        costPerUnit: 25.00,
        unit: 'm²',
        standardWidth: 1220,
        standardLength: 2440,
      }
    })
  ]);

  // Criar alguns produtos com diferentes tipos
  const products = await Promise.all([
    prisma.product.create({
      data: {
        organizationId: organization.id,
        name: 'Cartão de Visita',
        description: 'Cartão de visita em papel couché',
        productType: 'PRODUCT',
        pricingMode: 'SIMPLE_UNIT',
        salePrice: 0.50,
        minPrice: 0.30,
        markup: 2.0,
        active: true
      }
    }),
    prisma.product.create({
      data: {
        organizationId: organization.id,
        name: 'Adesivo Personalizado',
        description: 'Adesivo em vinil para personalização',
        productType: 'PRINT_ROLL',
        pricingMode: 'SIMPLE_AREA',
        salePrice: 25.00,
        minPrice: 15.00,
        markup: 2.0,
        active: true
      }
    }),
    prisma.product.create({
      data: {
        organizationId: organization.id,
        name: 'Criação de Logo',
        description: 'Serviço de criação de logotipo',
        productType: 'SERVICE',
        pricingMode: 'SIMPLE_UNIT',
        salePrice: 300.00,
        minPrice: 200.00,
        markup: 2.0,
        active: true
      }
    }),
    prisma.product.create({
      data: {
        organizationId: organization.id,
        name: 'Placa Personalizada',
        description: 'Placa em MDF cortada a laser',
        productType: 'LASER_CUT',
        pricingMode: 'DYNAMIC_ENGINEER',
        markup: 2.5,
        active: true
      }
    })
  ]);

  // Criar um cliente
  const customer = await prisma.profile.create({
    data: {
      organizationId: organization.id,
      type: 'INDIVIDUAL',
      name: 'Cliente Teste',
      email: 'cliente@teste.com',
      phone: '(11) 99999-9999',
      isCustomer: true,
    }
  });

  console.log('✅ Dados criados com sucesso!');
  console.log('');
  console.log('📋 Dados de acesso:');
  console.log('🏢 Organização: artplim');
  console.log('👤 Email: admin@artplim.com');
  console.log('🔑 Senha: 123456');
  console.log('');
  console.log('📊 Dados criados:');
  console.log(`- 1 organização: ${organization.name}`);
  console.log(`- 1 usuário: ${adminUser.name} (${adminUser.email})`);
  console.log(`- ${materials.length} materiais`);
  console.log(`- ${products.length} produtos`);
  console.log(`- 1 cliente: ${customer.name}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });