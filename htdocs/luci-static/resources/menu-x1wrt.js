'use strict';
'require baseclass';
'require ui';

return baseclass.extend({
	__init__() {
		ui.menu.load().then((tree) => this.render(tree));
		this.bindShellControls();
		this.patchChangeIndicator();
		this.startClock();
		this.startProgress();
		this.removeLoader();
		this.bindRipples();
		this.installToast();
	},

	icon(name) {
		const key = String(name || '').toLowerCase();
		const icons = {
			overview: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
			status: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/></svg>',
			network: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v6"/><path d="M12 13L5 17"/><path d="M12 13l7 4"/></svg>',
			wireless: '<svg viewBox="0 0 24 24"><path d="M5 12.5a11 11 0 0 1 14 0"/><path d="M1.5 9a16 16 0 0 1 21 0"/><path d="M8.5 16a6 6 0 0 1 7 0"/><path d="M12 20h.01"/></svg>',
			interfaces: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10"/><path d="M7 13h4"/><path d="M15 13h2"/></svg>',
			firewall: '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-5"/></svg>',
			routing: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h4a5 5 0 0 1 5 5v4"/><path d="M13 11h5"/></svg>',
			vpn: '<svg viewBox="0 0 24 24"><rect x="3" y="10" width="18" height="11" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/><path d="M12 15v2"/></svg>',
			dhcp: '<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M4 17h16"/><path d="M7 7v10"/><path d="M17 7v10"/><path d="M12 3v18"/></svg>',
			dns: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20"/><path d="M12 2a15 15 0 0 0 0 20"/></svg>',
			system: '<svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z"/></svg>',
			software: '<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7L12 12l8.7-5"/><path d="M12 22V12"/></svg>',
			services: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-8 8l-7 7a2.1 2.1 0 0 1-3-3l7-7a6 6 0 0 1 8-8z"/></svg>',
			reboot: '<svg viewBox="0 0 24 24"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.5 9A9 9 0 0 0 5.6 5.6L1 10m22 4-4.6 4.4A9 9 0 0 1 3.5 15"/></svg>',
			logout: '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
			admin: '<svg viewBox="0 0 24 24"><path d="M12 2l3 7 7 1-5 5 1 7-6-3.5L6 22l1-7-5-5 7-1z"/></svg>'
		};
		const fallback = icons[key] || icons[key.split('_')[0]] || icons.status;
		const wrap = E('span', { class: 'x1-nav-icon', 'aria-hidden': 'true' });
		wrap.innerHTML = fallback;
		return wrap;
	},

	bindShellControls() {
		const themeKey = 'x1wrt.theme';
		const html = document.documentElement;
		const toggle = document.getElementById('x1-theme-toggle');
		const mobileBtn = document.getElementById('x1-mobile-menu');
		const mobileDrawer = document.getElementById('x1-mobile-drawer');
		const mobileClose = document.getElementById('x1-mobile-close');

		const applyTheme = (choice) => {
			const mode = choice || localStorage.getItem(themeKey) || html.dataset.x1Mode || 'auto';
			const dark = mode === 'dark' || (mode !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
			html.dataset.x1Theme = dark ? 'dark' : 'light';
			html.dataset.x1ThemeChoice = mode;
			localStorage.setItem(themeKey, mode);
		};

		applyTheme(localStorage.getItem(themeKey) || html.dataset.x1Mode || 'auto');

		if (window.matchMedia) {
			window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
				if ((localStorage.getItem(themeKey) || 'auto') === 'auto') applyTheme('auto');
			});
		}

		toggle?.addEventListener('click', () => applyTheme(html.dataset.x1Theme === 'dark' ? 'light' : 'dark'));

		const setDrawer = (open) => {
			if (!mobileDrawer || !mobileBtn) return;
			mobileDrawer.classList.toggle('open', open);
			mobileDrawer.setAttribute('aria-hidden', open ? 'false' : 'true');
			mobileBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
			document.body.style.overflow = open ? 'hidden' : '';
		};

		mobileBtn?.addEventListener('click', () => setDrawer(!mobileDrawer?.classList.contains('open')));
		mobileClose?.addEventListener('click', () => setDrawer(false));
		mobileDrawer?.addEventListener('click', (ev) => { if (ev.target === mobileDrawer) setDrawer(false); });
		document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') setDrawer(false); });
	},

	patchChangeIndicator() {
		const original = ui.changes?.setIndicator;
		if (!original) return;
		ui.changes.setIndicator = function(n) {
			original.call(this, n);
			document.documentElement.dataset.x1Changes = n || 0;
		};
	},

	startClock() {
		const el = document.getElementById('x1-clock');
		if (!el) return;
		const tick = () => {
			const now = new Date();
			el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		};
		tick(); setInterval(tick, 30000);
	},

	startProgress() {
		const bar = document.getElementById('x1-scroll-progress');
		if (!bar) return;
		const update = () => {
			const top = document.documentElement.scrollTop || document.body.scrollTop;
			const height = document.documentElement.scrollHeight - window.innerHeight;
			bar.style.width = (height > 0 ? Math.min(100, Math.max(0, top / height * 100)) : 0) + '%';
		};
		window.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', update);
		update();
	},

	removeLoader() {
		const hide = () => document.getElementById('x1-page-loader')?.classList.add('x1-hidden');
		window.addEventListener('load', hide, { once: true });
		setTimeout(hide, 900);
	},

	bindRipples() {
		document.addEventListener('click', (ev) => {
			const target = ev.target.closest('button, .btn, .cbi-button, .x1-main-nav a, .x1-mode-menu a');
			if (!target) return;
			const cs = getComputedStyle(target);
			if (cs.position === 'static') target.style.position = 'relative';
			target.style.overflow = 'hidden';
			const rect = target.getBoundingClientRect();
			const size = Math.max(rect.width, rect.height);
			const ripple = document.createElement('span');
			ripple.className = 'x1-ripple';
			ripple.style.width = ripple.style.height = size + 'px';
			ripple.style.left = (ev.clientX - rect.left - size / 2) + 'px';
			ripple.style.top = (ev.clientY - rect.top - size / 2) + 'px';
			target.appendChild(ripple);
			setTimeout(() => ripple.remove(), 560);
		});
	},

	installToast() {
		window.x1Toast = (message, type = 'info', duration = 3500) => {
			let stack = document.querySelector('.x1-toast-stack');
			if (!stack) {
				stack = document.createElement('div');
				stack.className = 'x1-toast-stack';
				document.body.appendChild(stack);
			}
			const toast = document.createElement('div');
			toast.className = 'x1-toast ' + type;
			toast.textContent = message;
			stack.appendChild(toast);
			setTimeout(() => {
				toast.style.opacity = '0';
				toast.style.transform = 'translateY(10px) scale(.98)';
				setTimeout(() => toast.remove(), 220);
			}, duration);
		};
	},

	render(tree) {
		this.renderModeMenu(tree);
		if (L.env.dispatchpath.length >= 3) {
			let node = tree;
			let url = '';
			for (let i = 0; i < 3 && node; i++) {
				const segment = L.env.dispatchpath[i];
				node = node.children?.[segment];
				url += (url ? '/' : '') + segment;
			}
			if (node) this.renderTabMenu(node, url);
		}
	},

	renderModeMenu(tree) {
		const modeMenu = document.getElementById('modemenu');
		const children = ui.menu.getChildren(tree);
		let activeChild = null;
		if (!modeMenu) return;
		modeMenu.innerHTML = '';
		children.forEach((child, index) => {
			const active = L.env.requestpath.length ? child.name === L.env.requestpath[0] : index === 0;
			modeMenu.appendChild(E('li', { class: active ? 'active' : '' }, [ E('a', { href: L.url(child.name) }, [_(child.title)]) ]));
			if (active) activeChild = child;
		});
		if (modeMenu.children.length > 1) modeMenu.style.display = '';
		if (activeChild) {
			this.renderMainMenu(activeChild, activeChild.name);
			this.renderMobileMenu(activeChild, activeChild.name);
		}
	},

	renderMainMenu(tree, url) {
		const top = document.getElementById('topmenu');
		if (!top) return;
		top.innerHTML = '';
		ui.menu.getChildren(tree).forEach((child) => {
			const sub = ui.menu.getChildren(child);
			const active = L.env.dispatchpath[1] === child.name || L.env.dispatchpath[2] === child.name;
			const link = E('a', { href: sub.length ? L.url(url, child.name, sub[0].name) : L.url(url, child.name) }, [
				this.icon(child.name), E('span', { class: 'x1-nav-title' }, [_(child.title)]), sub.length ? E('span', { class: 'x1-nav-chevron' }, ['›']) : ''
			]);
			const li = E('li', { class: active ? 'active' : '' }, [link]);
			if (sub.length) {
				const ul = E('ul', { class: 'x1-submenu' });
				sub.forEach((item) => {
					const itemActive = L.env.dispatchpath.indexOf(item.name) !== -1;
					ul.appendChild(E('li', { class: itemActive ? 'active' : '' }, [
						E('a', { href: L.url(url, child.name, item.name) }, [this.icon(item.name), E('span', { class: 'x1-nav-title' }, [_(item.title)])])
					]));
				});
				li.appendChild(ul);
			}
			top.appendChild(li);
		});
		top.style.display = '';
	},

	renderMobileMenu(tree, url) {
		const list = document.getElementById('x1-mobile-list');
		if (!list) return;
		list.innerHTML = '';
		ui.menu.getChildren(tree).forEach((child) => {
			const sub = ui.menu.getChildren(child);
			const li = E('li', {}, [
				E('a', { href: sub.length ? L.url(url, child.name, sub[0].name) : L.url(url, child.name) }, [this.icon(child.name), E('span', {}, [_(child.title)])])
			]);
			if (sub.length) {
				const ul = E('ul', { class: 'x1-submenu' });
				sub.forEach((item) => ul.appendChild(E('li', {}, [E('a', { href: L.url(url, child.name, item.name) }, [_(item.title)])])));
				li.appendChild(ul);
			}
			list.appendChild(li);
		});
	},

	renderTabMenu(tree, url, level = 0) {
		const container = document.getElementById('tabmenu');
		const children = ui.menu.getChildren(tree);
		let activeNode = null;
		if (!container || !children.length) return;
		const ul = E('ul', { class: 'tabs' });
		children.forEach((child) => {
			const active = L.env.dispatchpath[3 + level] === child.name;
			ul.appendChild(E('li', { class: active ? 'active' : '' }, [E('a', { href: L.url(url, child.name) }, [_(child.title)])]));
			if (active) activeNode = child;
		});
		container.appendChild(ul);
		container.style.display = '';
		if (activeNode) this.renderTabMenu(activeNode, `${url}/${activeNode.name}`, level + 1);
	}
});
