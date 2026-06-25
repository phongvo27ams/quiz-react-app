import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../server/db';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const outputFile = path.join(publicDir, 'quiz-data.json');

async function main() {
  const sections = await prisma.section.findMany({
    orderBy: { title: 'asc' },
    include: {
      exercises: {
        orderBy: { createdAt: 'asc' },
        include: {
          questions: {
            orderBy: { orderIndex: 'asc' },
            include: { options: true },
          },
        },
      },
    },
  });

  const serialized = sections.map((section) => ({
    ...section,
    exercises: section.exercises.map((exercise) => ({
      ...exercise,
      sectionTitle: section.title,
    })),
  }));

  await mkdir(publicDir, { recursive: true });
  await writeFile(outputFile, JSON.stringify(serialized, null, 2), 'utf8');
  console.log(`Exported ${serialized.length} sections to ${path.relative(rootDir, outputFile)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
