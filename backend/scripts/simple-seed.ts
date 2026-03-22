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
            enableEngineering: true,
            enableWMS: true,
            enableProduction: true,
            enableFinance: true,
            enableFinanceReports: true,
            enableAutomation: true
        },
        create: {
            organizationId: organization.id,
            enableEngineering: true,
            enableWMS: true,
            enableProduction: true,
            enableFinance: true,
            enableFinanceReports: true,
            enableAutomation: true
        }
    });

    console.log('✅ Configurações garantidas');

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

    // ── Insumos Iniciais ──
    console.log('🌱 Inserindo insumos...');
    const insumosIniciais = [
        { nome: 'Lona Brilho 440g', categoria: 'Comunicação Visual', unidadeBase: 'M2', custoUnitario: 18.50 },
        { nome: 'Adesivo Vinil Branco', categoria: 'Comunicação Visual', unidadeBase: 'M2', custoUnitario: 14.00 },
        { nome: 'MDF 3mm', categoria: 'Chapas', unidadeBase: 'M2', custoUnitario: 25.50 },
        { nome: 'Ilhós Metálico', categoria: 'Acabamentos', unidadeBase: 'UN', custoUnitario: 0.15 },
        { nome: 'Tinta Solvente CMYK', categoria: 'Tintas', unidadeBase: 'LITRO', custoUnitario: 140.00 },
    ];

    const createdInsumos = [];
    for (const insumo of insumosIniciais) {
        let existing = await prisma.insumo.findFirst({
            where: { organizationId: organization.id, nome: insumo.nome }
        });

        if (existing) {
            existing = await prisma.insumo.update({
                where: { id: existing.id },
                data: {
                    categoria: insumo.categoria,
                    unidadeBase: insumo.unidadeBase as any,
                    custoUnitario: insumo.custoUnitario,
                    ativo: true
                }
            });
        } else {
            existing = await prisma.insumo.create({
                data: {
                    ...insumo,
                    unidadeBase: insumo.unidadeBase as any,
                    organizationId: organization.id,
                    ativo: true
                }
            });
        }
        createdInsumos.push(existing);
    }
    console.log(`✅ ${createdInsumos.length} insumos garantidos`);

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
                    ValorVenda_unit: "R$/m²",
                    ValorCusto: 0,
                    ValorCusto_unit: "R$/m²"
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
                    defaultUnit: "R$/m²",
                    allowedUnits: ["R$/m²", "R$/cm²", "R$/mm²"]
                  },
                  {
                    id: "ValorCusto",
                    name: "Custo M²",
                    role: "COST_RATE",
                    type: "INPUT",
                    visible: true,
                    defaultUnit: "R$/m²",
                    allowedUnits: ["R$/m²", "R$/cm²", "R$/mm²"]
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
                    ValorVenda_unit: "R$/m²",
                    ValorCusto: 0,
                    ValorCusto_unit: "R$/m²"
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
                    defaultUnit: "R$/m²",
                    allowedUnits: ["R$/m²", "R$/cm²", "R$/mm²"]
                  },
                  {
                    id: "ValorCusto",
                    name: "Custo M²",
                    role: "COST_RATE",
                    type: "INPUT",
                    visible: true,
                    defaultUnit: "R$/m²",
                    allowedUnits: ["R$/m²", "R$/cm²", "R$/mm²"]
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