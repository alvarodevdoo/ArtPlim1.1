const axios = require('axios');

async function testNewLogin() {
    const baseURL = 'http://localhost:3001';

    try {
        console.log('🔐 Testando novo login...');
        const loginResponse = await axios.post(`${baseURL}/auth/login`, {
            email: 'admin@artplim.com',
            password: '123456',
            organizationSlug: 'artplim'
        });

        console.log('✅ Login realizado com sucesso!');
        console.log('📋 Dados do usuário:', {
            name: loginResponse.data.data.user.name,
            email: loginResponse.data.data.user.email,
            role: loginResponse.data.data.user.role,
            organizationName: loginResponse.data.data.user.organizationName
        });

        const token = loginResponse.data.data.token;
        console.log('🔑 Token gerado:', token ? 'SIM' : 'NÃO');

        // Testar rota protegida
        console.log('\n🔒 Testando rota protegida...');
        const meResponse = await axios.get(`${baseURL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('✅ Rota protegida funcionando!');
        console.log('👤 Perfil do usuário:', {
            name: meResponse.data.data.name,
            email: meResponse.data.data.email,
            organization: meResponse.data.data.organization.name
        });

        console.log('\n🎉 Tudo funcionando perfeitamente!');

    } catch (error) {
        console.error('❌ Erro no teste:', error.response?.data || error.message);
    }
}

testNewLogin();