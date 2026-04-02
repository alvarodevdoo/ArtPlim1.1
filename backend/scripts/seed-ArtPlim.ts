import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { subDays, format } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting ArtPlim Massive Seed...');

  // 1. Organization & User
  const organization = await prisma.organization.upsert({
    where: { slug: 'artplim' },
    update: {},
    create: {
      name: 'ArtPlim Gráfica & Comunicação Visual',
      slug: 'artplim',
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

  console.log('✅ Organization and Admin Owner created.');
  console.log('⚠ All other sample data (Products, Customers, etc.) skipped for production setup.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
