import { PrismaClient, ItemType, PricingMode, MaterialFormat } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedCompleteData() {
    console.log('🌱 Iniciando seed completo com tipos de produtos...');

    try {
        // 1. CRIAR ORGANIZAÇÃO E USUÁRIOS
        console.log('🏢 Criando organização e usuários...');

        const organization = await prisma.organization.upsert({
            where: { slug: 'artplim-demo' },
            update: {},
            create: {
                name: 'ArtPlim Gráfica Demo',
                slug: 'artplim-demo',
                cnpj: '12.345.678/0001-90',
                plan: 'pro',
                active: true
            }
        });

        // Configurações da organização
        await prisma.organizationSettings.upsert({
            where: { organizationId: organization.id },
            update: {},
            create: {
                organizationId: organization.id,
                enableEngineering: true,
                enableWMS: true,
                enableProduction: true,
                enableFinance: true,
                defaultMarkup: 2.5,
                taxRate: 0.0,
                validadeOrcamento: 15
            }
        });

        // Usuários
        const hashedPassword = await bcrypt.hash('admin123', 10);

        const adminUser = await prisma.user.upsert({
            where: {
                organizationId_email: {
                    organizationId: organization.id,
                    email: 'admin@artplim.com'
                }
            },
            update: {},
            create: {
                organizationId: organization.id,
                email: 'admin@artplim.com',
                password: hashedPassword,
                name: 'Administrador',
                role: 'ADMIN',
                active: true
            }
        });

        const designerUser = await prisma.user.upsert({
            where: {
                organizationId_email: {
                    organizationId: organization.id,
                    email: 'designer@artplim.com'
                }
            },
            update: {},
            create: {
                organizationId: organization.id,
                email: 'designer@artplim.com',
                password: hashedPassword,
                name: 'Designer Gráfico',
                role: 'USER',
                active: true
            }
        });

        const operatorUser = await prisma.user.upsert({
            where: {
                organizationId_email: {
                    organizationId: organization.id,
                    email: 'operador@artplim.com'
                }
            },
            update: {},
            create: {
                organizationId: organization.id,
                email: 'operador@artplim.com',
                password: hashedPassword,
                name: 'Operador de Produção',
                role: 'OPERATOR',
                active: true
            }
        });

        console.log('✅ Organização e usuários criados');

        // 2. CRIAR CLIENTES
        console.log('👥 Criando clientes...');

        const customers = [
            {
                name: 'João Silva Comércio',
                document: '12345678901',
                email: 'joao@email.com',
                phone: '(11) 99999-1111',
                type: 'INDIVIDUAL' as const
            },
            {
                name: 'Empresa ABC Ltda',
                document: '12.345.678/0001-90',
                email: 'contato@empresaabc.com',
                phone: '(11) 3333-4444',
                type: 'COMPANY' as const
            },
            {
                name: 'Maria Santos',
                document: '98765432100',
                email: 'maria@email.com',
                phone: '(11) 88888-2222',
                type: 'INDIVIDUAL' as const
            }
        ];

        const createdCustomers = [];
        for (const customer of customers) {
            const created = await prisma.profile.upsert({
                where: {
                    organizationId_document: {
                        organizationId: organization.id,
                        document: customer.document
                    }
                },
                update: {},
                create: {
                    organizationId: organization.id,
                    type: customer.type,
                    name: customer.name,
                    document: customer.document,
                    email: customer.email,
                    phone: customer.phone,
                    isCustomer: true,
                    active: true
                }
            });
            createdCustomers.push(created);
        }

        console.log('✅ Clientes criados');

        // 3. CRIAR MATERIAIS
        console.log('📦 Criando materiais...');

        const materials = [
            // Materiais para impressão em folha
            { name: 'Papel Couché 115g', format: 'SHEET' as MaterialFormat, costPerUnit: 0.85, unit: 'folha' },
            { name: 'Papel Couché 170g', format: 'SHEET' as MaterialFormat, costPerUnit: 1.20, unit: 'folha' },
            { name: 'Papel Offset 75g', format: 'SHEET' as MaterialFormat, costPerUnit: 0.45, unit: 'folha' },
            { name: 'Papel Fotográfico', format: 'SHEET' as MaterialFormat, costPerUnit: 2.80, unit: 'folha' },

            // Materiais para impressão em rolo
            { name: 'Vinil Adesivo Branco', format: 'ROLL' as MaterialFormat, costPerUnit: 12.50, unit: 'm²' },
            { name: 'Lona Frontlit 440g', format: 'ROLL' as MaterialFormat, costPerUnit: 8.90, unit: 'm²' },
            { name: 'Lona Mesh 280g', format: 'ROLL' as MaterialFormat, costPerUnit: 9.80, unit: 'm²' },
            { name: 'Vinil Transparente', format: 'ROLL' as MaterialFormat, costPerUnit: 15.80, unit: 'm²' },

            // Materiais para corte laser
            { name: 'MDF 3mm', format: 'SHEET' as MaterialFormat, costPerUnit: 12.00, unit: 'm²' },
            { name: 'MDF 6mm', format: 'SHEET' as MaterialFormat, costPerUnit: 18.50, unit: 'm²' },
            { name: 'Acrílico 3mm', format: 'SHEET' as MaterialFormat, costPerUnit: 35.00, unit: 'm²' },
            { name: 'Compensado 4mm', format: 'SHEET' as MaterialFormat, costPerUnit: 22.00, unit: 'm²' },

            // Consumíveis
            { name: 'Tinta Digital CMYK', format: 'UNIT' as MaterialFormat, costPerUnit: 180.00, unit: 'litro' },
            { name: 'Laminação Brilho', format: 'ROLL' as MaterialFormat, costPerUnit: 6.50, unit: 'm²' },
            { name: 'Laminação Fosca', format: 'ROLL' as MaterialFormat, costPerUnit: 7.20, unit: 'm²' }
        ];

        const createdMaterials = [];
        for (const material of materials) {
            const created = await prisma.material.create({
                data: {
                    name: material.name,
                    format: material.format,
                    costPerUnit: material.costPerUnit,
                    unit: material.unit,
                    organizationId: organization.id,
                    description: `Material para produção gráfica - ${material.name}`,
                    active: true
                }
            });
            createdMaterials.push(created);
        }

        console.log('✅ Materiais criados');

        // 4. CRIAR PRODUTOS COM TIPOS
        console.log('🎨 Criando produtos com tipos...');

        const productsWithTypes = [
            // PRODUTOS PADRÃO (PRODUCT)
            {
                name: 'Cartão de Visita Premium',
                description: 'Cartão de visita em couché 300g com verniz localizado',
                productType: 'PRODUCT' as ItemType,
                pricingMode: 'SIMPLE_UNIT' as PricingMode,
                salePrice: 0.45,
                minPrice: 0.30,
                markup: 2.5,
                materials: ['Papel Couché 170g']
            },
            {
                name: 'Flyer A5 Colorido',
                description: 'Flyer formato A5 em couché 115g',
                productType: 'PRODUCT' as ItemType,
                pricingMode: 'SIMPLE_UNIT' as PricingMode,
                salePrice: 0.85,
                minPrice: 0.60,
                markup: 2.5,
                materials: ['Papel Couché 115g']
            },

            // SERVIÇOS (SERVICE)
            {
                name: 'Criação de Logotipo',
                description: 'Desenvolvimento de identidade visual completa',
                productType: 'SERVICE' as ItemType,
                pricingMode: 'SIMPLE_UNIT' as PricingMode,
                salePrice: 350.00,
                minPrice: 250.00,
                markup: 3.0,
                materials: []
            },
            {
                name: 'Arte para Redes Sociais',
                description: 'Criação de posts personalizados para Instagram/Facebook',
                productType: 'SERVICE' as ItemType,
                pricingMode: 'SIMPLE_UNIT' as PricingMode,
                salePrice: 80.00,
                minPrice: 50.00,
                markup: 2.8,
                materials: []
            },
            {
                name: 'Consultoria em Design',
                description: 'Consultoria especializada em design gráfico',
                productType: 'SERVICE' as ItemType,
                pricingMode: 'SIMPLE_UNIT' as PricingMode,
                salePrice: 120.00,
                minPrice: 80.00,
                markup: 3.5,
                materials: []
            },

            // IMPRESSÃO EM FOLHA (PRINT_SHEET)
            {
                name: 'Impressão A4 Colorida',
                description: 'Impressão digital colorida em papel A4',
                productType: 'PRINT_SHEET' as ItemType,
                pricingMode: 'SIMPLE_AREA' as PricingMode,
                salePrice: 2.50,
                minPrice: 1.80,
                markup: 2.2,
                materials: ['Papel Couché 115g', 'Tinta Digital CMYK']
            },
            {
                name: 'Impressão Fotográfica',
                description: 'Impressão em papel fotográfico alta qualidade',
                productType: 'PRINT_SHEET' as ItemType,
                pricingMode: 'SIMPLE_AREA' as PricingMode,
                salePrice: 8.50,
                minPrice: 6.00,
                markup: 2.8,
                materials: ['Papel Fotográfico', 'Tinta Digital CMYK']
            },
            {
                name: 'Folder Institucional',
                description: 'Folder dobrado em 3 partes com laminação',
                productType: 'PRINT_SHEET' as ItemType,
                pricingMode: 'SIMPLE_UNIT' as PricingMode,
                salePrice: 3.50,
                minPrice: 2.50,
                markup: 2.5,
                materials: ['Papel Couché 170g', 'Laminação Brilho']
            },

            // IMPRESSÃO EM ROLO (PRINT_ROLL)
            {
                name: 'Banner em Lona',
                description: 'Banner personalizado em lona frontlit 440g',
                productType: 'PRINT_ROLL' as ItemType,
                pricingMode: 'SIMPLE_AREA' as PricingMode,
                salePrice: 18.00,
                minPrice: 14.00,
                markup: 2.2,
                materials: ['Lona Frontlit 440g', 'Tinta Digital CMYK']
            },
            {
                name: 'Adesivo Personalizado',
                description: 'Adesivo em vinil branco com recorte',
                productType: 'PRINT_ROLL' as ItemType,
                pricingMode: 'SIMPLE_AREA' as PricingMode,
                salePrice: 25.00,
                minPrice: 18.00,
                markup: 2.5,
                materials: ['Vinil Adesivo Branco', 'Tinta Digital CMYK']
            },
            {
                name: 'Faixa Publicitária',
                description: 'Faixa em lona com ilhoses para eventos',
                productType: 'PRINT_ROLL' as ItemType,
                pricingMode: 'SIMPLE_AREA' as PricingMode,
                salePrice: 22.00,
                minPrice: 16.00,
                markup: 2.3,
                materials: ['Lona Frontlit 440g', 'Tinta Digital CMYK']
            },
            {
                name: 'Adesivo Transparente',
                description: 'Adesivo em vinil transparente para vidros',
                productType: 'PRINT_ROLL' as ItemType,
                pricingMode: 'SIMPLE_AREA' as PricingMode,
                salePrice: 32.00,
                minPrice: 24.00,
                markup: 2.4,
                materials: ['Vinil Transparente', 'Tinta Digital CMYK']
            },

            // CORTE LASER (LASER_CUT)
            {
                name: 'Placa MDF Personalizada',
                description: 'Placa decorativa em MDF com corte e gravação',
                productType: 'LASER_CUT' as ItemType,
                pricingMode: 'DYNAMIC_ENGINEER' as PricingMode,
                salePrice: null,
                minPrice: 25.00,
                markup: 3.2,
                materials: ['MDF 3mm']
            },
            {
                name: 'Chaveiro Acrílico',
                description: 'Chaveiro personalizado em acrílico colorido',
                productType: 'LASER_CUT' as ItemType,
                pricingMode: 'SIMPLE_UNIT' as PricingMode,
                salePrice: 8.50,
                minPrice: 5.00,
                markup: 3.5,
                materials: ['Acrílico 3mm']
            },
            {
                name: 'Caixa MDF Personalizada',
                description: 'Caixa em MDF com gravação personalizada',
                productType: 'LASER_CUT' as ItemType,
                pricingMode: 'DYNAMIC_ENGINEER' as PricingMode,
                salePrice: null,
                minPrice: 35.00,
                markup: 3.0,
                materials: ['MDF 6mm']
            },
            {
                name: 'Placa Identificação',
                description: 'Placa de identificação em compensado',
                productType: 'LASER_CUT' as ItemType,
                pricingMode: 'SIMPLE_UNIT' as PricingMode,
                salePrice: 15.00,
                minPrice: 10.00,
                markup: 2.8,
                materials: ['Compensado 4mm']
            }
        ];

        const createdProducts = [];
        for (const product of productsWithTypes) {
            const created = await prisma.product.create({
                data: {
                    name: product.name,
                    description: product.description,
                    productType: product.productType,
                    pricingMode: product.pricingMode,
                    salePrice: product.salePrice,
                    minPrice: product.minPrice,
                    markup: product.markup,
                    organizationId: organization.id,
                    active: true
                }
            });

            // Adicionar componentes (materiais) se houver
            if (product.materials.length > 0) {
                for (const materialName of product.materials) {
                    const material = createdMaterials.find(m => m.name === materialName);
                    if (material) {
                        await prisma.productComponent.create({
                            data: {
                                productId: created.id,
                                materialId: material.id,
                                consumptionMethod: material.format === 'ROLL' ? 'BOUNDING_BOX' :
                                    material.format === 'SHEET' ? 'BOUNDING_BOX' : 'FIXED_AMOUNT',
                                wastePercentage: 0.1 // 10% de perda padrão
                            }
                        });
                    }
                }
            }

            createdProducts.push(created);
            console.log(`✅ Produto criado: ${product.name} (${product.productType})`);
        }

        // 5. CRIAR PEDIDOS DE EXEMPLO
        console.log('📋 Criando pedidos de exemplo...');

        const orders = [
            {
                customer: createdCustomers[0],
                orderNumber: 'PED-001',
                status: 'DRAFT' as const,
                items: [
                    {
                        product: createdProducts.find(p => p.name === 'Cartão de Visita Premium'),
                        quantity: 1000,
                        width: 90,
                        height: 50,
                        unitPrice: 0.45,
                        totalPrice: 450.00
                    },
                    {
                        product: createdProducts.find(p => p.name === 'Criação de Logotipo'),
                        quantity: 1,
                        width: null,
                        height: null,
                        unitPrice: 350.00,
                        totalPrice: 350.00
                    }
                ]
            },
            {
                customer: createdCustomers[1],
                orderNumber: 'PED-002',
                status: 'APPROVED' as const,
                items: [
                    {
                        product: createdProducts.find(p => p.name === 'Banner em Lona'),
                        quantity: 2,
                        width: 2000,
                        height: 1000,
                        unitPrice: 18.00,
                        totalPrice: 72.00
                    },
                    {
                        product: createdProducts.find(p => p.name === 'Adesivo Personalizado'),
                        quantity: 10,
                        width: 200,
                        height: 100,
                        unitPrice: 25.00,
                        totalPrice: 50.00
                    }
                ]
            }
        ];

        for (const orderData of orders) {
            const subtotal = orderData.items.reduce((sum, item) => sum + item.totalPrice, 0);

            const order = await prisma.order.create({
                data: {
                    organizationId: organization.id,
                    customerId: orderData.customer.id,
                    orderNumber: orderData.orderNumber,
                    status: orderData.status,
                    subtotal: subtotal,
                    discount: 0,
                    tax: 0,
                    total: subtotal,
                    deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
                    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 dias
                    notes: `Pedido de exemplo - ${orderData.orderNumber}`,
                    items: {
                        create: orderData.items.map(item => ({
                            productId: item.product!.id,
                            itemType: item.product!.productType,
                            width: item.width,
                            height: item.height,
                            quantity: item.quantity,
                            totalArea: item.width && item.height ? (item.width * item.height * item.quantity) / 1000000 : null,
                            costPrice: item.unitPrice * 0.6, // 60% do preço de venda como custo
                            calculatedPrice: item.unitPrice,
                            unitPrice: item.unitPrice,
                            totalPrice: item.totalPrice,
                            notes: `Item de exemplo - ${item.product!.name}`
                        }))
                    }
                }
            });

            console.log(`✅ Pedido criado: ${order.orderNumber}`);
        }

        // 6. RESUMO FINAL
        console.log('\n🎉 Seed completo finalizado com sucesso!');
        console.log('\n📊 RESUMO DOS DADOS CRIADOS:');
        console.log(`🏢 Organização: ${organization.name}`);
        console.log(`👥 Usuários: 3 (admin, designer, operador)`);
        console.log(`🤝 Clientes: ${createdCustomers.length}`);
        console.log(`📦 Materiais: ${createdMaterials.length}`);
        console.log(`🎨 Produtos: ${createdProducts.length}`);

        console.log('\n🔑 CREDENCIAIS DE ACESSO:');
        console.log('📧 admin@artplim.com / admin123 (Administrador)');
        console.log('📧 designer@artplim.com / admin123 (Designer)');
        console.log('📧 operador@artplim.com / admin123 (Operador)');

        console.log('\n📋 PRODUTOS POR TIPO:');
        const productsByType = createdProducts.reduce((acc, product) => {
            acc[product.productType] = (acc[product.productType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        Object.entries(productsByType).forEach(([type, count]) => {
            const typeLabels = {
                'PRODUCT': '📦 Produtos Padrão',
                'SERVICE': '🎨 Serviços',
                'PRINT_SHEET': '📄 Impressão Folha',
                'PRINT_ROLL': '🖨️ Impressão Rolo',
                'LASER_CUT': '⚡ Corte Laser'
            };
            console.log(`${typeLabels[type as keyof typeof typeLabels] || type}: ${count}`);
        });

        console.log('\n✨ Banco de dados populado e pronto para uso!');

    } catch (error) {
        console.error('❌ Erro durante o seed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

seedCompleteData().catch(console.error);