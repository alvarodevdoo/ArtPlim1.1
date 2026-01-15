import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkClientes() {
    try {
        console.log('🔍 Verificando clientes no banco...');

        // Buscar todos os profiles
        const allProfiles = await prisma.profile.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                isCustomer: true,
                isEmployee: true,
                isSupplier: true,
                organizationId: true
            }
        });

        console.log(`📊 Total de profiles encontrados: ${allProfiles.length}`);

        if (allProfiles.length > 0) {
            console.log('\n📋 Profiles encontrados:');
            allProfiles.forEach(profile => {
                console.log(`- ${profile.name} (ID: ${profile.id})`);
                console.log(`  Cliente: ${profile.isCustomer}, Funcionário: ${profile.isEmployee}, Fornecedor: ${profile.isSupplier}`);
                console.log(`  Organização: ${profile.organizationId}`);
                console.log('');
            });
        }

        // Buscar apenas clientes
        const clientes = await prisma.profile.findMany({
            where: {
                isCustomer: true
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                document: true,
                organizationId: true
            }
        });

        console.log(`👥 Total de clientes encontrados: ${clientes.length}`);

        if (clientes.length === 0) {
            console.log('\n⚠️ Nenhum cliente encontrado! Vamos criar um cliente de teste...');

            // Buscar uma organização para associar o cliente
            const org = await prisma.organization.findFirst();

            if (org) {
                const novoCliente = await prisma.profile.create({
                    data: {
                        name: 'Cliente Teste',
                        email: 'cliente@teste.com',
                        phone: '(11) 99999-9999',
                        document: '123.456.789-00',
                        type: 'INDIVIDUAL',
                        isCustomer: true,
                        organizationId: org.id
                    }
                });

                console.log('✅ Cliente de teste criado:', novoCliente);
            } else {
                console.log('❌ Nenhuma organização encontrada para associar o cliente');
            }
        } else {
            console.log('\n👥 Clientes encontrados:');
            clientes.forEach(cliente => {
                console.log(`- ${cliente.name} (${cliente.email})`);
                console.log(`  Telefone: ${cliente.phone}, Documento: ${cliente.document}`);
                console.log(`  Organização: ${cliente.organizationId}`);
                console.log('');
            });
        }

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkClientes();