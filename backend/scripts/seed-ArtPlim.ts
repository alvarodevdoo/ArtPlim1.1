import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { subDays, format } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting ArtPlim Massive Seed...');

  // 1. Organization & User
  const organization = await prisma.organization.upsert({
    where: { slug: 'artplim' },
    update: {},
    create: {
      name: 'ArtPlim Gráfica & Comunicação Visual',
      slug: 'artplim',
      settings: {
        create: {
          enableWMS: true,
          enableProduction: true,
          enableFinance: true,
          defaultMarkup: 2.5,
        }
      }
    }
  });

  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
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

  const operatorPassword = await bcrypt.hash('web123456', 10);
  await prisma.user.upsert({
    where: { 
      organizationId_email: {
        organizationId: organization.id,
        email: 'operador@artplim.com.br'
      }
    },
    update: {},
    create: {
      name: 'Késia ArtPlim',
      email: 'operador@artplim.com.br',
      password: operatorPassword,
      role: 'OPERATOR',
      organizationId: organization.id
    }
  });

  console.log('✅ Organization, Admin and Operator created.');

  // 2. Chart of Accounts (Removed - user will use modal)
  console.log('⚠ Chart of Accounts population skipped.');

  // 3. Financial Accounts (Removed - user will create manually)
  console.log('⚠ Bank Accounts creation skipped.');

  // 4. Profiles (Clientes e Fornecedores) - 30+ Clientes
  const supplierNames = [
    'Rolo Mídia Brasil', 'Papeis & Cia', 'Inks Pro Systems', 'Vinil Prime Sul', 'Comunicação Visual Atacado'
  ];

  const customers = [
    { name: 'João da Silva', type: 'CLIENT', personType: 'INDIVIDUAL' },
    { name: 'Maria Oliveira', type: 'CLIENT', personType: 'INDIVIDUAL' },
    { name: 'Agência Digital XYZ', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Escola Modelo Ltda', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Padaria Pão de Mel', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Imobiliária House', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Auto Center Rodão', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Clínica Saúde Plena', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Restaurante Sabor Real', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Prefeitura Municipal', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Igreja Vida Eterna', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Academia Corpo & Alma', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Supermercado Central', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Loja de Roupas Chic', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Pet Shop Amigo Fiel', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Condomínio Solar', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Escritório Contábil S/S', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Buffet Festança', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Engenharia Construir', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Dental Clin', type: 'CLIENT', personType: 'COMPANY' },
    { name: 'Barbeiro de Sevilha', type: 'CLIENT', personType: 'INDIVIDUAL' },
    { name: 'Ana Souza Doces', type: 'CLIENT', personType: 'INDIVIDUAL' },
    { name: 'Pedro Pedreiro', type: 'CLIENT', personType: 'INDIVIDUAL' },
    { name: 'Letícia Lanches', type: 'CLIENT', personType: 'INDIVIDUAL' },
    { name: 'Ricardo Mecânico', type: 'CLIENT', personType: 'INDIVIDUAL' },
    { name: 'Bia das Flores', type: 'CLIENT', personType: 'INDIVIDUAL' },
    { name: 'Carlos Corretor', type: 'CLIENT', personType: 'INDIVIDUAL' },
    { name: 'Dra. Fernanda Advogada', type: 'CLIENT', personType: 'INDIVIDUAL' },
    { name: 'Seu Jorge Carpinteiro', type: 'CLIENT', personType: 'INDIVIDUAL' },
    { name: 'Marta Designer', type: 'CLIENT', personType: 'INDIVIDUAL' },
    { name: 'Paulo Fotógrafo', type: 'CLIENT', personType: 'INDIVIDUAL' },
    { name: 'Tati Maquiagem', type: 'CLIENT', personType: 'INDIVIDUAL' },
  ];

  for (const name of supplierNames) {
    await prisma.profile.upsert({
      where: { organizationId_name: { organizationId: organization.id, name } },
      update: { type: 'COMPANY' as any },
      create: {
        organizationId: organization.id,
        name,
        type: 'COMPANY' as any,
        isSupplier: true,
        email: `${name.toLowerCase().replace(/ /g, '')}@example.com`,
        active: true
      }
    });
  }

  const clientProfiles: any[] = [];
  for (const cust of customers) {
    const profile = await prisma.profile.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: cust.name } },
      update: { type: cust.personType as any },
      create: {
        organizationId: organization.id,
        name: cust.name,
        type: cust.personType as any,
        isCustomer: true,
        email: `${cust.name.toLowerCase().replace(/ /g, '')}@mail.com`,
        active: true
      }
    });
    clientProfiles.push(profile);
  }

  console.log(`✅ ${supplierNames.length} Suppliers and ${customers.length} Customers created.`);

  // 5. Materials (30+ Materiais)
  const materialsData = [
    // Lonas
    { name: 'Lona Frontlight 280g', unit: 'm²', category: 'Lonas', cost: 12.50, format: 'Rolo 3.20m' },
    { name: 'Lona Frontlight 440g', unit: 'm²', category: 'Lonas', cost: 18.90, format: 'Rolo 3.20m' },
    { name: 'Lona Backlight 500g', unit: 'm²', category: 'Lonas', cost: 35.00, format: 'Rolo 3.20m' },
    { name: 'Lona Perfurada', unit: 'm²', category: 'Lonas', cost: 28.00, format: 'Rolo 1.37m' },
    // Vinis
    { name: 'Vinil Adesivo Branco Brilho', unit: 'm²', category: 'Vinis', cost: 14.00, format: 'Rolo 1.52m' },
    { name: 'Vinil Adesivo Branco Fosco', unit: 'm²', category: 'Vinis', cost: 14.50, format: 'Rolo 1.52m' },
    { name: 'Vinil Adesivo Transparente', unit: 'm²', category: 'Vinis', cost: 16.00, format: 'Rolo 1.37m' },
    { name: 'Vinil Perfurado', unit: 'm²', category: 'Vinis', cost: 22.00, format: 'Rolo 1.37m' },
    { name: 'Vinil Recorte Preto', unit: 'm²', category: 'Vinis', cost: 12.00, format: 'Rolo 1.22m' },
    { name: 'Vinil Recorte Branco', unit: 'm²', category: 'Vinis', cost: 12.00, format: 'Rolo 1.22m' },
    { name: 'Vinil Recorte Vermelho', unit: 'm²', category: 'Vinis', cost: 15.00, format: 'Rolo 1.22m' },
    { name: 'Vinil Recorte Azul', unit: 'm²', category: 'Vinis', cost: 15.00, format: 'Rolo 1.22m' },
    { name: 'Vinil Cromado Prata', unit: 'm²', category: 'Vinis', cost: 55.00, format: 'Rolo 1.22m' },
    { name: 'Vinil Jateado', unit: 'm²', category: 'Vinis', cost: 25.00, format: 'Rolo 1.22m' },
    // Papeis
    { name: 'Papel Couché 115g', unit: 'un', category: 'Papeis', cost: 0.15, format: 'SRA3' },
    { name: 'Papel Couché 150g', unit: 'un', category: 'Papeis', cost: 0.22, format: 'SRA3' },
    { name: 'Papel Couché 250g', unit: 'un', category: 'Papeis', cost: 0.35, format: 'SRA3' },
    { name: 'Papel Couché 300g', unit: 'un', category: 'Papeis', cost: 0.45, format: 'SRA3' },
    { name: 'Papel Offset 90g', unit: 'un', category: 'Papeis', cost: 0.08, format: 'A4' },
    { name: 'Papel Duplex 250g', unit: 'un', category: 'Papeis', cost: 0.55, format: 'Folha' },
    { name: 'Papel Adesivo Fotográfico', unit: 'un', category: 'Papeis', cost: 0.85, format: 'A4' },
    // Tintas
    { name: 'Tinta Solvente Cyan', unit: 'L', category: 'Tintas', cost: 120.00, format: 'Frasco 1L' },
    { name: 'Tinta Solvente Magenta', unit: 'L', category: 'Tintas', cost: 120.00, format: 'Frasco 1L' },
    { name: 'Tinta Solvente Yellow', unit: 'L', category: 'Tintas', cost: 120.00, format: 'Frasco 1L' },
    { name: 'Tinta Solvente Black', unit: 'L', category: 'Tintas', cost: 120.00, format: 'Frasco 1L' },
    // Acabamentos
    { name: 'Ilhós Niquelado', unit: 'un', category: 'Acabamentos', cost: 0.05, format: 'Pacote 1000un' },
    { name: 'Bastão Plástico 3/4', unit: 'm', category: 'Acabamentos', cost: 2.50, format: 'Barra 6m' },
    { name: 'Corda Polipropileno', unit: 'm', category: 'Acabamentos', cost: 0.40, format: 'Rolo 100m' },
    { name: 'Fita Dupla Face 3M', unit: 'm', category: 'Acabamentos', cost: 1.20, format: 'Rolo 50m' },
    { name: 'Chapa PVC 1mm', unit: 'm²', category: 'Acabamentos', cost: 25.00, format: 'Folha 1.22x2.44m' },
    { name: 'Chapa PVC 2mm', unit: 'm²', category: 'Acabamentos', cost: 45.00, format: 'Folha 1.22x2.44m' },
    { name: 'Chapa ACM 3mm', unit: 'm²', category: 'Acabamentos', cost: 180.00, format: 'Chapa 1.22x5.00m' },
    { name: 'Estrutura Gallon Metálica', unit: 'm', category: 'Acabamentos', cost: 35.00, format: 'Barra 6m' },
  ];

  const materialIds: string[] = [];
  const materialsMap: Record<string, string> = {};

  const formatMap: Record<string, any> = {
    'Rolo 3.20m': 'ROLL',
    'Rolo 1.52m': 'ROLL',
    'Rolo 1.37m': 'ROLL',
    'Rolo 1.22m': 'ROLL',
    'SRA3': 'SHEET',
    'Folha': 'SHEET',
    'A4': 'SHEET',
    'Frasco 1L': 'UNIT',
    'Pacote 1000un': 'UNIT',
    'Barra 6m': 'UNIT',
    'Rolo 100m': 'UNIT',
    'Rolo 50m': 'UNIT',
    'Folha 1.22x2.44m': 'SHEET',
    'Chapa 1.22x5.00m': 'SHEET'
  };

  for (const mData of materialsData) {
    const material = await prisma.material.upsert({
      where: { 
        organizationId_name: {
          organizationId: organization.id,
          name: mData.name
        }
      },
      update: { 
        costPerUnit: mData.cost, 
        unit: mData.unit, 
        format: (formatMap[mData.format] || 'UNIT') as any,
      },
      create: {
        organizationId: organization.id,
        name: mData.name,
        unit: mData.unit,
        category: mData.category,
        costPerUnit: mData.cost,
        format: (formatMap[mData.format] || 'UNIT') as any,
        minStockQuantity: 10,
        sellWithoutStock: true,
        active: true,
      }
    });
    materialIds.push(material.id);
    materialsMap[mData.name] = material.id;
  }

  console.log(`✅ ${materialIds.length} Materials created.`);

  // 6. Pricing Rules
  const pricingRules = [
    { 
      name: 'Cálculo por Área (m²)', 
      type: 'SQUARE_METER', 
      formula: {
        formulaString: '(LARGURA * ALTURA / 1000000) * PRECO_M2',
        variables: [
          { id: 'LARGURA', name: 'Largura', type: 'INPUT', unit: 'mm', role: 'WIDTH' },
          { id: 'ALTURA', name: 'Altura', type: 'INPUT', unit: 'mm', role: 'HEIGHT' },
          { id: 'PRECO_M2', name: 'Preço por M2', type: 'FIXED', fixedValue: 45 }
        ]
      }
    },
    { 
      name: 'Cálculo Linear (m)', 
      type: 'LASER_CUT', 
      formula: {
        formulaString: 'COMPRIMENTO * PRECO_M',
        variables: [
          { id: 'COMPRIMENTO', name: 'Comprimento', type: 'INPUT', unit: 'm', role: 'LENGTH' },
          { id: 'PRECO_M', name: 'Preço por Metro', type: 'FIXED', fixedValue: 15 }
        ]
      }
    },
    { 
      name: 'Cálculo por Unidade', 
      type: 'UNIT', 
      formula: {
        formulaString: 'QUANTIDADE * PRECO_UN',
        variables: [
          { id: 'QUANTIDADE', name: 'Quantidade', type: 'INPUT', unit: 'un', role: 'QUANTITY' },
          { id: 'PRECO_UN', name: 'Preço Unitário', type: 'FIXED', fixedValue: 10 }
        ]
      }
    },
    { 
      name: 'Banner (Área + Acabamento)', 
      type: 'SQUARE_METER', 
      formula: {
        formulaString: '((LARGURA * ALTURA / 1000000) * PRECO_M2) + (BASTAO * 5.0) + (ILHOSES * 1.5)',
        variables: [
          { id: 'LARGURA', name: 'Largura', type: 'INPUT', unit: 'mm', role: 'WIDTH' },
          { id: 'ALTURA', name: 'Altura', type: 'INPUT', unit: 'mm', role: 'HEIGHT' },
          { id: 'PRECO_M2', name: 'Preço m²', type: 'FIXED', fixedValue: 45 },
          { id: 'BASTAO', name: 'Metros de Bastão', type: 'INPUT', unit: 'm' },
          { id: 'ILHOSES', name: 'Qtd Ilhoses', type: 'INPUT', unit: 'un' }
        ]
      }
    },
  ];

  const rulesMap: Record<string, string> = {};
  for (const rule of pricingRules) {
    const r = await prisma.pricingRule.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: rule.name } },
      update: { type: rule.type as any, formula: rule.formula },
      create: {
        organizationId: organization.id,
        name: rule.name,
        type: rule.type as any,
        formula: rule.formula as any,
        active: true
      }
    });
    rulesMap[rule.name] = r.id;
  }

  console.log('✅ Pricing Rules created.');

  // 7. Products (30+ Produtos)
  const productsData = [
    // Banners
    { name: 'Banner Lona 440g c/ Acabamento', type: 'PRODUCT', mode: 'SIMPLE_AREA', price: 45.00, rule: 'Banner (Área + Acabamento)', materials: ['Lona Frontlight 440g', 'Ilhós Niquelado', 'Bastão Plástico 3/4', 'Corda Polipropileno'] },
    { name: 'Banner Lona 280g Econômico', type: 'PRODUCT', mode: 'SIMPLE_AREA', price: 35.00, rule: 'Cálculo por Área (m²)', materials: ['Lona Frontlight 280g'] },
    { name: 'Banner Backlight Translucido', type: 'PRODUCT', mode: 'SIMPLE_AREA', price: 95.00, rule: 'Cálculo por Área (m²)', materials: ['Lona Backlight 500g'] },
    // Adesivos
    { name: 'Adesivo Vinil Branco Brilho', type: 'PRODUCT', mode: 'SIMPLE_AREA', price: 40.00, rule: 'Cálculo por Área (m²)', materials: ['Vinil Adesivo Branco Brilho'] },
    { name: 'Adesivo Vinil Transparente', type: 'PRODUCT', mode: 'SIMPLE_AREA', price: 45.00, rule: 'Cálculo por Área (m²)', materials: ['Vinil Adesivo Transparente'] },
    { name: 'Adesivo Jateado p/ Vidros', type: 'PRODUCT', mode: 'SIMPLE_AREA', price: 65.00, rule: 'Cálculo por Área (m²)', materials: ['Vinil Jateado'] },
    { name: 'Adesivo de Recorte - Letras/Logos', type: 'PRODUCT', mode: 'SIMPLE_AREA', price: 55.00, rule: 'Cálculo por Área (m²)', materials: ['Vinil Recorte Preto'] },
    { name: 'Adesivo Perfurado p/ Vidros de Carro', type: 'PRODUCT', mode: 'SIMPLE_AREA', price: 60.00, rule: 'Cálculo por Área (m²)', materials: ['Vinil Perfurado'] },
    { name: 'Rótulos em Vinil (Cartela A3)', type: 'PRODUCT' as any, mode: 'SIMPLE_UNIT', price: 15.00, rule: 'Cálculo por Unidade', materials: ['Vinil Adesivo Branco Brilho'] },
    // Impressão Digital / Papelaria
    { name: 'Cartão de Visita 4x0 (Milheiro)', type: 'PRODUCT' as any, mode: 'SIMPLE_UNIT', price: 120.00, rule: 'Cálculo por Unidade', materials: ['Papel Couché 300g'] },
    { name: 'Cartão de Visita 4x4 (Milheiro)', type: 'PRODUCT' as any, mode: 'SIMPLE_UNIT', price: 160.00, rule: 'Cálculo por Unidade', materials: ['Papel Couché 300g'] },
    { name: 'Panfleto 10x15cm 115g (Milheiro)', type: 'PRODUCT' as any, mode: 'SIMPLE_UNIT', price: 180.00, rule: 'Cálculo por Unidade', materials: ['Papel Couché 115g'] },
    { name: 'Panfleto 15x21cm 115g (Milheiro)', type: 'PRODUCT' as any, mode: 'SIMPLE_UNIT', price: 290.00, rule: 'Cálculo por Unidade', materials: ['Papel Couché 115g'] },
    { name: 'Tag de Roupa (100un)', type: 'PRODUCT' as any, mode: 'SIMPLE_UNIT', price: 45.00, rule: 'Cálculo por Unidade', materials: ['Papel Couché 250g'] },
    { name: 'Envelope Saco A4 (un)', type: 'PRODUCT' as any, mode: 'SIMPLE_UNIT', price: 2.50, rule: 'Cálculo por Unidade', materials: ['Papel Offset 90g'] },
    { name: 'Pasta c/ Bolsa (un)', type: 'PRODUCT' as any, mode: 'SIMPLE_UNIT', price: 4.80, rule: 'Cálculo por Unidade', materials: ['Papel Couché 300g'] },
    { name: 'Certificado / Diploma A4', type: 'PRODUCT' as any, mode: 'SIMPLE_UNIT', price: 3.50, rule: 'Cálculo por Unidade', materials: ['Papel Couché 150g'] },
    // Placas e Sinalização
    { name: 'Placa PVC 1mm c/ Adesivo', type: 'PRODUCT', mode: 'SIMPLE_AREA', price: 110.00, rule: 'Cálculo por Área (m²)', materials: ['Chapa PVC 1mm', 'Vinil Adesivo Branco Brilho'] },
    { name: 'Placa PVC 2mm c/ Adesivo', type: 'PRODUCT', mode: 'SIMPLE_AREA', price: 145.00, rule: 'Cálculo por Área (m²)', materials: ['Chapa PVC 2mm', 'Vinil Adesivo Branco Brilho'] },
    { name: 'Placa de Obra (ACM)', type: 'PRODUCT', mode: 'SIMPLE_AREA', price: 320.00, rule: 'Cálculo por Área (m²)', materials: ['Chapa ACM 3mm', 'Vinil Adesivo Branco Brilho'] },
    { name: 'Letreiro em ACM', type: 'PRODUCT', mode: 'SIMPLE_AREA', price: 450.00, rule: 'Cálculo por Área (m²)', materials: ['Chapa ACM 3mm'] },
    { name: 'Cavalete de Madeira 60x90cm', type: 'PRODUCT' as any, mode: 'SIMPLE_UNIT', price: 135.00, rule: 'Cálculo por Unidade', materials: ['Lona Frontlight 280g', 'Estrutura Gallon Metálica'] },
    // Outros
    { name: 'Totem de Papelão', type: 'PRODUCT' as any, mode: 'SIMPLE_UNIT', price: 180.00, rule: 'Cálculo por Unidade', materials: ['Papel Duplex 250g'] },
    { name: 'Bloco de Notas / Receituário', type: 'PRODUCT' as any, mode: 'SIMPLE_UNIT', price: 25.00, rule: 'Cálculo por Unidade', materials: ['Papel Offset 90g'] },
    { name: 'Imã de Geladeira (Cartela)', type: 'PRODUCT' as any, mode: 'SIMPLE_UNIT', price: 1.20, rule: 'Cálculo por Unidade', materials: ['Vinil Adesivo Branco Brilho'] },
    { name: 'Fachada em Lona c/ Estrutura', type: 'PRODUCT' as any, mode: 'SIMPLE_AREA', price: 165.00, rule: 'Cálculo por Área (m²)', materials: ['Lona Frontlight 440g', 'Estrutura Gallon Metálica'] },
    { name: 'Banner em Tecido Canvas', type: 'PRODUCT' as any, mode: 'SIMPLE_AREA', price: 150.00, rule: 'Cálculo por Área (m²)', materials: ['Papel Duplex 250g'] },
    { name: 'Adesivo de Chão Antiderrapante', type: 'PRODUCT' as any, mode: 'SIMPLE_AREA', price: 110.00, rule: 'Cálculo por Área (m²)', materials: ['Vinil Adesivo Branco Brilho'] },
    { name: 'Display de Balcão (PVC)', type: 'PRODUCT' as any, mode: 'SIMPLE_UNIT', price: 45.00, rule: 'Cálculo por Unidade', materials: ['Chapa PVC 1mm'] },
    { name: 'Placa de Sinalização Interna', type: 'PRODUCT' as any, mode: 'SIMPLE_UNIT', price: 25.00, rule: 'Cálculo por Unidade', materials: ['Chapa PVC 2mm', 'Vinil Recorte Preto'] },
    { name: 'Wind Banner (Completo)', type: 'PRODUCT' as any, mode: 'SIMPLE_UNIT', price: 280.00, rule: 'Cálculo por Unidade', materials: ['Lona Frontlight 280g', 'Estrutura Gallon Metálica'] },
    { name: 'Adesivo Automotivo (m²)', type: 'PRODUCT' as any, mode: 'SIMPLE_AREA', price: 85.00, rule: 'Cálculo por Área (m²)', materials: ['Vinil Adesivo Branco Brilho'] },
  ];

  const productIds: string[] = [];
  for (const pData of productsData) {
    const product = await prisma.product.upsert({
      where: { 
        organizationId_name: { organizationId: organization.id, name: pData.name } 
      },
      update: { 
        salePrice: pData.price, 
        pricingMode: pData.mode as any,
        pricingRuleId: rulesMap[pData.rule]
      },
      create: {
        organizationId: organization.id,
        name: pData.name,
        productType: pData.type as any,
        pricingMode: pData.mode as any,
        salePrice: pData.price,
        active: true,
        pricingRuleId: rulesMap[pData.rule],
        trackStock: true,
        sellWithoutStock: true
      }
    });
    productIds.push(product.id);

    // Ficha Técnica (BOM)
    for (const matName of pData.materials) {
      const materialId = materialsMap[matName];
      if (materialId) {
        await prisma.fichaTecnicaInsumo.upsert({
          where: {
            productId_insumoId: {
              productId: product.id,
              insumoId: materialId
            }
          },
          update: { quantidade: 1.0 },
          create: {
            organizationId: organization.id,
            productId: product.id,
            insumoId: materialId,
            quantidade: 1.0,
            custoCalculado: 0
          }
        });
      }
    }
  }

  console.log(`✅ ${productIds.length} Products and BOMs created.`);

  // 8. Initial Inventory (Estoque para cada Material)
  for (const materialId of materialIds) {
    await prisma.inventoryItem.create({
      data: {
        materialId,
        width: 1000, // Dimensões base para o seed
        length: 50000,
        quantity: Math.floor(Math.random() * 100) + 10,
        location: `Prateleira ${['A', 'B', 'C'][Math.floor(Math.random() * 3)]}-${Math.floor(Math.random() * 5) + 1}`,
        isOffcut: false
      }
    });

    // Alguns retalhos aleatórios
    if (Math.random() > 0.5) {
      await prisma.inventoryItem.create({
        data: {
          materialId,
          width: 500,
          length: 500,
          quantity: Math.floor(Math.random() * 5) + 1,
          location: 'Caixa de Retalhos',
          isOffcut: true
        }
      });
    }
  }

  console.log('✅ Initial Inventory and Offcuts created.');

  console.log('✅ Master data populated. No orders or transactions created.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
