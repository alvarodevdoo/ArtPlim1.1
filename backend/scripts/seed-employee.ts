import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedEmployee() {
    console.log('🌱 Criando funcionário de teste...');

    try {
        const org = await prisma.organization.findUnique({ where: { slug: 'artplim' } });
        if (!org) return console.error('Org artplim não encontrada');

        const hashedPassword = await bcrypt.hash('123456', 10);
        const email = 'kesia@artplim.com.br';

        // Criar Usuário Separado
        const user = await prisma.user.upsert({
            where: { organizationId_email: { organizationId: org.id, email } },
            update: { name: 'Kesia Funcionária', role: 'USER', active: true, password: hashedPassword },
            create: {
                organizationId: org.id,
                email,
                password: hashedPassword,
                name: 'Kesia Funcionária',
                role: 'USER',
                active: true
            }
        });

        // Criar Profile e vincular
        await prisma.profile.upsert({
            where: { organizationId_document: { organizationId: org.id, document: '00000000001' } },
            update: { userId: user.id, isEmployee: true, email: email },
            create: {
                organizationId: org.id,
                name: 'Kesia Funcionária',
                document: '00000000001',
                email: email,
                type: 'INDIVIDUAL',
                isEmployee: true,
                userId: user.id
            }
        });

        console.log('✅ Kesia criada com email: ' + email);
    } finally {
        await prisma.$disconnect();
    }
}
seedEmployee();
