'use strict';
'require view';
'require form';
'require uci';

/*
 * System → CleanX Theme: the options in /etc/config/cleanx, as a plain LuCI
 * form (it works under any theme). The theme reads them on every page load,
 * so changes show after saving and reloading the page.
 */
return view.extend({
	load: function() {
		return uci.load('cleanx').then(() => {
			/* installs older than 0.6.1 may lack the section */
			if (!uci.get('cleanx', 'theme')) uci.add('cleanx', 'theme', 'theme');
		});
	},

	render: function() {
		let m, s, o;

		m = new form.Map('cleanx', _('CleanX Theme'),
			_('Configure the CleanX theme. Changes apply after saving and reloading the page.'));

		/* ---- Appearance ---- */
		s = m.section(form.NamedSection, 'theme', 'theme', _('Appearance'));
		s.anonymous = true;

		o = s.option(form.ListValue, 'mode', _('Colour scheme'),
			_('"Auto" follows the light or dark setting of your device. The switch in the top bar overrides this in each browser.'));
		o.value('auto', _('Auto (follow device)'));
		o.value('light', _('Light'));
		o.value('dark', _('Dark'));
		o.default = 'auto';

		o = s.option(form.ListValue, 'animations', _('Animations'),
			_('Balanced: hover effects, and icon animations that play briefly after a page loads. Full: icons and the background keep moving (best with a fast graphics chip). Off: no motion at all.'));
		o.value('balanced', _('Balanced'));
		o.value('full', _('Full'));
		o.value('off', _('Off'));
		o.default = 'balanced';

		/* ---- Overview ---- */
		s = m.section(form.NamedSection, 'theme', 'theme', _('Overview'));
		s.anonymous = true;

		o = s.option(form.Flag, 'dashboard', _('Live dashboard'),
			_('Download and upload speed, CPU, RAM and uptime at the top of Status → Overview.'));
		o.default = '1';
		o.rmempty = false;

		/* ---- Network Map ---- */
		s = m.section(form.NamedSection, 'theme', 'theme', _('Network Map'));
		s.anonymous = true;

		o = s.option(form.Value, 'netmap_interval', _('Refresh every (seconds)'),
			_('How often the Network Map updates while it is open (3–60). The router is only asked while the page is visible.'));
		o.datatype = 'range(3,60)';
		o.placeholder = '5';
		o.default = '5';

		return m.render();
	}
});
