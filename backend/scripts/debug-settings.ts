import { PrismaClient } from '@prisma/client';
import { OrganizationService } from '../src/modules/organization/services/OrganizationService';

const prisma = new PrismaClient();

async function debug() {
  const service = new OrganizationService(prisma);
  
  // Pegar a primeira organização
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.log('Nenhuma organização encontrada.');
    return;
  }

  console.log(`Testando organização: ${org.name} (${org.id})`);

  try {
    // Simular o que o frontend envia
    const mockData = {
      enableWMS: false,
      enableProduction: false,
      enableFinance: true,
      enableFinanceReports: true,
      enableAutomation: true,
      validadeOrcamento: 7,
      allowDuplicatePhones: true,
      defaultReceivableCategoryId: null,
      defaultRevenueCategoryId: null
    };

    console.log('Tentando atualizar com:', mockData);
    const result = await service.updateSettings(org.id, mockData);
    console.log('✅ Sucesso na atualização!', result);
  } catch (error) {
    console.error('❌ ERRO CAPTURADO:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debug();
