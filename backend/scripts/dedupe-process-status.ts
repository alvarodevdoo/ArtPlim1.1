import { prisma } from '../src/shared/infrastructure/database/prisma';

/**
 * Remove ProcessStatus duplicados (mesma organização + nome + comportamento + escopo),
 * repontando todas as referências para um único "vencedor" antes de apagar os demais.
 * Tudo numa transação: se algo falhar, nada é aplicado.
 */
async function main() {
  const all = await prisma.processStatus.findMany();
  const groups = new Map<string, typeof all>();

  for (const s of all) {
    const key = `${s.organizationId}|${s.name}|${s.mappedBehavior}|${s.scope}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  const duplicatedGroups = [...groups.values()].filter((g) => g.length > 1);
  if (duplicatedGroups.length === 0) {
    console.log('Nenhum ProcessStatus duplicado encontrado.');
    return;
  }

  let totalRemoved = 0;

  await prisma.$transaction(async (tx) => {
    for (const rows of duplicatedGroups) {
      // Vencedor = mais antigo (createdAt). Os demais serão repontados e removidos.
      rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const keeper = rows[0];
      const dupIds = rows.slice(1).map((r) => r.id);

      console.log(
        `Grupo "${keeper.name}/${keeper.mappedBehavior}/${keeper.scope}": ` +
          `mantendo ${keeper.id}, repontando+removendo ${dupIds.length} duplicado(s).`
      );

      await tx.order.updateMany({ where: { processStatusId: { in: dupIds } }, data: { processStatusId: keeper.id } });
      await tx.orderItem.updateMany({ where: { processStatusId: { in: dupIds } }, data: { processStatusId: keeper.id } });
      await tx.budgetItem.updateMany({ where: { processStatusId: { in: dupIds } }, data: { processStatusId: keeper.id } });
      await tx.orderStatusHistory.updateMany({ where: { fromProcessStatusId: { in: dupIds } }, data: { fromProcessStatusId: keeper.id } });
      await tx.orderStatusHistory.updateMany({ where: { toProcessStatusId: { in: dupIds } }, data: { toProcessStatusId: keeper.id } });
      await tx.processStatus.updateMany({ where: { parentId: { in: dupIds } }, data: { parentId: keeper.id } });

      const del = await tx.processStatus.deleteMany({ where: { id: { in: dupIds } } });
      totalRemoved += del.count;
    }
  });

  console.log(`\nConcluído. ${totalRemoved} ProcessStatus duplicado(s) removido(s).`);
}

main()
  .catch((e) => {
    console.error('Falha no dedupe (nada foi aplicado):', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
