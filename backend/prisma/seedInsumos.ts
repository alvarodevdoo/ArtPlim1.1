// backend/prisma/seedInsumos.ts
import { PrismaClient, UnidadeBase } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Pegar a primeira org (assumindo que existe pelo menos uma no ambiente dev)
  const org = await prisma.organization.findFirst();
  
  if (!org) {
    console.warn('Nenhuma organization encontrada. O seed não pode prosseguir. Crie um usuário/org primeiro.');
    return;
  }

  console.log(`🧹 Removendo insumos existentes da org ${org.id}...`);
  await prisma.insumo.deleteMany({
    where: { organizationId: org.id }
  });

  const insumosIniciais = [
    // ── Filamentos 3D ──
    { nome: 'Filamento PLA Branco', categoria: 'Impressão 3D', unidadeBase: UnidadeBase.KG, custoUnitario: 89.90 },
    { nome: 'Filamento PLA Preto', categoria: 'Impressão 3D', unidadeBase: UnidadeBase.KG, custoUnitario: 89.90 },
    { nome: 'Filamento PETG Transparente', categoria: 'Impressão 3D', unidadeBase: UnidadeBase.KG, custoUnitario: 95.50 },
    { nome: 'Filamento ABS Cinza', categoria: 'Impressão 3D', unidadeBase: UnidadeBase.KG, custoUnitario: 75.00 },
    
    // ── Chapas Rígidas ──
    { nome: 'Chapa MDF 3mm (Cru)', categoria: 'Chapas', unidadeBase: UnidadeBase.M2, custoUnitario: 25.50 },
    { nome: 'Chapa MDF 6mm (Cru)', categoria: 'Chapas', unidadeBase: UnidadeBase.M2, custoUnitario: 42.00 },
    { nome: 'Chapa Acrílico Transp 2mm', categoria: 'Chapas', unidadeBase: UnidadeBase.M2, custoUnitario: 180.00 },
    { nome: 'Chapa PS Branco 1mm', categoria: 'Chapas', unidadeBase: UnidadeBase.M2, custoUnitario: 65.00 },
    { nome: 'Chapa PS Branco 2mm', categoria: 'Chapas', unidadeBase: UnidadeBase.M2, custoUnitario: 110.00 },
    { nome: 'PVC Expandido 5mm', categoria: 'Chapas', unidadeBase: UnidadeBase.M2, custoUnitario: 135.00 },

    // ── Lonas e Adesivos ──
    { nome: 'Lona Brilho 440g', categoria: 'Comunicação Visual', unidadeBase: UnidadeBase.M2, custoUnitario: 18.50 },
    { nome: 'Lona Fosca 440g', categoria: 'Comunicação Visual', unidadeBase: UnidadeBase.M2, custoUnitario: 19.50 },
    { nome: 'Adesivo Vinil Branco Brilho', categoria: 'Comunicação Visual', unidadeBase: UnidadeBase.M2, custoUnitario: 14.00 },
    { nome: 'Adesivo Vinil Transparente', categoria: 'Comunicação Visual', unidadeBase: UnidadeBase.M2, custoUnitario: 15.00 },
    { nome: 'Adesivo Perfurado', categoria: 'Comunicação Visual', unidadeBase: UnidadeBase.M2, custoUnitario: 22.00 },

    // ── Tintas ──
    { nome: 'Tinta Solvente Cyan', categoria: 'Tintas', unidadeBase: UnidadeBase.LITRO, custoUnitario: 140.00 },
    { nome: 'Tinta Solvente Magenta', categoria: 'Tintas', unidadeBase: UnidadeBase.LITRO, custoUnitario: 140.00 },
    { nome: 'Tinta Solvente Yellow', categoria: 'Tintas', unidadeBase: UnidadeBase.LITRO, custoUnitario: 140.00 },
    { nome: 'Tinta Solvente Black', categoria: 'Tintas', unidadeBase: UnidadeBase.LITRO, custoUnitario: 140.00 },

    // ── Acabamentos ──
    { nome: 'Ilhós Metálico N0', categoria: 'Acabamentos', unidadeBase: UnidadeBase.UN, custoUnitario: 0.15 },
    { nome: 'Abraçadeira de Nylon (Enforca)', categoria: 'Acabamentos', unidadeBase: UnidadeBase.UN, custoUnitario: 0.25 },
    { nome: 'Fita Dupla Face VHB 19mm', categoria: 'Acabamentos', unidadeBase: UnidadeBase.M, custoUnitario: 3.80 },
    { nome: 'Perfil de Alumínio U (Moldura)', categoria: 'Estruturas', unidadeBase: UnidadeBase.M, custoUnitario: 12.50 },
    { nome: 'Metalão 20x20', categoria: 'Estruturas', unidadeBase: UnidadeBase.M, custoUnitario: 16.00 },
  ];

  console.log('🌱 Inserindo insumos iniciais...');
  for (const insumo of insumosIniciais) {
    await prisma.insumo.create({
      data: {
        ...insumo,
        organizationId: org.id,
      }
    });
  }

  console.log(`✅ ${insumosIniciais.length} insumos inseridos com sucesso!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
