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
            enableFinance: true
        },
        create: {
            organizationId: organization.id,
            enableEngineering: true,
            enableWMS: true,
            enableProduction: true,
            enableFinance: true
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
        // Buscar se já existe por nome na organização
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
    console.log('📈 Criando regras de precificação...');
    const regraPadrao = await prisma.pricingRule.upsert({
        where: { id: 'regra-padrao-lonas' }, 
        update: {
            formula: 'CUSTO_MATERIAIS * 2.5',
            active: true
        },
        create: {
            id: 'regra-padrao-lonas',
            name: 'Padrão Lonas (Markup 2.5x)',
            organizationId: organization.id,
            type: 'PRODUCT',
            formula: 'CUSTO_MATERIAIS * 2.5',
            active: true
        }
    });

    // ── Produtos Iniciais ──
    console.log('🎨 Criando produtos...');
    const produtosIniciais = [
        {
            name: 'Banner em Lona',
            description: 'Banner personalizado com acabamento em bastão e cordão',
            productType: 'PRODUCT',
            pricingMode: 'DYNAMIC_ENGINEER',
            pricingRuleId: regraPadrao.id,
            salePrice: 0,
            minPrice: 15.00,
            markup: 2.5
        },
        {
            name: 'Adesivo Vinil',
            description: 'Adesivo impresso em alta resolução',
            productType: 'PRODUCT',
            pricingMode: 'SIMPLE_AREA',
            customFormula: '((LARGURA * ALTURA) / 1000000) * 45', 
            salePrice: 45.00,
            minPrice: 30.00,
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
                    pricingRuleId: produto.pricingRuleId,
                    customFormula: produto.customFormula,
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

        // Vincular Ficha Técnica Base (Exemplo)
        if (produto.name === 'Banner em Lona') {
            const lona = createdInsumos.find(i => i.nome === 'Lona Brilho 440g');
            const ilhos = createdInsumos.find(i => i.nome === 'Ilhós Metálico');
            
            if (lona && ilhos) {
                // Limpar e recriar
                await prisma.fichaTecnicaInsumo.deleteMany({ where: { productId: existingProduct.id } });
                await prisma.fichaTecnicaInsumo.createMany({
                    data: [
                        { productId: existingProduct.id, insumoId: lona.id, quantidade: 1, organizationId: organization.id, custoCalculado: lona.custoUnitario },
                        { productId: existingProduct.id, insumoId: ilhos.id, quantidade: 4, organizationId: organization.id, custoCalculado: ilhos.custoUnitario }
                    ]
                });
            }
        }
    }
    console.log('✅ Produtos e Fichas Técnicas garantidos');

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
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });