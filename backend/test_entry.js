const { PrismaClient, Prisma } = require('@prisma/client');
async function test() {
  const p = new PrismaClient();
  const orgId = 'ee6fded6-9e03-42ac-bf51-d295b5181a62';
  const matId = 'e37e0b4a-0983-4e3d-9784-d4f773a37713'; // Tinta Solvent Frasco 1L ID from previous check
  
  try {
    console.log('Starting manual entry test...');
    const material = await p.material.findUnique({ where: { id: matId } });
    if (!material) {
      console.error('Material not found');
      return;
    }
    console.log('Current Stock:', material.currentStock);
    
    const qty = 0.5;
    const unitCost = 240;
    const totalCost = 120;
    
    await p.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          organizationId: orgId,
          materialId: matId,
          type: 'ENTRY',
          quantity: new Prisma.Decimal(qty),
          unitCost: new Prisma.Decimal(unitCost),
          totalCost: new Prisma.Decimal(totalCost),
        }
      });
      console.log('Movement created ID:', movement.id);
      
      const newStock = Number(material.currentStock) + qty;
      const newAvg = unitCost; // Simple for test
      
      await tx.material.update({
        where: { id: matId },
        data: {
          currentStock: new Prisma.Decimal(newStock),
          averageCost: new Prisma.Decimal(newAvg)
        }
      });
      console.log('Material updated');
    });
    console.log('TEST SUCCESS');
  } catch (e) {
    console.error('TEST FAILED:', e);
  } finally {
    await p.$disconnect();
  }
}
test();
