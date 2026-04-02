import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando migração de Materiais para referenciar Categoria por ID...');

  // 1. Busca todos os materiais
  const materials = await prisma.material.findMany();

  // 2. Busca ou cria uma categoria padrão "Outros" para cada organizationId
  const orgIds = [...new Set(materials.map(m => m.organizationId))];

  for (const orgId of orgIds) {
    let defaultCategory = await prisma.category.findFirst({
      where: { name: 'Outros', organizationId: orgId }
    });

    if (!defaultCategory) {
      defaultCategory = await prisma.category.create({
        data: {
          name: 'Outros',
          type: 'EXPENSE',
          color: '#64748B',
          organizationId: orgId
        }
      });
      console.log(`Categoria "Outros" criada para a organização ${orgId}`);
    }

    // 3. Atualiza os materiais dessa organização usando a categoria padrão (quando ainda estiverem com o default migration categoryId de schema sync, assumimos que é a criacao do admin)
    // Nota: Como rodamos o `db push`, materiais que antes tinham um ID de string agora precisam do UUID da category.
    // Se o column cast do Postgres manteve o "Outros" como uma string literal, o UUID será inválido e vai quebrar no `db push`. 
    // Mas o Db Push dropou e recriou / truncou porque aceitamos perda de dados ou apenas recriou `categoryId` com um default string que pode esbarrar em restrição de FK UUID.
    // Presumindo que os dados agora requeiram um UUID de Category válido:
    
    const affected = await prisma.material.updateMany({
      where: { 
        organizationId: orgId,
        categoryId: 'Outros' // Aqui o schema default era 'Outros'. Tem que virar o UUID.
      },
      data: {
        categoryId: defaultCategory.id
      }
    });

    console.log(`Organização ${orgId}: ${affected.count} materiais atualizados para Categoria UUID.`);
  }

  console.log('Migração concluída com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro na migração:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
