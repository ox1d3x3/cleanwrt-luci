// Network Map checks, run against the harness server (see run.sh):
//   node netmap.test.js <base-url> <out-dir>
// Renders the map with the mocked router (normal and access-point mode),
// on desktop and phone, light and dark, opens a device and saves a new name
// and icon, and checks the Bootstrap fallback. Exits non-zero on failure.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:8199';
const OUT = process.argv[3] || path.join(__dirname, '.work', 'netmap');
fs.mkdirSync(OUT, { recursive: true });

let failed = 0;
function check(name, ok, detail = '') {
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
	if (!ok) failed++;
}

async function open(browser, { theme = 'cleanx', vp = [1440, 900], scheme = 'light', scenario = 'router' } = {}) {
	await fetch(`${BASE}/__scenario?name=${scenario}`);
	const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, colorScheme: scheme });
	await ctx.addCookies([{ name: 'theme', value: theme, url: BASE }]);
	await ctx.addInitScript((m) => { try { localStorage.setItem('cleanx.theme', m); } catch (e) {} }, scheme);
	const page = await ctx.newPage();
	const errors = [], calls = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('request', (r) => {
		if (!r.url().includes('/ubus')) return;
		try { [].concat(JSON.parse(r.postData() || '[]')).forEach((m) => { if (m.params) calls.push({ object: m.params[1], method: m.params[2], args: m.params[3] || {} }); }); } catch (e) {}
	});
	await page.goto(`${BASE}/cgi-bin/luci/admin/cleanx-netmap`, { waitUntil: 'load' });
	return { ctx, page, errors, calls };
}

// wait until the map has rates (needs two samples)
async function ready(page) {
	await page.waitForSelector('.cx-nm-nets', { timeout: 15000 });
	// Wi-Fi station rates need two samples of the station list
	await page.waitForFunction(() => /bps/.test(document.querySelector('[data-stat="inet"]')?.textContent || '')
		&& /bps/.test(document.querySelector('[data-mac-rate="AA:BB:CC:DD:EE:02"]')?.textContent || ''), null, { timeout: 15000 });
}

const groups = (page) => page.$$eval('.cx-nm-net', (els) => els.map((e) => ({ id: e.dataset.net, devices: e.querySelectorAll('.cx-nm-dev').length })));

(async () => {
	const browser = await chromium.launch();

	// ---------------------------------------------------- router, desktop
	{
		const { ctx, page, errors, calls } = await open(browser);
		await ready(page);
		const g = await groups(page);
		check('networks listed', JSON.stringify(g.map((x) => x.id)) === JSON.stringify(['wifi:phy0-ap0', 'wifi:phy0-ap1', 'wifi:phy1-ap0', 'net:lan']), JSON.stringify(g));
		check('devices placed', JSON.stringify(g.map((x) => x.devices)) === JSON.stringify([2, 1, 4, 4]), JSON.stringify(g));
		check('Wi-Fi-only guest bridge not listed twice', !g.some((x) => x.id === 'net:guest'));
		const tv = await page.$eval('.cx-nm-dev[data-mac="F0:B4:29:11:22:33"]', (b) => ({ name: b.querySelector('.cx-nm-dev-name').textContent, cls: b.className }));
		check('saved name and icon applied', tv.name === 'Living room TV' && /cx-nm-t-tv/.test(tv.cls), JSON.stringify(tv));
		check('theme button styling leaves device tiles alone', !/cleanx-(enhanced-button|action-)/.test(tv.cls), tv.cls);
		const plug = await page.$eval('.cx-nm-dev[data-mac="24:0A:C4:11:22:33"]', (b) => b.className);
		check('device type detected', /cx-nm-t-iot/.test(plug), plug);
		const wired = await page.$eval('.cx-nm-dev[data-mac="B4:2E:99:10:20:30"] .cx-nm-dev-sub', (e) => e.textContent);
		check('wired device shows its LAN port', /lan2$/.test(wired), wired);
		const flows = await page.$$eval('[data-flow]', (els) => Object.fromEntries(els.map((e) => [e.dataset.flow, e.dataset.state])));
		check('busy links move, quiet links rest', flows.inet === 'is-high' && flows['wifi:phy0-ap0'] === 'is-low' && flows['wifi:phy0-ap1'] === 'is-idle' && flows['trunk:wifi:phy0-ap1'] === 'is-high', JSON.stringify(flows));
		const anim = await page.$eval('[data-flow="inet"]', (e) => getComputedStyle(e, '::after').animationName);
		check('active link animates', anim === 'cxNmFlowV', anim);
		const stats = await page.$$eval('[data-stat]', (els) => els.map((e) => e.textContent));
		check('summary cards filled', stats[0] === '11' && /Mbps/.test(stats[1]) && stats[2] === '3' && stats[3] === 'nas', JSON.stringify(stats));
		const nav = await page.$$eval('#topmenu > li > a', (as) => as.map((a) => a.textContent.trim()).filter((t) => t === 'Network Map'));
		check('sidebar lists Network Map once', nav.length === 1, String(nav.length));
		const active = await page.$eval('#topmenu > li.active > a', (a) => a.textContent.trim()).catch(() => '');
		check('sidebar marks Network Map active', active === 'Network Map', active);

		// one batched request per refresh: count /ubus POSTs over two refreshes
		let posts = 0;
		page.on('request', (r) => { if (r.url().includes('/ubus') && r.method() === 'POST') posts++; });
		await page.waitForTimeout(6500);   // mock interval is 3 s
		check('one request per refresh', posts >= 1 && posts <= 3, `${posts} requests in 6.5 s`);
		check('reads bridge port table', calls.some((c) => c.object === 'file' && c.method === 'read' && /brforward$/.test(c.args.path)));
		await page.screenshot({ path: path.join(OUT, 'router-desktop-light.png'), fullPage: true });

		// ------------------------------------------------ device dialog + save
		await page.focus('.cx-nm-dev[data-mac="AA:BB:CC:DD:EE:03"]');
		await page.keyboard.press('Enter');
		await page.waitForSelector('#modal_overlay .modal.cx-nm-modal', { state: 'visible', timeout: 4000 });
		check('device opens with the keyboard', true);
		const title = await page.$eval('#modal_overlay .modal h4', (e) => e.textContent);
		check('dialog titled with the device', title === 'phone', title);
		const animPaused = await page.$eval('[data-flow="inet"]', (e) => getComputedStyle(e, '::after').animationPlayState);
		check('links pause while the dialog is open', animPaused === 'paused', animPaused);
		await page.fill('#modal_overlay input.cbi-input-text', 'Kitchen phone');
		await page.click('#modal_overlay .cx-nm-pick[data-type="tablet"]');
		const sel = await page.$$eval('#modal_overlay .cx-nm-pick[aria-checked="true"]', (els) => els.map((e) => e.dataset.type));
		check('icon picker selects one icon', JSON.stringify(sel) === '["tablet"]', JSON.stringify(sel));
		const shown = await page.$eval('#modal_overlay .cx-nm-detail-tile', (e) => e.className);
		check('dialog previews the picked icon', /cx-nm-t-tablet/.test(shown), shown);
		await page.screenshot({ path: path.join(OUT, 'dialog-desktop-light.png') });
		const before = calls.length;
		await page.click('#modal_overlay .cbi-button-positive');
		await page.waitForSelector('#modal_overlay .modal.cx-nm-modal', { state: 'hidden', timeout: 5000 }).catch(() => {});
		const saved = calls.slice(before).filter((c) => c.object === 'uci');
		const v = (c) => c.args.values || {};
		const wrote = saved.find((c) => (c.method === 'add' || c.method === 'set') && c.args.config === 'cleanx' && v(c).name === 'Kitchen phone' && v(c).icon === 'tablet' && v(c).mac === 'AA:BB:CC:DD:EE:03');
		const named = saved.some((c) => c.method === 'add' ? c.args.type === 'host' && c.args.name === 'h_aabbccddee03' : c.args.section === 'h_aabbccddee03');
		const commit = saved.find((c) => c.method === 'commit' && c.args.config === 'cleanx');
		check('save writes the name and icon to /etc/config/cleanx', !!wrote && named && !!commit, JSON.stringify(saved.map((c) => c.method + ' ' + JSON.stringify(c.args))));
		// Enter in the name field saves too
		await page.click('.cx-nm-dev[data-mac="24:0A:C4:11:22:33"]');
		await page.waitForSelector('#modal_overlay .modal.cx-nm-modal', { state: 'visible', timeout: 4000 });
		const before2 = calls.length;
		await page.fill('#modal_overlay input.cbi-input-text', 'Kitchen plug');
		await page.press('#modal_overlay input.cbi-input-text', 'Enter');
		await page.waitForSelector('#modal_overlay .modal.cx-nm-modal', { state: 'hidden', timeout: 5000 }).catch(() => {});
		const saved2 = calls.slice(before2).filter((c) => c.object === 'uci');
		check('Enter in the name field saves', saved2.some((c) => c.method === 'add' && (c.args.values || {}).name === 'Kitchen plug' && !(c.args.values || {}).icon)
			&& saved2.some((c) => c.method === 'commit'), JSON.stringify(saved2.map((c) => c.method)));
		check('no page errors (router)', errors.length === 0, errors.join(' | '));
		await ctx.close();
	}

	// ---------------------------------------------- router, phone, dark mode
	{
		const { ctx, page, errors } = await open(browser, { vp: [390, 844], scheme: 'dark' });
		await ready(page);
		const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		check('phone: no sideways scrolling', over <= 0, `${over}px`);
		const cols = await page.$eval('.cx-nm-devs', (e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
		check('phone: one device per row', cols === 1, String(cols));
		const clipped = await page.$$eval('.cx-nm-dev', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }).length);
		check('phone: device tiles fit the screen', clipped === 0, String(clipped));
		await page.screenshot({ path: path.join(OUT, 'router-phone-dark.png'), fullPage: true });
		await page.click('.cx-nm-dev[data-mac="F0:B4:29:11:22:33"]');
		await page.waitForSelector('#modal_overlay .modal.cx-nm-modal', { state: 'visible' });
		const btn = await page.$eval('#modal_overlay .cbi-button-positive', (b) => { const r = b.getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth; });
		check('phone: dialog Save button reachable', btn);
		await page.screenshot({ path: path.join(OUT, 'dialog-phone-dark.png') });
		check('no page errors (phone)', errors.length === 0, errors.join(' | '));
		await ctx.close();
	}

	// ------------------------------------------------------- access point
	{
		const { ctx, page, errors } = await open(browser, { scenario: 'ap' });
		await ready(page);
		const top = await page.$eval('.cx-nm-inet .cx-nm-node-title strong', (e) => e.textContent);
		check('AP: top node is the main router', top === 'Main router', top);
		const role = await page.$eval('.cx-nm-router .cx-nm-pill', (e) => e.textContent);
		check('AP: this router is an access point', role === 'Access point', role);
		const up = await page.$$eval('.cx-nm-port.is-uplink', (els) => els.map((e) => e.textContent));
		check('AP: uplink port marked', JSON.stringify(up) === '["wan ↑"]', JSON.stringify(up));
		const macs = await page.$$eval('.cx-nm-dev', (els) => els.map((e) => e.dataset.mac));
		check('AP: hosts behind the main router not listed', !macs.includes('F4:92:BF:00:00:01') && !macs.includes('11:22:33:44:55:66'), String(macs.length));
		const g = await groups(page);
		check('AP: wired devices still placed by port', (g.find((x) => x.id === 'net:lan') || {}).devices === 4, JSON.stringify(g));
		await page.screenshot({ path: path.join(OUT, 'ap-desktop-light.png'), fullPage: true });
		check('no page errors (AP)', errors.length === 0, errors.join(' | '));
		await ctx.close();
		await fetch(`${BASE}/__scenario?name=router`);
	}

	// ------------------------------------------------------- WAN down
	{
		const { ctx, page, errors } = await open(browser, { scenario: 'offline' });
		await page.waitForSelector('.cx-nm-nets', { timeout: 15000 });
		await page.waitForTimeout(800);
		const st = await page.$eval('.cx-nm-inet', (e) => ({ down: e.classList.contains('is-down'), pill: e.querySelector('.cx-nm-pill').textContent }));
		check('offline: Internet shown as offline', st.down && st.pill === 'Offline', JSON.stringify(st));
		const link = await page.$eval('[data-flow="inet"]', (e) => e.dataset.state);
		check('offline: uplink drawn dashed', link === 'is-down', link);
		const stat = await page.$eval('[data-stat="inet"]', (e) => e.textContent);
		check('offline: summary says offline', stat === 'Offline', stat);
		const g = await groups(page);
		check('offline: local networks still listed', g.length === 4, JSON.stringify(g));
		await page.screenshot({ path: path.join(OUT, 'offline-desktop-light.png'), fullPage: true });
		check('no page errors (offline)', errors.length === 0, errors.join(' | '));
		await ctx.close();
		await fetch(`${BASE}/__scenario?name=router`);
	}

	// ----------------------------------- UniWRT installed alongside CleanX
	// UniWRT's Overview sorts before Status, so LuCI opens it first; under
	// CleanX it would render unstyled. CleanX must forward it and keep both
	// UniWRT-only pages out of its menu.
	{
		await fetch(`${BASE}/__coexist?on=1`);
		const { ctx, page, errors } = await open(browser);
		await page.waitForSelector('.cx-nm-nets', { timeout: 15000 });
		const nav = await page.$$eval('#topmenu > li > a', (as) => as.map((a) => a.textContent.trim()));
		check('UniWRT: its Overview and Network Map are not in CleanX\'s menu', nav.filter((t) => t === 'Overview' || t === 'Network Map').length === 1 && nav.includes('Network Map'), JSON.stringify(nav));
		const mob = await page.$$eval('#cleanx-mobile-list a', (as) => as.map((a) => a.getAttribute('href') || '')).catch(() => []);
		check('UniWRT: mobile menu leaves them out too', !mob.some((h) => /uniwrt-(overview|netmap)/.test(h)), JSON.stringify(mob.filter((h) => /uniwrt/.test(h))));
		for (const [from, to] of [['admin', 'admin/status/overview'], ['admin/uniwrt-overview', 'admin/status/overview'], ['admin/uniwrt-netmap', 'admin/cleanx-netmap']]) {
			await page.goto(`${BASE}/cgi-bin/luci/${from}`, { waitUntil: 'load' });
			await page.waitForURL(new RegExp(to.replace('/', '\\/') + '$'), { timeout: 5000 }).catch(() => {});
			const url = page.url().replace(/^.*\/cgi-bin\/luci\//, '');
			check(`UniWRT: /${from} opens CleanX's ${to}`, url === to, url);
		}
		const settings = await page.goto(`${BASE}/cgi-bin/luci/admin/system/uniwrt`, { waitUntil: 'load' }).then(() => page.url());
		check('UniWRT: its settings page is left alone', /admin\/system\/uniwrt$/.test(settings), settings);
		check('no page errors (UniWRT alongside)', errors.length === 0, errors.join(' | '));
		await ctx.close();
		await fetch(`${BASE}/__coexist?on=0`);
	}

	// ------------------------------------------------- another theme active
	{
		const { ctx, page, errors, calls } = await open(browser, { theme: 'bootstrap' });
		await page.waitForSelector('#view .cbi-map-descr', { timeout: 10000 });
		await page.waitForTimeout(1500);
		const msg = await page.$eval('#view .cbi-map-descr', (e) => e.textContent);
		check('Bootstrap: explains the map needs CleanX', /part of the CleanX theme/.test(msg), msg);
		check('Bootstrap: no polling', !calls.some((c) => c.object === 'luci-rpc' && c.method === 'getHostHints'));
		check('no page errors (Bootstrap)', errors.length === 0, errors.join(' | '));
		await ctx.close();
	}

	// --------------------------------------------------------- login page
	for (const [vp, scheme] of [[[1440, 900], 'light'], [[390, 844], 'dark']]) {
		const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, colorScheme: scheme });
		await ctx.addCookies([{ name: 'theme', value: 'cleanx', url: BASE }]);
		const page = await ctx.newPage();
		const errors = [];
		page.on('pageerror', (e) => errors.push(e.message));
		await page.goto(`${BASE}/cgi-bin/luci/__login`, { waitUntil: 'load' });
		await page.waitForTimeout(700);
		const st = await page.evaluate(() => {
			const card = document.querySelector('.cleanx-login-card'), r = card && card.getBoundingClientRect();
			return { card: !!card && r.width > 200 && r.right <= innerWidth && r.left >= 0, user: !!document.querySelector('#luci_username'), pass: !!document.querySelector('#luci_password'),
				focused: document.activeElement && document.activeElement.id, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
				moving: [...document.querySelectorAll('.cleanx-login-bg span')].filter((e) => getComputedStyle(e).animationName !== 'none').length };
		});
		check(`login (${vp[0]}px): sign-in form shown and fits`, st.card && st.user && st.pass && st.sideways <= 0, JSON.stringify(st));
		check(`login (${vp[0]}px): username field focused`, st.focused === 'luci_username', st.focused);
		check(`login (${vp[0]}px): background at rest (animations=balanced)`, st.moving === 0, String(st.moving));
		await page.screenshot({ path: path.join(OUT, `login-${vp[0]}-${scheme}.png`) });
		check(`no page errors (login ${vp[0]}px)`, errors.length === 0, errors.join(' | '));
		await ctx.close();
	}

	await browser.close();
	console.log(failed ? `NETMAP: ${failed} check(s) failed` : 'NETMAP: all checks passed');
	process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
