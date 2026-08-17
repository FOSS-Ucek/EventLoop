const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const sessions = await prisma.gameSession.findMany();
  for (const session of sessions) {
    const scores = await prisma.gameScore.findMany({ where: { gameSessionId: session.id } });
    
    // Group by userId or userName
    const grouped = {};
    for (const score of scores) {
      const key = score.userId || score.userName;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(score);
    }
    
    // For each group, sort by score descending, keep the highest, delete the rest
    for (const key in grouped) {
      const group = grouped[key];
      if (group.length > 1) {
        group.sort((a, b) => b.score - a.score);
        const toKeep = group[0];
        const toDelete = group.slice(1).map(s => s.id);
        
        await prisma.gameScore.deleteMany({
          where: { id: { in: toDelete } }
        });
        console.log(`Kept ${toKeep.id} for ${key} with score ${toKeep.score}, deleted ${toDelete.length} duplicates.`);
      }
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
