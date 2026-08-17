const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const scores = await prisma.gameScore.findMany({ take: 10 });
  console.log(scores);
}
main().catch(console.error).finally(() => prisma.$disconnect());
