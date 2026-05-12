/**
 * Lightweight WhatsApp / Messenger / Instagram-style text formatter.
 *
 * Why a custom parser instead of remark/marked?
 *  - Chat-app formatting is its own dialect: WhatsApp uses single-character
 *    delimiters (`*bold*`, `_italic_`, `~strike~`) that conflict with strict
 *    markdown rules around word boundaries, while Messenger / IG accept the
 *    standard double-character markdown forms (`**bold**`, `__italic__`).
 *  - We need to render inside arbitrary bubbles (with `whitespace-pre-wrap`)
 *    without pulling in a 50+kB markdown engine + sanitiser.
 *  - We must auto-link plain URLs and produce React nodes so we can apply
 *    bubble-specific colour classes (links inside the AI bubble inherit white).
 *
 * Supported syntax (matches WhatsApp's reference + the safe markdown intersection):
 *   *bold*    or **bold**
 *   _italic_  or __italic__
 *   ~strike~  or ~~strike~~
 *   `code`    (inline monospace)
 *   ```code``` (multi-line monospace block)
 *   > quote   (line prefix, becomes a left bar)
 *   bare URLs (http/https/www) become `<a target="_blank" rel="noopener">`
 *
 * Escaped delimiters are not supported — use a different character if you
 * actually need a literal `*`. This matches WhatsApp behaviour.
 */
import * as React from 'react'

/* ------------------------------------------------------------------------- */
/* URL detection                                                             */
/* ------------------------------------------------------------------------- */

// Conservative URL regex: matches http(s)://... or www.... up to whitespace or
// terminal punctuation that's clearly not part of the URL. We intentionally
// exclude trailing `).,!?;:` so links inside sentences don't grab punctuation.
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<]+?)(?=[)\].,!?;:'"]?(?:\s|$))/gi

function ensureHref(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}

/* ------------------------------------------------------------------------- */
/* Inline tokenizer                                                          */
/* ------------------------------------------------------------------------- */

type InlineToken =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; children: InlineToken[] }
  | { kind: 'italic'; children: InlineToken[] }
  | { kind: 'strike'; children: InlineToken[] }
  | { kind: 'code'; value: string }
  | { kind: 'link'; href: string; value: string }

interface InlineRule {
  /** Open delimiter / close delimiter (same string). */
  delim: string
  /** Token kind to emit. */
  kind: 'bold' | 'italic' | 'strike'
  /**
   * If true, the delimiter must be word-isolated (WhatsApp behaviour) — i.e.
   * the chars immediately before the opener and after the closer cannot be a
   * word char. This avoids false positives like `cust*omer*name`.
   */
  wordIsolated: boolean
}

// Order matters: longer delimiters must be matched first so `**` doesn't get
// eaten by the single-`*` rule.
const INLINE_RULES: InlineRule[] = [
  { delim: '***', kind: 'bold', wordIsolated: false }, // bold + italic combo
  { delim: '~~', kind: 'strike', wordIsolated: false },
  { delim: '**', kind: 'bold', wordIsolated: false },
  { delim: '__', kind: 'italic', wordIsolated: false },
  { delim: '*', kind: 'bold', wordIsolated: true },
  { delim: '_', kind: 'italic', wordIsolated: true },
  { delim: '~', kind: 'strike', wordIsolated: true },
]

function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false
  return /\w/.test(ch)
}

/**
 * Tokenize a single line of text into inline nodes. Recursive: a `bold` span
 * may contain `italic`/`code`/etc. children.
 *
 * Algorithm:
 *  1. Walk left → right.
 *  2. At each position, try to open a code span (` ` `) — code is opaque, so
 *     once opened we look for the matching backtick and emit the literal value.
 *  3. Otherwise, try each formatting rule in priority order. If we can find a
 *     valid closing delimiter further down the line we emit a node and recurse
 *     into the inner text.
 *  4. Fall through to a literal character.
 *  5. After everything is parsed, run URL auto-linking on the surviving text
 *     nodes (links don't mutate sibling formatting).
 */
function tokenizeInline(input: string): InlineToken[] {
  const out: InlineToken[] = []
  const buf: string[] = []

  const flushText = () => {
    if (buf.length === 0) return
    const text = buf.join('')
    buf.length = 0
    // Split text on URLs so we can emit link tokens.
    pushTextWithLinks(out, text)
  }

  let i = 0
  while (i < input.length) {
    const ch = input[i]

    // Inline code first — opaque, no nested formatting allowed inside.
    if (ch === '`') {
      const end = input.indexOf('`', i + 1)
      if (end > i) {
        flushText()
        out.push({ kind: 'code', value: input.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }

    let consumed = false
    for (const rule of INLINE_RULES) {
      const dlen = rule.delim.length
      if (input.slice(i, i + dlen) !== rule.delim) continue

      // Find a valid closing delimiter: not adjacent to whitespace on the
      // inside (so `**foo **` isn't a match) and respecting word isolation.
      const innerStart = i + dlen
      // Opener must not be followed by whitespace.
      if (/\s/.test(input[innerStart] || '')) continue
      if (rule.wordIsolated && isWordChar(input[i - 1])) continue

      let closeAt = -1
      let scan = innerStart
      while (scan < input.length) {
        const next = input.indexOf(rule.delim, scan)
        if (next === -1) break
        // Closer must not be preceded by whitespace.
        if (/\s/.test(input[next - 1] || '')) {
          scan = next + dlen
          continue
        }
        // For word-isolated rules, the char *after* the closer must not be a
        // word char (so `*bold*part` doesn't parse).
        if (rule.wordIsolated && isWordChar(input[next + dlen])) {
          scan = next + dlen
          continue
        }
        closeAt = next
        break
      }

      if (closeAt === -1) continue

      flushText()
      const inner = input.slice(innerStart, closeAt)
      out.push({ kind: rule.kind, children: tokenizeInline(inner) })
      i = closeAt + dlen
      consumed = true
      break
    }
    if (consumed) continue

    buf.push(ch)
    i++
  }
  flushText()
  return out
}

function pushTextWithLinks(out: InlineToken[], text: string): void {
  if (!text) return
  let last = 0
  // Reset stateful regex.
  URL_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = URL_RE.exec(text)) !== null) {
    const start = m.index
    const raw = m[1]
    if (start > last) {
      out.push({ kind: 'text', value: text.slice(last, start) })
    }
    out.push({ kind: 'link', href: ensureHref(raw), value: raw })
    last = start + raw.length
  }
  if (last < text.length) {
    out.push({ kind: 'text', value: text.slice(last) })
  }
}

/* ------------------------------------------------------------------------- */
/* Block-level handling (code fences + quote prefix)                         */
/* ------------------------------------------------------------------------- */

type Block =
  | { kind: 'codeBlock'; value: string }
  | { kind: 'paragraph'; lines: { quoted: boolean; text: string }[] }

function splitBlocks(source: string): Block[] {
  const blocks: Block[] = []
  // Triple-backtick fences swallow everything until the next ``` (or end of
  // string) and render as monospaced blocks.
  const FENCE = /```([\s\S]*?)(?:```|$)/g
  let cursor = 0
  let m: RegExpExecArray | null
  while ((m = FENCE.exec(source)) !== null) {
    if (m.index > cursor) {
      blocks.push(...paragraphsFromText(source.slice(cursor, m.index)))
    }
    blocks.push({ kind: 'codeBlock', value: m[1].replace(/^\n|\n$/g, '') })
    cursor = m.index + m[0].length
  }
  if (cursor < source.length) {
    blocks.push(...paragraphsFromText(source.slice(cursor)))
  }
  return blocks
}

function paragraphsFromText(text: string): Block[] {
  const lines = text.split('\n').map((line) => {
    const quoted = /^\s*>\s?/.test(line)
    return { quoted, text: quoted ? line.replace(/^\s*>\s?/, '') : line }
  })
  return [{ kind: 'paragraph', lines }]
}

/* ------------------------------------------------------------------------- */
/* React rendering                                                           */
/* ------------------------------------------------------------------------- */

interface RenderOptions {
  /** Tailwind className for inline `<a>` elements (overrides the default). */
  linkClassName?: string
}

const DEFAULT_LINK_CLASS = 'underline underline-offset-2 hover:opacity-80'

function renderTokens(tokens: InlineToken[], opts: RenderOptions): React.ReactNode {
  return tokens.map((t, idx) => {
    switch (t.kind) {
      case 'text':
        return <React.Fragment key={idx}>{t.value}</React.Fragment>
      case 'bold':
        return (
          <strong key={idx} className="font-semibold">
            {renderTokens(t.children, opts)}
          </strong>
        )
      case 'italic':
        return (
          <em key={idx} className="italic">
            {renderTokens(t.children, opts)}
          </em>
        )
      case 'strike':
        return (
          <s key={idx} className="line-through opacity-80">
            {renderTokens(t.children, opts)}
          </s>
        )
      case 'code':
        return (
          <code
            key={idx}
            className="rounded bg-black/10 px-1 py-px font-mono text-[0.92em] dark:bg-white/15"
          >
            {t.value}
          </code>
        )
      case 'link':
        return (
          <a
            key={idx}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            className={opts.linkClassName ?? DEFAULT_LINK_CLASS}
            onClick={(e) => e.stopPropagation()}
          >
            {t.value}
          </a>
        )
      default:
        return null
    }
  })
}

/**
 * Render a string of chat text as React nodes with WhatsApp / Messenger style
 * formatting applied. Intended to live inside a `whitespace-pre-wrap` parent
 * (or one with explicit line breaks); we still emit `<br/>` between lines for
 * code blocks and quoted lines so they're individually styleable.
 */
export function renderRichText(source: string, opts: RenderOptions = {}): React.ReactNode {
  if (!source) return null
  const blocks = splitBlocks(source)
  return blocks.map((block, blockIdx) => {
    if (block.kind === 'codeBlock') {
      return (
        <pre
          key={blockIdx}
          className="my-1 overflow-x-auto rounded-md bg-black/15 px-2 py-1.5 font-mono text-[0.88em] leading-snug whitespace-pre dark:bg-white/15"
        >
          {block.value}
        </pre>
      )
    }
    return (
      <React.Fragment key={blockIdx}>
        {block.lines.map((line, lineIdx) => {
          const isLast = lineIdx === block.lines.length - 1
          const tokens = tokenizeInline(line.text)
          const content = renderTokens(tokens, opts)
          if (line.quoted) {
            return (
              <span
                key={lineIdx}
                className="my-0.5 block border-l-2 border-current/40 pl-2 italic opacity-80"
              >
                {content}
                {!isLast && <br />}
              </span>
            )
          }
          return (
            <React.Fragment key={lineIdx}>
              {content}
              {!isLast && <br />}
            </React.Fragment>
          )
        })}
      </React.Fragment>
    )
  })
}
