import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleInfo,
  faCircleExclamation,
  faTriangleExclamation,
  faLightbulb,
  faFireFlameCurved,
} from '@fortawesome/free-solid-svg-icons';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type HeadingLabelMap = Record<string, string>;

function headingRenderer(level: 1 | 2 | 3, options: { idPrefix?: string; labels?: HeadingLabelMap } = {}) {
  const { idPrefix = '', labels } = options;

  return function Heading({ children, ...props }: { children?: React.ReactNode }) {
    const text = Array.isArray(children) ? children.join(' ') : String(children ?? '');
    const Tag = `h${level}` as const;
    const slug = slugify(text);
    const numberLabel = labels?.[slug] ?? '';

    return (
      <Tag {...props} id={`${idPrefix}${slug}`}>
        {numberLabel ? <span className="heading-number">{numberLabel}</span> : null}
        {children}
      </Tag>
    );
  };
}

function parseAdmonitions(value: string) {
  const lines = value.split('\n');
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const openMatch = /^:::(note|tip|info|warning|danger)\s*$/.exec(lines[index].trim());
    if (!openMatch) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const type = openMatch[1];
    index += 1;
    const body: string[] = [];
    while (index < lines.length && lines[index].trim() !== ':::') {
      body.push(lines[index]);
      index += 1;
    }
    if (index < lines.length && lines[index].trim() === ':::') {
      index += 1;
    }

    output.push(`<div class="md-callout md-callout-${type}">\n${body.join('\n')}\n</div>`);
  }

  return output.join('\n');
}

export function MarkdownRenderer({
  value,
  idPrefix = '',
  labels,
}: {
  value: string;
  idPrefix?: string;
  labels?: HeadingLabelMap;
}) {
  const calloutTypes = {
    note: {
      label: 'NOTE',
      icon: faCircleInfo,
    },
    tip: {
      label: 'TIP',
      icon: faLightbulb,
    },
    info: {
      label: 'INFO',
      icon: faCircleExclamation,
    },
    warning: {
      label: 'WARNING',
      icon: faTriangleExclamation,
    },
    danger: {
      label: 'DANGER',
      icon: faFireFlameCurved,
    },
  } as const;

  function Callout({
    type,
    children,
  }: {
    type: keyof typeof calloutTypes;
    children?: React.ReactNode;
  }) {
    const meta = calloutTypes[type];
    return (
      <div className={`md-callout md-callout-${type}`}>
        <div className="md-callout-header">
          <FontAwesomeIcon className="md-callout-icon" icon={meta.icon} />
          <span>{meta.label}</span>
        </div>
        <div className="md-callout-body">{children}</div>
      </div>
    );
  }

  const CalloutSection = ({ type, children }: { type: keyof typeof calloutTypes; children?: React.ReactNode }) => (
    <Callout type={type}>{children}</Callout>
  );

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
      components={{
        h1: headingRenderer(1, { idPrefix, labels }),
        h2: headingRenderer(2, { idPrefix, labels }),
        h3: headingRenderer(3, { idPrefix, labels }),
        p: ({ ...props }) => <p className="md-paragraph" {...props} />,
        pre: ({ ...props }) => <pre className="md-pre" {...props} />,
        img: ({ ...props }) => <img className="md-image" alt="" {...props} />,
        table: ({ ...props }) => (
          <div className="md-table-wrap">
            <table className="md-table" {...props} />
          </div>
        ),
        div: ({ children, ...props }) => {
          const className = String((props as { className?: string }).className ?? '');
          if (className.includes('callout')) {
            const type = (className.match(/callout-(note|tip|info|warning|danger)/)?.[1] ?? 'note') as
              | 'note'
              | 'tip'
              | 'info'
              | 'warning'
              | 'danger';
            return <CalloutSection type={type}>{children}</CalloutSection>;
          }
          return <div {...props}>{children}</div>;
        },
      }}
    >
      {parseAdmonitions(value)}
    </ReactMarkdown>
  );
}
