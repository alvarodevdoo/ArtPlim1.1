const axios = require('axios');

async function testOrdersAPI() {
    try {
        console.log('🔍 Testing Orders API...');

        // First, login to get a token
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            email: 'admin@artplim.com',
            password: '123456',
            organizationSlug: 'artplim'
        });

        const token = loginResponse.data.data.token;
        console.log('✅ Login successful, token obtained');

        // Test orders endpoint
        const ordersResponse = await axios.get('http://localhost:3001/api/sales/orders', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('📊 Orders API Response:');
        console.log('Status:', ordersResponse.status);
        console.log('Data structure:', JSON.stringify(ordersResponse.data, null, 2));

        if (ordersResponse.data.data && ordersResponse.data.data.length > 0) {
            console.log('\n📋 First Order Details:');
            const firstOrder = ordersResponse.data.data[0];
            console.log('Order Number:', firstOrder.orderNumber);
            console.log('Customer:', firstOrder.customer?.name);
            console.log('Items Count:', firstOrder.items?.length || 0);

            if (firstOrder.items && firstOrder.items.length > 0) {
                console.log('\n🛍️ First Item Details:');
                const firstItem = firstOrder.items[0];
                console.log('Product ID:', firstItem.productId);
                console.log('Product Name:', firstItem.product?.name);
                console.log('Product Pricing Mode:', firstItem.product?.pricingMode);
                console.log('Quantity:', firstItem.quantity);
                console.log('Unit Price:', firstItem.unitPrice);
                console.log('Total Price:', firstItem.totalPrice);
            }
        } else {
            console.log('⚠️ No orders found in the system');
        }

    } catch (error) {
        console.error('❌ Error testing Orders API:', error.response?.data || error.message);
    }
}

testOrdersAPI();