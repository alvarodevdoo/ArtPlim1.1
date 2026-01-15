import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Criando dados com produtos para teste...');

    // Criar alguns materiais básicos
    const materials = await Promise.all([
        prisma.material.create({
            data: {
                organizationId: (await prisma.organization.findFirst())!.id,
                name: 'Papel Couché 300g',
                format: 'SHEET',
                costPerUnit: 0.50,
                unit: 'SHEET',
                standardWidth: 210,
                standardLength: 297,
                active: true
            }
        }),
        prisma.material.create({
            data: {
                organizationId: (await prisma.organization.findFirst())!.id,
                name: 'Vinil Adesivo',
                format: 'ROLL',
                costPerUnit: 15.00,
                unit: 'SQUARE_METER',
                standardWidth: 1000,
                active: true
            }
        }),
        prisma.material.create({
            data: {
                organizationId: (await prisma.organization.findFirst())!.id,
                name: 'MDF 3mm',
                format: 'SHEET',
                costPerUnit: 25.00,
                unit: 'SQUARE_METER',
                standardWidth: 1220,
                standardLength: 2440,
                active: true
            }
        })
    ]);

    // Criar alguns produtos com diferentes tipos
    const products = await Promise.all([
        prisma.product.create({
            data: {
                organizationId: (await prisma.organization.findFirst())!.id,
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
                organizationId: (await prisma.organization.findFirst())!.id,
                name: 'Adesivo Personalizado',
                description: 'Adesivo em vinil para personalização - R$ 25,00/m²',
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
                organizationId: (await prisma.organization.findFirst())!.id,
                name: 'Banner Grande',
                description: 'Banner em lona para eventos - R$ 18,00/m²',
                productType: 'PRINT_ROLL',
                pricingMode: 'SIMPLE_AREA',
                salePrice: 18.00,
                minPrice: 12.00,
                markup: 2.0,
                active: true
            }
        }),
        prisma.product.create({
            data: {
                organizationId: (await prisma.organization.findFirst())!.id,
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
                organizationId: (await prisma.organization.findFirst())!.id,
                name: 'Placa Personalizada',
                description: 'Placa em MDF cortada a laser',
                productType: 'LASER_CUT',
                pricingMode: 'DYNAMIC_ENGINEER',
                markup: 2.5,
                active: true
            }
        })
    ]);

    console.log('✅ Produtos criados com sucesso!');
    console.log('');
    console.log('📦 Produtos para teste:');
    products.forEach(product => {
        const priceInfo = product.salePrice ?
            (product.pricingMode === 'SIMPLE_AREA' ? `R$ ${product.salePrice}/m²` : `R$ ${product.salePrice}/un`) :
            'Preço dinâmico';
        console.log(`- ${product.name} (${product.pricingMode}) - ${priceInfo}`);
    });
    console.log('');
    console.log('🧪 Para testar o cálculo por m²:');
    console.log('1. Acesse a página de Pedidos');
    console.log('2. Selecione "Adesivo Personalizado" ou "Banner Grande"');
    console.log('3. Informe largura e altura (ex: 1000mm x 500mm = 0.5m²)');
    console.log('4. O preço deve ser calculado automaticamente');
    console.log('   - Adesivo: 0.5m² × R$ 25,00 = R$ 12,50');
    console.log('   - Banner: 0.5m² × R$ 18,00 = R$ 9,00');
}

main()
    .catch((e) => {
        console.error('❌ Erro ao executar seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });