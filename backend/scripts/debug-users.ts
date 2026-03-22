import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      organization: true
    }
  });
  const orgs = await prisma.organization.findMany();

  console.log('--- ALL USERS ---');
  console.log(JSON.stringify(users.map(u => ({
    id: u.id,
    email: u.email,
    orgId: u.organizationId,
    orgSlug: u.organization.slug,
    active: u.active
  })), null, 2));

  console.log('--- ALL ORGANIZATIONS ---');
  console.log(JSON.stringify(orgs.map(o => ({ id: o.id, slug: o.slug, name: o.name })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
