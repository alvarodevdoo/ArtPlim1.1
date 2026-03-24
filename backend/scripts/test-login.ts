import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function test() {
  const email = 'admin@artplim.com.br';
  const slug = 'artplim';
  const password = 'admin123';

  console.log(`Testing login for ${email} in ${slug}...`);

  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) { console.log('Org not found'); return; }

  const user = await prisma.user.findUnique({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email: email
      }
    }
  });

  if (!user) {
    console.log('User not found');
    const allUsers = await prisma.user.findMany({ select: { email: true } });
    console.log('All users in DB:', allUsers);
    return;
  }

  const isValid = await bcrypt.compare(password, user.password);
  console.log('Password valid:', isValid);
}

test().finally(() => prisma.$disconnect());
