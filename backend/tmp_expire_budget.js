const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    await prisma.budget.update({
        where: { id: "9164f253-fc1d-4398-b279-2107aac29aa9" },
        data: { 
            validUntil: yesterday,
            status: "DRAFT" // Ensure it's not already expired status to test the date logic too
        }
    });
    console.log("Budget 9164f253 expired manually.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
