const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const budget = await prisma.budget.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { id: true, budgetNumber: true, validUntil: true }
    });
    console.log(JSON.stringify(budget, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
