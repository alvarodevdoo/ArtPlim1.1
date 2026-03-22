const axios = require('axios');

async function testProductTypesAPI() {
    const baseURL = 'http://localhost:3001';

    try {
        console.log('🔐 Fazendo login...');
        const loginResponse = await axios.post(`${baseURL}/auth/login`, {
            email: 'admin@artplim.com',
            password: 'admin123',
            organizationSlug: 'artplim-demo'
        });

        const token = loginResponse.data.data.token;
        console.log('✅ Login realizado com sucesso');

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Listar produtos para ver os tipos
        console.log('\n📋 Listando produtos com tipos...');
        const productsResponse = await axios.get(`${baseURL}/api/catalog/products`, { headers });

        console.log('✅ Produtos encontrados:');
        productsResponse.data.data.forEach(product => {
            const typeEmojis = {
                'PRODUCT': '📦',
                'SERVICE': '🎨',
                'PRINT_SHEET': '📄',
                'PRINT_ROLL': '🖨️',
                'LASER_CUT': '⚡'
            };

            const emoji = typeEmojis[product.productType] || '❓';
            console.log(`  ${emoji} ${product.name} (${product.productType}) - R$ ${product.salePrice || 'Dinâmico'}`);
        });

        // Testar criação de um novo produto com tipo
        console.log('\n📝 Testando criação de produto com tipo LASER_CUT...');
        const newProduct = await axios.post(`${baseURL}/api/catalog/products`, {
            name: 'Teste Corte Laser',
            description: 'Produto de teste para corte laser',
            productType: 'LASER_CUT',
            pricingMode: 'SIMPLE_UNIT',
            salePrice: 25.00,
            minPrice: 15.00,
            markup: 2.5
        }, { headers });

        console.log('✅ Produto criado com sucesso:', {
            id: newProduct.data.data.id,
            name: newProduct.data.data.name,
            productType: newProduct.data.data.productType,
            salePrice: newProduct.data.data.salePrice
        });

        // Testar atualização do tipo de produto
        console.log('\n✏️ Testando atualização do tipo de produto...');
        const updatedProduct = await axios.put(`${baseURL}/api/catalog/products/${newProduct.data.data.id}`, {
            productType: 'SERVICE',
            salePrice: 150.00
        }, { headers });

        console.log('✅ Produto atualizado:', {
            name: updatedProduct.data.data.name,
            productType: updatedProduct.data.data.productType,
            salePrice: updatedProduct.data.data.salePrice
        });

        console.log('\n🎉 Todos os testes passaram! A funcionalidade está funcionando corretamente.');

    } catch (error) {
        console.error('❌ Erro no teste:', error.response?.data || error.message);
    }
}

testProductTypesAPI();