# Software Testing

Software Testing is a static, book-style documentation site built for long-form technical writing, browser reading, and PDF export. The project renders a single continuous book from Markdown and MDX documents stored in `docs/`, with a generated table of contents, heading numbering, syntax highlighting, mathematical formulas, callouts, and print-aware layout.

The current content is structured as a software testing handbook with chapters such as black-box testing, test automation, performance testing, API testing, security testing, regression testing, compatibility testing, usability testing, and test management.

## Features

- Single-page book reading experience at `http://localhost:5173/`
- Professional cover page and print-aware PDF layout
- Auto-generated contents from document headings
- Numbered `h1`, `h2`, and `h3` headings
- Markdown and MDX authoring from the `docs/` directory
- Code syntax highlighting
- KaTeX math rendering
- Styled admonitions and callouts
- Print styling for browser-to-PDF export
- Lazy chapter rendering to keep large books responsive
- Automatic GitHub Pages deployment from the `main` branch

## Tech Stack

- React 19
- TypeScript
- Vite
- React Markdown
- Remark GFM
- Remark Math
- Rehype KaTeX
- Rehype Highlight
- Font Awesome
- Plain CSS with custom variables and print rules

## Project Structure

Key directories and files:

- `docs/`
  Contains all book content. Each document is an `index.mdx` file inside a chapter/section/subsection folder structure.
- `book-order.json`
  Controls the exact render order of documents in the final book.
- `src/App.tsx`
  Builds the cover, contents, and continuous document flow.
- `src/richText.tsx`
  Renders Markdown features such as headings, callouts, code blocks, tables, images, and math.
- `src/styles.css`
  Holds the design tokens, layout styling, and print CSS.
- `.github/workflows/deploy.yml`
  GitHub Actions workflow for automatic Pages deployment.

Example content path:

```text
docs/black-box-testing/boundary-value-analysis/exercise-1/index.mdx
```

## How Content Works

Each `index.mdx` file becomes one section in the final single-page book. The app reads every file listed in `book-order.json`, extracts headings, builds the contents tree, and renders the documents in that exact order.

If you want to reorder the book, edit `book-order.json`.

If you want to add a new page:

1. Create a new `index.mdx` file under `docs/`.
2. Add its path to `book-order.json`.
3. Restart the dev server if needed.

## Install Dependencies

```bash
npm install
```

## Run Locally

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:5173/
```

## Production Build

Build the static site:

```bash
npm run build
```

The generated files will be written to:

```text
dist/
```

## PDF Export

The cover page includes an `Export PDF` button that opens the browser print flow.

Recommended print settings:

- Enable `Background graphics`
- Disable browser `Headers and footers`
- Save as PDF

The print CSS is designed so that:

- the cover uses a full-page layout
- contents and chapters use print-friendly margins
- the book can flow naturally across multiple PDF pages

## Performance Strategy for Large Books

This project is designed to remain usable even when the book grows large.

Current optimizations:

- Only the first few chapters are rendered immediately
- Remaining chapters are lazily mounted with `IntersectionObserver`
- All chapters are forced to render before printing, so PDF export still includes the entire book
- The contents and numbering are computed up front without requiring every chapter to be mounted in the DOM

This keeps scrolling and initial render significantly lighter than mounting the full book at once.

## GitHub Pages Deployment

This repository includes an automatic GitHub Pages deployment workflow:

- Workflow file: [.github/workflows/deploy.yml](./.github/workflows/deploy.yml)
- Trigger: every push to the `main` branch
- Build output: `dist/`
- Deployment target: GitHub Pages

The workflow:

1. Checks out the repository
2. Configures GitHub Pages
3. Installs dependencies with `npm ci`
4. Builds the site with `npm run build`
5. Uploads `dist/` as a Pages artifact
6. Deploys the artifact to GitHub Pages

The Vite base path is configured automatically through GitHub Actions, so the site can deploy correctly without hard-coding an old repository name.

## How to Enable GitHub Pages

In your GitHub repository:

1. Open `Settings`
2. Open `Pages`
3. Set the source to `GitHub Actions`
4. Push your code to the `main` branch

After that, each push to `main` will automatically trigger a fresh deployment.

## Notes

- This is now a static documentation project. It does not use a backend or database.
- The site is intentionally optimized for writing, reading, and printing rather than interactive quiz features.
- If the book becomes much larger in the future, the next optimization step would be reducing initial JavaScript payload size through document-level code splitting.
