import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const ROLE_PERMISSIONS: Record<string, string[]> = {
    OWNER: [
        'sales.view', 'sales.create', 'sales.edit', 'sales.delete', 'sales.approve',
        'finance.view', 'finance.costs', 'finance.margins', 'finance.reports',
        'production.view', 'production.manage',
        'inventory.view', 'inventory.manage',
        'admin.users', 'admin.settings', 'admin.organization'
    ],
    ADMIN: [
        'sales.view', 'sales.create', 'sales.edit', 'sales.delete', 'sales.approve',
        'finance.view', 'finance.costs', 'finance.margins', 'finance.reports',
        'production.view', 'production.manage',
        'inventory.view', 'inventory.manage',
        'admin.users', 'admin.settings'
    ],
    MANAGER: [
        'sales.view', 'sales.create', 'sales.edit', 'sales.approve',
        'finance.view', 'finance.costs', 'finance.margins',
        'production.view', 'production.manage',
        'inventory.view', 'inventory.manage'
    ],
    OPERATOR: [
        'production.view', 'production.manage',
        'inventory.view'
    ],
    USER: [
        'sales.view', 'sales.create', 'sales.edit'
    ]
};

const ROLE_NAMES: Record<string, string> = {
    OWNER: 'Proprietário',
    ADMIN: 'Administrador',
    MANAGER: 'Gerente',
    OPERATOR: 'Operador',
    USER: 'Usuário'
};

async function main() {
    console.log('Iniciando migração de roles (RBAC)...');
    
    // 1. Buscar todas as organizações
    const organizations = await prisma.organization.findMany();
    
    for (const org of organizations) {
        console.log(`Migrando organização: ${org.name} (${org.id})...`);
        
        // Mapear RoleEnum -> roleId
        const createdRoleIds: Record<string, string> = {};

        // 2. Para cada org, criar as roles padrões do sistema se não existirem
        for (const [roleEnum, roleName] of Object.entries(ROLE_NAMES)) {
            // Verifica se a role já existe para não duplicar
            let role = await prisma.role.findFirst({
                where: { organizationId: org.id, name: roleName }
            });

            if (!role) {
                role = await prisma.role.create({
                    data: {
                        organizationId: org.id,
                        name: roleName,
                        description: `Perfil padrão do sistema: ${roleName}`,
                        isSystem: true,
                        active: true,
                    }
                });

                // Inserir as permissões correspondentes
                const permissions = ROLE_PERMISSIONS[roleEnum] || [];
                if (permissions.length > 0) {
                    await prisma.rolePermission.createMany({
                        data: permissions.map(perm => ({
                            roleId: role!.id,
                            permissionKey: perm
                        }))
                    });
                }
            }
            createdRoleIds[roleEnum] = role.id;
        }

        // 3. Atualizar os usuários dessa organização com os seus respectivos roleIds
        const users = await prisma.user.findMany({ where: { organizationId: org.id } });
        
        for (const user of users) {
             const targetRoleId = createdRoleIds[user.role];
             if (targetRoleId && !user.roleId) {
                 await prisma.user.update({
                     where: { id: user.id },
                     data: { roleId: targetRoleId }
                 });
             }
        }
    }

    console.log('Migração de roles (RBAC) concluída com sucesso!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
