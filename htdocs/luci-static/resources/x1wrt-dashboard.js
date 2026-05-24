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
		if (document.body.dataset.x1Dashboard === '0') return;
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
		const span = E('span', { class: 'x1-stat-icon', 'aria-hidden': 'true' });
		span.innerHTML = icons[type] || icons.system;
		return span;
	},

	mount() {
		if (document.getElementById('x1-dashboard')) return;
		const dashboard = E('section', { id: 'x1-dashboard', class: 'x1-dashboard' }, [
			E('div', { class: 'x1-hero' }, [
				E('div', {}, [
					E('p', { class: 'x1-eyebrow' }, [ 'X1Wrt live network' ]),
					E('h1', {}, [ 'Router Dashboard' ]),
					E('p', {}, [ 'Live WAN speed, traffic totals, uptime and RAM usage with automatic GB/TB formatting.' ])
				]),
				E('div', { class: 'x1-pill' }, [ E('span', { class: 'x1-live-dot' }), 'WAN: ', E('span', { id: 'x1-wan-device' }, [ 'detecting' ]) ])
			]),
			E('div', { class: 'x1-stat-grid' }, [
				this.card('Download', 'x1-down-rate', '0 B/s', 'Total RX: ', 'x1-total-rx', 'x1-down-meter', 'down'),
				this.card('Upload', 'x1-up-rate', '0 B/s', 'Total TX: ', 'x1-total-tx', 'x1-up-meter', 'up'),
				this.card('Total Data', 'x1-total-data', '0 B', 'RX + TX since boot', null, 'x1-data-meter', 'data'),
				this.card('System', 'x1-system', 'Loading', 'Uptime / RAM', null, 'x1-system-meter', 'system')
			]),
			E('p', { class: 'x1-dashboard-note' }, [ 'Note: totals are interface counters since boot. For monthly totals, add vnStat/nlbwmon support in the next phase.' ])
		]);
		const main = document.getElementById('maincontent') || document.querySelector('main') || document.body;
		main.prepend(dashboard);
	},

	card(label, strongId, strongText, smallPrefix, smallId, meterId, iconType) {
		return E('article', { class: 'x1-stat-card' }, [
			E('div', { class: 'x1-stat-top' }, [ E('span', { class: 'x1-stat-label' }, [ label ]), this.icon(iconType) ]),
			E('strong', { id: strongId }, [ strongText ]),
			E('small', {}, smallId ? [ smallPrefix, E('span', { id: smallId }, [ '0 B' ]) ] : [ smallPrefix ]),
			E('span', { class: 'x1-meter' }, [ E('i', { id: meterId, style: 'width:4%' }) ])
		]);
	},

	async update() {
		try {
			const [ system, device ] = await Promise.all([ this.callSystemInfo(), this.getWanDeviceStatus() ]);
			this.updateNetwork(device);
			this.updateSystem(system);
		} catch (err) {
			this.text('x1-down-rate', 'Unavailable');
			this.text('x1-up-rate', 'Unavailable');
			console.warn('[X1Wrt] Dashboard update failed:', err);
		}
	},

	async detectWanDevice() {
		const saved = localStorage.getItem('x1wrt.wanDevice');
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
		this.text('x1-wan-device', this.wanDevice);
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
		this.text('x1-down-rate', this.formatRate(down));
		this.text('x1-up-rate', this.formatRate(up));
		this.text('x1-total-rx', this.formatBytes(rx));
		this.text('x1-total-tx', this.formatBytes(tx));
		this.text('x1-total-data', this.formatBytes(rx + tx));
		this.meter('x1-down-meter', this.rateToPct(down));
		this.meter('x1-up-meter', this.rateToPct(up));
		this.meter('x1-data-meter', Math.min(100, ((rx + tx) / (1024 ** 3)) * 8));
	},

	updateSystem(system) {
		const uptime = this.formatDuration(Number(system?.uptime || 0));
		const memTotal = Number(system?.memory?.total || 0);
		const memFree = Number(system?.memory?.free || 0) + Number(system?.memory?.buffered || 0) + Number(system?.memory?.cached || 0);
		const used = memTotal ? Math.max(memTotal - memFree, 0) : 0;
		const pct = memTotal ? Math.round((used / memTotal) * 100) : 0;
		this.text('x1-system', `${uptime} · ${pct}% RAM`);
		this.meter('x1-system-meter', pct);
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
