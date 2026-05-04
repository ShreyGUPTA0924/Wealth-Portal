const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const nudges = await prisma.aiNudge.findMany();
  console.log('Nudges:', nudges.length);
  console.log(nudges);
}
main().catch(console.error).finally(() => prisma.$disconnect());
