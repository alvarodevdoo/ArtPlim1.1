const { PrismaClient } = require('@prisma/client');

async function createMoreOrders() {
    const prisma = new PrismaClient();

    try {
        console.log('🔍 Creating more test orders...');

        // Get required data
        const organization = await prisma.organization.findFirst();
        const customer = await prisma.profile.findFirst({
            where: { isCustomer: true }
        });
        const products = await prisma.product.findMany();

        if (!organization || !customer || products.length === 0) {
            console.log('❌ Missing required data');
            return;
        }

        console.log(`✅ Found ${products.length} products to use`);

        // Create orders with different products
        const orders = [
            {
                orderNumber: 'PED-TEST-002',
                productName: 'Cartão de Visita',
                quantity: 1000,
                unitPrice: 0.15,
                width: 90,
                height: 50,
                status: 'APPROVED'
            },
            {
                orderNumber: 'PED-TEST-003',
                productName: 'Banner Personalizado',
                quantity: 1,
                unitPrice: 85.00,
                width: 1000,
                height: 700,
                status: 'IN_PRODUCTION'
            },
            {
                orderNumber: 'PED-TEST-004',
                productName: 'Flyer A5',
                quantity: 500,
                unitPrice: 0.25,
                width: 148,
                height: 210,
                status: 'FINISHED'
            }
        ];

        for (const orderData of orders) {
            const product = products.find(p => p.name === orderData.productName) || products[0];
            const totalPrice = orderData.quantity * orderData.unitPrice;

            const order = await prisma.order.create({
                data: {
                    organizationId: organization.id,
                    customerId: customer.id,
                    orderNumber: orderData.orderNumber,
                    status: orderData.status,
                    total: totalPrice,
                    subtotal: totalPrice,
                    notes: `Pedido de teste - ${orderData.productName}`,
                    items: {
                        create: [
                            {
                                productId: product.id,
                                width: orderData.width,
                                height: orderData.height,
                                quantity: orderData.quantity,
                                unitPrice: orderData.unitPrice,
                                totalPrice: totalPrice,
                                costPrice: orderData.unitPrice * 0.6,
                                calculatedPrice: orderData.unitPrice
                            }
                        ]
                    }
                }
            });

            console.log(`✅ Created order ${order.orderNumber} - ${product.name} - R$ ${totalPrice.toFixed(2)}`);
        }

        // Check final count
        const totalOrders = await prisma.order.count();
        console.log(`\n📊 Total orders in database: ${totalOrders}`);

    } catch (error) {
        console.error('❌ Error creating orders:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createMoreOrders();