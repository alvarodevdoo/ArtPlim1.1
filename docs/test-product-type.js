const axios = require('axios');

async function testProductType() {
    const baseURL = 'http://localhost:3001';

    try {
        // Primeiro, vamos fazer login para obter um token
        console.log('🔐 Fazendo login...');
        const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
            email: 'admin@artplim.com',
            password: 'admin123'
        });

        const token = loginResponse.data.token;
        console.log('✅ Login realizado com sucesso');

        // Configurar headers com token
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Testar criação de produto com tipo SERVICE
        console.log('\n📝 Criando produto do tipo SERVICE...');
        const serviceProduct = await axios.post(`${baseURL}/api/catalog/products`, {
            name: 'Design de Logo',
            description: 'Criação de logotipo personalizado',
            productType: 'SERVICE',
            pricingMode: 'SIMPLE_UNIT',
            salePrice: 150.00,
            markup: 2.0
        }, { headers });

        console.log('✅ Produto SERVICE criado:', serviceProduct.data.data);

        // Testar criação de produto do tipo PRINT_SHEET
        console.log('\n📝 Criando produto do tipo PRINT_SHEET...');
        const printProduct = await axios.post(`${baseURL}/api/catalog/products`, {
            name: 'Impressão A4 Colorida',
            description: 'Impressão em papel A4 colorida',
            productType: 'PRINT_SHEET',
            pricingMode: 'SIMPLE_AREA',
            salePrice: 2.50,
            markup: 2.0
        }, { headers });

        console.log('✅ Produto PRINT_SHEET criado:', printProduct.data.data);

        // Testar criação de produto do tipo LASER_CUT
        console.log('\n📝 Criando produto do tipo LASER_CUT...');
        const laserProduct = await axios.post(`${baseURL}/api/catalog/products`, {
            name: 'Corte em MDF',
            description: 'Corte a laser em MDF 3mm',
            productType: 'LASER_CUT',
            pricingMode: 'DYNAMIC_ENGINEER',
            markup: 3.0
        }, { headers });

        console.log('✅ Produto LASER_CUT criado:', laserProduct.data.data);

        // Listar todos os produtos para verificar os tipos
        console.log('\n📋 Listando todos os produtos...');
        const productsResponse = await axios.get(`${baseURL}/api/catalog/products`, { headers });

        console.log('✅ Produtos encontrados:');
        productsResponse.data.data.forEach(product => {
            console.log(`  - ${product.name} (${product.productType || 'PRODUCT'}) - ${product.pricingMode}`);
        });

        console.log('\n🎉 Teste concluído com sucesso!');

    } catch (error) {
        console.error('❌ Erro no teste:', error.response?.data || error.message);
    }
}

testProductType();