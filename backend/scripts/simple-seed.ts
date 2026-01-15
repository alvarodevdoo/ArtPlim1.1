import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Criando dados básicos...');

    // Criar organização
    const organization = await prisma.organization.create({
        data: {
            name: 'ArtPlim Gráfica',
            slug: 'artplim',
            active: true,
            plan: 'PREMIUM'
        }
    });

    console.log('✅ Organização criada:', organization.name);

    // Criar configurações da organização
    await prisma.organizationSettings.create({
        data: {
            organizationId: organization.id,
            enableEngineering: true,
            enableWMS: true,
            enableProduction: true,
            enableFinance: true
        }
    });

    console.log('✅ Configurações criadas');

    // Criar usuário admin
    const hashedPassword = await bcrypt.hash('123456', 10);

    const adminUser = await prisma.user.create({
        data: {
            organizationId: organization.id,
            name: 'Admin',
            email: 'admin@artplim.com',
            password: hashedPassword,
            role: 'OWNER',
            active: true
        }
    });

    console.log('✅ Usuário admin criado:', adminUser.email);

    console.log('');
    console.log('📋 DADOS DE ACESSO:');
    console.log('🏢 Organização: artplim');
    console.log('👤 Email: admin@artplim.com');
    console.log('🔑 Senha: 123456');
    console.log('');
}

main()
    .catch((e) => {
        console.error('❌ Erro ao executar seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });