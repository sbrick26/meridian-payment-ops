// Meridian Design Language 3.0 — screen renderer for Figma.
//
// Renders a data-table screen from MDL 3.0 tokens: masthead and nav, page
// header, filter bar, table with status and risk chips, pagination, footnote.
// What it draws comes entirely from its parameters - the tokens read from the
// design-language page, the rows, and the copy - so it is the design system
// expressed once as code rather than a picture of one screen.
//
// This is the drawing code for the AFTER frame, committed rather than
// generated. An agent writing a screen's worth of plugin JavaScript spends
// thousands of output tokens per attempt and lays it out slightly differently
// every time - which is how the masthead ended up over the page title and the
// filter bar under the table header. Authored once, it renders identically on
// every run and costs one tool call.
//
// Run it with figma_execute_file, which injects PARAMS:
//   { pageName, frameName, x, y, tokens: {...}, rows: [...] , meta: {...} }
// Every value it draws comes from PARAMS, so the design system stays the
// source of truth and this file stays layout only.


// Decode base64 without relying on atob: the plugin sandbox does not reliably
// provide it, and a missing global here fails the whole draw.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64ToBytes(b64) {
  const clean = String(b64).replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12)
            | (B64.indexOf(clean[i + 2] || 'A') << 6) | B64.indexOf(clean[i + 3] || 'A');
    out[p++] = (n >> 16) & 255;
    if (i + 2 < clean.length) out[p++] = (n >> 8) & 255;
    if (i + 3 < clean.length) out[p++] = n & 255;
  }
  return out.subarray(0, p);
}

const T = PARAMS.tokens || {};
const hex = (h) => {
  const s = String(h || '#000000').replace('#', '');
  return { r: parseInt(s.slice(0, 2), 16) / 255, g: parseInt(s.slice(2, 4), 16) / 255, b: parseInt(s.slice(4, 6), 16) / 255 };
};
const solid = (h) => [{ type: 'SOLID', color: hex(h) }];

const C = {
  action: T.action || '#1f5fd6',
  navy: T.navy900 || '#101827',
  surface: T.surface || '#ffffff',
  subdued: T.surfaceSubdued || '#edeff3',
  canvas: T.canvas || '#ffffff',
  border: T.border || '#d6dae2',
  text: T.textPrimary || '#10151f',
  muted: T.textSecondary || '#5a6577',
  inverse: T.textInverse || '#ffffff',
  success: T.success || '#1e7a52',
  warning: T.warning || '#a66a0a',
  critical: T.critical || '#b3261e',
};

(async () => {
  // Load every family/style pair this script can ask for. Assigning a
  // fontName that has not been loaded throws, and the throw aborts the whole
  // script mid-draw - which is how a run once produced a frame containing
  // nothing but its masthead. Roboto Mono has no "Semi Bold", so mono text is
  // clamped to the weights that exist.
  const FONTS = [
    { family: 'Inter', style: 'Regular' },
    { family: 'Inter', style: 'Medium' },
    { family: 'Inter', style: 'Semi Bold' },
    { family: 'Roboto Mono', style: 'Regular' },
    { family: 'Roboto Mono', style: 'Medium' },
  ];
  for (const f of FONTS) await figma.loadFontAsync(f);
  const MONO_OK = { Regular: 'Regular', Medium: 'Medium', 'Semi Bold': 'Medium', Bold: 'Medium' };

  // Reuse the page the caller names so a re-run replaces its own work rather
  // than stacking a second copy beside it.
  let page = figma.root.children.find((p) => p.name === PARAMS.pageName);
  if (!page) { page = figma.createPage(); page.name = PARAMS.pageName; }
  await figma.setCurrentPageAsync(page);

  const existing = page.findChild((n) => n.name === PARAMS.frameName);
  if (existing) existing.remove();

  // The BEFORE frame is built here rather than in a separate call. Every extra
  // round trip over the bridge is another chance for the connection to drop
  // mid-sequence, and when it dropped between creating this frame and filling
  // it, what was left on the canvas was a black rectangle. One call either
  // produces both frames or produces neither, which is the honest outcome.
  let beforeRect = null;
  if (PARAMS.beforeFrameName) {
    const oldBefore = page.findChild((n) => n.name === PARAMS.beforeFrameName);
    if (oldBefore) oldBefore.remove();
    const bf = figma.createFrame();
    bf.name = PARAMS.beforeFrameName;
    bf.resize(1440, 920);
    bf.x = (PARAMS.x || 0) - 1560;
    bf.y = PARAMS.y || 0;
    bf.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    page.appendChild(bf);
    const shot = figma.createRectangle();
    shot.name = 'legacy-screenshot';
    shot.resize(1440, 920);
    shot.x = 0; shot.y = 0;
    // The image is NOT applied here. Decoding 400KB of base64 inside the
    // plugin sandbox produced an image node whose fill rendered blank - the
    // bytes were verified identical, the geometry was verified exact, and it
    // still drew white. The upstream figma_set_image_fill tool decodes in the
    // browser bridge instead, and that path has rendered this same file
    // correctly on canvas. So this script leaves a named rectangle and
    // returns its id, and the caller applies the image with the proven tool.
    if (PARAMS.beforeImage) {
      const img = figma.createImage(b64ToBytes(PARAMS.beforeImage));
      shot.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: img.hash }];
    }
    bf.appendChild(shot);
    beforeRect = shot;
  }

  const W = 1440, H = 920, PAD = 32;
  const frame = figma.createFrame();
  frame.name = PARAMS.frameName;
  frame.resize(W, H);
  frame.x = PARAMS.x || 0;
  frame.y = PARAMS.y || 0;
  // Set the fill explicitly every run. A previous run left the legacy
  // screenshot as this frame's own background - an image fill applied to the
  // frame instead of to the BEFORE rectangle - so the modern design rendered
  // on top of the old screen and the two read as one overlapping mess.
  // Assigning a solid fill here clears whatever was there.
  frame.fills = solid(C.canvas);
  page.appendChild(frame);

  // Every node is placed at an absolute x/y with an explicit width. Nothing is
  // laid out by flow, because flow is what makes neighbours collide.
  const text = (s, o) => {
    const t = figma.createText();
    const style = o.style || 'Regular';
    t.fontName = o.mono
      ? { family: 'Roboto Mono', style: MONO_OK[style] || 'Regular' }
      : { family: 'Inter', style };
    t.fontSize = o.size || 13;
    t.characters = String(s);
    t.textAutoResize = 'NONE';
    t.resize(o.w, o.h || (o.size || 13) * 1.6);
    t.x = o.x; t.y = o.y;
    t.fills = solid(o.color || C.text);
    if (o.align) t.textAlignHorizontal = o.align;
    t.textAlignVertical = 'CENTER';
    if (o.spacing) t.letterSpacing = { unit: 'PIXELS', value: o.spacing };
    frame.appendChild(t);
    return t;
  };
  const rect = (o) => {
    const r = figma.createRectangle();
    r.x = o.x; r.y = o.y; r.resize(o.w, o.h);
    r.fills = solid(o.fill);
    if (o.radius) r.cornerRadius = o.radius;
    if (o.stroke) { r.strokes = solid(o.stroke); r.strokeWeight = o.strokeWeight || 1; }
    r.name = o.name || 'Rectangle';
    frame.appendChild(r);
    return r;
  };
  const chip = (label, x, y, tone) => {
    const map = { hold: C.warning, review: C.action, escalated: C.critical, pending: C.muted,
                  high: C.critical, med: C.warning, low: C.success };
    const col = map[String(tone || label).toLowerCase()] || C.muted;
    const w = Math.max(52, String(label).length * 7 + 18);
    rect({ x, y, w, h: 20, fill: col, radius: 10, name: `chip ${label}` }).opacity = 0.12;
    text(label, { x, y, w, h: 20, size: 10, style: 'Semi Bold', color: col, align: 'CENTER', spacing: 0.4 });
  };

  // ---- masthead -----------------------------------------------------------
  rect({ x: 0, y: 0, w: W, h: 56, fill: C.navy, name: 'masthead' });
  text('MERIDIAN PAYMENT OPS', { x: PAD, y: 18, w: 240, size: 12, style: 'Semi Bold', color: C.inverse, spacing: 1.1, mono: true });
  // Nav sits in its own reserved band on the right; the wordmark owns the left.
  const nav = [['Dashboard', 900], ['Held Payments', 1000], ['Reports', 1132], ['Help', 1216]];
  nav.forEach(([label, x], i) => {
    const active = i === 1;
    text(label, { x, y: 18, w: 120, size: 13, style: active ? 'Semi Bold' : 'Regular',
                  color: active ? C.inverse : '#c7cdd8' });
    if (active) rect({ x, y: 44, w: 100, h: 2, fill: C.action, name: 'nav active' });
  });
  rect({ x: 1300, y: 16, w: 108, h: 24, fill: '#1e2532', radius: 4, name: 'user chip' });
  text('D. WHITAKER', { x: 1300, y: 16, w: 108, h: 24, size: 10, color: '#c7cdd8', align: 'CENTER', mono: true });

  if ((PARAMS.variant || '') === 'agent') {
    // ---- agent-experience mock (POTENTIAL UI, not build scope) ------------
    // Drawn from the same tokens as everything else. The conversation comes
    // from PARAMS so the mock can show the actual demo script: a real
    // question, a real answer, and the refusal that proves the boundary.
    const A = PARAMS.agent || {};
    rect({ x: PAD, y: 88, w: 400, h: 764, fill: C.surface, radius: 8, stroke: C.border, name: 'context panel' });
    text(A.title || 'Meridian AP Assistant', { x: PAD + 24, y: 116, w: 352, size: 22, style: 'Semi Bold' });
    text(A.subtitle || 'Ask about any held payment - status, hold reason, timeline.',
         { x: PAD + 24, y: 152, w: 352, h: 44, size: 13, color: C.muted });
    rect({ x: PAD + 24, y: 216, w: 352, h: 92, fill: C.subdued, radius: 6, name: 'identity card' });
    text('IDENTITY', { x: PAD + 40, y: 228, w: 200, size: 10, style: 'Semi Bold', color: C.muted, spacing: 0.6 });
    text(A.identity || 'ap-inquiry-agent - read-only', { x: PAD + 40, y: 250, w: 320, size: 13, mono: true });
    text(A.phone || 'Voice: +1 (415) 338-9157', { x: PAD + 40, y: 276, w: 320, size: 13 });
    const caps = A.capabilities || [
      'Payment status by reference or invoice',
      'Hold reasons and ageing',
      'Risk score, explained',
      'Cannot release or modify payments',
    ];
    text('WHAT IT CAN DO', { x: PAD + 24, y: 336, w: 300, size: 10, style: 'Semi Bold', color: C.muted, spacing: 0.6 });
    caps.forEach((cap, k) => text('-  ' + cap, {
      x: PAD + 24, y: 360 + k * 28, w: 352, size: 13,
      color: k === caps.length - 1 ? C.critical : C.text,
    }));
    const cx = PAD + 424, cw = W - PAD - cx;
    rect({ x: cx, y: 88, w: cw, h: 764, fill: C.surface, radius: 8, stroke: C.border, name: 'chat panel' });
    let cy = 120;
    for (const m of (PARAMS.conversation || [])) {
      const isUser = m.role === 'user';
      const isRefusal = m.role === 'refusal';
      const lines = Math.max(1, Math.ceil(String(m.text || '').length / 58));
      const bh = lines * 20 + 20;
      const bw = Math.min(cw - 160, 620);
      const bx = isUser ? cx + cw - 40 - bw : cx + 40;
      rect({ x: bx, y: cy, w: bw, h: bh, radius: 8, name: (m.role || 'agent') + ' bubble',
             fill: isUser ? C.action : (isRefusal ? '#fdecea' : C.canvas),
             stroke: isUser ? undefined : (isRefusal ? C.critical : C.border) });
      text(m.text, { x: bx + 14, y: cy + 10, w: bw - 28, h: bh - 20, size: 13,
                     color: isUser ? C.inverse : (isRefusal ? C.critical : C.text) });
      cy += bh + 18;
    }
    rect({ x: cx + 40, y: 788, w: cw - 80, h: 40, fill: C.canvas, radius: 20, stroke: C.border, name: 'input bar' });
    text('Ask about a payment...', { x: cx + 58, y: 788, w: 300, h: 40, size: 13, color: C.muted });
    text((PARAMS.meta && PARAMS.meta.footnote) || 'Concept mock - potential agent experience. Not in build scope for this phase.',
         { x: PAD, y: 872, w: 1000, size: 11, color: C.muted });
  } else {
  // ---- breadcrumb + title -------------------------------------------------
  rect({ x: 0, y: 56, w: W, h: 94, fill: C.surface, name: 'title band' });
  text('Dashboard  /  Held Payments', { x: PAD, y: 70, w: 400, size: 11, color: C.muted });
  text('Held Payments', { x: PAD, y: 92, w: 260, size: 26, style: 'Semi Bold' });
  // 16px clear of the title's 260px box, so the two can never touch.
  text(PARAMS.meta?.subtitle || 'vendor payment inquiries', { x: PAD + 276, y: 100, w: 420, size: 13, color: C.muted });

  // ---- filter bar ---------------------------------------------------------
  const fy = 150;
  rect({ x: 0, y: fy, w: W, h: 76, fill: C.subdued, name: 'filter bar' });
  const field = (label, value, x, w) => {
    text(label, { x, y: fy + 12, w, size: 10, style: 'Semi Bold', color: C.muted, spacing: 0.6 });
    rect({ x, y: fy + 30, w, h: 34, fill: C.surface, radius: 4, stroke: C.border, name: `field ${label}` });
    text(value, { x: x + 10, y: fy + 30, w: w - 20, h: 34, size: 13, color: C.text });
  };
  field('STATUS', 'Open items', PAD, 180);
  field('TYPE', 'All types', PAD + 196, 160);
  field('SEARCH', 'payment ref, vendor, invoice…', PAD + 372, 420);
  rect({ x: PAD + 808, y: fy + 30, w: 96, h: 34, fill: C.action, radius: 4, name: 'Search button' });
  text('Search', { x: PAD + 808, y: fy + 30, w: 96, h: 34, size: 13, style: 'Semi Bold', color: C.inverse, align: 'CENTER' });
  text('Clear', { x: PAD + 916, y: fy + 30, w: 60, h: 34, size: 13, color: C.action });
  text('Export CSV', { x: W - PAD - 110, y: fy + 30, w: 110, h: 34, size: 12, color: C.action, align: 'RIGHT' });

  // ---- result meta --------------------------------------------------------
  const my = fy + 76;
  text(PARAMS.meta?.summary || '', { x: PAD, y: my + 10, w: 700, size: 12, color: C.muted });

  // ---- table --------------------------------------------------------------
  const cols = [
    { k: 'ref', label: 'REFERENCE', x: PAD, w: 140, mono: true },
    { k: 'vendor', label: 'VENDOR', x: 190, w: 210 },
    { k: 'invoice', label: 'INVOICE NO', x: 410, w: 140, mono: true },
    { k: 'amount', label: 'AMOUNT', x: 560, w: 120, align: 'RIGHT', mono: true },
    { k: 'ccy', label: 'CCY', x: 692, w: 44 },
    { k: 'status', label: 'STATUS', x: 748, w: 100, chip: true },
    { k: 'reason', label: 'HOLD REASON', x: 860, w: 330 },
    { k: 'age', label: 'AGE', x: 1200, w: 50, align: 'RIGHT' },
    { k: 'risk', label: 'RISK', x: 1264, w: 80, chip: true },
    { k: 'detail', label: '', x: 1356, w: 52, align: 'RIGHT' },
  ];
  const ty = my + 40, ROW = 52;
  rect({ x: PAD, y: ty, w: W - PAD * 2, h: 40, fill: C.subdued, radius: 4, name: 'table header' });
  cols.forEach((c) => {
    if (!c.label) return;
    text(c.label, { x: c.x + (c.align === 'RIGHT' ? 0 : 10), y: ty, w: c.w, h: 40,
                    size: 10, style: 'Semi Bold', color: C.muted, spacing: 0.6, align: c.align });
  });

  (PARAMS.rows || []).forEach((row, i) => {
    const y = ty + 40 + i * ROW;
    rect({ x: PAD, y, w: W - PAD * 2, h: ROW, fill: i % 2 ? C.canvas : C.surface, name: `row ${i + 1}` });
    rect({ x: PAD, y: y + ROW - 1, w: W - PAD * 2, h: 1, fill: C.border, name: 'row rule' });
    cols.forEach((c) => {
      const v = row[c.k];
      if (v === undefined || v === '') return;
      if (c.chip) { chip(v, c.x + 10, y + (ROW - 20) / 2, v); return; }
      text(v, { x: c.x + (c.align === 'RIGHT' ? 0 : 10), y, w: c.w, h: ROW,
                size: 13, mono: c.mono, align: c.align,
                color: c.k === 'ref' ? C.action : (c.k === 'age' ? C.critical : C.text) });
    });
  });

  // ---- pagination + footnote ---------------------------------------------
  const py = ty + 40 + (PARAMS.rows || []).length * ROW + 20;
  ['1', '2', '3', '4', '5'].forEach((n, i) => {
    const x = PAD + i * 40;
    rect({ x, y: py, w: 32, h: 32, fill: i === 0 ? C.action : C.surface, radius: 4,
           stroke: i === 0 ? undefined : C.border, name: `page ${n}` });
    text(n, { x, y: py, w: 32, h: 32, size: 12, color: i === 0 ? C.inverse : C.text, align: 'CENTER' });
  });
  text(PARAMS.meta?.pageNote || '', { x: PAD + 220, y: py, w: 400, h: 32, size: 12, color: C.muted });
  text(PARAMS.meta?.footnote || '', { x: PAD, y: py + 52, w: W - PAD * 2, size: 11, color: C.muted });

  }

  figma.currentPage.selection = [frame];
  const beforeFrame = page.findChild((n) => n.name === PARAMS.beforeFrameName);
  const result = {
    ok: true, page: page.name,
    beforeFrameId: beforeFrame ? beforeFrame.id : null,
    beforeRectId: beforeRect ? beforeRect.id : null,
    afterFrameId: frame.id,
    rows: (PARAMS.rows || []).length,
  };
  console.log(JSON.stringify(result));
  // RETURN the result as well: the execute tool reports the resolved value of
  // this script, and a run that only logged it got `undefined` back - then
  // spent three more bridge calls re-discovering the frame ids it had just
  // created.
  return result;
})();
