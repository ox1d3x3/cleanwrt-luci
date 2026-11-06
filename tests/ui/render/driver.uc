// Renders a LuCI page exactly like luci-base's runtime: view.ut -> header.ut -> theme header ...
import { striptags, entityencode } from 'html';
const LOADFILE = loadfile, CALL = call, PROTO = proto, G = global;
const TPL = getenv('TPL'), theme = getenv('THEME'), view = getenv('VIEW');
const reqpath = filter(split(getenv('REQPATH'), '/'), length);
const resolved = filter(split(getenv('RESOLVED') ?? getenv('REQPATH'), '/'), length);
const title = getenv('TITLE');
const scope = {
	theme, view,
	media: `/luci-static/${theme}`, resource: '/luci-static/resources',
	http: {
		prepare_content: () => null,
		getenv: (k) => ({ SCRIPT_NAME: '/cgi-bin/luci', PATH_INFO: '/' + join('/', reqpath), DOCUMENT_ROOT: '/www' })[k],
	},
	ctx: { request_path: reqpath, path: resolved, authsession: 'mocksid', authtoken: 'mocktoken' },
	config: { main: {}, apply: {} },
	dispatcher: {
		lang: 'en',
		build_url: (...p) => '/cgi-bin/luci' + (length(p) ? '/' + join('/', p) : '/'),
		lookup: () => true,
		rollback_pending: () => null,
	},
	dispatched: { title, order: 1, action: { type: 'view', path: view }, satisfied: true, readonly: false },
	node: { title },
	version: { distname: 'OpenWrt', distversion: getenv('OWVER'), luciname: 'LuCI', luciversion: getenv('OWVER') },
	ubus: { call: (o, m) => (o == 'system' && m == 'board')
		? { hostname: 'OpenWrt', model: 'QEMU Standard PC (Q35 + ICH9, 2009)', rootfs_type: 'squashfs', release: { distribution: 'OpenWrt', version: getenv('OWVER') } } : null },
	_: (s) => s, striptags, entityencode,
	rollback_token: null, pkgs_update_time: 0, blank_page: (getenv('BLANK') == '1'),
	trigger_apply: false, trigger_revert: false, media_error: null, lua_active: false,
	css: null,
};
PROTO(scope, G);
scope.include = function(name, extra) {
	let fn = LOADFILE(`${TPL}/${name}.ut`, { raw_mode: false });
	CALL(fn, null, PROTO({ ...(extra ?? {}) }, scope));
};
scope.include(getenv('ENTRY') ?? 'view');
