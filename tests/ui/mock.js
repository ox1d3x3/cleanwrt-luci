// Mock OpenWrt router backend for the LuCI harness: UCI configs modelled on
// OpenWrt's defaults plus plausible answers for every ubus call the
// luci-base / network / system / status / firewall views make.
'use strict';

let anonCounter = 0;
function cfg(sections) {
	const values = {};
	sections.forEach(([type, name, opts], index) => {
		const id = name || `cfg${(0x0a1b00 + (++anonCounter)).toString(16)}`;
		values[id] = { '.anonymous': !name, '.type': type, '.name': id, '.index': index, ...opts };
	});
	return values;
}

const FW_RULE = (name, o) => ['rule', null, { name, ...o }];

const UCI = {
	network: cfg([
		['interface', 'loopback', { device: 'lo', proto: 'static', ipaddr: '127.0.0.1', netmask: '255.0.0.0' }],
		['globals', 'globals', { ula_prefix: 'fd3c:9e5a:21b0::/48', packet_steering: '1' }],
		['device', null, { name: 'br-lan', type: 'bridge', ports: ['lan1', 'lan2', 'lan3', 'lan4'] }],
		['interface', 'lan', { device: 'br-lan', proto: 'static', ipaddr: '192.168.1.1', netmask: '255.255.255.0', ip6assign: '60' }],
		['interface', 'wan', { device: 'wan', proto: 'dhcp' }],
		['interface', 'wan6', { device: 'wan', proto: 'dhcpv6' }],
		['interface', 'guest', { device: 'br-guest', proto: 'static', ipaddr: '192.168.3.1', netmask: '255.255.255.0' }],
		['device', null, { name: 'br-guest', type: 'bridge', bridge_empty: '1' }],
		['route', null, { interface: 'lan', target: '10.10.0.0/24', gateway: '192.168.1.254' }],
		['rule', null, { in: 'lan', src: '192.168.1.0/24', lookup: 'main', priority: '100' }],
	]),
	wireless: cfg([
		['wifi-device', 'radio0', { type: 'mac80211', path: 'platform/soc/18000000.wifi', band: '2g', channel: '1', htmode: 'HE20', country: 'AU', cell_density: '0' }],
		['wifi-iface', 'default_radio0', { device: 'radio0', network: 'lan', mode: 'ap', ssid: 'OpenWrt', encryption: 'psk2', key: 'supersecret' }],
		['wifi-device', 'radio1', { type: 'mac80211', path: 'platform/soc/18000000.wifi+1', band: '5g', channel: '36', htmode: 'HE80', country: 'AU', cell_density: '0' }],
		['wifi-iface', 'default_radio1', { device: 'radio1', network: 'lan', mode: 'ap', ssid: 'OpenWrt-5G', encryption: 'sae-mixed', key: 'supersecret' }],
		['wifi-iface', 'wifinet2', { device: 'radio0', network: 'guest', mode: 'ap', ssid: 'Guest', encryption: 'none', isolate: '1' }],
	]),
	dhcp: cfg([
		['dnsmasq', null, { domainneeded: '1', localise_queries: '1', rebind_protection: '1', rebind_localhost: '1', local: '/lan/', domain: 'lan', expandhosts: '1', cachesize: '1000', authoritative: '1', readethers: '1', leasefile: '/tmp/dhcp.leases', resolvfile: '/tmp/resolv.conf.d/resolv.conf.auto', localservice: '1', ednspacket_max: '1232' }],
		['dhcp', 'lan', { interface: 'lan', start: '100', limit: '150', leasetime: '12h', dhcpv4: 'server', dhcpv6: 'server', ra: 'server', ra_flags: ['managed-config', 'other-config'] }],
		['dhcp', 'wan', { interface: 'wan', ignore: '1' }],
		['dhcp', 'guest', { interface: 'guest', start: '100', limit: '50', leasetime: '1h' }],
		['odhcpd', 'odhcpd', { maindhcp: '0', leasefile: '/tmp/odhcpd.leases', leasetrigger: '/usr/sbin/odhcpd-update', loglevel: '4' }],
		['host', null, { name: 'nas', mac: ['aa:bb:cc:dd:ee:01'], ip: '192.168.1.10', dns: '1' }],
		['domain', null, { name: 'printer', ip: '192.168.1.20' }],
	]),
	firewall: cfg([
		['defaults', null, { syn_flood: '1', input: 'REJECT', output: 'ACCEPT', forward: 'REJECT' }],
		['zone', null, { name: 'lan', network: ['lan'], input: 'ACCEPT', output: 'ACCEPT', forward: 'ACCEPT' }],
		['zone', null, { name: 'wan', network: ['wan', 'wan6'], input: 'REJECT', output: 'ACCEPT', forward: 'REJECT', masq: '1', mtu_fix: '1' }],
		['zone', null, { name: 'guest', network: ['guest'], input: 'REJECT', output: 'ACCEPT', forward: 'REJECT' }],
		['forwarding', null, { src: 'lan', dest: 'wan' }],
		['forwarding', null, { src: 'guest', dest: 'wan' }],
		FW_RULE('Allow-DHCP-Renew', { src: 'wan', proto: 'udp', dest_port: '68', target: 'ACCEPT', family: 'ipv4' }),
		FW_RULE('Allow-Ping', { src: 'wan', proto: 'icmp', icmp_type: 'echo-request', family: 'ipv4', target: 'ACCEPT' }),
		FW_RULE('Allow-IGMP', { src: 'wan', proto: 'igmp', family: 'ipv4', target: 'ACCEPT' }),
		FW_RULE('Allow-DHCPv6', { src: 'wan', proto: 'udp', dest_port: '546', family: 'ipv6', target: 'ACCEPT' }),
		FW_RULE('Allow-MLD', { src: 'wan', proto: 'icmp', src_ip: 'fe80::/10', icmp_type: ['130/0', '131/0', '132/0', '143/0'], family: 'ipv6', target: 'ACCEPT' }),
		FW_RULE('Allow-ICMPv6-Input', { src: 'wan', proto: 'icmp', icmp_type: ['echo-request', 'echo-reply', 'destination-unreachable'], limit: '1000/sec', family: 'ipv6', target: 'ACCEPT' }),
		FW_RULE('Allow-IPSec-ESP', { src: 'wan', dest: 'lan', proto: 'esp', target: 'ACCEPT' }),
		FW_RULE('Allow-ISAKMP', { src: 'wan', dest: 'lan', dest_port: '500', proto: 'udp', target: 'ACCEPT' }),
		FW_RULE('Guest-DNS', { src: 'guest', dest_port: '53', target: 'ACCEPT' }),
		['redirect', null, { name: 'NAS-HTTPS', src: 'wan', src_dport: '8443', dest: 'lan', dest_ip: '192.168.1.10', dest_port: '443', proto: ['tcp'], target: 'DNAT' }],
		['nat', null, { name: 'SNAT-guest', src: 'wan', src_ip: '192.168.3.0/24', snat_ip: '203.0.113.5', target: 'SNAT', proto: ['all'] }],
		['ipset', null, { name: 'blocklist', family: 'ipv4', match: ['src_ip'], entry: ['198.51.100.7'] }],
	]),
	system: cfg([
		['system', null, { hostname: 'OpenWrt', timezone: 'AWST-8', zonename: 'Australia/Perth', ttylogin: '0', log_size: '128', urandom_seed: '0', compat_version: '1.1' }],
		['timeserver', 'ntp', { enabled: '1', enable_server: '0', server: ['0.openwrt.pool.ntp.org', '1.openwrt.pool.ntp.org', '2.openwrt.pool.ntp.org', '3.openwrt.pool.ntp.org'] }],
		['led', 'led_wan', { name: 'WAN', sysfs: 'green:wan', trigger: 'netdev', dev: 'wan', mode: ['link', 'tx', 'rx'] }],
		['led', 'led_wlan', { name: 'WLAN', sysfs: 'blue:wlan', trigger: 'phy0tpt' }],
	]),
	luci: cfg([
		['core', 'main', { lang: 'auto', mediaurlbase: '/luci-static/cleanx', resourcebase: '/luci-static/resources', ubuspath: '/ubus/' }],
		['extern', 'flash_keep', { uci: '/etc/config/', dropbear: '/etc/dropbear/', openvpn: '/etc/openvpn/', passwd: '/etc/passwd' }],
		['internal', 'languages', { en: 'English' }],
		['internal', 'sauth', { sessionpath: '/tmp/luci-sessions', sessiontime: '3600' }],
		['internal', 'ccache', { enable: '1' }],
		['internal', 'themes', { Bootstrap: '/luci-static/bootstrap', CleanX: '/luci-static/cleanx' }],
		['internal', 'apply', { rollback: '90', holdoff: '4', timeout: '5', display: '1.5' }],
		['internal', 'diag', { dns: 'openwrt.org', ping: 'openwrt.org', route: 'openwrt.org' }],
	]),
	dropbear: cfg([
		['dropbear', null, { PasswordAuth: 'on', RootPasswordAuth: 'on', Port: '22' }],
	]),
	uhttpd: cfg([
		['uhttpd', 'main', { listen_http: ['0.0.0.0:80', '[::]:80'], listen_https: ['0.0.0.0:443', '[::]:443'], redirect_https: '0', home: '/www', rfc1918_filter: '1', max_requests: '3', max_connections: '100', cert: '/etc/uhttpd.crt', key: '/etc/uhttpd.key', cgi_prefix: '/cgi-bin', script_timeout: '60', network_timeout: '30', http_keepalive: '20', tcp_keepalive: '1', ubus_prefix: '/ubus' }],
	]),
	fstab: cfg([
		['global', null, { anon_swap: '0', anon_mount: '0', auto_swap: '1', auto_mount: '1', delay_root: '5', check_fs: '0' }],
	]),
	rpcd: cfg([
		['rpcd', null, { socket: '/var/run/ubus/ubus.sock', timeout: '30' }],
		['login', null, { username: 'root', password: '$p$root', read: ['*'], write: ['*'] }],
	]),
	ucitrack: cfg([]),
	cleanx: cfg([
		['theme', 'theme', { mode: 'auto', dashboard: '1', wan_interface: 'auto', animations: 'balanced' }],
	]),
};

const MAC = (n) => `aa:bb:cc:00:00:${n.toString(16).padStart(2, '0')}`;
const STATS = { rx_bytes: 123456789, tx_bytes: 98765432, rx_packets: 112233, tx_packets: 99887, rx_errors: 0, tx_errors: 0, rx_dropped: 3, tx_dropped: 0, multicast: 12, collisions: 0 };
function netdev(name, o = {}) {
	return {
		name, up: true, mtu: 1500, qlen: 1000, mac: MAC(o.n || 1), devtype: 'ethernet', type: 1, ifindex: o.n || 1,
		flags: { up: true, broadcast: true, promisc: false, loopback: false, noarp: false, multicast: true, pointtopoint: false },
		link: { speed: 1000, duplex: 'full', carrier: true, changes: 3, up_count: 2, down_count: 1 },
		stats: STATS, ipaddrs: [], ip6addrs: [], ...o,
	};
}
const NETDEVS = {
	lo: netdev('lo', { n: 1, devtype: undefined, type: 772, mac: '00:00:00:00:00:00', flags: { up: true, loopback: true }, ipaddrs: [{ address: '127.0.0.1', netmask: '255.0.0.0' }], ip6addrs: [{ address: '::1', netmask: '128' }], mtu: 65536 }),
	eth0: netdev('eth0', { n: 2, mtu: 1504 }),
	eth1: netdev('eth1', { n: 3 }),
	lan1: netdev('lan1', { n: 4, devtype: 'dsa', parent: 'eth0' }),
	lan2: netdev('lan2', { n: 5, devtype: 'dsa', parent: 'eth0' }),
	lan3: netdev('lan3', { n: 6, devtype: 'dsa', parent: 'eth0', up: false, link: { speed: -1, duplex: 'unknown', carrier: false } }),
	lan4: netdev('lan4', { n: 7, devtype: 'dsa', parent: 'eth0' }),
	wan: netdev('wan', { n: 8, devtype: 'dsa', parent: 'eth1', ipaddrs: [{ address: '203.0.113.20', netmask: '24' }], ip6addrs: [{ address: '2001:db8::20', netmask: '64' }] }),
	'br-lan': netdev('br-lan', { n: 9, devtype: 'bridge', bridge: { id: '7fff.aabbcc000009', stp: false, ports: ['lan1', 'lan2', 'lan4', 'phy0-ap0', 'phy1-ap0'] }, ports: ['lan1', 'lan2', 'lan4', 'phy0-ap0', 'phy1-ap0'], ipaddrs: [{ address: '192.168.1.1', netmask: '24' }], ip6addrs: [{ address: 'fd3c:9e5a:21b0::1', netmask: '60' }] }),
	'br-guest': netdev('br-guest', { n: 10, devtype: 'bridge', bridge: { id: '7fff.aabbcc00000a', stp: false, ports: ['phy0-ap1'] }, ports: ['phy0-ap1'], ipaddrs: [{ address: '192.168.3.1', netmask: '24' }] }),
	'phy0-ap0': netdev('phy0-ap0', { n: 11, devtype: 'wlan', wireless: true }),
	'phy1-ap0': netdev('phy1-ap0', { n: 12, devtype: 'wlan', wireless: true }),
	'phy0-ap1': netdev('phy0-ap1', { n: 13, devtype: 'wlan', wireless: true }),
};

function iface(name, proto, device, o = {}) {
	return {
		interface: name, up: true, pending: false, available: true, autostart: true, dynamic: false, uptime: 86400 + name.length * 100,
		l3_device: device, proto, device, updated: ['addresses', 'routes'], metric: 0, dns_metric: 0, delegation: true,
		'ipv4-address': [], 'ipv6-address': [], 'ipv6-prefix': [], 'ipv6-prefix-assignment': [], route: [], 'dns-server': [], 'dns-search': [], neighbors: [], inactive: {}, data: {}, ...o,
	};
}
const IFACES = { interface: [
	iface('loopback', 'static', 'lo', { 'ipv4-address': [{ address: '127.0.0.1', mask: 8 }] }),
	iface('lan', 'static', 'br-lan', { 'ipv4-address': [{ address: '192.168.1.1', mask: 24 }], 'ipv6-prefix-assignment': [{ address: 'fd3c:9e5a:21b0::', mask: 60, 'local-address': { address: 'fd3c:9e5a:21b0::1', mask: 60 } }] }),
	iface('wan', 'dhcp', 'wan', { 'ipv4-address': [{ address: '203.0.113.20', mask: 24 }], route: [{ target: '0.0.0.0', mask: 0, nexthop: '203.0.113.1', source: '203.0.113.20/32' }], 'dns-server': ['203.0.113.53'], data: { leasetime: 86400 } }),
	iface('wan6', 'dhcpv6', 'wan', { 'ipv6-address': [{ address: '2001:db8::20', mask: 64 }], route: [{ target: '::', mask: 0, nexthop: 'fe80::1', source: '2001:db8::/64' }] }),
	iface('guest', 'static', 'br-guest', { 'ipv4-address': [{ address: '192.168.3.1', mask: 24 }] }),
] };

const BOARD = {
	model: { id: 'mock,router', name: 'Mock Router AX3000' },
	network: { lan: { ports: ['lan1', 'lan2', 'lan3', 'lan4'], protocol: 'static' }, wan: { device: 'wan', protocol: 'dhcp' } },
	wlan: { phy0: { info: { antenna_rx: 3, antenna_tx: 3, bands: { '2G': { ht: true, he: true, max_width: 40, modes: ['NOHT', 'HT20', 'HT40', 'HE20', 'HE40'] } }, radios: [] } },
		phy1: { info: { antenna_rx: 3, antenna_tx: 3, bands: { '5G': { ht: true, vht: true, he: true, max_width: 160, modes: ['NOHT', 'HT20', 'HT40', 'VHT20', 'VHT40', 'VHT80', 'HE20', 'HE40', 'HE80', 'HE160'] } }, radios: [] } } },
};

function iwinfo(phy, band, ifname, ssid) {
	return { phy, ssid, bssid: MAC(phy === 'phy0' ? 0x30 : 0x31), mode: 'Master', channel: band === '2g' ? 1 : 36, frequency: band === '2g' ? 2412 : 5180, txpower: 20, quality: 70, quality_max: 70, signal: -40, noise: -95, bitrate: 1200000,
		encryption: { enabled: true, wpa: [2], authentication: ['psk'], ciphers: ['ccmp'] }, hwmodes: band === '2g' ? ['b', 'g', 'n', 'ax'] : ['a', 'n', 'ac', 'ax'], hwmodes_text: '802.11', htmodes: band === '2g' ? ['HT20', 'HT40', 'HE20', 'HE40'] : ['HT20', 'HT40', 'VHT20', 'VHT40', 'VHT80', 'HE20', 'HE40', 'HE80', 'HE160'],
		hardware: { name: 'MediaTek MT7981', id: [0x14c3, 0x7981, 0x14c3, 0x7981] }, country: 'AU', txpower_offset: 0, frequency_offset: 0 };
}
function radio(name, band, ifaces) {
	const sec = UCI.wireless[name];
	return { up: true, pending: false, autostart: true, disabled: false, retry_setup_failed: false, config: { ...sec },
		iwinfo: iwinfo(name === 'radio0' ? 'phy0' : 'phy1', band, null, null),
		interfaces: ifaces.map(([section, ifname]) => ({ section, ifname, config: { ...UCI.wireless[section], mode: 'ap' }, iwinfo: iwinfo(name === 'radio0' ? 'phy0' : 'phy1', band, ifname, UCI.wireless[section].ssid) })) };
}
const WIRELESS = {
	radio0: radio('radio0', '2g', [['default_radio0', 'phy0-ap0'], ['wifinet2', 'phy0-ap1']]),
	radio1: radio('radio1', '5g', [['default_radio1', 'phy1-ap0']]),
};

function freqlist(device) {
	const five = /phy1|radio1|ap0$/.test(device) && !/phy0/.test(device);
	const chans = five ? [36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 149, 153, 157, 161, 165] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
	return { results: chans.map((c) => ({ band: five ? 5 : 2, channel: c, mhz: five ? 5000 + c * 5 : 2407 + c * 5, restricted: false, active: c === (five ? 36 : 1), no_outdoor: false, no_ir: c > 48 && c < 149, dfs: c >= 52 && c <= 144, no_ht40minus: false, no_ht40plus: false, no_80mhz: false, no_160mhz: false })) };
}

const LEDS = {
	'green:wan': { brightness: 1, max_brightness: 1, trigger: 'netdev', triggers: ['none', 'kbd-scrolllock', 'timer', 'heartbeat', 'default-on', 'netdev', 'phy0rx', 'phy0tx', 'phy0assoc', 'phy0radio', 'phy0tpt', 'phy1tpt', 'mmc0'] },
	'blue:wlan': { brightness: 0, max_brightness: 255, trigger: 'phy0tpt', triggers: ['none', 'timer', 'heartbeat', 'default-on', 'netdev', 'phy0tpt', 'phy1tpt'] },
	'red:status': { brightness: 0, max_brightness: 1, trigger: 'none', triggers: ['none', 'timer', 'heartbeat', 'default-on', 'netdev'] },
};

const INITS = Object.fromEntries(['boot', 'system', 'sysntpd', 'network', 'firewall', 'dnsmasq', 'odhcpd', 'dropbear', 'uhttpd', 'rpcd', 'log', 'cron', 'led', 'gpio_switch', 'packet_steering', 'sysfixtime', 'urandom_seed', 'wpad', 'done', 'umount'].map((n, i) => [n, { start: 10 + i * 5, stop: 90 - i * 2, enabled: n !== 'gpio_switch', running: !['boot', 'done', 'umount', 'gpio_switch'].includes(n) }]));

const PROCS = [['1', 'root', '/sbin/procd'], ['512', 'root', '/sbin/ubusd'], ['1340', 'root', '/sbin/netifd'], ['1600', 'dnsmasq', '/usr/sbin/dnsmasq -C /var/etc/dnsmasq.conf.cfg01411c -k -x /var/run/dnsmasq/dnsmasq.cfg01411c.pid'], ['1702', 'root', '/usr/sbin/uhttpd -f -h /www -r OpenWrt'], ['1850', 'root', '/usr/sbin/dropbear -F -P /var/run/dropbear.1.pid -p 22 -K 300 -T 3']]
	.map(([pid, user, command]) => ({ PID: pid, PPID: '1', USER: user, STAT: 'S', VSZ: '1500', '%VSZ': '1%', '%CPU': '0%', COMMAND: command }));

const FILES = {
	'/etc/rc.local': '# Put your custom commands here that should be executed once\n# the system init finished. By default this file does nothing.\n\nexit 0\n',
	'/etc/crontabs/root': '0 4 * * * /sbin/reboot\n',
	'/etc/sysupgrade.conf': '## This file contains files and directories that should\n## be preserved during an upgrade.\n\n# /etc/example.conf\n',
	'/etc/firewall.user': '',
	'/etc/dropbear/authorized_keys': '',
	'/etc/passwd': 'root:x:0:0:root:/root:/bin/ash\ndaemon:*:1:1:daemon:/var:/bin/false\nnetwork:x:101:101:network:/var:/bin/false\n',
	'/etc/group': 'root:x:0:\ndaemon:x:1:\nnetwork:x:101:\n',
	'/etc/iproute2/rt_tables': '128\tprelocal\n255\tlocal\n254\tmain\n253\tdefault\n0\tunspec\n',
	'/proc/filesystems': 'nodev\tsysfs\nnodev\ttmpfs\n\text4\n\tsquashfs\n\tvfat\n',
	'/etc/filesystems': 'ext4\nvfat\n',
	'/etc/services': 'ssh\t\t22/tcp\nhttp\t\t80/tcp\nhttps\t\t443/tcp\ndomain\t\t53/udp\n',
	'/etc/board.json': JSON.stringify(BOARD),
	'/proc/sys/net/netfilter/nf_conntrack_count': '42\n',
	'/proc/sys/net/netfilter/nf_conntrack_max': '16384\n',
	'/etc/opkg/customfeeds.conf': '',
	'/etc/opkg/distfeeds.conf': '',
	'/usr/lib/os-release': 'NAME="OpenWrt"\n',
};

const LOGTEXT = Array.from({ length: 30 }, (_, i) => `Thu Nov  5 15:${String(10 + i).padStart(2, '0')}:00 2026 daemon.info dnsmasq[1600]: query[A] example${i}.org from 192.168.1.${100 + i}`).join('\n');

function now() { return Math.floor(Date.now() / 1000); }

// Returns [code, data] like ubus; code 0 = OK, 4 = not found, 3 = method not found
function call(object, method, args = {}) {
	const k = `${object}.${method}`;
	switch (k) {
	case 'session.access': return [0, { access: true }];
	case 'session.login': return [0, { ubus_rpc_session: 'mocksid', timeout: 3600 }];
	case 'uci.get': {
		const c = UCI[args.config];
		if (!c) return [4];
		if (args.section) {
			const s = c[args.section];
			if (!s) return [4];
			if (args.option) return s[args.option] === undefined ? [4] : [0, { value: s[args.option] }];
			return [0, { values: s }];
		}
		return [0, { values: c }];
	}
	case 'uci.state': return [0, { values: {} }];
	case 'uci.changes': return [0, { changes: {} }];
	case 'uci.configs': return [0, { configs: Object.keys(UCI) }];
	case 'uci.add': return [0, { section: `cfgnew${(++anonCounter).toString(16)}` }];
	case 'uci.set': case 'uci.delete': case 'uci.rename': case 'uci.order': case 'uci.apply': case 'uci.confirm': case 'uci.rollback': case 'uci.revert': case 'uci.commit': return [0, {}];
	case 'luci.getFeatures': return [0, { firewall4: true, firewall: false, nftables: true, dnsmasq: true, odhcpd: true, ipv6: true, hostapd: true, wpasupplicant: true, 'hostapd.11n': true, 'hostapd.11ac': true, 'hostapd.11ax': true, 'hostapd.11r': true, 'hostapd.11w': true, 'hostapd.acs': true, 'hostapd.eap': true, 'hostapd.sae': true, 'hostapd.owe': true, 'hostapd.wps': true, 'hostapd.ocv': true, 'hostapd.cli': true, 'wpasupplicant.sae': true, 'wpasupplicant.owe': true, 'wpasupplicant.eap': true, 'wpasupplicant.11w': true, ipset: true, dnsmasq_full: true, 'dnsmasq.dnssec': true, 'dnsmasq.ipset': true, 'dnsmasq.nftset': true, 'dnsmasq.dhcpv6': true, 'dnsmasq.tftp': true, 'dnsmasq.auth': true, 'dnsmasq.conntrack': true, 'dnsmasq.dhcp': true, 'dnsmasq.dnsmasq': true, rpcd: true, apk: true, opkg: false, ufpd: false, relayd: true, netifd: true, bonding: true, 'wireguard': true, zram: true, swap: true, ubifs: false, ext4: true, nftable: true, mwan3: false, ntpd: true, sysntpd: true }];
	case 'luci.getVersion': return [0, { revision: 'r29300-mock', branch: 'OpenWrt' }];
	case 'luci.getUnixtime': return [0, { result: now() }];
	case 'luci.getTimezones': return [0, { UTC: { tzstring: 'UTC0' }, 'Australia/Perth': { tzstring: 'AWST-8' }, 'Europe/London': { tzstring: 'GMT0BST,M3.5.0/1,M10.5.0' }, 'America/New_York': { tzstring: 'EST5EDT,M3.2.0,M11.1.0' } }];
	case 'luci.getLocaltime': return [0, { result: now() }];
	case 'luci.setLocaltime': return [0, { result: now() }];
	case 'luci.getLEDs': return [0, LEDS];
	case 'luci.getUSBDevices': return [0, { devices: [], ports: [] }];
	case 'luci.getConntrackHelpers': return [0, { result: [{ name: 'ftp', description: 'FTP passive connection tracking', module: 'nf_conntrack_ftp', family: 'ipv4', proto: 'tcp', port: 21 }, { name: 'sip', description: 'SIP VoIP connection tracking', module: 'nf_conntrack_sip', family: 'ipv4', proto: 'udp', port: 5060 }, { name: 'tftp', description: 'TFTP connection tracking', module: 'nf_conntrack_tftp', family: 'ipv4', proto: 'udp', port: 69 }] }];
	case 'luci.getBuiltinEthernetPorts': return [0, { result: ['lan1', 'lan2', 'lan3', 'lan4', 'wan'].map((d, i) => ({ device: d, role: d === 'wan' ? 'wan' : 'lan', netdev: d })) }];
	case 'luci.getSwconfigFeatures': case 'luci.getSwconfigPortState': return [0, {}];
	case 'luci.getMountPoints': return [0, { result: [{ device: '/dev/root', mount: '/rom', fstype: 'squashfs', options: 'ro', size: 6291456, avail: 0, free: 0 }, { device: 'overlayfs:/overlay', mount: '/', fstype: 'overlay', options: 'rw', size: 104857600, avail: 90000000, free: 90000000 }] }];
	case 'luci.getBlockDevices': return [0, { sda1: { dev: '/dev/sda1', uuid: '1234-ABCD', type: 'vfat', size: 8000000000, label: 'USB' } }];
	case 'luci.setBlockDetect': return [0, { result: true }];
	case 'luci.getProcessList': return [0, { result: PROCS }];
	case 'luci.getRealtimeStats': return [0, { result: Array.from({ length: 60 }, (_, i) => [now() - 60 + i, 1, 2, 3, 4, 5, 6, 7]) }];
	case 'luci.getConntrackList': return [0, { result: [{ layer3: 'ipv4', layer4: 'tcp', src: '192.168.1.100', dst: '93.184.216.34', sport: 51000, dport: 443, bytes: 4096, packets: 12 }] }];
	case 'luci.getOdhcp6cStats': return [0, {}];
	case 'luci.getInitList': return [0, INITS];
	case 'luci.setInitAction': return [0, { result: true }];
	case 'luci.setPassword': return [0, { result: true }];
	case 'luci-rpc.getBoardJSON': return [0, BOARD];
	case 'luci-rpc.getNetworkDevices': return [0, NETDEVS];
	case 'luci-rpc.getWirelessDevices': return [0, WIRELESS];
	case 'luci-rpc.getHostHints': return [0, { 'aa:bb:cc:dd:ee:01': { name: 'nas', ipaddrs: ['192.168.1.10'], ip6addrs: [] }, 'aa:bb:cc:dd:ee:02': { name: 'laptop', ipaddrs: ['192.168.1.101'], ip6addrs: ['fd3c:9e5a:21b0::101'] }, 'aa:bb:cc:dd:ee:03': { name: 'phone', ipaddrs: ['192.168.1.102'], ip6addrs: [] } }];
	case 'luci-rpc.getDUIDHints': return [0, { '000100012a3b4c5d': { name: 'laptop', hostname: 'laptop' } }];
	case 'luci-rpc.getDHCPLeases': return [0, { dhcp_leases: [{ hostname: 'laptop', ipaddr: '192.168.1.101', macaddr: 'aa:bb:cc:dd:ee:02', expires: 40000 }, { hostname: 'phone', ipaddr: '192.168.1.102', macaddr: 'aa:bb:cc:dd:ee:03', expires: 30000 }], dhcp6_leases: [{ hostname: 'laptop', ip6addrs: ['fd3c:9e5a:21b0::101/128'], duid: '000100012a3b4c5d', expires: 40000 }] }];
	case 'network.interface.dump': return [0, IFACES];
	case 'network.interface.status': { const i = IFACES.interface.find((x) => x.interface === args.interface); return i ? [0, i] : [4]; }
	case 'network.device.status': { const d = NETDEVS[args.name]; return d ? [0, { ...d, statistics: STATS, carrier: true, speed: '1000F' }] : [0, Object.fromEntries(Object.entries(NETDEVS).map(([n, v]) => [n, { ...v, statistics: STATS }]))]; }
	case 'network.get_proto_handlers': return [0, { static: { no_device: false, no_proto_task: true }, dhcp: {}, dhcpv6: {}, pppoe: {}, none: { no_device: false }, '6in4': { no_device: true }, pppoa: {}, pptp: { no_device: true } }];
	case 'network.wireless.status': return [0, WIRELESS];
	case 'network.rrdns.lookup': return [0, {}];
	case 'iwinfo.devices': return [0, { devices: ['phy0-ap0', 'phy1-ap0', 'phy0-ap1'] }];
	case 'iwinfo.info': return [0, iwinfo(/phy1/.test(args.device) ? 'phy1' : 'phy0', /phy1|radio1/.test(args.device) ? '5g' : '2g', args.device, 'OpenWrt')];
	case 'iwinfo.freqlist': return [0, freqlist(args.device || '')];
	case 'iwinfo.txpowerlist': return [0, { results: [0, 5, 10, 13, 15, 17, 20, 23].map((dbm) => ({ dbm, mw: Math.round(10 ** (dbm / 10)), active: dbm === 20 })) }];
	case 'iwinfo.countrylist': return [0, { results: [['AU', 'AU'], ['DE', 'DE'], ['GB', 'GB'], ['US', 'US'], ['00', '00']].map(([code, iso3166]) => ({ code, iso3166, active: code === 'AU' })) }];
	case 'iwinfo.assoclist': return [0, { results: [{ mac: 'AA:BB:CC:DD:EE:02', signal: -48, noise: -95, inactive: 120, rx: { rate: 866000, mhz: 80, mcs: 9, ht: false, vht: true }, tx: { rate: 866000, mhz: 80, mcs: 9, vht: true } }] }];
	case 'iwinfo.scan': return [0, { results: [] }];
	case 'system.board': return [0, { kernel: '6.6.73', hostname: 'OpenWrt', system: 'ARMv8 Processor rev 4', model: BOARD.model.name, board_name: 'mock,router', rootfs_type: 'squashfs', release: { distribution: 'OpenWrt', version: process.env.OWVER || '25.12.4', revision: 'r29300-mock', target: 'mediatek/filogic', description: `OpenWrt ${process.env.OWVER || '25.12.4'} r29300-mock` } }];
	case 'system.info': return [0, { localtime: now(), uptime: 186400, load: [8000, 6000, 4000], memory: { total: 512000000, free: 300000000, shared: 1000000, buffered: 4000000, available: 330000000, cached: 50000000 }, root: { total: 102400, free: 90000, used: 12400, avail: 90000 }, tmp: { total: 250000, free: 248000, used: 2000, avail: 248000 }, swap: { total: 0, free: 0 } }];
	case 'system.reboot': return [0, {}];
	case 'system.validate_firmware_image': return [0, { valid: true, forceable: true, allow_backup: true, tests: {} }];
	case 'file.read': return FILES[args.path] !== undefined ? [0, { data: FILES[args.path] }] : [4];
	case 'file.write': case 'file.remove': return [0, {}];
	case 'file.stat': case 'file.lstat': {
		if (FILES[args.path] !== undefined || /^\/(www|etc|bin|sbin|usr\/sbin\/(iptables|ip6tables|nft))/.test(args.path) || ['/bin/ping6', '/bin/traceroute6', '/lib/upgrade/platform.sh', '/usr/sbin/nft'].includes(args.path))
			return [0, { path: args.path, type: 'file', size: 100, mode: 33188, atime: now(), mtime: now(), ctime: now(), inode: 1, uid: 0, gid: 0 }];
		return [4];
	}
	case 'file.list': return [0, { entries: args.path === '/www' ? [{ name: 'index.html', type: 'file' }, { name: 'luci-static', type: 'directory' }] : [] }];
	case 'file.exec': {
		const cmd = args.command || '';
		if (/dmesg/.test(cmd)) return [0, { code: 0, stdout: '[    0.000000] Booting Linux on physical CPU 0x0\n[    1.234567] mock: hello\n' }];
		if (/nft/.test(cmd)) return [0, { code: 0, stdout: JSON.stringify({ nftables: [{ metainfo: { version: '1.0.9', json_schema_version: 1 } }] }) }];
		if (/luci-peeraddr/.test(cmd)) return [0, { code: 0, stdout: '{ "inbound_interface": "lan", "remote_addr": "192.168.1.101" }' }];
		return [0, { code: 0, stdout: '', stderr: '' }];
	}
	case 'log.read': return [0, { log: LOGTEXT.split('\n').map((msg, i) => ({ msg, id: i, priority: 30, source: 1, time: (now() - 3000 + i) * 1000 })) }];
	case 'rc.list': return [0, INITS];
	case 'rc.init': return [0, {}];
	case 'service.list': return [0, { dnsmasq: { instances: { cfg01411c: { running: true, pid: 1600 } } }, odhcpd: { instances: { instance1: { running: true } } }, dropbear: { instances: { instance1: { running: true } } } }];
	case 'dsl.metrics': return [4];
	case 'fingerprint.fingerprint': return [0, {}];
	case 'luci.getRealtimeStats.load': return [0, {}];
	}
	return null;
}

module.exports = { call, UCI };
