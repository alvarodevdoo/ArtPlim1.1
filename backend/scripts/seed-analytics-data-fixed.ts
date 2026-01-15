import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedAnalyticsData() {
  console.log('🌱 Criando dados para analytics...');

  try {
    // Limpar dados existentes
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productComponent.deleteMany();
    await prisma.product.deleteMany();
    await prisma.material.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organizationSettings.deleteMany();
    await prisma.organization.deleteMany();

    // Criar organização
    const organization = await prisma.organization.create({
      data: {
        name: 'Gráfica Analytics',
        slug: 'grafica-analytics',
        plan: 'pro',
        active: true
      }
    });

    // Criar configurações
    await prisma.organizationSettings.create({
      data: {
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

    // Criar usuários
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await prisma.user.create({
      data: {
        organizationId: organization.id,
        email: 'admin@analytics.com',
        password: hashedPassword,
        name: 'Admin Analytics',
        role: 'ADMIN',
        active: true
      }
    });

    // Criar materiais
    const materials = await Promise.all([
      prisma.material.create({
        data: {
          organizationId: organization.id,
          name: 'Papel Couché 150g',
          format: 'SHEET',
          costPerUnit: 0.15,
          unit: 'm²',
          standardWidth: 660,
          standardLength: 960,
          active: true
        }
      }),
      prisma.material.create({
        data: {
          organizationId: organization.id,
          name: 'Vinil Adesivo',
          format: 'ROLL',
          costPerUnit: 8.50,
          unit: 'ml',
          standardWidth: 1370,
          active: true
        }
      }),
      prisma.material.create({
        data: {
          organizationId: organization.id,
          name: 'Tinta Digital',
          format: 'UNIT',
          costPerUnit: 2.30,
          unit: 'un',
          active: true
        }
      })
    ]);

    console.log(`✅ ${materials.length} materiais criados`);

    // Criar produtos
    const products = await Promise.all([
      prisma.product.create({
        data: {
          organizationId: organization.id,
          name: 'Cartão de Visita',
          description: 'Cartão de visita em couché 300g',
          pricingMode: 'SIMPLE_UNIT',
          salePrice: 0.25,
          minPrice: 0.15,
          markup: 2.0,
          active: true
        }
      }),
      prisma.product.create({
        data: {
          organizationId: organization.id,
          name: 'Flyer A4',
          description: 'Flyer A4 em couché 150g',
          pricingMode: 'SIMPLE_AREA',
          salePrice: 2.50,
          minPrice: 1.50,
          markup: 2.0,
          active: true
        }
      }),
      prisma.product.create({
        data: {
          organizationId: organization.id,
          name: 'Adesivo Vinil',
          description: 'Adesivo em vinil com impressão digital',
          pricingMode: 'DYNAMIC_ENGINEER',
          markup: 2.5,
          active: true
        }
      }),
      prisma.product.create({
        data: {
          organizationId: organization.id,
          name: 'Banner',
          description: 'Banner em lona com impressão digital',
          pricingMode: 'SIMPLE_AREA',
          salePrice: 15.00,
          minPrice: 10.00,
          markup: 2.0,
          active: true
        }
      })
    ]);

    console.log(`✅ ${products.length} produtos criados`);

    // Criar componentes dos produtos
    await Promise.all([
      // Cartão de visita - Papel
      prisma.productComponent.create({
        data: {
          productId: products[0].id,
          materialId: materials[0].id,
          consumptionMethod: 'BOUNDING_BOX',
          wastePercentage: 15.0
        }
      }),
      // Flyer - Papel
      prisma.productComponent.create({
        data: {
          productId: products[1].id,
          materialId: materials[0].id,
          consumptionMethod: 'BOUNDING_BOX',
          wastePercentage: 10.0
        }
      }),
      // Adesivo - Vinil + Tinta
      prisma.productComponent.create({
        data: {
          productId: products[2].id,
          materialId: materials[1].id,
          consumptionMethod: 'BOUNDING_BOX',
          wastePercentage: 8.0
        }
      }),
      prisma.productComponent.create({
        data: {
          productId: products[2].id,
          materialId: materials[2].id,
          consumptionMethod: 'FIXED_AMOUNT',
          wastePercentage: 5.0
        }
      }),
      // Banner - Vinil + Tinta
      prisma.productComponent.create({
        data: {
          productId: products[3].id,
          materialId: materials[1].id,
          consumptionMethod: 'BOUNDING_BOX',
          wastePercentage: 5.0
        }
      }),
      prisma.productComponent.create({
        data: {
          productId: products[3].id,
          materialId: materials[2].id,
          consumptionMethod: 'FIXED_AMOUNT',
          wastePercentage: 3.0
        }
      })
    ]);

    console.log('✅ Componentes de produtos criados');

    // Criar clientes
    const customers = await Promise.all([
      prisma.profile.create({
        data: {
          organizationId: organization.id,
          type: 'COMPANY',
          name: 'Empresa ABC Ltda',
          document: '12345678000199',
          email: 'contato@empresaabc.com',
          phone: '(11) 99999-1111',
          isCustomer: true,
          active: true
        }
      }),
      prisma.profile.create({
        data: {
          organizationId: organization.id,
          type: 'INDIVIDUAL',
          name: 'João Silva',
          document: '12345678901',
          email: 'joao@email.com',
          phone: '(11) 99999-2222',
          isCustomer: true,
          active: true
        }
      }),
      prisma.profile.create({
        data: {
          organizationId: organization.id,
          type: 'COMPANY',
          name: 'Restaurante XYZ',
          document: '98765432000188',
          email: 'contato@restaurantexyz.com',
          phone: '(11) 99999-3333',
          isCustomer: true,
          active: true
        }
      })
    ]);

    console.log(`✅ ${customers.length} clientes criados`);

    // Criar pedidos com dados históricos (últimos 6 meses)
    const orders = [];
    const now = new Date();
    
    for (let monthsAgo = 6; monthsAgo >= 0; monthsAgo--) {
      const baseDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      
      // Criar 10-20 pedidos por mês
      const ordersInMonth = Math.floor(Math.random() * 10) + 10;
      
      for (let i = 0; i < ordersInMonth; i++) {
        const orderDate = new Date(
          baseDate.getFullYear(),
          baseDate.getMonth(),
          Math.floor(Math.random() * 28) + 1,
          Math.floor(Math.random() * 24),
          Math.floor(Math.random() * 60)
        );

        const customer = customers[Math.floor(Math.random() * customers.length)];
        const orderNumber = `ORD-${orderDate.getFullYear()}${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`;
        
        // Status baseado na idade do pedido
        let status = 'DELIVERED';
        if (monthsAgo === 0) {
          const statuses = ['DRAFT', 'APPROVED', 'IN_PRODUCTION', 'FINISHED', 'DELIVERED'];
          status = statuses[Math.floor(Math.random() * statuses.length)];
        }

        const order = await prisma.order.create({
          data: {
            organizationId: organization.id,
            customerId: customer.id,
            orderNumber,
            status: status as any,
            subtotal: 0, // Será calculado depois
            discount: 0,
            tax: 0,
            total: 0, // Será calculado depois
            deliveryDate: new Date(orderDate.getTime() + 7 * 24 * 60 * 60 * 1000),
            validUntil: new Date(orderDate.getTime() + 30 * 24 * 60 * 60 * 1000),
            createdAt: orderDate,
            updatedAt: status === 'DELIVERED' 
              ? new Date(orderDate.getTime() + Math.random() * 10 * 24 * 60 * 60 * 1000)
              : orderDate
          }
        });

        // Criar 1-5 itens por pedido
        const itemsCount = Math.floor(Math.random() * 4) + 1;
        let orderTotal = 0;

        for (let j = 0; j < itemsCount; j++) {
          const product = products[Math.floor(Math.random() * products.length)];
          const quantity = Math.floor(Math.random() * 500) + 50;
          
          // Dimensões baseadas no tipo de produto
          let width: number, height: number;
          if (product.name.includes('Cartão')) {
            width = 90; height = 50;
          } else if (product.name.includes('Flyer')) {
            width = 210; height = 297;
          } else if (product.name.includes('Banner')) {
            width = 1000 + Math.random() * 2000; height = 500 + Math.random() * 1000;
          } else {
            width = 100 + Math.random() * 500; height = 100 + Math.random() * 500;
          }

          const costPrice = 0.5 + Math.random() * 2;
          const calculatedPrice = costPrice * 2;
          const unitPrice = calculatedPrice * (0.8 + Math.random() * 0.4); // Variação de preço
          const totalPrice = unitPrice * quantity;

          await prisma.orderItem.create({
            data: {
              orderId: order.id,
              productId: product.id,
              width,
              height,
              quantity,
              area: (width * height) / 1000000, // m²
              costPrice,
              calculatedPrice,
              unitPrice,
              totalPrice
            }
          });

          orderTotal += totalPrice;
        }

        // Atualizar total do pedido
        await prisma.order.update({
          where: { id: order.id },
          data: {
            subtotal: orderTotal,
            total: orderTotal
          }
        });

        orders.push(order);
      }
    }

    console.log(`✅ ${orders.length} pedidos criados com dados históricos`);

    console.log('\n🎉 Dados para analytics criados com sucesso!');
    console.log('\n📊 Resumo:');
    console.log(`- Organização: ${organization.name}`);
    console.log(`- Usuário: admin@analytics.com / admin123`);
    console.log(`- Materiais: ${materials.length}`);
    console.log(`- Produtos: ${products.length}`);
    console.log(`- Clientes: ${customers.length}`);
    console.log(`- Pedidos: ${orders.length} (últimos 6 meses)`);

  } catch (error) {
    console.error('❌ Erro ao criar dados para analytics:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedAnalyticsData().catch(console.error);