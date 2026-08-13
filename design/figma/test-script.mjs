// Run the design script against a stubbed Figma API.
//
// A runtime error inside a plugin script aborts the draw silently and leaves a
// half-built frame - a missing font weight once produced a frame containing
// only its masthead, and finding out cost a 25-minute round trip through the
// bridge. This exercises the same code paths in milliseconds, with no Figma,
// no plugin and no network, and fails loudly on the things that actually break:
// unloaded fonts, missing helpers, bad property names.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const loaded = new Set();
const created = [];
const node = (type) => {
  const n = {
    type, id: `${type}:${created.length + 1}`, name: type, x: 0, y: 0, width: 0, height: 0,
    children: [],
    resize(w, h) { this.width = w; this.height = h; },
    appendChild(c) { this.children.push(c); c._parent = this; },
    findChild(fn) { return this.children.find(fn) || null; },
    remove() { if (this._parent) this._parent.children = this._parent.children.filter((k) => k !== this); },
  };
  // The whole point: assigning a font that was never loaded must throw here,
  // exactly as Figma does.
  Object.defineProperty(n, 'fontName', {
    set(v) {
      const key = `${v.family}|${v.style}`;
      if (!loaded.has(key)) throw new Error(`font not loaded: ${key}`);
      this._font = v;
    },
    get() { return this._font; },
  });
  created.push(n);
  return n;
};

const page = node('PAGE');
page.name = '__unnamed__';
globalThis.figma = {
  root: { children: [page] },
  currentPage: page,
  createPage: () => { const p = node('PAGE'); figma.root.children.push(p); return p; },
  setCurrentPageAsync: async (p) => { figma.currentPage = p; },
  createFrame: () => node('FRAME'),
  createText: () => node('TEXT'),
  createRectangle: () => node('RECTANGLE'),
  loadFontAsync: async (f) => { loaded.add(`${f.family}|${f.style}`); },
  createImage: (bytes) => {
    if (!(bytes instanceof Uint8Array) || bytes.length < 8) {
      throw new Error(`createImage got ${bytes && bytes.length} bytes - base64 decode failed`);
    }
    return { hash: 'stub-image-hash' };
  },
};

const rows = JSON.parse(
  execFileSync('sqlite3', [path.join(REPO, 'payops.db')], {
    input: readFileSync(path.join(HERE, 'rows.sql'), 'utf8'), encoding: 'utf8',
  }).trim());

globalThis.PARAMS = {
  pageName: 'TEST - Held Payments', frameName: 'TEST AFTER', x: 0, y: 0,
  beforeFrameName: 'TEST BEFORE',
  beforeImage: readFileSync(path.join(HERE, '..', '..', 'docs/design/legacy-held-payments.png')).toString('base64'),
  tokens: { action: '#1f5fd6', navy900: '#101827', surface: '#ffffff', surfaceSubdued: '#edeff3',
            canvas: '#f7f8fa', border: '#d6dae2', textPrimary: '#10151f', textSecondary: '#5a6577',
            textInverse: '#ffffff', success: '#1e7a52', warning: '#a66a0a', critical: '#b3261e' },
  rows,
  meta: { subtitle: 's', summary: 'q', pageNote: 'p', footnote: 'f' },
};

const src = readFileSync(path.join(HERE, 'render-screen.js'), 'utf8');
let failed = false;
process.on('unhandledRejection', (e) => { console.error('FAIL:', e.message); failed = true; });

await import('data:text/javascript,' + encodeURIComponent(src));
await new Promise((r) => setTimeout(r, 60));

if (failed) process.exit(1);
const frame = created.find((n) => n.type === 'FRAME' && n.name === PARAMS.frameName);
if (!frame) { console.error('FAIL: after frame was never created'); process.exit(1); }
const before = created.find((n) => n.type === 'FRAME' && n.name === PARAMS.beforeFrameName);
if (!before) { console.error('FAIL: before frame was never created'); process.exit(1); }
if (!before.children.some((c) => (c.fills || []).some((f) => f.type === 'IMAGE'))) {
  console.error('FAIL: before frame has no image fill - this is the black rectangle'); process.exit(1);
}

// A frame that draws its masthead and then throws still "exists", so assert on
// substance: the row data has to have made it onto the canvas.
const texts = created.filter((n) => n.type === 'TEXT');
const chars = texts.map((t) => String(t.characters ?? ''));
const missing = rows.filter((r) => !chars.some((c) => c.includes(r.ref)));
console.log(`nodes: ${created.length} · frame children: ${frame.children.length} · text nodes: ${texts.length}`);
if (missing.length) { console.error('FAIL: rows missing from canvas:', missing.map((m) => m.ref)); process.exit(1); }
if (frame.children.length < 40) { console.error(`FAIL: only ${frame.children.length} nodes in frame - draw aborted early`); process.exit(1); }
console.log('PASS — table variant: BEFORE has an image fill, AFTER has',
  frame.children.length, 'nodes,', rows.length, 'rows');

// ---- agent variant ----------------------------------------------------------
// The same script draws the potential-agent-experience mock. Re-import with a
// cache-busted URL so the module evaluates again under new PARAMS.
globalThis.PARAMS = {
  pageName: 'TEST - Agent Mock', frameName: 'TEST AGENT AFTER', x: 0, y: 0,
  variant: 'agent',
  beforeFrameName: 'TEST AGENT BEFORE',
  beforeImage: readFileSync(path.join(HERE, '..', '..', 'docs/design/legacy-held-payments.png')).toString('base64'),
  tokens: {},
  conversation: [
    { role: 'user',    text: 'What is going on with invoice INV-2026-4411?' },
    { role: 'agent',   text: 'Payment MT-2026-08822 to Lion City Trading is PENDING - PO mismatch, 11 days old.' },
    { role: 'user',    text: 'Release it.' },
    { role: 'refusal', text: 'I cannot release payments - my identity has read-only scope. I can note it for a clerk.' },
  ],
  meta: { footnote: 'f' },
};
await import('data:text/javascript,' + encodeURIComponent(src) + '//agent-variant');
await new Promise((r) => setTimeout(r, 60));
const chat = created.find((n) => n.name === 'chat panel');
if (!chat) { console.error('FAIL: agent variant drew no chat panel'); process.exit(1); }
const bubbles = created.filter((n) => n.name.endsWith(' bubble'));
if (bubbles.length < 4) { console.error(`FAIL: expected 4 chat bubbles, got ${bubbles.length}`); process.exit(1); }
const agentBefore = created.filter((n) => n.type === 'FRAME' && n.name === 'TEST AGENT BEFORE');
if (!agentBefore.length) { console.error('FAIL: agent variant lost the BEFORE frame'); process.exit(1); }
console.log('PASS — agent variant:', bubbles.length, 'bubbles, chat panel + BEFORE frame present');
