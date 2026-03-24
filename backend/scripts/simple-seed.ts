import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Criando dados básicos...');

    // Criar organização (com upsert para evitar erro se já existir)
    const organization = await prisma.organization.upsert({
        where: { slug: 'artplim' },
        update: {
            name: 'ArtPlim Gráfica',
            active: true,
            plan: 'PREMIUM'
        },
        create: {
            name: 'ArtPlim Gráfica',
            slug: 'artplim',
            active: true,
            plan: 'PREMIUM'
        }
    });

    console.log('✅ Organização garantida:', organization.name);

    // Criar ou atualizar configurações da organização
    await prisma.organizationSettings.upsert({
        where: { organizationId: organization.id },
        update: {
            enableWMS: true,
            enableProduction: true,
            enableFinance: true,
            enableFinanceReports: true,
            enableAutomation: true
        },
        create: {
            organizationId: organization.id,
            enableWMS: true,
            enableProduction: true,
            enableFinance: true,
            enableFinanceReports: true,
            enableAutomation: true
        }
    });

    console.log('✅ Configurações garantidas');

    // ── Plano de Contas Básico ──
    console.log('📊 Criando plano de contas básico...');
    const contasBase = [
        { code: '1.1.01', name: 'Estoque de Materiais', type: 'ASSET' },
        { code: '1.1.02', name: 'Estoque de Produtos Acabados', type: 'ASSET' },
        { code: '3.1.01', name: 'Venda de Produtos', type: 'REVENUE' },
        { code: '4.1.01', name: 'Custo de Materiais (CPV)', type: 'EXPENSE' },
        { code: '4.1.02', name: 'Despesas Operacionais', type: 'EXPENSE' },
    ];

    for (const conta of contasBase) {
        await prisma.chartOfAccount.upsert({
            where: { 
                organizationId_code: { 
                    organizationId: organization.id, 
                    code: conta.code 
                } 
            },
            update: {
                name: conta.name,
                type: conta.type as any,
                active: true
            },
            create: {
                organizationId: organization.id,
                code: conta.code,
                name: conta.name,
                type: conta.type as any,
                active: true
            }
        });
    }
    console.log('✅ Plano de contas garantido');

    // Criar usuário admin (com upsert)
    const hashedPassword = await bcrypt.hash('123456', 10);

    const adminUser = await prisma.user.upsert({
        where: { 
            organizationId_email: {
                organizationId: organization.id,
                email: 'admin@artplim.com'
            }
        },
        update: {
            name: 'Admin',
            password: hashedPassword,
            role: 'OWNER',
            active: true
        },
        create: {
            organizationId: organization.id,
            name: 'Admin',
            email: 'admin@artplim.com',
            password: hashedPassword,
            role: 'OWNER',
            active: true
        }
    });

    console.log('✅ Usuário admin garantido:', adminUser.email);

    // ── Materiais Iniciais ──
    console.log('🌱 Inserindo materiais...');
    const materiaisIniciais = [
        { name: 'Lona Brilho 440g', category: 'Comunicação Visual', unit: 'm2', format: 'ROLL', costPerUnit: 18.50 },
        { name: 'Adesivo Vinil Branco', category: 'Comunicação Visual', unit: 'm2', format: 'ROLL', costPerUnit: 14.00 },
        { name: 'MDF 3mm', category: 'Chapas', unit: 'm2', format: 'SHEET', costPerUnit: 25.50 },
        { name: 'Ilhós Metálico', category: 'Acabamentos', unit: 'un', format: 'UNIT', costPerUnit: 0.15 },
        { name: 'Tinta Solvente CMYK', category: 'Tintas', unit: 'litro', format: 'UNIT', costPerUnit: 140.00 },
    ];

    const createdMaterials = [];
    for (const mat of materiaisIniciais) {
        let existing = await prisma.material.findFirst({
            where: { organizationId: organization.id, name: mat.name }
        });

        if (existing) {
            existing = await prisma.material.update({
                where: { id: existing.id },
                data: {
                    category: mat.category,
                    unit: mat.unit,
                    format: mat.format as any,
                    costPerUnit: mat.costPerUnit,
                    active: true
                }
            });
        } else {
            existing = await prisma.material.create({
                data: {
                    ...mat,
                    format: mat.format as any,
                    organizationId: organization.id,
                    active: true,
                    defaultConsumptionRule: 'FIXED',
                    defaultConsumptionFactor: 1.0
                }
            });
        }
        createdMaterials.push(existing);
    }
    console.log(`✅ ${createdMaterials.length} materiais garantidos`);

    // ── Regras de Precificação ──
    console.log('📈 Criando regras de precificação detalhadas...');
    
    // 1. Regra Unitária
    const regraUnitario = await prisma.pricingRule.upsert({
        where: { id: 'e248f50d-e74f-40d1-aa01-a48f99e1bb22' },
        update: {
            name: 'Unitário',
            formula: {
                formulaString: 'ValorVenda',
                costFormulaString: 'ValorCusto',
                referenceValues: {
                  ValorCusto: 0,
                  ValorVenda: 0
                },
                variables: [
                    {
                        id: 'ValorVenda',
                        name: 'Venda',
                        role: 'COST_RATE',
                        type: 'INPUT',
                        visible: true,
                        defaultUnit: "",
                        allowedUnits: []
                    },
                    {
                        id: 'ValorCusto',
                        name: 'Custo',
                        role: 'COST_RATE',
                        type: 'INPUT',
                        visible: true,
                        defaultUnit: "",
                        allowedUnits: []
                    }
                ]
            },
            active: true
        },
        create: {
            id: 'e248f50d-e74f-40d1-aa01-a48f99e1bb22',
            organizationId: organization.id,
            name: 'Unitário',
            type: 'UNIT',
            formula: {
                formulaString: 'ValorVenda',
                costFormulaString: 'ValorCusto',
                referenceValues: {
                  ValorCusto: 0,
                  ValorVenda: 0
                },
                variables: [
                    {
                        id: 'ValorVenda',
                        name: 'Venda',
                        role: 'COST_RATE',
                        type: 'INPUT',
                        visible: true,
                        defaultUnit: "",
                        allowedUnits: []
                    },
                    {
                        id: 'ValorCusto',
                        name: 'Custo',
                        role: 'COST_RATE',
                        type: 'INPUT',
                        visible: true,
                        defaultUnit: "",
                        allowedUnits: []
                    }
                ]
            },
            active: true
        }
    });

    // 2. Regra de Área Detalhada com ReferenceValues robustos
    const regraArea = await prisma.pricingRule.upsert({
        where: { id: 'bd0cbeac-ba5d-4124-ab5b-3d0a77ef8804' },
        update: {
            name: 'Área',
            formula: {
                formulaString: '( altura * largura ) * ValorVenda',
                costFormulaString: '( altura * largura ) * ValorCusto',
                referenceValues: {
                    altura: "100",
                    altura_unit: "cm",
                    largura: "100",
                    largura_unit: "cm",
                    ValorVenda: 0,
                    ValorVenda_unit: "m²",
                    ValorCusto: 0,
                    ValorCusto_unit: "m²"
                },
                variables: [
                  {
                    id: "altura",
                    name: "Altura",
                    role: "LENGTH",
                    type: "INPUT",
                    visible: true,
                    defaultUnit: "cm",
                    allowedUnits: ["mm", "cm", "m"]
                  },
                  {
                    id: "largura",
                    name: "Largura",
                    role: "LENGTH",
                    type: "INPUT",
                    visible: true,
                    defaultUnit: "cm",
                    allowedUnits: ["mm", "cm", "m"]
                  },
                  {
                    id: "ValorVenda",
                    name: "Preço M²",
                    role: "COST_RATE",
                    type: "INPUT",
                    visible: true,
                    defaultUnit: "m²",
                    allowedUnits: ["m²", "cm²", "mm²"]
                  },
                  {
                    id: "ValorCusto",
                    name: "Custo M²",
                    role: "COST_RATE",
                    type: "INPUT",
                    visible: true,
                    defaultUnit: "m²",
                    allowedUnits: ["m²", "cm²", "mm²"]
                  }
                ]
            },
            active: true
        },
        create: {
            id: 'bd0cbeac-ba5d-4124-ab5b-3d0a77ef8804',
            organizationId: organization.id,
            name: 'Área',
            type: 'SQUARE_METER',
            formula: {
                formulaString: '( altura * largura ) * ValorVenda',
                costFormulaString: '( altura * largura ) * ValorCusto',
                referenceValues: {
                    altura: "100",
                    altura_unit: "cm",
                    largura: "100",
                    largura_unit: "cm",
                    ValorVenda: 0,
                    ValorVenda_unit: "m²",
                    ValorCusto: 0,
                    ValorCusto_unit: "m²"
                },
                variables: [
                  {
                    id: "altura",
                    name: "Altura",
                    role: "LENGTH",
                    type: "INPUT",
                    visible: true,
                    defaultUnit: "cm",
                    allowedUnits: ["mm", "cm", "m"]
                  },
                  {
                    id: "largura",
                    name: "Largura",
                    role: "LENGTH",
                    type: "INPUT",
                    visible: true,
                    defaultUnit: "cm",
                    allowedUnits: ["mm", "cm", "m"]
                  },
                  {
                    id: "ValorVenda",
                    name: "Preço M²",
                    role: "COST_RATE",
                    type: "INPUT",
                    visible: true,
                    defaultUnit: "m²",
                    allowedUnits: ["m²", "cm²", "mm²"]
                  },
                  {
                    id: "ValorCusto",
                    name: "Custo M²",
                    role: "COST_RATE",
                    type: "INPUT",
                    visible: true,
                    defaultUnit: "m²",
                    allowedUnits: ["m²", "cm²", "mm²"]
                  }
                ]
            },
            active: true
        }
    });

    console.log('✅ Regras de precificação garantidas');

    // ── Produtos Iniciais ──
    console.log('🎨 Criando produtos...');
    const produtosIniciais = [
        {
            name: 'Banner em Lona',
            description: 'Banner personalizado com acabamento em bastão e cordão',
            productType: 'PRODUCT',
            pricingMode: 'DYNAMIC_ENGINEER',
            pricingRuleId: regraArea.id,
            salePrice: 0,
            minPrice: 0,
            markup: 2.5
        },
        {
            name: 'Adesivo Vinil',
            description: 'Adesivo impresso em alta resolução',
            productType: 'PRODUCT',
            pricingMode: 'DYNAMIC_ENGINEER',
            pricingRuleId: regraArea.id,
            salePrice: 0,
            minPrice: 0,
            markup: 2.0
        }
    ];

    for (const produto of produtosIniciais) {
        let existingProduct = await prisma.product.findFirst({
            where: { organizationId: organization.id, name: produto.name }
        });

        if (existingProduct) {
            existingProduct = await prisma.product.update({
                where: { id: existingProduct.id },
                data: {
                    description: produto.description,
                    productType: produto.productType as any,
                    pricingMode: produto.pricingMode as any,
                    pricingRuleId: (produto as any).pricingRuleId,
                    salePrice: produto.salePrice,
                    minPrice: produto.minPrice,
                    markup: produto.markup,
                    active: true
                }
            });
        } else {
            existingProduct = await prisma.product.create({
                data: {
                    ...produto,
                    productType: produto.productType as any,
                    pricingMode: produto.pricingMode as any,
                    organizationId: organization.id,
                    active: true
                }
            });
        }
    }
    console.log('✅ Produtos garantidos');

    console.log('');
    console.log('📋 DADOS DE ACESSO:');
    console.log('🏢 Organização: artplim');
    console.log('👤 Email: admin@artplim.com');
    console.log('🔑 Senha: 123456');
    console.log('');
}

main()
    .catch((e) => {
        console.error('❌ Erro ao executar seed:', e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });