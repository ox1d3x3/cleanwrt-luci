// LuCI harness server: renders real LuCI pages (ucode templates) for a given
// theme, serves real LuCI/theme assets, answers /ubus with the mock router and
// serves the menu tree built from menu.d like luci-base's dispatcher.
// Usage: node server.js <assembled-root> <port> <owver>
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(process.argv[2]);
const PORT = +process.argv[3] || 8080;
process.env.OWVER = process.argv[4] || '25.12.4';
const mock = require('./mock.js');

// ucode build directory (binary + modules); see tests/ui/setup.sh
const UC = path.resolve(process.env.UCODE_DIR || path.join(__dirname, '.work', 'ucode', 'b'));
const RENDER = path.join(__dirname, 'render');
const unknownCalls = new Map();

// ---------------------------------------------------------------- menu tree
const EXISTING = new Set(['/sbin/fw3', '/usr/sbin/odhcpd', '/usr/sbin/dnsmasq', '/usr/sbin/nft', '/usr/libexec/ip-full',
	'/usr/sbin/dropbear', '/usr/sbin/uhttpd', '/sbin/block', '/sys/class/leds']);
function fsOk(spec) {
	const one = (o) => Object.entries(o).every(([p, kind]) => (kind === 'absent') ? !EXISTING.has(p) : EXISTING.has(p));
	return Array.isArray(spec) ? spec.some(one) : one(spec);
}
function checkDepends(spec) {
	const d = spec.depends;
	if (!d) return true;
	if (d.fs && !fsOk(d.fs)) return false;
	if (d.uci) for (const c of Object.keys(d.uci)) if (!mock.UCI[c]) return false;
	return true;
}
// /__coexist?on=1 adds tests/ui/fixtures/uniwrt (UniWRT installed alongside)
const COEXIST = path.join(__dirname, 'fixtures', 'uniwrt');
let coexist = false;
function menuFiles() {
	const list = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ f, dir }));
	const files = list(path.join(ROOT, 'menu.d')).concat(coexist ? list(path.join(COEXIST, 'menu.d')) : []);
	return files.sort((a, b) => a.f.localeCompare(b.f));
}
function buildTree() {
	const tree = { action: { type: 'firstchild' } };
	for (const { f, dir } of menuFiles()) {
		const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
		for (const [p, spec] of Object.entries(data)) {
			let node = tree, wildcard = false;
			for (const s of p.split('/').filter(Boolean)) {
				if (s[0] === '*') { node.wildcard = true; wildcard = true; break; }
				node.children = node.children || {};
				node.children[s] = node.children[s] || { satisfied: true };
				node = node.children[s];
			}
			if (node === tree) continue;
			for (const k of ['auth', 'cors', 'depends', 'order', 'setgroup', 'setuser', 'title', 'wildcard', 'firstchild_ineligible'])
				if (spec[k] !== undefined) node[k] = spec[k];
			if (spec.action) { if (wildcard) node.wildcardaction = spec.action; else node.action = spec.action; }
			node.satisfied = checkDepends(spec);
		}
	}
	return tree;
}
let TREE = buildTree();
function menuJson(node) {
	const out = { ...node };
	delete out.depends; delete out.wildcardaction;
	if (node.children) {
		out.children = {};
		for (const [k, v] of Object.entries(node.children))
			out.children[k] = menuJson(v);
	}
	return out;
}
function lookup(parts) {
	let node = TREE;
	for (const p of parts) { if (!node.children || !node.children[p]) return null; node = node.children[p]; }
	return node;
}
function sortedChildren(node) {
	return Object.entries(node.children || {}).filter(([, v]) => v.satisfied !== false && v.title)
		.sort((a, b) => (a[1].order ?? 9999) - (b[1].order ?? 9999));
}
function resolve(parts) {
	for (let guard = 0; guard < 10; guard++) {
		const node = lookup(parts);
		if (!node) return null;
		const a = node.action || {};
		if (a.type === 'firstchild') { const c = sortedChildren(node)[0]; if (!c) return null; parts = [...parts, c[0]]; continue; }
		if (a.type === 'alias') { parts = a.path.split('/'); continue; }
		return { parts, node };
	}
	return null;
}

// ------------------------------------------------------------------ pages
function renderPage(parts, theme) {
	const r = resolve(parts);
	if (!r) return null;
	const a = r.node.action;
	// like LuCI: request_path is what was asked for, path the page it resolved to
	const env = { ...process.env, TPL: path.join(ROOT, 'tpl'), THEME: theme, REQPATH: parts.join('/'), RESOLVED: r.parts.join('/'), TITLE: r.node.title || '', LD_LIBRARY_PATH: UC };
	if (a.type === 'view') { env.VIEW = a.path; env.ENTRY = 'view'; }
	else if (a.type === 'template') { env.VIEW = ''; env.ENTRY = a.path; }
	else return null;
	return execFileSync(path.join(UC, 'ucode'), ['-L', path.join(RENDER, 'lib'), '-L', UC, path.join(RENDER, 'driver.uc')], { env, cwd: RENDER, maxBuffer: 1 << 24 }).toString();
}

// ------------------------------------------------------------------- ubus
function ubus(req) {
	const one = (r) => {
		if (r.method === 'list') return { jsonrpc: '2.0', id: r.id, result: [0, {}] };
		const [, object, method, args] = r.params;
		if (object === 'file' && method === 'list') {
			const dir = path.join(ROOT, (args && args.path) || '/');
			let entries = [];
			try { entries = fs.readdirSync(dir, { withFileTypes: true }).map((d) => ({ name: d.name, type: d.isDirectory() ? 'directory' : 'file', size: 100, mode: 33188, mtime: 0 })); } catch (_) {}
			return { jsonrpc: '2.0', id: r.id, result: [0, { entries }] };
		}
		const res = mock.call(object, method, args || {});
		if (!res) {
			const k = `${object}.${method}`;
			unknownCalls.set(k, (unknownCalls.get(k) || 0) + 1);
			return { jsonrpc: '2.0', id: r.id, result: [3] };
		}
		return { jsonrpc: '2.0', id: r.id, result: res.length > 1 ? res : [res[0]] };
	};
	return Array.isArray(req) ? req.map(one) : one(req);
}

// ------------------------------------------------------------------ http
const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.gif': 'image/gif', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
	const url = new URL(req.url, 'http://x');
	const cookieTheme = (/(?:^|; )theme=([a-z-]+)/.exec(req.headers.cookie || '') || [])[1];
	const theme = url.searchParams.get('theme') || cookieTheme || 'cleanx';
	const send = (code, type, body, extra = {}) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra }); res.end(body); };

	if (url.pathname.startsWith('/ubus')) {
		let body = '';
		req.on('data', (c) => body += c);
		req.on('end', () => {
			try { send(200, 'application/json', JSON.stringify(ubus(JSON.parse(body)))); }
			catch (e) { send(400, 'text/plain', String(e)); }
		});
		return;
	}
	if (url.pathname.startsWith('/cgi-bin/cgi-exec')) return send(200, 'text/plain', '');
	if (url.pathname === '/__unknown') return send(200, 'application/json', JSON.stringify(Object.fromEntries(unknownCalls)));
	if (url.pathname === '/__scenario') { mock.setScenario(url.searchParams.get('name')); return send(200, 'text/plain', 'ok'); }
	if (url.pathname === '/__coexist') { coexist = url.searchParams.get('on') === '1'; TREE = buildTree(); return send(200, 'text/plain', 'ok'); }
	if (url.pathname === '/__pages') {
		const pages = [];
		const walk = (node, parts) => {
			for (const [k, v] of sortedChildren(node)) {
				const p = [...parts, k];
				if (v.action && ['view', 'template'].includes(v.action.type)) pages.push({ path: p.join('/'), title: v.title, type: v.action.type, view: v.action.path });
				walk(v, p);
			}
		};
		walk(lookup(['admin']), ['admin']);
		return send(200, 'application/json', JSON.stringify(pages));
	}
	if (url.pathname.startsWith('/cgi-bin/luci')) {
		const parts = url.pathname.replace(/^\/cgi-bin\/luci\/?/, '').split('/').filter(Boolean);
		if (parts[0] === 'admin' && parts[1] === 'menu') return send(200, 'application/json', JSON.stringify(menuJson(TREE)));
		if (parts[0] === 'admin' && parts[1] === 'translations') return send(200, 'application/javascript', 'window.TR={};');
		if (parts[0] === 'admin' && parts[1] === 'uci') return send(200, 'application/json', '{}');
		if (parts[0] === '__login') {   // the login page, as LuCI shows it when signed out
			const env = { ...process.env, TPL: path.join(ROOT, 'tpl'), THEME: theme, REQPATH: 'admin', RESOLVED: 'admin', TITLE: '', VIEW: '', BLANK: '1', LD_LIBRARY_PATH: UC,
				ENTRY: fs.existsSync(path.join(ROOT, 'tpl', 'themes', theme, 'sysauth.ut')) ? `themes/${theme}/sysauth` : 'sysauth' };
			const html = execFileSync(path.join(UC, 'ucode'), ['-L', path.join(RENDER, 'lib'), '-L', UC, path.join(RENDER, 'driver.uc')], { env, cwd: RENDER, maxBuffer: 1 << 24 }).toString();
			return send(200, 'text/html; charset=UTF-8', html);
		}
		const html = renderPage(parts.length ? parts : ['admin'], theme);
		if (!html) return send(404, 'text/plain', 'no page');
		return send(200, 'text/html; charset=UTF-8', html, { 'Set-Cookie': `theme=${theme}; path=/` });
	}
	for (const base of coexist ? [ROOT, COEXIST] : [ROOT]) {
		const file = path.join(base, 'www', path.normalize(url.pathname));
		if (file.startsWith(path.join(base, 'www')) && fs.existsSync(file) && fs.statSync(file).isFile())
			return send(200, TYPES[path.extname(file)] || 'application/octet-stream', fs.readFileSync(file));
	}
	send(404, 'text/plain', 'not found');
}).listen(PORT, () => console.log(`harness ${ROOT} on :${PORT}`));
