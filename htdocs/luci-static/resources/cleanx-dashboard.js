'use strict';
'require baseclass';
'require rpc';
'require poll';

return baseclass.extend({
	previous: null,
	wanDevice: null,

	callSystemInfo: rpc.declare({ object: 'system', method: 'info' }),
	callInterfaceStatus: rpc.declare({ object: 'network.interface', method: 'status', params: [ 'interface' ] }),
	callInterfaceDump: rpc.declare({ object: 'network.interface', method: 'dump' }),
	callDeviceStatus: rpc.declare({ object: 'network.device', method: 'status', params: [ 'name' ] }),

	__init__() {
		if (document.body.dataset.cleanxDashboard === '0') return;
		if (!this.isOverviewPage()) return;
		this.mount();
		this.update();
		poll.add(() => this.update(), 2);
	},

	isOverviewPage() {
		const page = document.body.dataset.page || '';
		return page === 'admin-status-overview' || location.pathname.indexOf('/admin/status/overview') !== -1 || location.pathname.replace(/\/+$/, '').endsWith('/admin');
	},

	icon(type) {
		const icons = {
			down: '<svg viewBox="0 0 24 24"><path d="M12 3v14"/><path d="M6 11l6 6 6-6"/><path d="M5 21h14"/></svg>',
			up: '<svg viewBox="0 0 24 24"><path d="M12 21V7"/><path d="M6 13l6-6 6 6"/><path d="M5 3h14"/></svg>',
			data: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
			system: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9z"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>'
		};
		const span = E('span', { class: 'cleanx-stat-icon', 'aria-hidden': 'true' });
		span.innerHTML = icons[type] || icons.system;
		return span;
	},

	mount() {
		if (document.getElementById('cleanx-dashboard')) return;
		const dashboard = E('section', { id: 'cleanx-dashboard', class: 'cleanx-dashboard' }, [
			E('div', { class: 'cleanx-hero' }, [
				E('div', {}, [
					E('p', { class: 'cleanx-eyebrow' }, [ 'CleanX' ]),
					E('h1', {}, [ 'Network Overview' ]),
					E('p', {}, [ 'Current router activity and system health.' ])
				]),
				E('div', { class: 'cleanx-pill' }, [ E('span', { class: 'cleanx-live-dot' }), 'WAN: ', E('span', { id: 'cleanx-wan-device' }, [ 'detecting' ]) ])
			]),
			E('div', { class: 'cleanx-stat-grid' }, [
				this.card('Download', 'cleanx-down-rate', '0 B/s', 'Total RX: ', 'cleanx-total-rx', 'cleanx-down-meter', 'down'),
				this.card('Upload', 'cleanx-up-rate', '0 B/s', 'Total TX: ', 'cleanx-total-tx', 'cleanx-up-meter', 'up'),
				this.card('Total Data', 'cleanx-total-data', '0 B', 'RX + TX since boot', null, 'cleanx-data-meter', 'data'),
				this.card('System', 'cleanx-system', 'Loading', 'Uptime / RAM', null, 'cleanx-system-meter', 'system')
			])
		]);
		const main = document.getElementById('maincontent') || document.querySelector('main') || document.body;
		main.prepend(dashboard);
	},

	card(label, strongId, strongText, smallPrefix, smallId, meterId, iconType) {
		return E('article', { class: 'cleanx-stat-card' }, [
			E('div', { class: 'cleanx-stat-top' }, [ E('span', { class: 'cleanx-stat-label' }, [ label ]), this.icon(iconType) ]),
			E('strong', { id: strongId }, [ strongText ]),
			E('small', {}, smallId ? [ smallPrefix, E('span', { id: smallId }, [ '0 B' ]) ] : [ smallPrefix ]),
			E('span', { class: 'cleanx-meter' }, [ E('i', { id: meterId, style: 'width:4%' }) ])
		]);
	},

	/* Counters come from LuCI RPC. Traffic totals are interface counters since boot; persistent monthly accounting can be added later with vnStat or nlbwmon. */

	async update() {
		try {
			const [ system, device ] = await Promise.all([ this.callSystemInfo(), this.getWanDeviceStatus() ]);
			this.updateNetwork(device);
			this.updateSystem(system);
		} catch (err) {
			this.text('cleanx-down-rate', 'Unavailable');
			this.text('cleanx-up-rate', 'Unavailable');
			console.warn('[CleanX] Dashboard update failed:', err);
		}
	},

	async detectWanDevice() {
		const saved = localStorage.getItem('cleanx.wanDevice');
		if (saved && saved !== 'auto') return saved;
		try {
			const wan = await this.callInterfaceStatus('wan');
			if (wan?.l3_device) return wan.l3_device;
			if (wan?.device) return wan.device;
		} catch (_) {}
		try {
			const dump = await this.callInterfaceDump();
			const interfaces = dump?.interface || [];
			const candidate = interfaces.find((i) => i.interface === 'wan' || i.route?.some((r) => r.target === '0.0.0.0' || r.target === '::'));
			return candidate?.l3_device || candidate?.device || candidate?.interface || 'eth0';
		} catch (_) { return 'eth0'; }
	},

	async getWanDeviceStatus() {
		if (!this.wanDevice) this.wanDevice = await this.detectWanDevice();
		this.text('cleanx-wan-device', this.wanDevice);
		return this.callDeviceStatus(this.wanDevice);
	},

	updateNetwork(device) {
		const stats = device?.statistics || device || {};
		const rx = Number(stats.rx_bytes || 0);
		const tx = Number(stats.tx_bytes || 0);
		const now = Date.now();
		let down = 0;
		let up = 0;
		if (this.previous) {
			const seconds = Math.max((now - this.previous.time) / 1000, 1);
			down = Math.max((rx - this.previous.rx) / seconds, 0);
			up = Math.max((tx - this.previous.tx) / seconds, 0);
		}
		this.previous = { rx, tx, time: now };
		this.text('cleanx-down-rate', this.formatRate(down));
		this.text('cleanx-up-rate', this.formatRate(up));
		this.text('cleanx-total-rx', this.formatBytes(rx));
		this.text('cleanx-total-tx', this.formatBytes(tx));
		this.text('cleanx-total-data', this.formatBytes(rx + tx));
		this.meter('cleanx-down-meter', this.rateToPct(down));
		this.meter('cleanx-up-meter', this.rateToPct(up));
		this.meter('cleanx-data-meter', Math.min(100, ((rx + tx) / (1024 ** 3)) * 8));
	},

	updateSystem(system) {
		const uptime = this.formatDuration(Number(system?.uptime || 0));
		const memTotal = Number(system?.memory?.total || 0);
		const memFree = Number(system?.memory?.free || 0) + Number(system?.memory?.buffered || 0) + Number(system?.memory?.cached || 0);
		const used = memTotal ? Math.max(memTotal - memFree, 0) : 0;
		const pct = memTotal ? Math.round((used / memTotal) * 100) : 0;
		this.text('cleanx-system', `${uptime} · ${pct}% RAM`);
		this.meter('cleanx-system-meter', pct);
	},

	rateToPct(bytesPerSecond) {
		const mbps = (bytesPerSecond * 8) / 1000000;
		return Math.max(4, Math.min(100, mbps));
	},

	formatBytes(value) {
		const units = [ 'B', 'KB', 'MB', 'GB', 'TB', 'PB' ];
		let number = Number(value || 0);
		let unit = 0;
		while (number >= 1024 && unit < units.length - 1) { number /= 1024; unit++; }
		const digits = unit === 0 || number >= 100 ? 0 : number >= 10 ? 1 : 2;
		return `${number.toFixed(digits)} ${units[unit]}`;
	},

	formatRate(value) { return `${this.formatBytes(value)}/s`; },
	formatDuration(seconds) {
		const d = Math.floor(seconds / 86400);
		const h = Math.floor((seconds % 86400) / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		if (d > 0) return `${d}d ${h}h`;
		if (h > 0) return `${h}h ${m}m`;
		return `${m}m`;
	},
	text(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; },
	meter(id, pct) { const el = document.getElementById(id); if (el) el.style.width = Math.max(4, Math.min(100, pct || 4)) + '%'; }
});
