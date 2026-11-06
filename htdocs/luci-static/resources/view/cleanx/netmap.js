'use strict';
'require view';
'require rpc';
'require poll';
'require ui';
'require uci';

/*
 * CleanX Network Map
 *
 * Internet -> router -> Wi-Fi networks / wired networks -> client devices,
 * drawn as a vertical tree in CleanX's card style. Links show live traffic,
 * devices get a type icon the user can override, and every device opens a
 * details dialog to rename it or pick another icon.
 *
 * When the router is an access point behind another router (its LAN bridge
 * holds the default route), the top node becomes "Main router" and wired
 * devices are placed from the bridge's forwarding table instead of by IP.
 *
 * Router cost stays at the level of LuCI's own Status pages: one batched
 * ubus request per refresh, only while this page is open and visible, using
 * data the router already keeps (DHCP leases, neighbour table, Wi-Fi
 * station list, interface counters). Layout, device detection, rate maths
 * and animation run in the browser. The connecting lines are plain CSS
 * (no measuring, no per-frame script); they only move while traffic flows.
 */

const callHints   = rpc.declare({ object: 'luci-rpc', method: 'getHostHints', expect: { '': {} } });
const callWifi    = rpc.declare({ object: 'luci-rpc', method: 'getWirelessDevices', expect: { '': {} } });
const callNetDevs = rpc.declare({ object: 'luci-rpc', method: 'getNetworkDevices', expect: { '': {} } });
const callBoard   = rpc.declare({ object: 'luci-rpc', method: 'getBoardJSON', expect: { '': {} } });
const callSystem  = rpc.declare({ object: 'system', method: 'board', expect: { '': {} } });
const callIfDump  = rpc.declare({ object: 'network.interface', method: 'dump', expect: { 'interface': [] } });
const callAssoc   = rpc.declare({ object: 'iwinfo', method: 'assoclist', params: [ 'device' ], expect: { results: [] } });
const callUfp     = rpc.declare({ object: 'fingerprint', method: 'fingerprint', expect: { '': {} } });
const callCommit  = rpc.declare({ object: 'uci', method: 'commit', params: [ 'config' ] });
/* errors must reject, so a refused read never looks like an empty table */
const callRead    = rpc.declare({ object: 'file', method: 'read', params: [ 'path', 'base64' ], expect: { data: '' }, reject: true });

/* ------------------------------------------------------------------ icons
 * Drawn for CleanX: 24px grid, round 2px strokes (stroke set in CSS). */
const ICONS = {
	phone:     '<rect x="7" y="2.5" width="10" height="19" rx="2.6"/><path d="M11 18.3h2"/>',
	tablet:    '<rect x="4.5" y="3" width="15" height="18" rx="2.6"/><path d="M11 17.8h2"/>',
	laptop:    '<rect x="4.5" y="5" width="15" height="10.5" rx="1.8"/><path d="M2.5 19h19"/>',
	desktop:   '<rect x="3" y="4" width="18" height="12" rx="2.2"/><path d="M12 16v4"/><path d="M8 20h8"/>',
	tv:        '<rect x="2.5" y="6" width="19" height="12.5" rx="2.4"/><path d="M8.5 2.5 12 6l3.5-3.5"/><path d="M8 21h8"/>',
	camera:    '<rect x="3" y="6" width="13" height="8" rx="2.2"/><path d="M16 9l5-2.5v7L16 11"/><path d="M7 14v4H4"/>',
	iot:       '<path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2v.2h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/><path d="M9.5 19h5"/><path d="M10.5 21.5h3"/>',
	speaker:   '<rect x="6" y="2.5" width="12" height="19" rx="3"/><circle cx="12" cy="14.5" r="3.4"/><path d="M12 7h.01"/>',
	printer:   '<path d="M7 9V3.5h10V9"/><rect x="3" y="9" width="18" height="8" rx="2.2"/><path d="M7 14h10v6.5H7z"/>',
	console:   '<path d="M6.5 8h11a4 4 0 0 1 3.9 4.8l-.8 3.7a2.3 2.3 0 0 1-4 1L15 16H9l-1.6 1.5a2.3 2.3 0 0 1-4-1l-.8-3.7A4 4 0 0 1 6.5 8z"/><path d="M8 11v3"/><path d="M6.5 12.5h3"/><path d="M15.5 11.5h.01"/><path d="M17.5 13.5h.01"/>',
	server:    '<rect x="4" y="3" width="16" height="8" rx="2.2"/><rect x="4" y="13" width="16" height="8" rx="2.2"/><path d="M8 7h.01"/><path d="M8 17h.01"/><path d="M12 7h4"/><path d="M12 17h4"/>',
	network:   '<rect x="2.5" y="13" width="19" height="7" rx="2.2"/><path d="M6.5 16.5h.01"/><path d="M10 16.5h.01"/><path d="M8.6 9.6a4.8 4.8 0 0 1 6.8 0"/><path d="M6 7a8.5 8.5 0 0 1 12 0"/>',
	watch:     '<rect x="6.5" y="6" width="11" height="12" rx="3"/><path d="M9 6l.7-3.5h4.6L15 6"/><path d="M9 18l.7 3.5h4.6L15 18"/><path d="M12 9.8v2.4l1.4 1"/>',
	appliance: '<rect x="4.5" y="2.5" width="15" height="19" rx="2.6"/><circle cx="12" cy="13.5" r="4.2"/><path d="M8 6h.01"/><path d="M11 6h5"/>',
	car:       '<path d="M5 17v-4l2-5.5A2 2 0 0 1 8.9 6h6.2a2 2 0 0 1 1.9 1.5L19 13v4"/><path d="M3.5 13h17"/><circle cx="8" cy="17" r="1.8"/><circle cx="16" cy="17" r="1.8"/>',
	generic:   '<rect x="5" y="3" width="14" height="18" rx="3.4"/><path d="M9 7h6"/><path d="M12 17h.01"/>',
	/* map nodes */
	internet:  '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>',
	router:    '<rect x="3" y="12.5" width="18" height="7" rx="2.2"/><path d="M7 16h.01"/><path d="M10.5 16h.01"/><path d="M14.5 16h3"/><path d="M8 12.5 6.6 5"/><path d="M16 12.5 17.4 5"/>',
	wifi:      '<path d="M5 12.6a10 10 0 0 1 14 0"/><path d="M2 9.3a14.5 14.5 0 0 1 20 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.6h.01"/>',
	wired:     '<path d="M5 9h14v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M8 9V5h8v4"/><path d="M9.5 13v2.5"/><path d="M12 13v2.5"/><path d="M14.5 13v2.5"/>',
	devices:   '<rect x="2.5" y="4" width="13" height="10" rx="1.8"/><path d="M1.5 17.5h11"/><rect x="16" y="8" width="6" height="12" rx="1.6"/>',
	activity:  '<path d="M3 12h4l3-8 4 16 3-8h4"/>'
};

const TYPES = [
	[ 'phone',     _('Phone') ],        [ 'tablet',    _('Tablet') ],      [ 'laptop',  _('Laptop') ],
	[ 'desktop',   _('Computer') ],     [ 'tv',        _('TV / Streamer') ], [ 'camera', _('Camera / CCTV') ],
	[ 'iot',       _('Smart device') ], [ 'speaker',   _('Speaker') ],     [ 'printer', _('Printer') ],
	[ 'console',   _('Game console') ], [ 'server',    _('Server / NAS') ], [ 'network', _('Access point / Switch') ],
	[ 'watch',     _('Watch') ],        [ 'appliance', _('Appliance') ],   [ 'car',     _('Car') ],
	[ 'generic',   _('Other') ]
];
const TYPE_NAME = {};
TYPES.forEach((t) => { TYPE_NAME[t[0]] = t[1]; });

function icon(name, cls) {
	const span = E('span', { 'class': 'cx-nm-ico' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
	span.innerHTML = '<svg viewBox="0 0 24 24" focusable="false">' + (ICONS[name] || ICONS.generic) + '</svg>';   /* static markup from this file only */
	return span;
}

/* ------------------------------------------------------- device detection
 * Best guess, cheapest signal first, always explainable and overridable.
 * Order: user choice > ufp (if installed) > hostname > maker prefix >
 * private (randomised) Wi-Fi MAC > connection type. */
const NAME_RULES = [
	[ 'console',   /playstation|\bps[345]\b|ps[345][-_ ]|xbox|nintendo|\bswitch[-_ ]?(oled|lite)?$|steam[-_ ]?deck/i ],
	[ 'tablet',    /ipad|galaxy[-_ ]?tab|[-_ ]tab[-_ ]|[-_]tab$|kindle|fire[-_ ]?hd|lenovo[-_ ]?tab|mipad|matepad/i ],
	[ 'watch',     /watch/i ],
	[ 'phone',     /iphone|android|galaxy|pixel|oneplus|redmi|xiaomi|poco|huawei|honor|oppo|vivo|realme|nokia|motorola|moto[-_ ]?g|nothing[-_ ]?phone|\bsm-[a-z]\d/i ],
	[ 'laptop',    /macbook|laptop|notebook|thinkpad|xps|zenbook|vivobook|ideapad|yoga|elitebook|probook|latitude|surface|chromebook/i ],
	[ 'tv',        /\btv\b|[-_]tv|tv[-_]|bravia|webos|tizen|roku|chromecast|fire[-_ ]?tv|firestick|shield|apple[-_ ]?tv|mibox|google[-_ ]?tv/i ],
	[ 'camera',    /\bcam|cam\b|camera|\bipc|nvr|dvr|hikvision|dahua|reolink|ezviz|wyze|blink|arlo|imou|annke|amcrest|tapo[-_ ]?c\d|\bds-\d/i ],
	[ 'speaker',   /echo|alexa|google[-_ ]?home|nest[-_ ]?(mini|audio|hub)|homepod|sonos|speaker/i ],
	[ 'printer',   /printer|epson|brother|canon|laserjet|deskjet|officejet|envy|^hp[0-9a-f]{6}|^npi[0-9a-f]/i ],
	[ 'server',    /\bnas\b|^nas$|synology|diskstation|qnap|truenas|unraid|server|proxmox|\bpve\b|zima|casaos|raspberrypi|pi[-_ ]?hole|homeassistant|home[-_ ]?assistant|ubuntu|debian/i ],
	[ 'iot',       /^esp[-_]|espressif|tasmota|shelly|tuya|sonoff|smart[-_ ]?plug|[-_]plug|bulb|lamp|light|hue|yeelight|kasa|meross|wled|zigbee|thermostat|doorbell|sensor/i ],
	[ 'appliance', /fridge|refrigerator|washer|washing|dryer|dishwasher|oven|aircon|air[-_ ]?con|vacuum|roborock|roomba|dreame|ecovacs|purifier/i ],
	[ 'car',       /tesla|\bcar\b|vehicle/i ],
	[ 'network',   /access[-_ ]?point|\bap\b|router|\buap\b|openwrt|mesh|deco|eero|repeater|extender|switch/i ],
	[ 'desktop',   /^desktop-|^pc-|-pc$|imac|mac[-_ ]?mini|mac[-_ ]?studio|workstation|^win-/i ]
];
/* A few high-confidence maker prefixes; a full OUI database would not fit. */
const OUI = {
	iot:     [ '240AC4','246F28','30AEA4','3C71BF','7C9EBD','84F3EB','8CAAB5','A4CF12','BCDDC2','C82B96','CC50E3','DC4F22','ECFABC','483FDA','E8DB84','349454','441793','58BF25','083AF2','10521C','40225D','94B97E','A842E3','C44F33','E05A1B','001788','ECB5FA' ],
	server:  [ 'B827EB','DCA632','E45F01','D83ADD','2CCF67','001132' ],
	camera:  [ '2857BE','4419B6','4CBD8F','BCAD28','C056E3','E0CA3C','54C415','3CEF8C','4C11BF','9002A9','A0BD1D','E0508B' ],
	speaker: [ '000E58','5CAAFD','7828CA','949F3E','B8E937','48A6B8','347E5C' ],
	tv:      [ 'B0A737','D83134','CC6DA0','080581','AC3A7A','DC3A5E' ],
	console: [ '98B6E9','7CBB8A','0403D6','582F40','E84ECE','34AF2C' ],
	network: [ '24A43C','44D9E7','687251','7483C2','788A20','802AA8','B4FBE4','DC9FDB','F09FC2','FCECDA','E063DA','18E829' ]
};
const OUI_MAP = {};
Object.keys(OUI).forEach((t) => { OUI[t].forEach((p) => { OUI_MAP[p] = t; }); });

function isPrivateMac(mac) { return (parseInt(mac.substr(0, 2), 16) & 2) === 2; }

function classify(c, ufp) {
	const n = c.name || '';
	if (ufp) {
		const hay = [ ufp.class, ufp.device, ufp.vendor, ufp.os, ufp.type ].filter(Boolean).join(' ');
		for (let i = 0; hay && i < NAME_RULES.length; i++)
			if (NAME_RULES[i][1].test(hay)) return [ NAME_RULES[i][0], _('device fingerprint') ];
	}
	for (let j = 0; n && j < NAME_RULES.length; j++)
		if (NAME_RULES[j][1].test(n)) return [ NAME_RULES[j][0], _('device name “%s”').format(n) ];
	const oui = OUI_MAP[c.mac.replace(/:/g, '').substr(0, 6).toUpperCase()];
	if (oui) return [ oui, _('hardware maker') ];
	if (c.wifi && isPrivateMac(c.mac)) return [ 'phone', _('private Wi-Fi address (typical of phones)') ];
	return c.wifi ? [ 'laptop', _('Wi-Fi device') ] : [ 'desktop', _('wired device') ];
}

/* ---------------------------------------------------------------- helpers */
const ACTIVE = 8000;   /* bit/s; below this a link counts as idle */

function fmtRate(bps) {
	if (bps == null) return '–';
	if (bps >= 1e9) return (bps / 1e9).toFixed(1) + ' Gbps';
	if (bps >= 1e6) return (bps / 1e6).toFixed(bps >= 1e8 ? 0 : 1) + ' Mbps';
	if (bps >= 1e3) return Math.round(bps / 1e3) + ' kbps';
	return Math.round(bps) + ' bps';
}
function fmtDur(s) {
	if (!s && s !== 0) return '–';
	const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
	return (d ? d + 'd ' : '') + (d || h ? h + 'h ' : '') + m + 'm';
}
function bars(dbm) { return dbm >= -55 ? 4 : dbm >= -65 ? 3 : dbm >= -75 ? 2 : 1; }
function bandName(radio) {
	const b = (radio.config || {}).band || '';
	if (b === '2g') return '2.4 GHz';
	if (b === '5g') return '5 GHz';
	if (b === '6g') return '6 GHz';
	if (b === '60g') return '60 GHz';
	const ch = +((radio.config || {}).channel || 0);
	return ch > 0 && ch <= 14 ? '2.4 GHz' : ch > 14 ? '5 GHz' : _('Wi-Fi');
}
function ip4ToInt(ip) { const p = String(ip).split('.'); return p.length === 4 ? ((+p[0] << 24) >>> 0) + (+p[1] << 16) + (+p[2] << 8) + (+p[3]) : null; }
function inSubnet(ip, net, mask) {
	const a = ip4ToInt(ip), b = ip4ToInt(net);
	if (a == null || b == null) return false;
	const m = mask === 0 ? 0 : (0xffffffff << (32 - mask)) >>> 0;
	return ((a & m) >>> 0) === ((b & m) >>> 0);
}
/* /sys/class/net/<bridge>/brforward: 16-byte struct __fdb_entry records
   (mac[6], port_no, is_local, ageing u32, port_hi, pad...). Returns
   { MAC: portName } for learned (non-local) entries on known ports. */
function parseFdb(b64, portNames) {
	if (!b64 || !/^[A-Za-z0-9+\/=\s]+$/.test(b64)) return null;
	let bin;
	try { bin = atob(b64.replace(/\s+/g, '')); } catch (e) { return null; }
	const out = {};
	for (let i = 0; i + 16 <= bin.length; i += 16) {
		if (bin.charCodeAt(i + 7)) continue;   /* the bridge's own addresses */
		const port = portNames[(bin.charCodeAt(i + 12) << 8) | bin.charCodeAt(i + 6)];
		if (!port) continue;
		const mac = [];
		for (let j = 0; j < 6; j++) mac.push(('0' + bin.charCodeAt(i + j).toString(16)).slice(-2));
		out[mac.join(':').toUpperCase()] = port;
	}
	return out;
}
const WIFI_IF = /^(wl|phy|wlan|ath|ra|rai|apcli|mon)\d/;

function flowClass(bps, down) {
	if (down) return 'is-down';
	if (!bps || bps < ACTIVE) return 'is-idle';
	if (bps < 1e6) return 'is-low';
	if (bps < 2e7) return 'is-mid';
	return 'is-high';
}
/* header pills: nothing until the first rate is known, then Idle or the rate */
function pillText(bps) { return bps == null ? '' : bps < ACTIVE ? _('Idle') : fmtRate(bps); }
function ratePill(key, bps, show) {
	return E('span', { 'class': 'cx-nm-rate' + (bps != null && bps < ACTIVE ? ' is-idle' : ''), 'data-rate': key }, [ show ? pillText(bps) : '' ]);
}
function meterPct(bps) {   /* same scale as the Overview dashboard: 1 Mbps = 1% */
	return Math.max(4, Math.min(100, (bps || 0) / 1e6));
}
function networksOf(cfg) {
	const n = cfg.network;
	return (Array.isArray(n) ? n : String(n || '').split(/\s+/)).filter(Boolean);
}

return view.extend({
	interval: 5,
	prev: {},       /* byte counters from the previous refresh, for rates */
	wifiIfs: [],    /* AP interface names learned on the previous refresh */
	sig: '',        /* topology signature: rebuild DOM only when it changes */
	ufp: null,
	tick: 0,
	fdbBridges: [], /* bridges with wired ports whose forwarding table we read */
	brPorts: {},    /* bridge -> its wired member ports */
	portNo: {},     /* bridge -> { port number: port name } (read once) */
	portSig: {},
	fdbSeen: {},    /* MAC -> { br, port, t }: wired placements, kept a while */
	fdbOk: {},      /* bridge -> true once a forwarding table was read */
	fdbMiss: {},    /* bridge -> failed reads before the first success */

	load: function() {
		return Promise.all([
			uci.load('cleanx').catch(() => {}),
			L.resolveDefault(callBoard(), {}),
			L.resolveDefault(callSystem(), {})
		]);
	},

	/* Device names and icons the user chose (config host sections in
	   /etc/config/cleanx), by MAC address. */
	overrides: function() {
		const o = {};
		let hosts = [];
		try { hosts = uci.sections('cleanx', 'host') || []; } catch (e) {}
		hosts.forEach((s) => {
			if (s.mac) o[s.mac.toUpperCase()] = { icon: s.icon || null, name: s.name || null, sid: s['.name'] };
		});
		return o;
	},

	fetch: function() {
		const self = this, assoc = {}, fdb = {};
		const calls = [
			L.resolveDefault(callHints(), {}),
			L.resolveDefault(callWifi(), {}),
			L.resolveDefault(callNetDevs(), {}),
			L.resolveDefault(callIfDump(), [])
		];
		/* everything below joins the same batched request */
		/* station lists for the AP interfaces we already know */
		self.wifiIfs.forEach((ifn) => {
			calls.push(L.resolveDefault(callAssoc(ifn), []).then((r) => { assoc[ifn] = r || []; }));
		});
		/* bridge forwarding tables (one small kernel read per bridge) tell
		   which LAN port each wired device sits behind; port numbers are
		   read once per bridge layout */
		self.fdbBridges.forEach((br) => {
			if (!self.fdbOk[br] && self.fdbMiss[br] >= 3) return;   /* not readable here: stop asking */
			const ports = self.brPorts[br] || [], sig = ports.join(' ');
			if (self.portSig[br] !== sig) {
				self.portSig[br] = sig;
				const names = {};
				calls.push(Promise.all(ports.map((p) =>
					L.resolveDefault(callRead('/sys/class/net/' + p + '/brport/port_no'), '').then((v) => {
						const n = parseInt(v, 16); if (!isNaN(n)) names[n] = p;
					})
				)).then(() => { self.portNo[br] = names; }));
			}
			calls.push(L.resolveDefault(callRead('/sys/class/net/' + br + '/brforward', true), null).then((v) => { fdb[br] = v; }));
		});
		/* optional fingerprinting service, if the user installed it — rarely */
		if (L.hasSystemFeature('ufpd') && self.tick % 12 === 0)
			calls.push(L.resolveDefault(callUfp(), {}).then((r) => { self.ufp = r; }));
		self.tick++;
		return Promise.all(calls).then((r) => ({ hints: r[0], wifi: r[1], devs: r[2], ifaces: r[3], assoc: assoc, fdb: fdb, t: Date.now() / 1000 }));
	},

	/* bit/s since the previous sample; asking again for the same sample
	   (a rebuild after renaming a device) returns the same answer */
	rate: function(key, bytes, t) {
		const p = this.prev[key];
		if (p && p.t === t) return p.r;
		let r = null;
		if (p && t > p.t && bytes >= p.b) r = (bytes - p.b) * 8 / (t - p.t);
		this.prev[key] = { b: bytes, t: t, r: r };
		return r;
	},

	model: function(d) {
		const self = this, ov = this.overrides(), ufp = this.ufp || {}, board = this.board || {};
		const devs = d.devs || {}, t = d.t;

		/* WAN = the interface holding the default route; the rest with IPv4
		   are local networks. If the default route sits on a bridge that has
		   LAN ports or Wi-Fi in it, this router is an access point behind a
		   main router: that bridge is the uplink AND a local network. */
		let wan = null, ap = false, gw = null;
		const nets = [];
		(d.ifaces || []).forEach((i) => {
			if (i.interface === 'loopback' || !i.up) return;
			const def = (i.route || []).filter((r) => r.target === '0.0.0.0' && r.mask === 0)[0];
			const dev = i.l3_device || i.device, dd = devs[dev] || {}, bp = dd.ports || [];
			const lanBridge = !!dd.bridge && (bp.length > 1 || bp.some((p) => (devs[p] || {}).wireless || WIFI_IF.test(p)));
			if (def && !wan) { wan = i; gw = def.nexthop || null; ap = lanBridge; }
			if (def && !lanBridge) return;
			(i['ipv4-address'] || []).forEach((a) => { nets.push({ name: i.interface, addr: a.address, mask: a.mask, dev: dev, uplink: !!def }); });
		});

		const ownMacs = {};
		Object.keys(devs).forEach((k) => { if (devs[k].mac) ownMacs[devs[k].mac.toUpperCase()] = true; });

		/* bridges worth a forwarding-table read: local networks with wired ports */
		const fdbBridges = [], brPorts = {};
		nets.forEach((n) => {
			const dd = devs[n.dev] || {};
			if (!dd.bridge || brPorts[n.dev]) return;
			const wiredPorts = (dd.ports || []).filter((p) => !(devs[p] || {}).wireless && !WIFI_IF.test(p));
			if (wiredPorts.length) { brPorts[n.dev] = wiredPorts; fdbBridges.push(n.dev); }
		});
		self.fdbBridges = fdbBridges; self.brPorts = brPorts;
		fdbBridges.forEach((br) => {
			if (!d.fdb || !(br in d.fdb)) return;
			const raw = d.fdb[br];   /* null = read refused/failed, '' = empty table */
			const tbl = raw === '' ? {} : self.portNo[br] && Object.keys(self.portNo[br]).length ? parseFdb(raw, self.portNo[br]) : null;
			if (!tbl) { self.fdbMiss[br] = (self.fdbMiss[br] || 0) + 1; return; }
			self.fdbOk[br] = true;
			Object.keys(tbl).forEach((mac) => { self.fdbSeen[mac] = { br: br, port: tbl[mac], t: t }; });
		});
		/* the kernel forgets quiet devices after 5 min; keep them 5 min more */
		Object.keys(self.fdbSeen).forEach((mac) => { if (t - self.fdbSeen[mac].t > 600) delete self.fdbSeen[mac]; });

		/* in access-point mode the uplink is the LAN port the main router sits behind */
		let uplinkPort = null;
		if (ap) {
			const wb = wan.l3_device || wan.device;
			Object.keys(d.hints || {}).some((m) => {
				const h = d.hints[m];
				if (gw && (h.ipaddrs || []).indexOf(gw) >= 0) { const f = self.fdbSeen[m.toUpperCase()]; if (f && f.br === wb) uplinkPort = f.port; return true; }
				return false;
			});
			if (!uplinkPort && (brPorts[wb] || []).indexOf('wan') >= 0) uplinkPort = 'wan';
		}

		const wanDev = ap ? (uplinkPort ? devs[uplinkPort] : null) : wan ? devs[wan.l3_device || wan.device] : null;
		let wanRx = null, wanTx = null;
		if (wanDev && wanDev.stats) {
			wanRx = self.rate('wan:rx', wanDev.stats.rx_bytes || 0, t);
			wanTx = self.rate('wan:tx', wanDev.stats.tx_bytes || 0, t);
		}
		const wanRate = wanRx == null && wanTx == null ? null : (wanRx || 0) + (wanTx || 0);

		/* Wi-Fi networks (AP interfaces) and their stations */
		const groups = [], seen = {}, ifs = [];
		let radios = 0, radiosUp = 0;
		Object.keys(d.wifi || {}).sort().forEach((rname) => {
			const radio = d.wifi[rname];
			radios++;
			if (radio.up !== false && !(radio.config || {}).disabled) radiosUp++;
			(radio.interfaces || []).forEach((w) => {
				const cfg = w.config || {};
				if (!w.ifname || (cfg.mode && cfg.mode !== 'ap')) return;
				ifs.push(w.ifname);
				const g = { id: 'wifi:' + w.ifname, kind: 'wifi', title: cfg.ssid || (w.iwinfo || {}).ssid || w.ifname,
				            band: bandName(radio), nets: networksOf(cfg), open: !cfg.encryption || cfg.encryption === 'none',
				            up: radio.up !== false && !cfg.disabled && !(radio.config || {}).disabled, clients: [], rate: 0 };
				(d.assoc[w.ifname] || []).forEach((s) => {
					const mac = String(s.mac).toUpperCase();
					const bytes = ((s.rx || {}).bytes || 0) + ((s.tx || {}).bytes || 0);
					const r = self.rate('sta:' + mac, bytes, t);
					seen[mac] = true;
					g.clients.push({ mac: mac, wifi: true, signal: s.signal, conn: s.connected_time, inactive: s.inactive,
					                 txr: (s.tx || {}).rate, rxr: (s.rx || {}).rate, rate: r });
					g.rate += r || 0;
				});
				groups.push(g);
			});
		});
		self.wifiIfs = ifs;

		/* wired networks: hosts in a local subnet that aren't Wi-Fi stations or the router itself */
		const wired = {};
		nets.forEach((n) => {
			if (wired[n.name]) return;
			const dev = devs[n.dev] || {};
			/* the board's LAN ports, plus any other port bridged in (the WAN
			   port of an access point, say) */
			const ports = Array.from(new Set([].concat(((board.network || {})[n.name] || {}).ports || [], dev.ports || [])));
			const portRate = {};
			let rate = 0;
			ports.forEach((p) => {
				const pd = devs[p];
				if (!pd || !pd.stats || pd.wireless) return;
				portRate[p] = self.rate('port:' + p, (pd.stats.rx_bytes || 0) + (pd.stats.tx_bytes || 0), t) || 0;
				if (p !== uplinkPort) rate += portRate[p];   /* uplink traffic is already the top link */
			});
			wired[n.name] = { id: 'net:' + n.name, kind: 'wired', title: n.name === 'lan' ? _('LAN') : n.name.toUpperCase(),
			                  subnet: n.addr + '/' + n.mask, up: true, clients: [], rate: rate, portRate: portRate, br: n.dev, bridge: !!dev.bridge,
			                  note: ap && n.uplink && !self.fdbOk[n.dev] && self.tick > 2 ? _('Wired devices can’t be listed here: this firmware does not let the map read the LAN bridge’s port table.') : null,
			                  ports: ports.filter((p) => { const pd = devs[p]; return pd && !pd.wireless && !WIFI_IF.test(p); })
			                              .map((p) => { const pd = devs[p]; return { name: p, uplink: p === uplinkPort, up: pd.link ? !!pd.link.carrier : !!pd.up, speed: pd.link && pd.link.speed }; }) };
		});

		const clients = {};
		Object.keys(d.hints || {}).forEach((m) => {
			const mac = m.toUpperCase(), h = d.hints[m];
			if (ownMacs[mac]) return;
			const ip = (h.ipaddrs || [])[0];
			let net = null;
			for (let i = 0; i < nets.length && ip; i++) if (inSubnet(ip, nets[i].addr, nets[i].mask)) { net = nets[i].name; break; }
			clients[mac] = { name: h.name || null, ips: h.ipaddrs || [], ip6s: h.ip6addrs || [], net: net };
		});

		/* wired devices: placed by the bridge's port table when we have it;
		   otherwise (routed networks only) by IP subnet, as LuCI itself does */
		const placed = {};
		Object.keys(wired).forEach((k) => {
			const g = wired[k];
			Object.keys(self.fdbSeen).forEach((mac) => {
				const f = self.fdbSeen[mac];
				if (f.br !== g.br || f.port === uplinkPort || seen[mac] || ownMacs[mac] || placed[mac]) return;
				placed[mac] = true;
				g.clients.push({ mac: mac, wifi: false, port: f.port });
			});
		});
		Object.keys(clients).forEach((mac) => {
			const net = clients[mac].net, g = net && wired[net];
			/* hosts on the uplink network may be anywhere behind the main router */
			if (!g || seen[mac] || placed[mac] || ownMacs[mac] || nets.some((n) => n.name === net && n.uplink)) return;
			placed[mac] = true;
			g.clients.push({ mac: mac, wifi: false });
		});
		Object.keys(wired).forEach((k) => {
			const g = wired[k], perPort = {};
			g.clients.forEach((c) => { if (c.port) perPort[c.port] = (perPort[c.port] || 0) + 1; });
			/* a port with a single device behind it: that port's traffic is the device's */
			g.clients.forEach((c) => { if (c.port && perPort[c.port] === 1 && g.portRate[c.port] != null) c.rate = g.portRate[c.port]; });
			/* a bridge of Wi-Fi interfaces only (a guest network, say) is already
			   shown as its Wi-Fi card; list it again only if wired hosts appear */
			if (g.bridge && !g.ports.length && !g.clients.length) return;
			groups.push(g);
		});

		/* fill in names, icons and labels */
		let total = 0, nwifi = 0, top = null;
		groups.forEach((g) => {
			g.clients.forEach((c) => {
				const h = clients[c.mac] || {}, o = ov[c.mac] || {};
				c.host = h.name; c.ips = h.ips || []; c.ip6s = h.ip6s || [];
				const guess = classify({ mac: c.mac, name: h.name, wifi: c.wifi }, ufp[c.mac] || ufp[c.mac.toLowerCase()]);
				c.auto = guess[0]; c.reason = guess[1];
				c.type = o.icon && ICONS[o.icon] && TYPE_NAME[o.icon] ? o.icon : c.auto;
				c.custom = !!(o.icon && TYPE_NAME[o.icon]);
				c.label = o.name || h.name || c.ips[0] || c.mac;
				c.customName = o.name || '';
				c.sid = o.sid || null;
				total++; if (c.wifi) nwifi++;
				if (c.rate >= ACTIVE && (!top || c.rate > top.rate)) top = c;
			});
			/* a stable order (by name), so tiles don't jump around as traffic changes */
			g.clients.sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }) || a.mac.localeCompare(b.mac));
		});

		/* each trunk segment carries the traffic of every network below it */
		let below = 0;
		for (let i = groups.length - 1; i >= 0; i--) { below += groups[i].up ? groups[i].rate || 0 : 0; groups[i].trunk = below; }

		const lanTotal = groups.reduce((s, g) => s + (g.rate || 0), 0);
		return { wan: wan, wanRate: wanRate, wanRx: wanRx, wanTx: wanTx, groups: groups, total: total, nwifi: nwifi,
		         ap: ap, gw: gw, uplinkPort: uplinkPort, top: top, lanTotal: lanTotal,
		         ssids: groups.filter((g) => g.kind === 'wifi').length, radios: radios, radiosUp: radiosUp };
	},

	/* --------------------------------------------------------------- render */
	render: function(data) {
		const self = this;
		const head = [ E('h2', {}, [ _('Network Map') ]) ];

		/* the map's styles ship with the CleanX theme; under another theme,
		   say so instead of drawing an unstyled page (and poll nothing) */
		if (!document.querySelector('link[rel="stylesheet"][href*="/cleanx/main.css"]'))
			return E('div', {}, head.concat([ E('div', { 'class': 'cbi-map-descr' }, [
				_('The Network Map is part of the CleanX theme. Switch to CleanX under System → System → Language and Style to use it.') ]) ]));

		this.board = data[2] || {};
		this.sysboard = data[3] || {};
		const iv = parseInt(uci.get('cleanx', 'theme', 'netmap_interval'), 10);
		this.interval = isNaN(iv) ? 5 : Math.min(60, Math.max(3, iv));   /* 3–60 s; junk → default */
		const still = uci.get('cleanx', 'theme', 'animations') === 'off';

		this.tree = E('div', { 'class': 'cx-nm-tree', 'aria-live': 'off' }, [
			E('div', { 'class': 'cx-nm-loading' }, [ E('span', { 'class': 'cx-nm-spinner', 'aria-hidden': 'true' }), _('Collecting data…') ])
		]);
		this.root = E('div', { 'class': 'cx-nm' + (still ? ' cx-nm-still' : '') }, [
			this.statGrid(),
			E('div', { 'class': 'cx-nm-bar' }, [
				E('div', { 'class': 'cx-nm-bar-title' }, [
					E('span', { 'class': 'cx-nm-eyebrow' }, [ _('Topology') ]),
					E('span', { 'class': 'cx-nm-live' }, [ E('i', { 'aria-hidden': 'true' }), _('Live · every %d s').format(this.interval) ])
				]),
				E('div', { 'class': 'cx-nm-legend', 'aria-hidden': 'true' }, [
					E('span', { 'class': 'cx-nm-key cx-nm-key-on' }, [ _('Active') ]),
					E('span', { 'class': 'cx-nm-key' }, [ _('Idle') ]),
					E('span', { 'class': 'cx-nm-key cx-nm-key-down' }, [ _('Offline') ])
				])
			]),
			this.tree
		]);

		const refresh = () => {
			if (document.hidden) return Promise.resolve();   /* no router work while the tab is hidden */
			return self.fetch().then((d) => {
				/* the first refresh learns the AP interfaces; fetch their stations right away */
				if (!self.learned) {
					self.learned = true;
					self.model(d);
					if (self.wifiIfs.length || self.fdbBridges.length) return self.fetch();
				}
				return d;
			}).then((d) => { self.lastData = d; self.update(self.model(d)); })
			  .catch((e) => { console.warn('[CleanX] Network Map refresh failed:', e); });
		};
		refresh();
		poll.add(refresh, this.interval);

		return E('div', {}, head.concat([
			E('div', { 'class': 'cbi-map-descr' }, [ _('Live view of the devices connected to this router. Select a device for details, or to rename it and change its icon.') ]),
			this.root
		]));
	},

	/* summary cards, styled like the Overview dashboard */
	statGrid: function() {
		const card = (key, label, ico) => E('article', { 'class': 'cleanx-stat-card cx-nm-stat cx-nm-stat-' + key }, [
			E('div', { 'class': 'cleanx-stat-top' }, [
				E('span', { 'class': 'cleanx-stat-label' }, [ label ]),
				E('span', { 'class': 'cleanx-stat-icon cx-nm-stat-icon', 'aria-hidden': 'true' }, [ icon(ico) ])
			]),
			E('strong', { 'data-stat': key }, [ '–' ]),
			E('small', { 'data-stat-sub': key }, [ ' ' ]),
			E('span', { 'class': 'cleanx-meter' }, [ E('i', { 'data-stat-meter': key, 'style': 'width:4%' }) ])
		]);
		return E('div', { 'class': 'cleanx-stat-grid cleanx-stat-grid-live cx-nm-stats' }, [
			card('devices', _('Devices'), 'devices'),
			card('inet', _('Internet'), 'internet'),
			card('wifi', _('Wi-Fi'), 'wifi'),
			card('top', _('Most active'), 'activity')
		]);
	},

	update: function(m) {
		this.last = m;
		this.stats(m);
		const sig = m.groups.map((g) => g.id + ':' + (g.up ? 1 : 0) + (g.note ? 'n' : '') + (g.ports || []).map((p) => p.name + (p.uplink ? '^' : '') + (p.up ? '+' : '')).join('')
			+ ':' + g.clients.map((c) => c.mac + c.type + c.label + (c.port || '')).join(',')).join('|')
			+ (m.wan ? 'w' + (((m.wan['ipv4-address'] || [])[0] || {}).address || '') : '') + (m.ap ? 'a' + m.gw + (m.uplinkPort || '') : '');
		if (sig !== this.sig) { this.sig = sig; this.build(m); }
		else this.refreshValues(m);
	},

	stats: function(m) {
		const root = this.root;
		const set = (attr, key, txt) => { const e = root.querySelector('[' + attr + '="' + key + '"]'); if (e && e.textContent !== txt) e.textContent = txt; };
		const meter = (key, pct) => { const e = root.querySelector('[data-stat-meter="' + key + '"]'); if (e) e.style.width = Math.max(4, Math.min(100, pct)) + '%'; };

		set('data-stat', 'devices', String(m.total));
		set('data-stat-sub', 'devices', _('%d Wi-Fi · %d wired').format(m.nwifi, m.total - m.nwifi));
		meter('devices', m.total ? m.nwifi / m.total * 100 : 4);

		const lbl = root.querySelector('.cx-nm-stat-inet .cleanx-stat-label');
		if (lbl) lbl.textContent = m.ap ? _('Uplink') : _('Internet');
		set('data-stat', 'inet', !m.wan ? _('Offline') : fmtRate(m.wanRate));
		set('data-stat-sub', 'inet', !m.wan ? (m.ap ? _('No main router') : _('No default route'))
			: m.wanRx == null ? _('Measuring…') : '↓ ' + fmtRate(m.wanRx) + '  ·  ↑ ' + fmtRate(m.wanTx));
		meter('inet', meterPct(m.wanRate));

		set('data-stat', 'wifi', String(m.ssids));
		set('data-stat-sub', 'wifi', !m.radios ? _('No radios') : N_(m.radios, '%d of %d radio on', '%d of %d radios on').format(m.radiosUp, m.radios));
		meter('wifi', m.radios ? m.radiosUp / m.radios * 100 : 4);

		set('data-stat', 'top', m.top ? m.top.label : _('All quiet'));
		set('data-stat-sub', 'top', m.top ? fmtRate(m.top.rate) : _('No device is busy right now'));
		meter('top', m.top && m.lanTotal ? m.top.rate / m.lanTotal * 100 : 4);
	},

	build: function(m) {
		const self = this, tree = this.tree, wan = m.wan || {};
		if (!tree) return;
		const wanAddr = ((wan['ipv4-address'] || [])[0] || {}).address;
		const host = this.sysboard.hostname || 'OpenWrt';
		const model = (this.board.model || {}).name || this.sysboard.model || '';

		const pill = (cls, txt) => E('span', { 'class': 'cx-nm-pill ' + cls }, [ txt ]);
		const core = E('div', { 'class': 'cx-nm-core' }, [
			E('div', { 'class': 'cx-nm-node cx-nm-inet' + (m.wan ? '' : ' is-down'), 'data-node': 'inet',
			           'title': m.ap ? _('This router is working as an access point behind your main router') : '' }, [
				E('span', { 'class': 'cx-nm-node-tile' }, [ icon(m.ap ? 'router' : 'internet') ]),
				E('div', { 'class': 'cx-nm-node-text' }, [
					E('div', { 'class': 'cx-nm-node-title' }, [ E('strong', {}, [ m.ap ? _('Main router') : _('Internet') ]),
						m.wan ? pill('is-ok', _('Online')) : pill('is-bad', _('Offline')) ]),
					E('span', { 'class': 'cx-nm-node-sub' }, [ !m.wan ? _('No connection') : m.ap ? (m.gw || _('Uplink')) + (m.uplinkPort ? ' · ' + _('port %s').format(m.uplinkPort) : '')
					                                          : [ wanAddr, (wan.proto || '').toUpperCase(), wan.interface ].filter(Boolean).join(' · ') ])
				]),
				ratePill('inet', m.wanRate, !!m.wan)
			]),
			E('div', { 'class': 'cx-nm-link cx-nm-v cx-nm-corelink', 'data-flow': 'inet', 'aria-hidden': 'true' }),
			E('div', { 'class': 'cx-nm-node cx-nm-router', 'data-node': 'router' }, [
				E('span', { 'class': 'cx-nm-node-tile' }, [ icon(m.ap ? 'network' : 'router') ]),
				E('div', { 'class': 'cx-nm-node-text' }, [
					E('div', { 'class': 'cx-nm-node-title' }, [ E('strong', {}, [ host ]), pill('is-accent', m.ap ? _('Access point') : _('Router')) ]),
					E('span', { 'class': 'cx-nm-node-sub' }, [ [ model, m.ap ? wanAddr : '' ].filter(Boolean).join(' · ') ])
				])
			])
		]);
		this.ap = m.ap;

		const nets = m.groups.length
			? E('ul', { 'class': 'cx-nm-nets' }, m.groups.map((g, i) => self.network(g, i === m.groups.length - 1)))
			: E('div', { 'class': 'cx-nm-empty cx-nm-nonets' }, [ _('No Wi-Fi or local networks are up.') ]);

		tree.replaceChildren(core, nets);
		this.flows(m);
	},

	network: function(g, last) {
		const self = this, wifi = g.kind === 'wifi';
		const badges = [];
		if (wifi) badges.push(E('span', { 'class': 'cx-nm-pill' }, [ g.band ]));
		if (wifi && g.open) badges.push(E('span', { 'class': 'cx-nm-pill is-warn', 'title': _('No password') }, [ _('Open') ]));
		if (!g.up) badges.push(E('span', { 'class': 'cx-nm-pill is-bad' }, [ _('Off') ]));
		const n = g.clients.length;
		const sub = [ N_(n, '%d device', '%d devices').format(n) ];
		if (wifi && g.nets.length) sub.push(_('on %s').format(g.nets.map((x) => x === 'lan' ? _('LAN') : x.toUpperCase()).join(', ')));
		if (!wifi) sub.push(g.subnet);

		const card = E('section', { 'class': 'cx-nm-card ' + (wifi ? 'cx-nm-card-wifi' : 'cx-nm-card-wired'), 'aria-label': g.title }, [
			E('div', { 'class': 'cx-nm-card-head' }, [
				E('span', { 'class': 'cx-nm-card-tile' }, [ icon(wifi ? 'wifi' : 'wired') ]),
				E('div', { 'class': 'cx-nm-card-text' }, [
					E('div', { 'class': 'cx-nm-card-title' }, [ E('strong', {}, [ g.title ]) ].concat(badges)),
					E('span', { 'class': 'cx-nm-card-sub' }, [ sub.join(' · ') ])
				]),
				ratePill(g.id, g.rate, g.up)
			]),
			g.ports && g.ports.length ? E('div', { 'class': 'cx-nm-ports' }, g.ports.map((p) =>
				E('span', { 'class': 'cx-nm-port' + (p.up ? ' is-up' : '') + (p.uplink ? ' is-uplink' : ''),
					'title': p.name + (p.uplink ? ' · ' + _('uplink to main router') : '') + (p.up && p.speed > 0 ? ' · ' + p.speed + ' Mbps' : p.up ? '' : ' · ' + _('no link')) }, [
					E('i', { 'aria-hidden': 'true' }), p.name + (p.uplink ? ' ↑' : '')
				]))) : '',
			n ? E('div', { 'class': 'cx-nm-devs' }, g.clients.map((c) => self.device(c)))
			  : E('div', { 'class': 'cx-nm-empty' }, [ g.note || (g.up ? _('No devices connected') : _('This network is turned off')) ])
		]);

		return E('li', { 'class': 'cx-nm-net' + (last ? ' is-last' : '') + (g.up ? '' : ' is-off'), 'data-net': g.id }, [
			E('span', { 'class': 'cx-nm-link cx-nm-v cx-nm-trunk', 'data-flow': 'trunk:' + g.id, 'aria-hidden': 'true' }),
			E('span', { 'class': 'cx-nm-link cx-nm-h cx-nm-branch', 'data-flow': g.id, 'aria-hidden': 'true' }),
			E('span', { 'class': 'cx-nm-joint', 'data-joint': g.id, 'aria-hidden': 'true' }),
			card
		]);
	},

	device: function(c) {
		const self = this;
		/* second line: the IP (or MAC when the IP is already the name), plus the
		   LAN port; a device known only by its MAC says why there is no IP */
		let sub = c.ips[0] ? (c.ips[0] !== c.label ? c.ips[0] : c.mac)
		        : c.label !== c.mac ? c.mac : (this.ap ? _('IP from main router') : _('No IP address'));
		if (c.port) sub += ' · ' + c.port;
		const on = c.rate >= ACTIVE;
		const b = E('button', { 'type': 'button', 'class': 'cx-nm-dev cx-nm-t-' + c.type + (on ? ' is-on' : ''), 'data-mac': c.mac,
			'title': c.label + ' — ' + (TYPE_NAME[c.type] || ''), 'aria-label': c.label + ', ' + (TYPE_NAME[c.type] || '') + ', ' + sub }, [
			E('span', { 'class': 'cx-nm-dev-tile' }, [ icon(c.type) ]),
			E('span', { 'class': 'cx-nm-dev-text' }, [
				E('span', { 'class': 'cx-nm-dev-name' }, [ c.label ]),
				E('span', { 'class': 'cx-nm-dev-sub' }, [ sub ])
			]),
			E('span', { 'class': 'cx-nm-dev-meta' }, [
				c.wifi ? E('span', { 'class': 'cx-nm-bars b' + bars(c.signal), 'title': c.signal + ' dBm' }, [ E('i'), E('i'), E('i'), E('i') ]) : '',
				E('span', { 'class': 'cx-nm-dev-rate', 'data-mac-rate': c.mac }, [ on ? fmtRate(c.rate) : '' ])
			]),
			E('span', { 'class': 'cx-nm-dev-act', 'aria-hidden': 'true' })
		]);
		b.addEventListener('click', () => { self.details(c.mac); });
		return b;
	},

	refreshValues: function(m) {
		const root = this.root;
		const set = (sel, txt) => { const e = root.querySelector(sel); if (e && e.textContent !== txt) e.textContent = txt; };
		const pill = (key, bps, show) => {
			const e = root.querySelector('[data-rate="' + key + '"]');
			if (!e) return;
			const txt = show ? pillText(bps) : '';
			if (e.textContent !== txt) e.textContent = txt;
			e.classList.toggle('is-idle', bps != null && bps < ACTIVE);
		};
		pill('inet', m.wanRate, !!m.wan);
		m.groups.forEach((g) => {
			pill(g.id, g.rate, g.up);
			g.clients.forEach((c) => {
				const on = c.rate >= ACTIVE;
				set('[data-mac-rate="' + c.mac + '"]', on ? fmtRate(c.rate) : '');
				const b = root.querySelector('.cx-nm-dev[data-mac="' + c.mac + '"]');
				if (b && b.classList.contains('is-on') !== on) b.classList.toggle('is-on', on);
				const sb = c.wifi && b && b.querySelector('.cx-nm-bars');
				if (sb && sb.getAttribute('class') !== 'cx-nm-bars b' + bars(c.signal)) { sb.setAttribute('class', 'cx-nm-bars b' + bars(c.signal)); sb.title = c.signal + ' dBm'; }
			});
		});
		this.flows(m);
	},

	/* link state: idle (still), low/mid/high (moving, faster with more
	   traffic), down (dashed). Trunk segments carry every network below. */
	flows: function(m) {
		const root = this.root;
		const set = (id, bps, down) => {
			const e = root.querySelector('[data-flow="' + id + '"]');
			if (!e) return;
			const cls = flowClass(bps, down);
			if (e.dataset.state !== cls) {
				if (e.dataset.state) e.classList.remove(e.dataset.state);
				e.classList.add(cls);
				e.dataset.state = cls;
			}
		};
		set('inet', m.wanRate, !m.wan);
		m.groups.forEach((g) => {
			set(g.id, g.rate, !g.up);
			set('trunk:' + g.id, g.trunk, false);
			const j = root.querySelector('[data-joint="' + g.id + '"]');
			if (j) j.classList.toggle('is-on', g.up && g.rate >= ACTIVE);
		});
	},

	/* ------------------------------------------------------- device dialog */
	findClient: function(mac) {
		let r = null;
		(this.last ? this.last.groups : []).forEach((g) => { g.clients.forEach((c) => { if (c.mac === mac) r = { c: c, g: g }; }); });
		return r;
	},

	details: function(mac) {
		const self = this, f = this.findClient(mac);
		if (!f) return;
		const c = f.c, g = f.g;
		let chosen = c.custom ? c.type : '';
		const nameId = 'cx-nm-name-' + c.mac.replace(/:/g, '');
		const nameInput = E('input', { 'type': 'text', 'id': nameId, 'class': 'cbi-input-text', 'value': c.customName,
			'placeholder': c.host || c.ips[0] || c.mac, 'maxlength': 48, 'autocomplete': 'off' });
		const row = (k, v) => v ? [ E('dt', {}, [ k ]), E('dd', {}, [ v ]) ] : [];
		const tile = E('span', { 'class': 'cx-nm-detail-tile cx-nm-t-' + c.type }, [ icon(c.type) ]);
		const typeLbl = E('strong', {}, [ TYPE_NAME[c.type] || '' ]);

		const tiles = E('div', { 'class': 'cx-nm-icons', 'role': 'radiogroup', 'aria-label': _('Device icon') });
		const pick = (type) => {
			chosen = type;
			tiles.querySelectorAll('.cx-nm-pick').forEach((x) => {
				const sel = x.getAttribute('data-type') === type;
				x.classList.toggle('is-sel', sel);
				x.setAttribute('aria-checked', sel ? 'true' : 'false');
			});
			const shown = type || c.auto;
			tile.className = 'cx-nm-detail-tile cx-nm-t-' + shown;
			tile.replaceChildren(icon(shown));
			typeLbl.textContent = TYPE_NAME[shown] || '';
		};
		const mk = (type, label, ico) => {
			const sel = chosen === type;
			const t = E('button', { 'type': 'button', 'class': 'cx-nm-pick cx-nm-t-' + ico + (sel ? ' is-sel' : ''), 'role': 'radio',
				'aria-checked': sel ? 'true' : 'false', 'data-type': type, 'title': label }, [ icon(ico), E('span', {}, [ label ]) ]);
			t.addEventListener('click', () => pick(type));
			return t;
		};
		tiles.appendChild(mk('', _('Automatic'), c.auto));
		TYPES.forEach((t) => { tiles.appendChild(mk(t[0], t[1], t[0])); });

		const saveBtn = E('button', { 'class': 'btn cbi-button-positive important', 'click': ui.createHandlerFn(this, () =>
			self.save(c, nameInput.value.trim(), chosen)) }, [ _('Save') ]);
		nameInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); saveBtn.click(); } });

		const on = c.rate >= ACTIVE;
		const via = c.wifi ? g.title + ' · ' + g.band : g.title + (c.port ? ' · ' + _('port %s').format(c.port) : ' · ' + _('wired'));
		ui.showModal(c.label, [
			E('div', { 'class': 'cx-nm-detail' }, [
				E('div', { 'class': 'cx-nm-detail-hero' }, [
					tile,
					E('div', { 'class': 'cx-nm-detail-id' }, [ typeLbl, E('span', {}, [ via ]) ]),
					E('span', { 'class': 'cx-nm-pill ' + (on ? 'is-ok' : '') }, [ on ? _('Active') : _('Idle') ])
				]),
				E('dl', { 'class': 'cx-nm-kv' }, [].concat(
					row(_('IPv4'), c.ips.join(', ') || (this.ap ? _('Assigned by your main router (not visible to this access point)') : _('None'))),
					row(_('IPv6'), c.ip6s.slice(0, 2).join(', ')),
					row(_('MAC'), c.mac + (isPrivateMac(c.mac) ? ' · ' + _('private address') : '')),
					c.wifi ? row(_('Signal'), c.signal + ' dBm') : [],
					c.wifi && c.txr ? row(_('Link rate'), fmtRate(c.txr * 1000) + ' ↓ · ' + fmtRate(c.rxr * 1000) + ' ↑') : [],
					c.wifi ? row(_('Connected for'), fmtDur(c.conn)) : [],
					row(_('Traffic now'), c.rate != null ? fmtRate(c.rate) : c.wifi ? _('Measuring…') : _('Shown per port for wired devices')),
					row(_('Detected as'), (TYPE_NAME[c.auto] || '') + ' — ' + c.reason)
				))
			]),
			E('div', { 'class': 'cx-nm-field' }, [ E('label', { 'for': nameId }, [ _('Name') ]), nameInput ]),
			E('div', { 'class': 'cx-nm-field' }, [ E('span', { 'class': 'cx-nm-field-label' }, [ _('Icon') ]), tiles ]),
			E('div', { 'class': 'right cx-nm-actions' }, [
				E('button', { 'class': 'btn cbi-button', 'click': ui.hideModal }, [ _('Cancel') ]), ' ',
				saveBtn
			])
		], 'cx-nm-modal');
	},

	/* names and icons live in /etc/config/cleanx (kept across upgrades); a
	   direct uci commit means nothing restarts and no apply countdown runs */
	save: function(c, name, type) {
		const self = this, sid = c.sid || ('h_' + c.mac.replace(/:/g, '').toLowerCase());
		return uci.load('cleanx').then(() => {
			if (!name && !type) {
				/* back to the automatic name and icon */
				if (uci.get('cleanx', sid)) uci.remove('cleanx', sid);
			} else {
				if (!uci.get('cleanx', sid)) uci.add('cleanx', 'host', sid);
				uci.set('cleanx', sid, 'mac', c.mac);
				uci.set('cleanx', sid, 'name', name || null);
				uci.set('cleanx', sid, 'icon', type || null);
			}
			return uci.save();
		}).then(() => callCommit('cleanx')).then(() => {
			uci.unload('cleanx');
			return uci.load('cleanx');
		}).then(() => {
			ui.hideModal();
			if (ui.changes && ui.changes.init) ui.changes.init();
			self.sig = '';   /* force a rebuild with the new label/icon */
			if (self.lastData) self.update(self.model(self.lastData));
		}).catch((e) => {
			ui.addNotification(null, E('p', [ _('Could not save: %s').format(e.message || e) ]), 'error');
		});
	},

	handleSaveApply: null, handleSave: null, handleReset: null
});
