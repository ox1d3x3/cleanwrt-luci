// Interaction audit: drives real LuCI pages with a real mouse and checks every
// control is visible, reachable (not covered) and does what it should.
// Usage: node audit.js <base-url> <theme> <out.json> [page-filter-regex] [WxH]
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');

const [BASE, THEME, OUT, FILTER, VP] = process.argv.slice(2);
const [VW, VH] = (VP || '1440x900').split('x').map(Number);
const MAX_LI = 40, MAX_EDIT_PER_TABLE = 2, DEP_DEPTH = 1;

// ------------------------------------------------------------ in-page helpers
const HELPERS = () => {
	if (window.__A) return;
	let seq = 0;
	const vis = (el) => !!el && el.isConnected && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
		el.getClientRects().length > 0 && (() => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; })();
	const idOf = (el) => { if (!el.dataset.auditId) el.dataset.auditId = 'a' + (++seq); return el.dataset.auditId; };
	const txt = (el) => (el?.textContent || el?.value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
	const anchor = (el) => {
		const a = el.closest('[id^="cbi-"], [data-section-id], [data-name], [data-tab]');
		if (!a) return '';
		return a.id || ((a.dataset.sectionId ? 's:' + a.dataset.sectionId : '') + (a.dataset.name ? 'n:' + a.dataset.name : '') + (a.dataset.tab ? 't:' + a.dataset.tab : ''));
	};
	const desc = (el) => {
		if (!el) return 'null';
		let s = el.tagName.toLowerCase();
		if (el.id) s += '#' + el.id.slice(0, 50);
		const cls = [...el.classList].slice(0, 3).join('.');
		if (cls) s += '.' + cls;
		return s;
	};
	const checkboxTarget = (input) => {
		if (vis(input)) return input;
		const lbl = input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
		if (vis(lbl)) return lbl;
		const wrap = input.closest('label');
		if (vis(wrap)) return wrap;
		return null;
	};
	const inActions = (el) => !!el.closest('.cbi-page-actions, #applyrevert, .cleanx-apply-group, .cbi-section-actions .cbi-dropdown');
	// The part of an element a user can actually see: its box intersected with
	// the viewport and every ancestor that clips (scrolling tables, dialogs, ...).
	const visibleRect = (el) => {
		const r = el.getBoundingClientRect();
		let l = Math.max(r.left, 0), t = Math.max(r.top, 0), rt = Math.min(r.right, innerWidth), b = Math.min(r.bottom, innerHeight);
		for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
			const cs = getComputedStyle(a);
			if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
				const ar = a.getBoundingClientRect();
				if (cs.overflowX !== 'visible') { l = Math.max(l, ar.left); rt = Math.min(rt, ar.right); }
				if (cs.overflowY !== 'visible') { t = Math.max(t, ar.top); b = Math.min(b, ar.bottom); }
			}
			// A fixed-position box (e.g. LuCI's dialog overlay) is positioned
			// against the viewport; ancestors above it do not clip it.
			if (cs.position === 'fixed') break;
		}
		return { l, t, r: rt, b, w: rt - l, h: b - t };
	};
	// Click point: centre of the visible part (capped 40px in from its left
	// edge, where labels and values start), or null if too little is visible.
	const clickPoint = (el) => {
		const v = visibleRect(el);
		if (v.w < 8 || v.h < 8) return null;
		return { x: Math.round(v.l + Math.min(v.w / 2, 40)), y: Math.round(v.t + v.h / 2) };
	};

	window.__A = {
		vis, desc,
		// Every interactive control currently visible under root.
		controls(rootSel) {
			const root = document.querySelector(rootSel);
			if (!root) return [];
			const out = [];
			const add = (el, kind, target, extra = {}) => {
				// live values (traffic rates on the Network Map) must not make a
				// button look like a new control on every refresh
				const label = kind === 'button' || kind === 'tab' ? (el.textContent || el.value || '').replace(/\d+(\.\d+)?\s?[kMG]?bps/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
				const key = `${kind}|${anchor(el)}|${el.name || ''}|${label}${extra.k || ''}`;
				out.push({ id: idOf(el), kind, key, label: txt(el.closest('.cbi-value')?.querySelector('.cbi-value-title') || el), tid: target ? idOf(target) : null });
			};
			root.querySelectorAll('input, select, textarea').forEach((el) => {
				if (el.closest('.cbi-dropdown')) return;            // part of a LuCI dropdown
				const t = (el.type || 'text').toLowerCase();
				if (['hidden', 'file'].includes(t)) return;
				if (el.disabled || el.readOnly && t !== 'checkbox') return;
				if (t === 'checkbox' || t === 'radio') { const tg = checkboxTarget(el); if (tg) add(el, t, tg); return; }
				if (['button', 'submit', 'reset', 'image'].includes(t)) { if (vis(el)) add(el, 'button', el); return; }
				if (vis(el)) add(el, el.tagName === 'SELECT' ? 'select' : el.tagName === 'TEXTAREA' ? 'textarea' : 'text', el);
			});
			root.querySelectorAll('.cbi-dropdown').forEach((el) => {
				if (!vis(el) || el.getAttribute('disabled') !== null || el.classList.contains('cbi-button') || inActions(el)) return;
				if (el.closest('.cbi-dropdown') !== el) return;
				add(el, el.hasAttribute('multiple') ? 'dropdown-multi' : 'dropdown', el);
			});
			root.querySelectorAll('.cbi-dropdown.cbi-button').forEach((el) => { if (vis(el) && !inActions(el)) add(el, 'combobutton', el); });
			root.querySelectorAll('button, .cbi-button, a.btn').forEach((el) => {
				if (el.matches('input, .cbi-dropdown') || el.closest('.cbi-dropdown') || el.disabled) return;
				if (vis(el)) add(el, 'button', el);
			});
			root.querySelectorAll('.cbi-tabmenu > li[data-tab]').forEach((li) => {
				if (vis(li)) add(li, 'tab', li.querySelector('a') || li, { k: ':' + li.dataset.tab });
			});
			return out;
		},
		// Scroll a target into view and report whether a click at its centre would hit it.
		probe(tid, ownerId) {
			const t = document.querySelector(`[data-audit-id="${tid}"]`);
			const owner = ownerId ? document.querySelector(`[data-audit-id="${ownerId}"]`) : t;
			if (!t || !vis(t)) return { ok: false, why: 'not visible' };
			t.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
			const r = t.getBoundingClientRect();
			const pt = clickPoint(t);
			if (!pt) return { ok: false, why: 'clipped: not enough of it is visible' };
			const { x, y } = pt;
			const hit = document.elementFromPoint(x, y);
			const lbl = owner && owner.id ? document.querySelector(`label[for="${CSS.escape(owner.id)}"]`) : null;
			const ok = !!hit && (t === hit || t.contains(hit) || (owner && (owner === hit || owner.contains(hit))) || (lbl && (lbl === hit || lbl.contains(hit))) ||
				(hit.tagName === 'LABEL' && hit.htmlFor && owner && hit.htmlFor === owner.id));
			return { ok, x, y, w: Math.round(r.width), h: Math.round(r.height), hit: desc(hit), why: ok ? '' : `covered by ${desc(hit)}` };
		},
		get(id) { return document.querySelector(`[data-audit-id="${id}"]`); },
		state(id) {
			const el = this.get(id);
			if (!el) return null;
			if (el.matches('input[type=checkbox], input[type=radio]')) return { checked: el.checked };
			if (el.classList.contains('cbi-dropdown')) {
				const sel = [...el.querySelectorAll(':scope > ul > li[selected]')].map((li) => li.dataset.value);
				return { open: el.hasAttribute('open'), selected: sel };
			}
			return { focused: document.activeElement === el };
		},
		dropdownItems(id) {
			const dd = this.get(id);
			if (!dd) return [];
			// When open, only the real list counts; LuCI also keeps a "preview"
			// copy in the field that intentionally shows just the selection.
			const sel = dd.hasAttribute('open') ? ':scope > ul.dropdown > li[data-value]' : ':scope > ul > li[data-value]';
			return [...dd.querySelectorAll(sel)]
				.filter((li) => !li.querySelector('input:not([type=checkbox])'))
				.filter((li) => !li.hidden && li.style.display !== 'none')
				.map((li) => ({ id: idOf(li), value: li.dataset.value, selected: li.hasAttribute('selected'), text: txt(li) }));
		},
		// Bring a list item into view inside its (possibly scrollable) list.
		probeItem(liId) {
			const li = this.get(liId);
			if (!li) return { ok: false, why: 'gone' };
			if (!vis(li)) return { ok: false, why: 'not visible' };
			li.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
			const pt = clickPoint(li);
			if (!pt) return { ok: false, why: 'clipped: not enough of it is visible' };
			const { x, y } = pt;
			const hit = document.elementFromPoint(x, y);
			const ok = !!hit && (hit === li || li.contains(hit));
			return { ok, x, y, why: ok ? '' : `covered by ${desc(hit)}` };
		},
		visibleIds(rootSel) { return this.controls(rootSel).map((c) => c.id); },
		modalOpen() { const m = document.querySelector('#modal_overlay .modal'); return !!(m && vis(m) && document.body.classList.contains('modal-overlay-active')); },
		tabPanelVisible(liId) {
			const li = this.get(liId);
			if (!li) return { ok: false, why: 'tab gone' };
			const tab = li.dataset.tab;
			const menu = li.parentElement;
			// LuCI places the panes as siblings after the menu (ui.tabs.initTabGroup)
			let panes = [...menu.parentElement.querySelectorAll(':scope > [data-tab]')];
			if (!panes.length) panes = [...document.querySelectorAll(`[data-tab="${CSS.escape(tab)}"]`)].filter((p) => p !== li && p.tagName !== 'LI');
			const pane = panes.find((p) => p.dataset.tab === tab);
			if (!pane) return { ok: true, why: 'no pane (link tab)' };
			const others = panes.filter((p) => p !== pane && vis(p)).map((p) => p.dataset.tab);
			const ok = vis(pane) && li.classList.contains('cbi-tab') && others.length === 0;
			return { ok, why: ok ? '' : `pane visible=${vis(pane)} active=${li.classList.contains('cbi-tab')} others=${others.join(',')}` };
		},
		modalButtons() {
			return [...document.querySelectorAll('#view button, #view .cbi-button')]
				.filter((b) => vis(b) && !b.closest('.cbi-dropdown, .cbi-page-actions, .cleanx-apply-group'))
				.filter((b) => /^(edit|configure…|configure\.\.\.|add|add led action|add new interface…|add device configuration…|add instance|add server instance)$/i.test(txt(b)))
				.map((b) => ({ id: idOf(b), text: txt(b), table: anchor(b.closest('.cbi-section, .cbi-tblsection, table') || b) }));
		},
		// Elements LuCI itself hides, or layouts that make options unreachable.
		structure(rootSel) {
			const root = document.querySelector(rootSel);
			if (!root) return [];
			const out = [];
			const name = (el) => (el.closest('[id^="cbi-"]') || el).id || desc(el);
			root.querySelectorAll('.hidden').forEach((el) => { if (vis(el)) out.push({ type: 'luci-hidden-shown', id: name(el) }); });
			root.querySelectorAll('[data-tab][data-tab-active="false"]').forEach((el) => { if (el.tagName !== 'LI' && vis(el) && el.querySelector('.cbi-value, input, select, .cbi-dropdown')) out.push({ type: 'inactive-pane-shown', id: name(el) + ':' + el.dataset.tab }); });
			root.querySelectorAll('.cbi-tabmenu > li[data-tab]').forEach((li) => { if (/display:\s*none/.test(li.getAttribute('style') || '') && vis(li)) out.push({ type: 'empty-tab-shown', id: name(li.parentElement.nextElementSibling || li) + ':' + li.dataset.tab }); });
			root.querySelectorAll('.cbi-dropdown:not([open]):not([empty])').forEach((dd) => {
				if (!vis(dd)) return;
				const extra = [...dd.querySelectorAll(':scope > ul > li:not([display])')].filter((li) => vis(li));
				if (extra.length) out.push({ type: 'closed-dropdown-expanded', id: name(dd) + ` (+${extra.length})` });
			});
			root.querySelectorAll('.cbi-value').forEach((v) => {
				const sec = v.querySelector(':scope > .cbi-section, :scope > fieldset.cbi-section');
				if (sec && vis(sec) && sec.getBoundingClientRect().width < v.getBoundingClientRect().width * 0.6) out.push({ type: 'nested-section-squeezed', id: name(v) });
			});
			return out;
		},
		closeModal() {
			const m = document.querySelector('#modal_overlay .modal');
			if (!m) return 'none';
			const b = [...m.querySelectorAll('button, .cbi-button')].find((x) => vis(x) && /^(dismiss|cancel|close)$/i.test(txt(x)));
			if (b) return idOf(b);
			return null;
		},
	};
};

// ------------------------------------------------------------------- driver
const results = [];
function rec(page, ctx, c, check, ok, detail = '') {
	results.push({ page, ctx, kind: c.kind, key: c.key, label: c.label, check, ok, detail });
}

// Wait a little, then for two rendered frames: LuCI sizes and positions some
// widgets (e.g. open dropdown lists) in requestAnimationFrame callbacks.
async function settle(p, ms = 160) {
	await p.waitForTimeout(ms);
	await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
async function closeDropdowns(p) { await p.evaluate(() => window.dispatchEvent(new MouseEvent('click'))); await settle(p, 80); }
let shots = 0;
const SHOTDIR = (OUT || 'out/x.json').replace(/\.json$/, '') + '-shots';
fs.mkdirSync(SHOTDIR, { recursive: true });
async function shot(p, pg, c, pr) {
	if (shots >= 60 || pr.x === undefined) return;
	shots++;
	await p.evaluate(([x, y]) => { const m = document.createElement('div'); m.id = '__mark'; m.style.cssText = `position:fixed;left:${x - 14}px;top:${y - 14}px;width:28px;height:28px;border:3px solid red;border-radius:50%;z-index:2147483647;pointer-events:none`; document.body.appendChild(m); }, [pr.x, pr.y]);
	await p.screenshot({ path: `${SHOTDIR}/${String(shots).padStart(2, '0')}-${pg.replace(/\//g, '_')}-${c.kind}.png` });
	await p.evaluate(() => document.getElementById('__mark')?.remove());
	results[results.length - 1].shot = shots;
}

async function testControl(p, pg, ctx, root, c, tested, depth) {
	const A = (fn, ...args) => p.evaluate(([f, a]) => window.__A[f](...a), [fn, args]);
	const pr = await A('probe', c.tid, c.id);
	rec(pg, ctx, c, 'reachable', pr.ok, pr.why);
	if (!pr.ok) { await shot(p, pg, c, pr); return; }

	if (c.kind === 'button' || c.kind === 'combobutton' || c.kind === 'tab') return;

	if (c.kind === 'text' || c.kind === 'textarea' || c.kind === 'select') {
		await p.mouse.click(pr.x, pr.y);
		await settle(p, 60);
		const st = await A('state', c.id);
		rec(pg, ctx, c, 'focus-on-click', !!st?.focused, st?.focused ? '' : `focus went to ${await p.evaluate(() => window.__A.desc(document.activeElement))}`);
		await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
		return;
	}

	if (c.kind === 'checkbox' || c.kind === 'radio') {
		const before = await A('state', c.id);
		const visBefore = new Set(await A('visibleIds', root));
		await p.mouse.click(pr.x, pr.y);
		await settle(p);
		const after = await A('state', c.id);
		const toggled = after && before && after.checked !== before.checked;
		rec(pg, ctx, c, 'toggles-on-click', !!toggled || (c.kind === 'radio' && after?.checked), toggled ? '' : `checked stayed ${before?.checked}`);
		if (toggled && depth < DEP_DEPTH) {
			// dependent options revealed by this change
			const now = await A('controls', root);
			for (const d of now.filter((x) => !visBefore.has(x.id) && !tested.has(x.key))) {
				tested.add(d.key);
				await testControl(p, pg, ctx + ' > dep:' + c.label, root, d, tested, depth + 1);
			}
		}
		if (toggled && c.kind === 'checkbox') {
			const pr2 = await A('probe', c.tid, c.id);
			if (pr2.ok) { await p.mouse.click(pr2.x, pr2.y); await settle(p); }
			const back = await A('state', c.id);
			rec(pg, ctx, c, 'toggles-back', back && back.checked === before.checked, back && back.checked === before.checked ? '' : 'could not restore');
		}
		return;
	}

	if (c.kind === 'dropdown' || c.kind === 'dropdown-multi') {
		const before = await A('state', c.id);
		await p.mouse.click(pr.x, pr.y);
		await settle(p);
		let st = await A('state', c.id);
		rec(pg, ctx, c, 'opens-on-click', !!st?.open, st?.open ? '' : 'did not open');
		if (!st?.open) return;
		const items = await A('dropdownItems', c.id);
		let bad = [];
		for (const it of items.slice(0, MAX_LI)) {
			const r = await A('probeItem', it.id);
			if (!r.ok) bad.push(`${it.value}: ${r.why}`);
		}
		rec(pg, ctx, c, 'items-reachable', bad.length === 0, bad.slice(0, 4).join('; ') + (bad.length > 4 ? ` (+${bad.length - 4})` : '') + ` [${items.length} items]`);
		const target = items.find((it) => !it.selected) || null;
		if (!target) { await closeDropdowns(p); return; }
		const tr = await A('probeItem', target.id);
		if (!tr.ok) { rec(pg, ctx, c, 'select-item', false, `target ${target.value}: ${tr.why}`); await closeDropdowns(p); return; }
		await p.mouse.click(tr.x, tr.y);
		await settle(p);
		st = await A('state', c.id);
		const selected = st && st.selected.includes(target.value);
		rec(pg, ctx, c, 'select-item', !!selected, selected ? '' : `selected=${JSON.stringify(st?.selected)} wanted ${target.value}`);
		// restore the original selection
		if (c.kind === 'dropdown-multi') {
			const t2 = await A('probeItem', target.id);
			if (t2.ok) { await p.mouse.click(t2.x, t2.y); await settle(p); }
			await closeDropdowns(p);
		} else if (before?.selected?.length) {
			const pr3 = await A('probe', c.tid, c.id);
			if (pr3.ok) {
				await p.mouse.click(pr3.x, pr3.y); await settle(p);
				const orig = (await A('dropdownItems', c.id)).find((it) => it.value === before.selected[0]);
				if (orig) { const r = await A('probeItem', orig.id); if (r.ok) { await p.mouse.click(r.x, r.y); await settle(p); } }
			}
			if ((await A('state', c.id))?.open) { await closeDropdowns(p); }
		}
		return;
	}
}

const openedDialogs = new Set();
async function dialogs(p, pg) {
	const A = (fn, ...args) => p.evaluate(([f, a]) => window.__A[f](...a), [fn, args]);
	const triggers = await A('modalButtons');
	const perTable = {};
	for (const b of triggers) {
		const k = b.table + '|' + b.text;
		perTable[k] = (perTable[k] || 0) + 1;
		const dk = `${pg}|${k}#${perTable[k]}`;
		if (perTable[k] > MAX_EDIT_PER_TABLE || openedDialogs.has(dk)) continue;
		openedDialogs.add(dk);
		const pr = await A('probe', b.id, b.id);
		const fake = { kind: 'button', key: `modal-trigger|${b.table}|${b.text}#${perTable[k]}`, label: b.text };
		rec(pg, 'page', fake, 'reachable', pr.ok, pr.why);
		if (!pr.ok) { await shot(p, pg, fake, pr); continue; }
		await p.mouse.click(pr.x, pr.y);
		const opened = await p.waitForFunction(() => window.__A.modalOpen(), null, { timeout: 4000 }).then(() => true).catch(() => false);
		if (!opened) continue;   // e.g. "Add" needing a name first
		await settle(p, 500);
		const title = await p.evaluate(() => (document.querySelector('#modal_overlay .modal h4')?.textContent || '').trim().slice(0, 50));
		rec(pg, 'page', fake, 'opens-dialog', true, title);
		const dctx = `dialog:${b.table}|${b.text}#${perTable[k]}`;
		await explore(p, pg, dctx, '#modal_overlay .modal', false);
		const closeId = await A('closeModal');
		if (closeId && closeId !== 'none') {
			const cp = await A('probe', closeId, closeId);
			const closeCtl = { kind: 'button', key: 'modal-close', label: 'Dismiss' };
			rec(pg, dctx, closeCtl, 'reachable', cp.ok, cp.why);
			if (!cp.ok) await shot(p, pg, closeCtl, { ...cp, x: cp.x ?? 20, y: cp.y ?? 20 });
			if (cp.ok) await p.mouse.click(cp.x, cp.y);
		}
		const closed = await p.waitForFunction(() => !window.__A.modalOpen(), null, { timeout: 3000 }).then(() => true).catch(() => false);
		if (!closed) { await p.evaluate(() => L.ui.hideModal()); await settle(p, 400); }
		await settle(p, 300);
	}
}

// Test all controls in root, clicking through every tab (deepest first so
// nested tab groups are visited while their parent pane is active).
async function explore(p, pg, ctx, root, withDialogs) {
	const A = (fn, ...args) => p.evaluate(([f, a]) => window.__A[f](...a), [fn, args]);
	const tested = new Set(), clickedTabs = new Set(), structSeen = new Set();
	for (let guard = 0; guard < 80; guard++) {
		// one control at a time, re-scanning each time: a change can make LuCI
		// re-render part of the form (e.g. switching protocol)
		for (let n = 0; n < 400; n++) {
			const c = (await A('controls', root)).find((x) => x.kind !== 'tab' && !tested.has(x.key));
			if (!c) break;
			tested.add(c.key);
			await testControl(p, pg, ctx, root, c, tested, 0);
		}
		for (const st of await A('structure', root)) {
			const k = `structure|${st.type}|${st.id}`;
			if (!structSeen.has(k)) { structSeen.add(k); rec(pg, ctx, { kind: 'structure', key: k.replace(/ \(\+\d+\)$/, ''), label: st.type }, st.type, false, st.id); }
		}
		if (withDialogs) await dialogs(p, pg);
		const tabs = (await A('controls', root)).filter((c) => c.kind === 'tab' && !clickedTabs.has(c.key));
		if (!tabs.length) break;
		const t = tabs[tabs.length - 1];
		clickedTabs.add(t.key);
		const pr = await A('probe', t.tid, t.id);
		rec(pg, ctx, t, 'reachable', pr.ok, pr.why);
		if (!pr.ok) continue;
		await p.mouse.click(pr.x, pr.y);
		await settle(p, 250);
		const tv = await A('tabPanelVisible', t.id);
		rec(pg, ctx, t, 'shows-its-pane', tv.ok, tv.why);
	}
}

module.exports = { HELPERS };
if (require.main === module) (async () => {
	const pages = (await (await fetch(BASE + '/__pages')).json()).filter((x) => !FILTER || new RegExp(FILTER).test(x.path));
	const browser = await chromium.launch();
	const context = await browser.newContext({ viewport: { width: VW, height: VH } });
	await context.addCookies([{ name: 'theme', value: THEME, url: BASE }]);
	const p = await context.newPage();
	p.on('dialog', (d) => d.dismiss());
	const errors = [];
	p.on('pageerror', (e) => errors.push(`${p.url()}: ${e.message.split('\n')[0]}`));

	for (const pgInfo of pages) {
		const pg = pgInfo.path;
		const t0 = Date.now();
		await p.goto(`${BASE}/cgi-bin/luci/${pg}`, { waitUntil: 'load' });
		await p.waitForFunction(() => { const v = document.getElementById('view'); return v && !v.querySelector(':scope > .spinning') && v.children.length > 0; }, null, { timeout: 10000 }).catch(() => {});
		await settle(p, 1300);   // let the theme's enhancers settle
		await p.evaluate(HELPERS);
		await explore(p, pg, 'page', '#view', true);

		const n = results.filter((r) => r.page === pg).length, f = results.filter((r) => r.page === pg && !r.ok).length;
		console.log(`${THEME} ${pg.padEnd(38)} checks=${String(n).padStart(4)} failed=${String(f).padStart(3)} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
	}
	fs.writeFileSync(OUT, JSON.stringify({ theme: THEME, viewport: [VW, VH], results, errors }, null, 1));
	await browser.close();
})();
