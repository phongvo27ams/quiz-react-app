# Quiz Studio

Quiz Studio is a simple quiz web app for software testing exercises.

It supports:
- Section-based exercise browsing
- Multiple-choice questions with auto numbering
- Immediate correct / wrong feedback
- Rich content in questions and explanations:
  - Markdown text
  - Code syntax highlighting
  - Math formulas
  - Tables
  - Images
- Exercise creation and editing
- Score summary at the end of an exercise
- Full-stack deployment support with PostgreSQL + Neon and Vercel
- Media uploads that can use local storage in development or ImageKit in production

## Tech Stack

- Frontend: React + TypeScript + Vite
- Styling: Plain CSS with shared design tokens
- Content rendering: Markdown, KaTeX, Highlight.js
- Backend: Node.js + Express
- Database: Prisma + PostgreSQL
- Production hosting: Vercel
- Media storage: ImageKit or local disk in development

## Project Structure

- `src/` - React frontend
- `server/` - Express API
- `prisma/` - Prisma schema and seed data

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up the database

The project uses PostgreSQL locally through Prisma and the same PostgreSQL schema on Neon in production.

```bash
npx prisma generate --no-engine
npx prisma db push
npm run seed
```

Set `DATABASE_URL` in `.env` before running the commands.

### 3. Start the app

```bash
npm run dev
```

This starts both:
- the Express API
- the Vite frontend

Open the URL shown in the terminal.

## Available Scripts

- `npm run dev` - start both the frontend and backend in development
- `npm run dev:client` - start only the frontend
- `npm run dev:server` - start only the backend API
- `npm run build` - build the frontend for production
- `npm run seed` - populate the database with sample sections and exercises
- `npm run prisma:generate` - generate Prisma Client
- `npm run prisma:push` - push the Prisma schema to the configured PostgreSQL database

## Database Notes

- The app now uses PostgreSQL through `DATABASE_URL`
- For local development you can use a local PostgreSQL instance
- For production on Vercel, point `DATABASE_URL` to Neon
- Schema changes should be made in `prisma/schema.prisma`
- Sample data is generated through `prisma/seed.ts`

## Deployment Notes

GitHub Pages can host only the static frontend.

If you deploy to GitHub Pages:
- the React UI can be hosted there
- the Express API and SQLite database cannot run there

To support quiz content on GitHub Pages, this repo exports the current Prisma data into `public/quiz-data.json` before build. The frontend falls back to that file when the API is unavailable.

For a full-stack deployment, use Vercel:
- the frontend is built from Vite
- the API runs as a serverless function from `api/index.ts`
- Prisma connects to Neon through `DATABASE_URL`
- media uploads can go to ImageKit if `IMAGEKIT_*` env vars are configured

## GitHub Pages Deploy

This repository includes a GitHub Actions workflow that deploys from `main` automatically.

Flow:
- push to `main`
- install dependencies
- generate Prisma client
- push the Prisma schema
- seed the local SQLite database in CI
- export quiz data to `public/quiz-data.json`
- build the Vite app
- publish the `dist/` folder to GitHub Pages

For the workflow to work, enable GitHub Pages in the repository settings and set the source to the `gh-pages` branch if your repo uses branch-based Pages deployment.

## Media Storage

By default, uploaded media is saved to the local `public/media/` folders during development.

To use ImageKit in production, set:

- `IMAGEKIT_PUBLIC_KEY`
- `IMAGEKIT_PRIVATE_KEY`
- `IMAGEKIT_URL_ENDPOINT`

When those variables are present, uploads go to ImageKit instead of the local filesystem.

## Environment Variables

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL`
- `PORT`
- `IMAGEKIT_PUBLIC_KEY`
- `IMAGEKIT_PRIVATE_KEY`
- `IMAGEKIT_URL_ENDPOINT`

## License

No license has been added yet.
