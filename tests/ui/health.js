// Page health: opens every LuCI page with stock LuCI (Bootstrap) and with
// CleanX and reports what goes wrong only with CleanX:
//   - JavaScript errors (uncaught exceptions and console errors)
//   - the page scrolling sideways at this viewport
//   - icons, images or graphics blown up to page size (unstyled SVGs)
//   - images that fail to load
//   - controls pushed off the right edge of the screen
//   - extra requests to the router while the page sits idle
//
//   node health.js <base-url> <out.json> [WxH] [page-filter-regex]
// Exits 1 if CleanX has a problem stock LuCI doesn't.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');

const [BASE, OUT, VP = '1440x900', FILTER = ''] = process.argv.slice(2);
const [W, H] = VP.split('x').map(Number);
const IDLE_MS = 12000;   // two LuCI poll intervals (5 s) plus margin

async function scan(browser, theme, pages) {
	const ctx = await browser.newContext({ viewport: { width: W, height: H } });
	await ctx.addCookies([{ name: 'theme', value: theme, url: BASE }]);
	const out = {};
	for (const pg of pages) {
		const p = await ctx.newPage();
		const errors = [];
		let requests = 0, counting = false;
		p.on('pageerror', (e) => errors.push('exception: ' + e.message.split('\n')[0]));
		p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text().split('\n')[0].slice(0, 160)); });
		p.on('request', (r) => { if (counting && r.url().includes('/ubus')) requests++; });
		const failed = [];
		p.on('response', (r) => { if (r.status() >= 400 && /\.(svg|png|gif|jpe?g|webp|css|js)(\?|$)/.test(r.url())) failed.push(r.status() + ' ' + r.url().replace(BASE, '').replace(/\?.*/, '')); });
		try {
			await p.goto(`${BASE}/cgi-bin/luci/${pg}`, { waitUntil: 'load', timeout: 30000 });
			await p.waitForTimeout(2500);
			counting = true;
			await p.waitForTimeout(IDLE_MS);
			counting = false;
			const dom = await p.evaluate(({ W, H }) => {
				const vis = (e) => { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
				const name = (e) => {
					let s = e.tagName.toLowerCase();
					if (e.id) s += '#' + e.id;
					else if (typeof e.className === 'string' && e.className.trim()) s += '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.');
					const host = e.closest('[id], .cbi-section, .cbi-map');
					return host && host !== e ? s + ' in ' + (host.id ? '#' + host.id : '.' + String(host.className).trim().split(/\s+/)[0]) : s;
				};
				const sideways = document.documentElement.scrollWidth - document.documentElement.clientWidth;
				const huge = [...document.querySelectorAll('#maincontent svg, #maincontent img, #view svg, #view img')].filter((e) => {
					if (!vis(e) || (e.tagName.toLowerCase() === 'svg' && e.parentElement && e.parentElement.closest('svg'))) return false;
					const r = e.getBoundingClientRect();
					/* graphs legitimately span the page (stock LuCI shows them as
					   big too, so they cancel out below); an icon must not */
					return r.width > Math.min(W * 0.6, 640) && r.height > Math.min(H * 0.5, 420);
				}).map((e) => name(e) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
				const broken = [...document.images].filter((i) => vis(i) && i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map((i) => i.getAttribute('src').replace(/\?.*/, ''));
				/* controls off the right edge, unless they sit in something that scrolls sideways */
				const scrolls = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const ox = getComputedStyle(a).overflowX; if ((ox === 'auto' || ox === 'scroll') && a.scrollWidth > a.clientWidth) return true; } return false; };
				const offRight = [...document.querySelectorAll('#maincontent button, #maincontent input:not([type=hidden]), #maincontent select, #maincontent .cbi-dropdown, #maincontent a.btn')]
					.filter((e) => vis(e) && e.getBoundingClientRect().right > window.innerWidth + 2 && !scrolls(e)).map(name);
				/* CleanX's sidebar must never scroll sideways (stock LuCI has none) */
				const side = document.querySelector('.cleanx-sidebar');
				const sidebarSideways = side ? side.scrollWidth - side.clientWidth : 0;
				return { sideways, sidebarSideways, huge, broken, offRight: [...new Set(offRight)].slice(0, 8) };
			}, { W, H });
			out[pg] = { errors: [...new Set(errors)], failed: [...new Set(failed)], requests, ...dom };
		} catch (e) {
			out[pg] = { errors: ['load: ' + e.message.split('\n')[0]], failed, requests, sideways: 0, huge: [], broken: [], offRight: [] };
		}
		await p.close();
		const r = out[pg];
		console.log(`${theme.padEnd(9)} ${pg.padEnd(40)} err=${r.errors.length} req=${r.requests} sideways=${r.sideways} huge=${r.huge.length} broken=${r.broken.length} offRight=${r.offRight.length}`);
	}
	await ctx.close();
	return out;
}

(async () => {
	const pages = (await (await fetch(`${BASE}/__pages`)).json()).map((p) => p.path).filter((p) => !FILTER || new RegExp(FILTER).test(p));
	const browser = await chromium.launch();
	const [bs, cx] = await Promise.all([scan(browser, 'bootstrap', pages), scan(browser, 'cleanx', pages)]);
	await browser.close();

	const problems = [];
	for (const pg of pages) {
		const b = bs[pg] || {}, c = cx[pg] || {};
		const key = (x) => x.replace(/ \d+x\d+$/, '');   /* sizes differ between themes */
		const only = (k) => (c[k] || []).filter((x) => !(b[k] || []).map(key).includes(key(x)));
		for (const e of only('errors')) problems.push(`${pg}: JavaScript error with CleanX only — ${e}`);
		for (const e of only('failed')) problems.push(`${pg}: file failed to load with CleanX only — ${e}`);
		for (const e of only('broken')) problems.push(`${pg}: broken image with CleanX only — ${e}`);
		for (const e of only('huge')) problems.push(`${pg}: oversized graphic with CleanX — ${e}`);
		for (const e of only('offRight')) problems.push(`${pg}: control off the right edge with CleanX — ${e}`);
		if (c.sideways > 1 && !(b.sideways > 1)) problems.push(`${pg}: page scrolls sideways with CleanX (${c.sideways}px)`);
		if (c.sidebarSideways > 1) problems.push(`${pg}: CleanX's sidebar scrolls sideways (${c.sidebarSideways}px)`);
		/* CleanX's own live pages poll on purpose; elsewhere it must not add router requests */
		const own = /^admin\/(status\/overview|cleanx-netmap)$/.test(pg);
		if (!own && c.requests > b.requests + 1) problems.push(`${pg}: ${c.requests} router requests while idle with CleanX vs ${b.requests} with stock LuCI`);
	}
	fs.writeFileSync(OUT, JSON.stringify({ viewport: VP, bootstrap: bs, cleanx: cx, problems }, null, 1));
	console.log(`\nPAGE HEALTH (${VP}): ${pages.length} pages, ${problems.length} CleanX-only problem(s)`);
	problems.forEach((p) => console.log('  - ' + p));
	process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
