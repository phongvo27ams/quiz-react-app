import { PrismaClient } from '@prisma/client';
import { loadEnv } from '../scripts/load-env';

loadEnv();
export const prisma = new PrismaClient();
