import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando Setup Minimalista (5 Insumos, 5 Produtos)...');

  // 1. Organização e Usuário Admin
  const organization = await prisma.organization.upsert({
    where: { slug: 'artplim' },
    update: {},
    create: {
      name: 'ArtPlim Minimal',
      slug: 'artplim',
      settings: {
        create: {
          enableFinance: true,
          enableProduction: true,
          defaultMarkup: 2.0,
        }
      }
    }
  });

  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { 
      organizationId_email: {
        organizationId: organization.id,
        email: 'admin@artplim.com.br'
      }
    },
    update: {},
    create: {
      name: 'Admin ArtPlim',
      email: 'admin@artplim.com.br',
      password: adminPassword,
      role: 'ADMIN',
      organizationId: organization.id
    }
  });

  console.log('✅ Organização e Admin criados.');

  // 2. Insumos (5)
  const materials = [
    { name: 'Lona Frontlight 440g', unit: 'm²', category: 'Lonas', cost: 18.00, format: 'ROLL' },
    { name: 'Vinil Adesivo Branco', unit: 'm²', category: 'Vinis', cost: 14.00, format: 'ROLL' },
    { name: 'Papel Couché 250g', unit: 'un', category: 'Papeis', cost: 0.35, format: 'SHEET' },
    { name: 'Ilhós Niquelado', unit: 'un', category: 'Acabamentos', cost: 0.05, format: 'UNIT' },
    { name: 'Tinta Solvente Frasco 1L', unit: 'L', category: 'Tintas', cost: 120.00, format: 'UNIT' },
  ];

  const materialMap: Record<string, string> = {};
  for (const m of materials) {
    const mat = await prisma.material.create({
      data: {
        organizationId: organization.id,
        name: m.name,
        unit: m.unit,
        category: m.category,
        costPerUnit: m.cost,
        format: m.format as any,
        active: true
      }
    });
    materialMap[m.name] = mat.id;
  }
  console.log('✅ 5 Insumos criados.');

  // 3. Regras de Preço Básicas
  const areaRule = await prisma.pricingRule.create({
    data: {
      organizationId: organization.id,
      name: 'Cálculo por Área (m²)',
      type: 'SQUARE_METER',
      formula: {
        formulaString: '(LARGURA * ALTURA / 1000000) * PRECO_M2',
        variables: [
          { id: 'LARGURA', name: 'Largura', type: 'INPUT', unit: 'mm', role: 'WIDTH' },
          { id: 'ALTURA', name: 'Altura', type: 'INPUT', unit: 'mm', role: 'HEIGHT' },
          { id: 'PRECO_M2', name: 'Preço por M2', type: 'FIXED', fixedValue: 45 }
        ]
      } as any,
      active: true
    }
  });

  const unitRule = await prisma.pricingRule.create({
    data: {
      organizationId: organization.id,
      name: 'Cálculo por Unidade',
      type: 'UNIT',
      formula: {
        formulaString: 'QUANTIDADE * PRECO_UN',
        variables: [
          { id: 'QUANTIDADE', name: 'Quantidade', type: 'INPUT', unit: 'un', role: 'QUANTITY' },
          { id: 'PRECO_UN', name: 'Preço Unitário', type: 'FIXED', fixedValue: 10 }
        ]
      } as any,
      active: true
    }
  });

  // 4. Produtos (5)
  const products = [
    { name: 'Banner Lona 440g', mode: 'SIMPLE_AREA', price: 45.00, ruleId: areaRule.id, mats: ['Lona Frontlight 440g', 'Ilhós Niquelado'] },
    { name: 'Adesivo em Vinil', mode: 'SIMPLE_AREA', price: 40.00, ruleId: areaRule.id, mats: ['Vinil Adesivo Branco', 'Tinta Solvente Frasco 1L'] },
    { name: 'Cartão de Visita (1000un)', mode: 'SIMPLE_UNIT', price: 120.00, ruleId: unitRule.id, mats: ['Papel Couché 250g'] },
    { name: 'Panfleto 10x15cm (1000un)', mode: 'SIMPLE_UNIT', price: 180.00, ruleId: unitRule.id, mats: ['Papel Couché 250g', 'Tinta Solvente Frasco 1L'] },
    { name: 'Placa PVC 2mm c/ Adesivo', mode: 'SIMPLE_AREA', price: 140.00, ruleId: areaRule.id, mats: ['Vinil Adesivo Branco'] },
  ];

  for (const p of products) {
    const prod = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: p.name,
        productType: 'PRODUCT',
        pricingMode: p.mode as any,
        salePrice: p.price,
        pricingRuleId: p.ruleId,
        active: true
      }
    });

    // Ficha Técnica Simples
    for (const mName of p.mats) {
      await prisma.fichaTecnicaInsumo.create({
        data: {
          organizationId: organization.id,
          productId: prod.id,
          insumoId: materialMap[mName],
          quantidade: 1.0,
          custoCalculado: 0
        }
      });
    }
  }

  console.log('✅ 5 Produtos e Fichas Técnicas criados.');
  console.log('🚀 Setup Minimalista Concluído com Sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
