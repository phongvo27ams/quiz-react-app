import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
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

type HeadingCounters = {
  h1: number;
  h2: number;
  h3: number;
};

type HeadingLabelMap = Record<string, string>;

type DocOutline = {
  anchor: string;
  title: string;
  labels: HeadingLabelMap;
  toc: TocItem;
  rootNumber: string;
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

const orderedDocs: DocRecord[] = (bookOrder as string[])
  .map((path) => docsByPath.get(path))
  .filter((doc): doc is { path: string; content: string } => Boolean(doc))
  .map((doc) => ({
    path: doc.path,
    content: doc.content,
  }));

function buildDocOutline(doc: DocRecord, index: number, globalState: HeadingCounters): DocOutline {
  const headings = extractHeadings(doc.content).filter((heading) => heading.level >= 1 && heading.level <= 3);
  const firstHeading = headings[0];
  const anchor = firstHeading?.id ?? `document-${index + 1}`;
  const labels: HeadingLabelMap = {};
  let chapter = globalState.h1;
  let section = globalState.h2;
  let subsection = globalState.h3;
  let rootNumber = '1';

  if (firstHeading?.level === 1) {
    chapter += 1;
    section = 0;
    subsection = 0;
    rootNumber = `${chapter}`;
  } else if (firstHeading?.level === 2) {
    if (chapter === 0) chapter = 1;
    section += 1;
    subsection = 0;
    rootNumber = `${chapter}.${section}`;
  } else if (firstHeading?.level === 3) {
    if (chapter === 0) chapter = 1;
    if (section === 0) section = 1;
    subsection += 1;
    rootNumber = `${chapter}.${section}.${subsection}`;
  }

  const rootLevel = firstHeading?.level ?? 1;
  const root: TocItem = {
    id: anchor,
    text: `${rootNumber} ${firstHeading?.text ?? `Document ${index + 1}`}`,
    level: rootLevel,
    children: [],
  };
  const stack: TocItem[] = [root];

  let localChapter = chapter;
  let localSection = section;
  let localSubsection = subsection;

  for (const heading of headings) {
    if (heading === firstHeading) {
      labels[heading.id] = rootNumber;
      continue;
    }

    if (heading.level === 1) {
      chapter += 1;
      section = 0;
      subsection = 0;
      localChapter = chapter;
      localSection = 0;
      localSubsection = 0;
      labels[heading.id] = `${localChapter}`;
    } else if (heading.level === 2) {
      section += 1;
      subsection = 0;
      localSection = section;
      localSubsection = 0;
      labels[heading.id] = `${localChapter}.${localSection}`;
    } else if (heading.level === 3) {
      subsection += 1;
      localSubsection = subsection;
      labels[heading.id] = `${localChapter}.${localSection}.${localSubsection}`;
    }

    const item: TocItem = {
      id: `${anchor}-${heading.id}`,
      text: `${labels[heading.id]} ${heading.text}`,
      level: heading.level,
      children: [],
    };

    while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    stack[stack.length - 1].children.push(item);
    stack.push(item);
  }

  globalState.h1 = chapter;
  globalState.h2 = section;
  globalState.h3 = subsection;

  return {
    anchor,
    title: firstHeading?.text ?? `Document ${index + 1}`,
    labels,
    toc: root,
    rootNumber,
  };
}

function LazyDocSection({
  doc,
  outline,
  preload = false,
}: {
  doc: DocRecord;
  outline: DocOutline;
  preload?: boolean;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isReady, setIsReady] = useState(preload);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    if (preload) {
      setIsReady(true);
    }
  }, [preload]);

  useEffect(() => {
    const handleBeforePrint = () => {
      startTransition(() => {
        setPrintMode(true);
        setIsReady(true);
      });
    };
    const handleAfterPrint = () => {
      startTransition(() => {
        setPrintMode(false);
      });
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  useEffect(() => {
    if (isReady || printMode) return;

    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (!visible) return;
        startTransition(() => {
          setIsReady(true);
        });
        observer.disconnect();
      },
      {
        rootMargin: '1200px 0px',
        threshold: 0.01,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isReady, printMode]);

  const docId = `${outline.anchor}-`;

  return (
    <section className="chapter" id={outline.anchor} key={doc.path} ref={sectionRef}>
      <div className="chapter-body doc-page">
        {isReady || printMode ? (
          <RichText value={doc.content} idPrefix={docId} labels={outline.labels} />
        ) : (
          <div className="doc-placeholder">
            <p className="doc-placeholder-label">Loading chapter</p>
            <h2 className="doc-placeholder-title">
              <span className="heading-number">{outline.rootNumber}</span>
              {outline.title}
            </h2>
            <p className="doc-placeholder-copy">
              This chapter will render as you approach it, which keeps long books responsive even when the
              document set grows large.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function App() {
  const docs = useMemo(() => orderedDocs, []);
  const outlines = useMemo(() => {
    const state: HeadingCounters = { h1: 0, h2: 0, h3: 0 };
    return docs.map((doc, index) => buildDocOutline(doc, index, state));
  }, [docs]);

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
          <div className="cover-badge">Professional Edition</div>
          <span className="cover-edition">Software Quality Series</span>
        </div>
        <div className="cover-grid">
          <div className="cover-main">
            <p className="cover-kicker">Software Engineering · Testing Practice · Reference</p>
            <p className="cover-overline">A practical handbook for systematic quality assurance</p>
            <h1>Software Testing</h1>
            <p className="cover-subtitle">
              A structured field guide to black-box techniques, automation strategy, performance analysis,
              and API validation for modern software teams.
            </p>
            <div className="cover-author-block">
              <span className="cover-author-label">Author</span>
              <p className="cover-author-name">Phong Vo</p>
            </div>
          </div>
          <aside className="cover-aside">
            <div className="cover-panel">
              <p className="cover-panel-label">In This Edition</p>
              <ul>
                <li>Black-box testing patterns and analysis models</li>
                <li>Automation design, locator strategy, and wait handling</li>
                <li>Performance and API testing study chapters</li>
              </ul>
            </div>
          </aside>
        </div>
        <div className="cover-meta">
          <span>Single-page book edition</span>
          <span>Print-ready PDF layout</span>
          <span>Built from Markdown and MDX</span>
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
            <h2>Contents</h2>
          </div>
          <div className="contents-tree">
            <ol>
              {outlines.map((outline) => renderTocItem(outline.toc))}
            </ol>
          </div>
        </section>

        <div className="book-article">
          {docs.map((doc, index) => {
            const outline = outlines[index];
            return <LazyDocSection doc={doc} key={doc.path} outline={outline} preload={index < 4} />;
          })}
        </div>
      </main>
    </div>
  );
}

export default App;
