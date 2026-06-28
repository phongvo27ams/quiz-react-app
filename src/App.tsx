import { useMemo } from 'react';
import { RichText } from './richText';
import bookOrder from '../book-order.json';

type DocRecord = {
  path: string;
  content: string;
};

type TocItem = {
  id: string;
  text: string;
  level: number;
  children: TocItem[];
};

type HeadingRecord = {
  id: string;
  text: string;
  level: number;
};

const rawDocs = import.meta.glob('../docs/**/*.mdx', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const rawDocEntries = Object.entries(rawDocs).map(([path, source]) => ({
  path: path.replace(/^\.\.\//, ''),
  content: String(source).trim(),
}));

const docsByPath = new Map(rawDocEntries.map((doc) => [doc.path, doc]));

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractHeadings(content: string) {
  const lines = content.split('\n');
  const headings: HeadingRecord[] = [];

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line.trim());
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].replace(/\s+#+\s*$/, '').trim();
    headings.push({
      level,
      text,
      id: slugify(text),
    });
  }

  return headings;
}

function docTitleFromContent(doc: DocRecord, fallbackIndex: number) {
  const headings = extractHeadings(doc.content);
  const firstHeading = headings.find((heading) => heading.level === 1) ?? headings[0];
  return firstHeading?.text ?? `Document ${fallbackIndex + 1}`;
}

function docAnchorFromContent(doc: DocRecord, fallbackIndex: number) {
  const headings = extractHeadings(doc.content);
  const firstHeading = headings.find((heading) => heading.level === 1) ?? headings[0];
  return firstHeading?.id ?? `document-${fallbackIndex + 1}`;
}

function buildTocItems(doc: DocRecord, index: number): TocItem {
  const headings = extractHeadings(doc.content).filter((heading) => heading.level >= 1 && heading.level <= 3);
  const rootHeading = headings.find((heading) => heading.level === 1) ?? headings[0];
  const docAnchor = docAnchorFromContent(doc, index);
  const root: TocItem = {
    id: docAnchor,
    text: docTitleFromContent(doc, index),
    level: 1,
    children: [],
  };

  const stack: TocItem[] = [root];

  for (const heading of headings) {
    if (rootHeading && heading.id === rootHeading.id && heading.level === rootHeading.level) {
      continue;
    }

    const item: TocItem = {
      id: `${docAnchor}-${heading.id}`,
      text: heading.text,
      level: heading.level,
      children: [],
    };

    while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    stack[stack.length - 1].children.push(item);
    stack.push(item);
  }

  return root;
}

const orderedDocs: DocRecord[] = (bookOrder as string[])
  .map((path) => docsByPath.get(path))
  .filter((doc): doc is { path: string; content: string } => Boolean(doc))
  .map((doc) => ({
    path: doc.path,
    content: doc.content,
  }));

function docLabel(index: number) {
  return `CHAPTER ${index + 1}`;
}

function App() {
  const docs = useMemo(() => orderedDocs, []);
  const toc = useMemo(() => docs.map((doc, index) => buildTocItems(doc, index)), [docs]);

  function renderTocItem(item: TocItem) {
    return (
      <li key={item.id} className={`toc-level-${Math.min(item.level, 3)}`}>
        <a href={`#${item.id}`}>{item.text}</a>
        {item.children.length > 0 ? <ol>{item.children.map(renderTocItem)}</ol> : null}
      </li>
    );
  }

  return (
    <div className="book-shell">
      <header className="book-cover" id="top">
        <div className="cover-topline">
          <div className="cover-badge">Printed Edition</div>
          <span className="cover-edition">Volume I</span>
        </div>
        <div className="cover-grid">
          <div className="cover-main">
            <p className="cover-kicker">Markdown · MDX · PDF</p>
            <h1>Markdown Book</h1>
            <p className="cover-subtitle">
              A multi-page writing workspace for long-form documentation, reading, and PDF export.
            </p>
          </div>
          <aside className="cover-aside">
            <div className="cover-panel">
              <p className="cover-panel-label">Edition Notes</p>
              <ul>
                <li>Single continuous reading page</li>
                <li>MDX files live in <code>docs/</code></li>
                <li>Print view matches the full page flow</li>
              </ul>
            </div>
          </aside>
        </div>
        <div className="cover-meta">
          <span>Static local preview</span>
          <span>Single-page book flow</span>
          <span>Ready for PDF export</span>
        </div>
        <div className="cover-actions">
          <button className="primary" onClick={() => window.print()}>
            Export PDF
          </button>
          <a className="ghost" href="#contents">
            Contents
          </a>
        </div>
      </header>

      <main className="book-content">
        <section className="contents-section" id="contents">
          <div className="contents-heading">
            <p className="chapter-index">Contents</p>
            <h2>Contents</h2>
          </div>
          <div className="contents-tree">
            <ol>
              {toc.map(renderTocItem)}
            </ol>
          </div>
        </section>

        <div className="book-article">
          {docs.map((doc, index) => {
            const docAnchor = docAnchorFromContent(doc, index);
            const docId = `${docAnchor}-`;

            return (
              <section className="chapter" id={docAnchor} key={doc.path}>
                <p className="chapter-index">{docLabel(index)}</p>
                <div className="chapter-body doc-page">
                  <RichText value={doc.content} idPrefix={docId} />
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default App;
