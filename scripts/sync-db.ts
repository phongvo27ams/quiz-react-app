import { execSync } from 'node:child_process';
import { loadEnv } from './load-env';

loadEnv();

execSync('npx prisma db push', { stdio: 'inherit' });
