// No topo do seu seed-ArtPlim.ts
import { prisma } from '../src/shared/infrastructure/database/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 [ArtPlim] Iniciando carga de dados base...');

  try {
    // 1. Upsert da Organização (Princípio SOLID: Responsabilidade de estrutura)
    const organization = await prisma.organization.upsert({
      where: { slug: 'artplim' },
      update: {},
      create: {
        name: 'ArtPlim Gráfica & Comunicação Visual',
        slug: 'artplim',
        plan: 'premium',
        settings: {
          create: {
            enableWMS: true,
            enableProduction: true,
            enableFinance: true,
            defaultMarkup: 2.5,
          }
        }
      }
    });
    console.log(`✅ Organização "${organization.slug}" verificada.`);

    // 2. Upsert do Admin (Feature: Auth/Users)
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
      where: {
        organizationId_email: {
          organizationId: organization.id,
          email: 'admin@artplim.com.br'
        }
      },
      update: {},
      create: {
        name: 'Admin ArtPlim',
        email: 'admin@artplim.com.br',
        password: adminPassword,
        role: 'ADMIN',
        organizationId: organization.id
      }
    });
    console.log(`✅ Administrador "${admin.email}" verificado.`);

    console.log('🏁 Seed finalizado com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante o Seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();