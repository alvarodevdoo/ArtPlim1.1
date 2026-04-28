import axios from 'axios';

async function test() {
  try {
    console.log('--- Buscando Perfis ---');
    const profilesRes = await axios.get('http://localhost:3000/api/profiles?isCustomer=true');
    const portugues = profilesRes.data.data.find((p: any) => p.name.includes('Portuguesa'));
    
    if (portugues) {
      console.log('Cliente encontrado:', portugues.name);
      console.log('Saldo:', portugues.balance);
      
      console.log('\n--- Buscando Detalhes do Cliente ---');
      const detailRes = await axios.get(`http://localhost:3000/api/profiles/${portugues.id}`);
      console.log('Detalhes:', JSON.stringify(detailRes.data.data, null, 2));
    } else {
      console.log('Cliente Portuguesa não encontrado na lista.');
    }
  } catch (error: any) {
    console.error('Erro:', error.message);
    if (error.response) {
      console.error('Dados do erro:', error.response.data);
    }
  }
}

test();
