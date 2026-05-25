'use strict';
'require baseclass';
'require rpc';
'require poll';

return baseclass.extend({
	previousNet: null,
	previousCpu: null,
	wanDevice: null,

	callSystemInfo: rpc.declare({ object: 'system', method: 'info' }),
	callInterfaceStatus: rpc.declare({ object: 'network.interface', method: 'status', params: [ 'interface' ] }),
	callInterfaceDump: rpc.declare({ object: 'network.interface', method: 'dump' }),
	callDeviceStatus: rpc.declare({ object: 'network.device', method: 'status', params: [ 'name' ] }),
	callProcStat: rpc.declare({ object: 'file', method: 'read', params: [ 'path' ], reject: false }),

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
			cpu: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9z"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>',
			ram: '<svg viewBox="0 0 24 24"><rect x="5" y="6" width="14" height="12" rx="2"/><path d="M8 10h8M8 14h5M8 2v4M12 2v4M16 2v4M8 18v4M12 18v4M16 18v4"/></svg>'
		};
		const span = E('span', { class: 'cleanx-stat-icon cleanx-stat-icon-' + type, 'aria-hidden': 'true' });
		span.innerHTML = icons[type] || icons.cpu;
		return span;
	},

	mount() {
		if (document.getElementById('cleanx-dashboard')) return;

		const dashboard = E('section', { id: 'cleanx-dashboard', class: 'cleanx-dashboard' }, [
			E('div', { class: 'cleanx-hero' }, [
				E('div', {}, [
					E('p', { class: 'cleanx-eyebrow' }, [ 'CleanX' ]),
					E('h1', {}, [ 'Network Overview' ]),
					E('p', {}, [ 'Router activity and system health at a glance.' ])
				]),
				E('div', { class: 'cleanx-pill' }, [ E('span', { class: 'cleanx-live-dot' }), 'WAN: ', E('span', { id: 'cleanx-wan-device' }, [ 'detecting' ]) ])
			]),
			E('div', { class: 'cleanx-stat-grid cleanx-stat-grid-live' }, [
				this.card('Download', 'cleanx-down-rate', '0 B/s', 'Total RX: ', 'cleanx-total-rx', 'cleanx-down-meter', 'down'),
				this.card('Upload', 'cleanx-up-rate', '0 B/s', 'Total TX: ', 'cleanx-total-tx', 'cleanx-up-meter', 'up'),
				this.card('CPU', 'cleanx-cpu-usage', '0%', 'System load: ', 'cleanx-cpu-load', 'cleanx-cpu-meter', 'cpu'),
				this.card('RAM', 'cleanx-ram-usage', '0%', 'Used memory: ', 'cleanx-ram-used', 'cleanx-ram-meter', 'ram')
			]),
			E('div', { class: 'cleanx-dashboard-meta' }, [
				E('span', {}, [ 'System Uptime: ', E('strong', { id: 'cleanx-system-uptime' }, [ 'Loading' ]) ]),
				E('span', {}, [ 'Total Traffic: ', E('strong', { id: 'cleanx-total-data' }, [ '0 B' ]) ]),
				E('span', {}, [ 'RAM Total: ', E('strong', { id: 'cleanx-ram-total' }, [ '0 B' ]) ])
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

	async update() {
		try {
			const [ system, device, cpuPct ] = await Promise.all([
				this.callSystemInfo(),
				this.getWanDeviceStatus(),
				this.getCpuUsage()
			]);
			this.updateNetwork(device);
			this.updateSystem(system, cpuPct);
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

	async getCpuUsage() {
		try {
			const reply = await this.callProcStat('/proc/stat');
			const data = typeof reply === 'string' ? reply : (reply?.data || reply?.content || '');
			const first = data.split('\n').find((line) => line.indexOf('cpu ') === 0);
			if (!first) return null;
			const nums = first.trim().split(/\s+/).slice(1).map((n) => Number(n) || 0);
			const idle = (nums[3] || 0) + (nums[4] || 0);
			const total = nums.reduce((a, b) => a + b, 0);
			const current = { idle, total };
			let pct = null;
			if (this.previousCpu && total > this.previousCpu.total) {
				const totalDelta = total - this.previousCpu.total;
				const idleDelta = idle - this.previousCpu.idle;
				pct = Math.round(Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100)));
			}
			this.previousCpu = current;
			return pct;
		} catch (_) {
			return null;
		}
	},

	updateNetwork(device) {
		const stats = device?.statistics || device || {};
		const rx = Number(stats.rx_bytes || 0);
		const tx = Number(stats.tx_bytes || 0);
		const now = Date.now();
		let down = 0;
		let up = 0;
		if (this.previousNet) {
			const seconds = Math.max((now - this.previousNet.time) / 1000, 1);
			down = Math.max((rx - this.previousNet.rx) / seconds, 0);
			up = Math.max((tx - this.previousNet.tx) / seconds, 0);
		}
		this.previousNet = { rx, tx, time: now };
		this.text('cleanx-down-rate', this.formatRate(down));
		this.text('cleanx-up-rate', this.formatRate(up));
		this.text('cleanx-total-rx', this.formatBytes(rx));
		this.text('cleanx-total-tx', this.formatBytes(tx));
		this.text('cleanx-total-data', this.formatBytes(rx + tx));
		this.meter('cleanx-down-meter', this.rateToPct(down));
		this.meter('cleanx-up-meter', this.rateToPct(up));
	},

	updateSystem(system, cpuPct) {
		const uptime = this.formatDuration(Number(system?.uptime || 0));
		const memTotal = Number(system?.memory?.total || 0);
		const memFree = Number(system?.memory?.free || 0) + Number(system?.memory?.buffered || 0) + Number(system?.memory?.cached || 0);
		const used = memTotal ? Math.max(memTotal - memFree, 0) : 0;
		const ramPct = memTotal ? Math.round((used / memTotal) * 100) : 0;
		const load = this.formatLoad(system?.load);

		if (cpuPct === null || cpuPct === undefined) {
			const normalized = this.loadToPct(system?.load);
			cpuPct = normalized.pct;
		}

		this.text('cleanx-cpu-usage', `${cpuPct}%`);
		this.text('cleanx-cpu-load', load);
		this.meter('cleanx-cpu-meter', cpuPct);

		this.text('cleanx-ram-usage', `${ramPct}%`);
		this.text('cleanx-ram-used', `${this.formatBytes(used)} / ${this.formatBytes(memTotal)}`);
		this.text('cleanx-ram-total', this.formatBytes(memTotal));
		this.text('cleanx-system-uptime', uptime);
		this.meter('cleanx-ram-meter', ramPct);
	},

	formatLoad(load) {
		if (!Array.isArray(load) || !load.length) return 'n/a';
		return load.slice(0, 3).map((v) => {
			const n = Number(v || 0);
			return (n > 1000 ? n / 65535 : n).toFixed(2);
		}).join(', ');
	},

	loadToPct(load) {
		if (!Array.isArray(load) || !load.length) return { pct: 0 };
		const raw = Number(load[0] || 0);
		const avg = raw > 1000 ? raw / 65535 : raw;
		return { pct: Math.max(0, Math.min(100, Math.round(avg * 100))) };
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
		const s = Math.floor(seconds % 60);
		if (d > 0) return `${d}d ${h}h ${m}m`;
		if (h > 0) return `${h}h ${m}m`;
		if (m > 0) return `${m}m ${s}s`;
		return `${s}s`;
	},

	text(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; },
	meter(id, pct) { const el = document.getElementById(id); if (el) el.style.width = Math.max(4, Math.min(100, pct || 4)) + '%'; }
});
