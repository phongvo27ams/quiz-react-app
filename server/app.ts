import express from 'express';
import cors from 'cors';
import { prisma } from './db';
import { createMediaRouter } from './media';
import { randomUUID } from 'node:crypto';

function createId() {
  return randomUUID();
}

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/media', createMediaRouter());

  app.get('/api/exercises', async (_req, res) => {
    const exercises = await prisma.exercise.findMany({
      orderBy: { createdAt: 'desc' },
      include: { questions: { orderBy: { orderIndex: 'asc' }, include: { options: true } } },
    });
    res.json(exercises);
  });

  app.get('/api/sections', async (_req, res) => {
    const sections = await prisma.section.findMany({
      orderBy: { title: 'asc' },
      include: {
        exercises: {
          orderBy: { createdAt: 'asc' },
          include: { questions: { orderBy: { orderIndex: 'asc' }, include: { options: true } } },
        },
      },
    });
    res.json(
      sections.map((section) => ({
        ...section,
        exercises: section.exercises.map((exercise) => ({
          ...exercise,
          sectionTitle: section.title,
        })),
      })),
    );
  });

  app.post('/api/sections', async (req, res) => {
    const { title, description } = req.body as { title: string; description: string };
    if (!title?.trim()) {
      return res.status(400).json({ message: 'Section title is required.' });
    }
    const created = await prisma.section.create({
      data: {
        id: createId(),
        title: title.trim(),
        description: description?.trim() || '',
      },
    });
    res.status(201).json(created);
  });

  app.put('/api/sections/:id', async (req, res) => {
    const { title, description } = req.body as { title: string; description: string };
    if (!title?.trim()) {
      return res.status(400).json({ message: 'Section title is required.' });
    }
    const updated = await prisma.section.update({
      where: { id: req.params.id },
      data: {
        title: title.trim(),
        description: description?.trim() || '',
      },
    });
    res.json(updated);
  });

  app.delete('/api/sections/:id', async (req, res) => {
    const exerciseCount = await prisma.exercise.count({ where: { sectionId: req.params.id } });
    if (exerciseCount > 0) {
      return res.status(409).json({ message: 'Cannot delete a section that still has exercises.' });
    }
    await prisma.section.delete({ where: { id: req.params.id } });
    res.status(204).send();
  });

  app.get('/api/exercises/:id', async (req, res) => {
    const exercise = await prisma.exercise.findUnique({
      where: { id: req.params.id },
      include: { questions: { orderBy: { orderIndex: 'asc' }, include: { options: true } } },
    });
    if (!exercise) return res.status(404).json({ message: 'Not found' });
    res.json(exercise);
  });

  app.post('/api/exercises', async (req, res) => {
    const { title, description, question } = req.body as {
      title: string;
      description?: string;
      questions: {
        prompt: string;
        explanation: string;
        correctOptionIndex: number;
        options: { label: string; text: string }[];
      }[];
      question?: {
        prompt: string;
        explanation: string;
        correctOptionIndex: number;
        options: { label: string; text: string }[];
      };
    };

    const sourceQuestions = req.body.questions ?? (question ? [question] : []);
    const exerciseId = createId();
    const sectionId = (req.body.sectionId as string) || '';
    const sectionExists = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!sectionExists) {
      return res.status(400).json({ message: 'Valid sectionId is required.' });
    }

    const created = await prisma.exercise.create({
      data: {
        id: exerciseId,
        sectionId,
        title,
        description: description || 'New exercise',
        questions: {
          create: sourceQuestions.map((item, questionIndex) => ({
            id: createId(),
            prompt: item.prompt,
            explanation: item.explanation,
            correctOptionId: 'pending',
            orderIndex: questionIndex + 1,
            options: {
              create: item.options.map((option, optionIndex) => ({
                id: createId(),
                label: option.label,
                text: option.text,
              })),
            },
          })),
        },
      },
      include: { questions: { include: { options: true } } },
    });

    for (let index = 0; index < created.questions.length; index += 1) {
      const createdQuestion = created.questions[index];
      const originalQuestion = sourceQuestions[index];
      await prisma.question.update({
        where: { id: createdQuestion.id },
        data: { correctOptionId: createdQuestion.options[originalQuestion.correctOptionIndex].id },
      });
    }

    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: { questions: { orderBy: { orderIndex: 'asc' }, include: { options: true } } },
    });
    res.status(201).json(exercise);
  });

  app.put('/api/exercises/:id', async (req, res) => {
    const { title, description, sectionTitle } = req.body as { title: string; description: string; sectionTitle?: string };
    const updated = await prisma.exercise.update({
      where: { id: req.params.id },
      data: {
        title,
        description,
        sectionId: sectionTitle
          ? (await prisma.section.findUnique({ where: { title: sectionTitle } }))?.id
          : undefined,
      },
    });
    res.json(updated);
  });

  app.delete('/api/exercises/:id', async (req, res) => {
    await prisma.exercise.delete({ where: { id: req.params.id } });
    res.status(204).send();
  });

  app.post('/api/exercises/:id/questions', async (req, res) => {
    const { afterQuestionId, copyQuestionId } = req.body as { afterQuestionId: string; copyQuestionId?: string };
    const exercise = await prisma.exercise.findUnique({
      where: { id: req.params.id },
      include: { questions: { orderBy: { orderIndex: 'asc' }, include: { options: true } } },
    });
    if (!exercise) return res.status(404).json({ message: 'Not found' });

    const anchorIndex = exercise.questions.findIndex((question) => question.id === afterQuestionId);
    if (anchorIndex === -1) {
      return res.status(400).json({ message: 'Invalid anchor question.' });
    }

    const insertIndex = exercise.questions[anchorIndex].orderIndex + 1;
    const sourceQuestion = copyQuestionId ? exercise.questions.find((question) => question.id === copyQuestionId) : undefined;
    await prisma.$transaction(async (tx) => {
      await tx.question.updateMany({
        where: {
          exerciseId: exercise.id,
          orderIndex: { gte: insertIndex },
        },
        data: {
          orderIndex: { increment: 1 },
        },
      });

      const createdQuestion = await tx.question.create({
        data: {
          id: createId(),
          exerciseId: exercise.id,
          prompt: sourceQuestion?.prompt ?? '',
          explanation: sourceQuestion?.explanation ?? '',
          correctOptionId: '',
          orderIndex: insertIndex,
          options: {
            create: (sourceQuestion?.options ?? ['A', 'B', 'C', 'D'].map((label) => ({ label, text: '' }))).map((option, optionIndex) => ({
              id: createId(),
              label: option.label,
              text: option.text,
            })),
          },
        },
        include: { options: true },
      });

      await tx.question.update({
        where: { id: createdQuestion.id },
        data: {
          correctOptionId: sourceQuestion
            ? createdQuestion.options[
                Math.max(
                  0,
                  sourceQuestion.options.findIndex((option) => option.id === sourceQuestion.correctOptionId),
                )
              ].id
            : createdQuestion.options[0].id,
        },
      });

      const result = await tx.question.findUnique({
        where: { id: createdQuestion.id },
        include: { options: true },
      });
      res.status(201).json(result);
    });
  });

  app.put('/api/questions/:id', async (req, res) => {
    const { prompt, explanation, correctOptionIndex, options } = req.body as {
      prompt: string;
      explanation: string;
      correctOptionIndex: number;
      options: { label: string; text: string }[];
    };

    const existing = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: { options: true },
    });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    await prisma.option.deleteMany({ where: { questionId: existing.id } });
    const recreated = await prisma.question.update({
      where: { id: existing.id },
      data: {
        prompt,
        explanation,
          options: {
            create: options.map((option, index) => ({
              id: createId(),
              label: option.label,
              text: option.text,
            })),
          },
      },
      include: { options: true },
    });

    await prisma.question.update({
      where: { id: existing.id },
      data: { correctOptionId: recreated.options[correctOptionIndex].id },
    });

    const updated = await prisma.question.findUnique({
      where: { id: existing.id },
      include: { options: true },
    });
    res.json(updated);
  });

  app.delete('/api/questions/:id', async (req, res) => {
    await prisma.question.delete({ where: { id: req.params.id } });
    res.status(204).send();
  });

  return app;
}
