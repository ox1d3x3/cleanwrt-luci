'use strict';
'require baseclass';
'require ui';
'require rpc';
'require poll';

return baseclass.extend({
	callSystemInfo: rpc.declare({ object: 'system', method: 'info' }),

	__init__() {
		ui.menu.load().then((tree) => this.render(tree));
		this.bindShellControls();
		this.enhanceLuciContent();
		this.patchChangeIndicator();
		this.startClock();
		this.startProgress();
		this.removeLoader();
		this.bindRipples();
		this.bindButtonFeedback();
		this.installToast();
		this.bindCbiTabsFallback();
		this.startStatusLiveRefresh();
		this.fixModalAndShellDetails();
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
		const wrap = E('span', { class: 'cleanx-nav-icon', 'aria-hidden': 'true' });
		wrap.innerHTML = fallback;
		return wrap;
	},

	bindShellControls() {
		const themeKey = 'cleanx.theme';
		const html = document.documentElement;
		const toggle = document.getElementById('cleanx-theme-toggle');
		const mobileBtn = document.getElementById('cleanx-mobile-menu');
		const mobileDrawer = document.getElementById('cleanx-mobile-drawer');
		const mobileClose = document.getElementById('cleanx-mobile-close');

		const applyTheme = (choice) => {
			const mode = choice || localStorage.getItem(themeKey) || html.dataset.cleanxMode || 'auto';
			const dark = mode === 'dark' || (mode !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
			html.dataset.cleanxTheme = dark ? 'dark' : 'light';
			html.dataset.cleanxThemeChoice = mode;
			localStorage.setItem(themeKey, mode);
		};

		applyTheme(localStorage.getItem(themeKey) || html.dataset.cleanxMode || 'auto');

		if (window.matchMedia) {
			window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
				if ((localStorage.getItem(themeKey) || 'auto') === 'auto') applyTheme('auto');
			});
		}

		toggle?.addEventListener('click', () => applyTheme(html.dataset.cleanxTheme === 'dark' ? 'light' : 'dark'));

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


	enhanceLuciContent() {
		const main = document.getElementById('maincontent') || document.body;
		const positiveWords = /^(install|update|upgrade|save|apply|add|upload|generate|download|flash|configure|start|enable|connect|scan|submit|ok)$/i;
		const dangerWords = /^(delete|remove|reset|reboot|stop|disable|discard|erase|terminate|kill)$/i;
		const neutralWords = /^(clear|refresh|reload|view|edit|restart|restore|backup|browse|choose)$/i;

		const enhance = () => {
			if (!main) return;

			const page = String(document.body.dataset.page || location.pathname || '').toLowerCase();
			const isStatusLike = /status-overview|status\/overview|admin-status-overview|realtime|load|bandwidth|connections/.test(page);

			/* Conservative table handling: do not wrap status/live widgets or native
			 * LuCI structures that rely on their own JS and inline layout. */
			main.querySelectorAll('table, div.table, .cbi-section-table').forEach((table) => {
				if (table.closest('.cleanx-dashboard, #modal_overlay, .ifacebox, .cleanx-port-grid')) return;

				const hasLiveGraph = !!table.querySelector('canvas, .cbi-progressbar, .progress');
				const shouldStayNative = isStatusLike && hasLiveGraph;

				if (shouldStayNative) {
					const wrap = table.closest('.cleanx-table-wrap');
					if (wrap && wrap.parentNode) {
						wrap.parentNode.insertBefore(table, wrap);
						if (!wrap.childElementCount) wrap.remove();
					}
					table.classList.add('cleanx-status-widget');
					return;
				}

				if (table.closest('.cleanx-table-wrap')) return;
				const wrap = document.createElement('div');
				wrap.className = 'cleanx-table-wrap';
				table.parentNode.insertBefore(wrap, table);
				wrap.appendChild(table);
			});

			this.fixPortStatusCards(main);

			main.querySelectorAll('.cbi-map, .cbi-section, fieldset, .panel, .modal').forEach((node) => {
				node.classList.add('cleanx-enhanced-card');
			});

			main.querySelectorAll('button, input[type="submit"], input[type="button"], input[type="reset"], a.cbi-button, .cbi-button, a.btn, .btn').forEach((btn) => {
				if (btn.classList.contains('cleanx-enhanced-button')) return;
				btn.classList.add('cleanx-enhanced-button');

				const text = String(btn.textContent || btn.value || btn.getAttribute('aria-label') || '').trim().toLowerCase().replace(/\.+$/g, '');
				const name = String(btn.getAttribute('name') || '').toLowerCase();
				const cls = String(btn.className || '').toLowerCase();
				const key = text || name;

				if (dangerWords.test(key) || /remove|reset|negative|danger/.test(name + ' ' + cls))
					btn.classList.add('cleanx-action-danger');
				else if (positiveWords.test(key) || /save|apply|positive|action|add|install|update|upload/.test(name + ' ' + cls))
					btn.classList.add('cleanx-action-positive');
				else if (neutralWords.test(key))
					btn.classList.add('cleanx-action-neutral');

				if (!btn.getAttribute('title') && (btn.textContent || btn.value))
					btn.setAttribute('title', String(btn.textContent || btn.value).trim());
			});

			main.querySelectorAll('input, select, textarea').forEach((field) => {
				field.classList.add('cleanx-enhanced-field');
			});
		};

		enhance();
		window.addEventListener('load', enhance, { once: true });
		setTimeout(enhance, 250);
		setTimeout(enhance, 900);

		if (window.MutationObserver && main) {
			let scheduled = false;
			const observer = new MutationObserver(() => {
				if (scheduled) return;
				scheduled = true;
				window.requestAnimationFrame(() => {
					scheduled = false;
					enhance();
				});
			});
			observer.observe(main, { childList: true, subtree: true });
		}
	},


	fixPortStatusCards(main) {
		const page = String(document.body.dataset.page || location.pathname || '').toLowerCase();
		if (!/status|overview/.test(page)) return;

		const markGrid = (grid) => {
			if (!grid) return;
			grid.classList.add('cleanx-port-grid');
			try {
				grid.style.setProperty('display', 'grid', 'important');
				grid.style.setProperty('grid-template-columns', 'repeat(auto-fit, minmax(230px, 1fr))', 'important');
				grid.style.setProperty('gap', '16px', 'important');
				grid.style.setProperty('width', '100%', 'important');
				grid.style.setProperty('max-width', '100%', 'important');
			} catch (_) {}
		};

		main.querySelectorAll('div[style*="minmax(70px"], div[style*="max-width:100px"], div[style*="min-width:70px"]').forEach((node) => {
			if (node.querySelector('.ifacebox')) markGrid(node);
		});

		main.querySelectorAll('.ifacebox').forEach((box) => {
			box.classList.add('cleanx-port-card');
			markGrid(box.parentElement);

			try {
				box.style.setProperty('width', '100%', 'important');
				box.style.setProperty('min-width', '0', 'important');
				box.style.setProperty('max-width', 'none', 'important');
				box.style.setProperty('margin', '0', 'important');
			} catch (_) {}

			box.querySelectorAll('.cbi-tooltip-container > .cbi-tooltip').forEach((tip) => {
				tip.setAttribute('aria-hidden', 'true');
				try {
					tip.style.setProperty('display', 'none', 'important');
					tip.style.setProperty('position', 'absolute', 'important');
				} catch (_) {}
			});

			box.querySelectorAll('.ifacebox-body br').forEach((br) => {
				br.dataset.cleanxHidden = '1';
			});
		});
	},

	startStatusLiveRefresh() {
		const page = String(document.body.dataset.page || location.pathname || '').toLowerCase();
		if (!/admin-status-overview|status\/overview|\/admin$/.test(page)) return;

		const fmtBytes = (value) => {
			const units = [ 'B', 'KB', 'MB', 'GB', 'TB', 'PB' ];
			let n = Number(value || 0), u = 0;
			while (n >= 1024 && u < units.length - 1) { n /= 1024; u++; }
			const d = u === 0 || n >= 100 ? 0 : n >= 10 ? 1 : 2;
			return n.toFixed(d) + ' ' + units[u];
		};

		const setProgress = (row, value, max) => {
			if (!row || !max) return;
			const pct = Math.max(0, Math.min(100, Math.floor((100 / max) * value)));
			const bar = row.querySelector('.cbi-progressbar, .progress');
			if (!bar) return;
			let fill = bar.firstElementChild || bar.appendChild(document.createElement('div'));
			bar.title = '%s / %s (%d%%)'.format(fmtBytes(value), fmtBytes(max), pct);
			bar.dataset.cleanxLive = 'true';
			fill.style.width = pct.toFixed(2) + '%';
		};

		const findRow = (label) => {
			label = label.toLowerCase();
			for (const row of document.querySelectorAll('#maincontent table.table tr, #maincontent .table .tr')) {
				const first = row.querySelector('td:first-child, .td:first-child, .td.left, td.left');
				const text = String(first?.textContent || '').trim().toLowerCase();
				if (text === label) return row;
			}
			return null;
		};

		const update = async () => {
			try {
				const system = await this.callSystemInfo();
				const mem = system?.memory || {};
				const swap = system?.swap || {};
				const total = Number(mem.total || 0);
				if (total) {
					const available = Number(mem.available || ((mem.free || 0) + (mem.buffered || 0)) || 0);
					const used = Math.max(total - Number(mem.free || 0), 0);
					setProgress(findRow('Total Available'), available, total);
					setProgress(findRow('Used'), used, total);
					if (mem.buffered) setProgress(findRow('Buffered'), Number(mem.buffered), total);
					if (mem.cached) setProgress(findRow('Cached'), Number(mem.cached), total);
				}
				if (swap.total > 0) setProgress(findRow('Swap free'), Number(swap.free || 0), Number(swap.total || 0));
			} catch (err) {
				console.debug('[CleanX] Status memory refresh skipped:', err);
			}
		};

		update();
		poll.add(update, 3);
	},

	patchChangeIndicator() {
		const original = ui.changes?.setIndicator;
		if (!original) return;
		ui.changes.setIndicator = function(n) {
			original.call(this, n);
			document.documentElement.dataset.cleanxChanges = n || 0;
		};
	},

	startClock() {
		const el = document.getElementById('cleanx-clock');
		if (!el) return;
		const tick = () => {
			const now = new Date();
			el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		};
		tick(); setInterval(tick, 30000);
	},

	startProgress() {
		const bar = document.getElementById('cleanx-scroll-progress');
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
		const hide = () => document.getElementById('cleanx-page-loader')?.classList.add('cleanx-hidden');
		window.addEventListener('load', hide, { once: true });
		setTimeout(hide, 900);
	},

	bindRipples() {
		document.addEventListener('click', (ev) => {
			const target = ev.target.closest('button, input[type="submit"], input[type="button"], input[type="reset"], .btn, .cbi-button, [role="button"], .cleanx-main-nav a, .cleanx-mode-menu a');
			if (!target) return;

			const page = String(document.body.dataset.page || '').toLowerCase();
			if (target.closest('#maincontent, #modal_overlay')) return;
			if (/package-manager|software|opkg|flash|backup/.test(page)) return;

			/* Input elements cannot safely contain ripple child nodes. Do not risk breaking LuCI submit/upload actions. */
			if (target.tagName === 'INPUT') return;

			const cs = getComputedStyle(target);
			if (cs.position === 'static') target.style.position = 'relative';
			target.style.overflow = 'hidden';
			const rect = target.getBoundingClientRect();
			const size = Math.max(rect.width, rect.height);
			const ripple = document.createElement('span');
			ripple.className = 'cleanx-ripple';
			ripple.style.width = ripple.style.height = size + 'px';
			ripple.style.left = (ev.clientX - rect.left - size / 2) + 'px';
			ripple.style.top = (ev.clientY - rect.top - size / 2) + 'px';
			target.appendChild(ripple);
			setTimeout(() => ripple.remove(), 560);
		});
	},


	bindButtonFeedback() {
		document.addEventListener('click', (ev) => {
			const btn = ev.target.closest('button, input[type="submit"], input[type="button"], a.cbi-button, .cbi-button, .btn');
			if (!btn || btn.disabled || btn.classList.contains('cleanx-click-busy')) return;

			/* Package manager, flash/backup and modal actions depend on native LuCI
			 * event handlers. Avoid adding decorative state to them. */
			if (btn.closest('#maincontent, #modal_overlay')) return;
			if (/package-manager|software|opkg|flash|backup/.test(String(document.body.dataset.page || ''))) return;

			const type = (btn.getAttribute('type') || '').toLowerCase();
			const text = String(btn.textContent || btn.value || '').trim().toLowerCase();
			if (type === 'button' && !/update|install|upload|save|apply|flash|generate/.test(text)) return;
			btn.classList.add('cleanx-click-busy');
			setTimeout(() => btn.classList.remove('cleanx-click-busy'), 1300);
		}, true);
	},


	bindCbiTabsFallback() {
		/* LuCI normally binds CBI tabs itself. This fallback only ensures the tab
		 * remains usable when a page is saved/re-rendered or third-party pages miss
		 * the native handler. It only touches tabs inside the same cbi-map. */
		document.addEventListener('click', (ev) => {
			const a = ev.target.closest('.cbi-tabmenu > li[data-tab] > a');
			if (!a) return;

			const li = a.closest('li[data-tab]');
			const tab = li && li.getAttribute('data-tab');
			const menu = a.closest('.cbi-tabmenu');
			const map = menu && menu.closest('.cbi-map, .cbi-section, #view, main, body');
			const tabbed = menu && menu.nextElementSibling && menu.nextElementSibling.classList && menu.nextElementSibling.classList.contains('cbi-map-tabbed')
				? menu.nextElementSibling
				: (map && map.querySelector('.cbi-map-tabbed'));

			if (!tab || !menu || !tabbed) return;

			ev.preventDefault();
			menu.querySelectorAll(':scope > li[data-tab]').forEach((item) => {
				const active = item === li;
				item.classList.toggle('cbi-tab', active);
				item.classList.toggle('cbi-tab-disabled', !active);
				item.classList.toggle('active', active);
			});
			tabbed.querySelectorAll(':scope > [data-tab]').forEach((panel) => {
				const active = panel.getAttribute('data-tab') === tab;
				panel.dataset.tabActive = active ? 'true' : 'false';
				panel.hidden = !active;
				panel.style.display = active ? '' : 'none';
			});
		}, true);
	},

	installToast() {
		window.cleanxToast = (message, type = 'info', duration = 3500) => {
			let stack = document.querySelector('.cleanx-toast-stack');
			if (!stack) {
				stack = document.createElement('div');
				stack.className = 'cleanx-toast-stack';
				document.body.appendChild(stack);
			}
			const toast = document.createElement('div');
			toast.className = 'cleanx-toast ' + type;
			toast.textContent = message;
			stack.appendChild(toast);
			setTimeout(() => {
				toast.style.opacity = '0';
				toast.style.transform = 'translateY(10px) scale(.98)';
				setTimeout(() => toast.remove(), 220);
			}, duration);
		};
	},


	fixModalAndShellDetails() {
		const mark = () => {
			const menu = document.getElementById('cleanx-mobile-menu');
			if (menu && !menu.getAttribute('title')) menu.setAttribute('title', 'Open menu');

			document.querySelectorAll('#modal_overlay .modal').forEach((modal) => {
				modal.classList.add('cleanx-modal-ready');

				/* LuCI package manager dependency dialogs contain nested UL/LI trees
				 * with state buttons. Keep native nodes and handlers intact, but wrap
				 * plain text so CSS can align package names and state pills cleanly. */
				modal.querySelectorAll('button, .cbi-button, input[type="button"], input[type="submit"]').forEach((btn) => {
					btn.classList.add('cleanx-modal-button');
					const label = String(btn.textContent || btn.value || '').trim().toLowerCase();
					if (/installed|not available|missing|available/.test(label))
						btn.classList.add('cleanx-package-state');
				});

				modal.querySelectorAll('ul').forEach((ul) => {
					ul.classList.add('cleanx-modal-list');
					if (ul.textContent && /dependencies|installed|not available|required dependency|package/i.test(ul.textContent))
						ul.classList.add('cleanx-dependency-tree');
					if (ul.querySelector('.cleanx-package-state'))
						ul.classList.add('cleanx-dependency-tree');
				});

				modal.querySelectorAll('li').forEach((li) => {
					if (!li.querySelector('button, .cbi-button, input[type="button"], input[type="submit"], .cleanx-package-state')) return;
					li.classList.add('cleanx-dependency-row');

					if (li.querySelector(':scope > .cleanx-dependency-label')) return;

					const label = document.createElement('span');
					label.className = 'cleanx-dependency-label';
					let moved = false;

					Array.from(li.childNodes).forEach((node) => {
						if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
							label.appendChild(node);
							moved = true;
						}
						else if (node.nodeType === Node.ELEMENT_NODE) {
							const el = node;
							if (el.matches('button, .cbi-button, input[type="button"], input[type="submit"], ul, ol')) return;
							if (el.classList && el.classList.contains('cleanx-dependency-label')) return;
							label.appendChild(el);
							moved = true;
						}
					});

					if (moved) li.insertBefore(label, li.firstChild);
				});
			});
		};

		mark();
		window.addEventListener('load', mark, { once: true });
		setTimeout(mark, 250);
		setTimeout(mark, 900);
		if (window.MutationObserver) {
			const observer = new MutationObserver(() => window.requestAnimationFrame(mark));
			observer.observe(document.body, { childList: true, subtree: true });
		}
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
				this.icon(child.name), E('span', { class: 'cleanx-nav-title' }, [_(child.title)]), sub.length ? E('span', { class: 'cleanx-nav-chevron' }, ['›']) : ''
			]);
			const li = E('li', { class: active ? 'active' : '' }, [link]);
			if (sub.length) {
				const ul = E('ul', { class: 'cleanx-submenu' });
				sub.forEach((item) => {
					const itemActive = L.env.dispatchpath.indexOf(item.name) !== -1;
					ul.appendChild(E('li', { class: itemActive ? 'active' : '' }, [
						E('a', { href: L.url(url, child.name, item.name) }, [this.icon(item.name), E('span', { class: 'cleanx-nav-title' }, [_(item.title)])])
					]));
				});
				li.appendChild(ul);
			}
			top.appendChild(li);
		});
		top.style.display = '';
	},

	renderMobileMenu(tree, url) {
		const list = document.getElementById('cleanx-mobile-list');
		if (!list) return;
		list.innerHTML = '';
		ui.menu.getChildren(tree).forEach((child) => {
			const sub = ui.menu.getChildren(child);
			const li = E('li', {}, [
				E('a', { href: sub.length ? L.url(url, child.name, sub[0].name) : L.url(url, child.name) }, [this.icon(child.name), E('span', {}, [_(child.title)])])
			]);
			if (sub.length) {
				const ul = E('ul', { class: 'cleanx-submenu' });
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
