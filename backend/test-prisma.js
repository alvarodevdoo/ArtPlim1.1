const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const settings = await prisma.organizationSettings.findMany();
  console.log(JSON.stringify(settings.map(s => ({
    organizationId: s.organizationId,
    nfeCertificateSubject: s.nfeCertificateSubject,
    nfeCertificateExpiry: s.nfeCertificateExpiry,
    hasCert: !!s.nfeCertificate,
    pwd: s.nfeCertificatePassword?.substring(0, 10)
  })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
