const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const rule = await prisma.pricingRule.findFirst();
    console.log(JSON.stringify(rule, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
