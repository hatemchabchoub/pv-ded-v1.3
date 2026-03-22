const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*\/?>/g;
const RTL_CONTROL_RE = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const SECTION_HEADER_RE = /^(define styles|nodes|relationships)\b/i;

const NODE_EXPRESSION_SOURCE = String.raw`(?:\[\/[\s\S]*\/\]|\{\{[\s\S]*\}\}|\{[\s\S]*\}|\(\[[\s\S]*\]\)|\(\([\s\S]*\)\)|\([\s\S]*\)|\[[\s\S]*\])`;
const REVERSED_NODE_RE = new RegExp(`^(${NODE_EXPRESSION_SOURCE})\\s*([A-Za-z][A-Za-z0-9_]*)$`);
const FORWARD_NODE_RE = new RegExp(`^([A-Za-z][A-Za-z0-9_]*)\\s*(${NODE_EXPRESSION_SOURCE})$`);

function stripOuterQuotes(value: string) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function cleanText(value: string) {
  return stripOuterQuotes(
    value
      .replace(HTML_TAG_RE, " ")
      .replace(RTL_CONTROL_RE, "")
      .replace(/\s+/g, " ")
      .trim()
  ).replace(/"/g, "'");
}

function sanitizeNodeExpression(expression: string) {
  const normalized = expression.trim();
  const shapes = [
    { re: /^\[\/(.*)\/\]$/s, wrap: (label: string) => `[/"${label}"/]` },
    { re: /^\{\{(.*)\}\}$/s, wrap: (label: string) => `{{"${label}"}}` },
    { re: /^\{(.*)\}$/s, wrap: (label: string) => `{"${label}"}` },
    { re: /^\(\[(.*)\]\)$/s, wrap: (label: string) => `(["${label}"])` },
    { re: /^\(\((.*)\)\)$/s, wrap: (label: string) => `(("${label}"))` },
    { re: /^\((.*)\)$/s, wrap: (label: string) => `("${label}")` },
    { re: /^\[(.*)\]$/s, wrap: (label: string) => `["${label}"]` },
  ] as const;

  for (const shape of shapes) {
    const match = normalized.match(shape.re);
    if (match) {
      return shape.wrap(cleanText(match[1]));
    }
  }

  return normalized;
}

function formatEdgeLabel(label: string) {
  const safeLabel = cleanText(label);
  return safeLabel ? `|"${safeLabel}"|` : "";
}

function normalizeRelationLine(line: string) {
  const reversedWithLabel = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*\|(.+?)\|\s*<--\s*([A-Za-z][A-Za-z0-9_]*)$/);
  if (reversedWithLabel) {
    const [, target, label, source] = reversedWithLabel;
    return `${source} -->${formatEdgeLabel(label)} ${target}`;
  }

  const forwardWithLabel = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*-->\s*\|(.+?)\|\s*([A-Za-z][A-Za-z0-9_]*)$/);
  if (forwardWithLabel) {
    const [, source, label, target] = forwardWithLabel;
    return `${source} -->${formatEdgeLabel(label)} ${target}`;
  }

  const brokenForwardWithLabel = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*\|(.+?)\|\s*-->\s*([A-Za-z][A-Za-z0-9_]*)$/);
  if (brokenForwardWithLabel) {
    const [, source, label, target] = brokenForwardWithLabel;
    return `${source} -->${formatEdgeLabel(label)} ${target}`;
  }

  const reversed = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*<--\s*([A-Za-z][A-Za-z0-9_]*)$/);
  if (reversed) {
    const [, target, source] = reversed;
    return `${source} --> ${target}`;
  }

  return line;
}

function normalizeNodeLine(line: string) {
  const reversed = line.match(REVERSED_NODE_RE);
  if (reversed) {
    const [, expression, id] = reversed;
    return `${id}${sanitizeNodeExpression(expression)}`;
  }

  const forward = line.match(FORWARD_NODE_RE);
  if (forward) {
    const [, id, expression] = forward;
    return `${id}${sanitizeNodeExpression(expression)}`;
  }

  return line;
}

function normalizeLine(rawLine: string) {
  const line = rawLine
    .replace(RTL_CONTROL_RE, "")
    .replace(/^\s*[;؛]+\s*/, "")
    .replace(/\s*[;؛]+\s*$/, "")
    .trim();

  if (!line || line.startsWith("%%") || SECTION_HEADER_RE.test(line)) {
    return null;
  }

  if (/^(graph|flowchart)\s+TD$/i.test(line)) {
    return line.startsWith("flowchart") ? line.replace(/^flowchart/i, "graph") : line;
  }

  if (line.startsWith("classDef") || line.startsWith("class ")) {
    return line;
  }

  if (line.includes("<--") || line.includes("-->")) {
    return normalizeRelationLine(line);
  }

  return normalizeNodeLine(line);
}

/** Strip HTML tags, fix special chars, and normalize RTL-broken Mermaid syntax */
export function sanitizeMermaidCode(raw: string): string {
  const normalizedInput = raw.replace(HTML_TAG_RE, " ").replace(/;/g, "\n");
  const lines = normalizedInput
    .split("\n")
    .map(normalizeLine)
    .filter((line): line is string => Boolean(line));

  const hasGraph = lines.some((line) => /^(graph|flowchart)\s+TD$/i.test(line));
  return (hasGraph ? lines : ["graph TD", ...lines]).join("\n");
}

/** Inject classDef styles if not already present */
export function injectStyles(code: string): string {
  const hasClassDef = /classDef\s/.test(code);
  if (hasClassDef) return code;

  const classDefs = `
  classDef person fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e3a5f,font-weight:bold
  classDef company fill:#ede9fe,stroke:#8b5cf6,stroke-width:2px,color:#3b1f7a,font-weight:bold
  classDef vehicle fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#78350f,font-weight:bold
  classDef goods fill:#fee2e2,stroke:#ef4444,stroke-width:2px,color:#7f1d1d,font-weight:bold
  classDef location fill:#d1fae5,stroke:#10b981,stroke-width:2px,color:#064e3b,font-weight:bold
  classDef document fill:#cffafe,stroke:#06b6d4,stroke-width:2px,color:#164e63,font-weight:bold
  classDef violation fill:#ffe4e6,stroke:#e11d48,stroke-width:2px,color:#881337,font-weight:bold
  classDef officer fill:#ccfbf1,stroke:#0d9488,stroke-width:2px,color:#134e4a,font-weight:bold
  classDef default fill:#f8fafc,stroke:#94a3b8,stroke-width:1px,color:#334155`;

  const firstNewline = code.indexOf("\n");
  if (firstNewline === -1) return code + "\n" + classDefs;
  return code.slice(0, firstNewline) + "\n" + classDefs + code.slice(firstNewline);
}