const axios = require('axios');

// Teste permanente de login - NÃO APAGAR
// Este arquivo serve para testar rapidamente o login quando necessário

const API_BASE = 'http://localhost:3001';

async function testLogin() {
    console.log('🔐 Testando login básico...');

    try {
        const response = await axios.post(`${API_BASE}/api/auth/login`, {
            email: 'admin@artplim.com',
            password: '123456',
            organizationSlug: 'artplim'
        });

        console.log('✅ Login bem-sucedido!');
        console.log('📋 Dados retornados:');
        console.log('  - Token:', response.data.data.token ? 'RECEBIDO' : 'NÃO RECEBIDO');
        console.log('  - Usuário:', response.data.data.user.name);
        console.log('  - Email:', response.data.data.user.email);
        console.log('  - Organização:', response.data.data.user.organizationName);
        console.log('  - Role:', response.data.data.user.role);

        return response.data.data.token;

    } catch (error) {
        console.error('❌ Erro no login:');
        if (error.response) {
            console.error('  Status:', error.response.status);
            console.error('  Mensagem:', error.response.data.error?.message || error.response.data.message);
        } else {
            console.error('  Erro:', error.message);
        }
        return null;
    }
}

async function testOrganizationSettings(token) {
    if (!token) {
        console.log('⏭️ Pulando teste de configurações (sem token)');
        return;
    }

    console.log('\n🏢 Testando configurações da organização...');

    try {
        const response = await axios.get(`${API_BASE}/api/organization/settings`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('✅ Configurações carregadas com sucesso!');
        console.log('📋 Configurações:');
        const settings = response.data.data;
        console.log('  - Engineering:', settings.enableEngineering ? 'ATIVO' : 'INATIVO');
        console.log('  - WMS:', settings.enableWMS ? 'ATIVO' : 'INATIVO');
        console.log('  - Production:', settings.enableProduction ? 'ATIVO' : 'INATIVO');
        console.log('  - Finance:', settings.enableFinance ? 'ATIVO' : 'INATIVO');
        console.log('  - Markup padrão:', settings.defaultMarkup);
        console.log('  - Taxa de imposto:', settings.taxRate);

    } catch (error) {
        console.error('❌ Erro ao carregar configurações:');
        if (error.response) {
            console.error('  Status:', error.response.status);
            console.error('  Mensagem:', error.response.data.error?.message || error.response.data.message);
        } else {
            console.error('  Erro:', error.message);
        }
    }
}

async function runAllTests() {
    console.log('🧪 TESTE PERMANENTE DE LOGIN E AUTENTICAÇÃO');
    console.log('='.repeat(50));

    const token = await testLogin();
    await testOrganizationSettings(token);

    console.log('\n' + '='.repeat(50));
    console.log('✅ Testes concluídos!');
}

// Executar se chamado diretamente
if (require.main === module) {
    runAllTests();
}

module.exports = { testLogin, testOrganizationSettings };