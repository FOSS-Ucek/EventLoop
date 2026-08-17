const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const scores = await prisma.gameScore.findMany({ 
    where: { userName: 'Toolchat' },
    select: { id: true, score: true, userId: true }
  });
  console.log("Total:", scores.length);
  console.log(scores.slice(0, 5));
}
main().catch(console.error).finally(() => prisma.$disconnect());
