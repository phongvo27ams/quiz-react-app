import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { loadEnv } from '../scripts/load-env';
import { initialSections } from '../src/data';

loadEnv();
const prisma = new PrismaClient();

const idMap = new Map<string, string>();
function uuidFor(originalId: string) {
  const existing = idMap.get(originalId);
  if (existing) return existing;
  const next = randomUUID();
  idMap.set(originalId, next);
  return next;
}

async function main() {
  await prisma.option.deleteMany();
  await prisma.question.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.section.deleteMany();

  for (const section of initialSections) {
    await prisma.section.create({
      data: {
        id: uuidFor(section.id),
        title: section.title,
        description: section.description,
      },
    });
  }

  for (const section of initialSections) {
    for (const exercise of section.exercises) {
      await prisma.exercise.create({
        data: {
          id: uuidFor(exercise.id),
          sectionId: uuidFor(section.id),
          title: exercise.title,
          description: exercise.description,
          questions: {
            create: exercise.questions.map((question, index) => ({
              id: uuidFor(question.id),
              prompt: question.prompt,
              explanation: question.explanation,
              correctOptionId: question.correctOptionId,
              orderIndex: index + 1,
              options: {
                create: question.options.map((option) => ({
                  id: uuidFor(option.id),
                  label: option.label,
                  text: option.text,
                })),
              },
            })),
          },
        },
      });
    }
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
