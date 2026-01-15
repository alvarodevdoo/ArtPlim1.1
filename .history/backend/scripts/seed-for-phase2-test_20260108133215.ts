import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedForPhase2Test() {
  console.log('🌱 Seeding database for Phase 2 testing...');

  try {
    // Create organization
    const organization = await prisma.organization.create({
      data: {
        name: 'Test Organization',
        slug: 'test-org',
        plan: 'pro',
        active: true
      }
    });
    console.log(`✅ Created organization: ${organization.name}`);

    // Create organization settings
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
    console.log('✅ Created organization settings');

    // Create a user
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test User',
        role: 'ADMIN',
        active: true
      }
    });
    console.log(`✅ Created user: ${user.name}`);

    // Create materials
    const materials = await Promise.all([
      prisma.material.create({
        data: {
          organizationId: organization.id,
          name: 'Papel Couché 150g',
          description: 'Papel couché brilho 150g/m²',
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
          name: 'Laminação Fosca',
          description: 'Laminação fosca BOPP',
          format: 'SHEET',
          costPerUnit: 0.25,
          unit: 'm²',
          standardWidth: 660,
          standardLength: 960,
          active: true
        }
      }),
      prisma.material.create({
        data: {
          organizationId: organization.id,
          name: 'Wire-o',
          description: 'Espiral wire-o',
          format: 'UNIT',
          costPerUnit: 2.50,
          unit: 'un',
          active: true
        }
      })
    ]);
    console.log(`✅ Created ${materials.length} materials`);

    // Create inventory items for materials
    for (const material of materials) {
      await prisma.inventoryItem.create({
        data: {
          materialId: material.id,
          width: material.standardWidth || 1000,
          length: material.standardLength || 1000,
          quantity: 100,
          location: 'A1-01'
        }
      });
    }
    console.log('✅ Created inventory items');

    // Create products
    const products = await Promise.all([
      prisma.product.create({
        data: {
          organizationId: organization.id,
          name: 'Cardápio Simples',
          description: 'Cardápio básico por área',
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
          name: 'Cartão de Visita',
          description: 'Cartão de visita por unidade',
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
          name: 'Cardápio Dinâmico',
          description: 'Cardápio com configurações dinâmicas',
          pricingMode: 'DYNAMIC_ENGINEER',
          markup: 2.5,
          active: true
        }
      })
    ]);
    console.log(`✅ Created ${products.length} products`);

    // Create product components for the dynamic product
    const dynamicProduct = products.find(p => p.pricingMode === 'DYNAMIC_ENGINEER');
    if (dynamicProduct) {
      await Promise.all([
        prisma.productComponent.create({
          data: {
            productId: dynamicProduct.id,
            materialId: materials[0].id, // Papel Couché
            consumptionMethod: 'BOUNDING_BOX',
            wastePercentage: 0.05,
            wasteUnits: 2,
            isOptional: false,
            priority: 1,
            notes: 'Material principal para impressão'
          }
        }),
        prisma.productComponent.create({
          data: {
            productId: dynamicProduct.id,
            materialId: materials[1].id, // Laminação
            consumptionMethod: 'BOUNDING_BOX',
            wastePercentage: 0.03,
            wasteUnits: 1,
            isOptional: true,
            priority: 2,
            notes: 'Acabamento opcional'
          }
        })
      ]);
      console.log('✅ Created product components');
    }

    // Create a customer profile
    const customer = await prisma.profile.create({
      data: {
        organizationId: organization.id,
        type: 'COMPANY',
        name: 'Cliente Teste Ltda',
        document: '12.345.678/0001-90',
        email: 'cliente@teste.com',
        phone: '(11) 99999-9999',
        address: 'Rua Teste, 123',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01234-567',
        isCustomer: true,
        creditLimit: 10000.00,
        paymentTerms: 30,
        active: true
      }
    });
    console.log(`✅ Created customer: ${customer.name}`);

    console.log('\n🎉 Database seeded successfully for Phase 2 testing!');
    console.log(`Organization ID: ${organization.id}`);
    console.log(`Dynamic Product ID: ${dynamicProduct?.id}`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedForPhase2Test()
  .then(() => {
    console.log('✅ Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  });