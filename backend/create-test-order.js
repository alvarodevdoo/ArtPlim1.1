const { PrismaClient } = require('@prisma/client');

async function createTestOrder() {
    const prisma = new PrismaClient();

    try {
        console.log('🔍 Creating test order...');

        // Get organization and customer
        const organization = await prisma.organization.findFirst();
        const customer = await prisma.profile.findFirst({
            where: { isCustomer: true }
        });
        const product = await prisma.product.findFirst();

        if (!organization || !customer || !product) {
            console.log('❌ Missing required data:');
            console.log('- Organization:', !!organization);
            console.log('- Customer:', !!customer);
            console.log('- Product:', !!product);
            return;
        }

        console.log('✅ Found required data:');
        console.log('- Organization:', organization.name);
        console.log('- Customer:', customer.name);
        console.log('- Product:', product.name);

        // Create test order
        const order = await prisma.order.create({
            data: {
                organizationId: organization.id,
                customerId: customer.id,
                orderNumber: 'PED-TEST-001',
                status: 'DRAFT',
                total: 150.00,
                subtotal: 150.00,
                notes: 'Pedido de teste criado automaticamente',
                items: {
                    create: [
                        {
                            productId: product.id,
                            width: 210,
                            height: 297,
                            quantity: 100,
                            unitPrice: 1.50,
                            totalPrice: 150.00,
                            costPrice: 0.90,
                            calculatedPrice: 1.50
                        }
                    ]
                }
            },
            include: {
                customer: true,
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        console.log('✅ Test order created successfully!');
        console.log('- Order Number:', order.orderNumber);
        console.log('- Customer:', order.customer.name);
        console.log('- Items:', order.items.length);
        console.log('- Total:', order.total);

        if (order.items.length > 0) {
            const item = order.items[0];
            console.log('- First Item Product:', item.product.name);
            console.log('- Quantity:', item.quantity);
            console.log('- Unit Price:', item.unitPrice);
        }

    } catch (error) {
        console.error('❌ Error creating test order:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createTestOrder();