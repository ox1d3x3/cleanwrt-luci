'use strict';
'require view';

// Stand-in for UniWRT's overview page (tests/ui/fixtures): like the real one it
// relies on UniWRT's stylesheet, so under another theme its icon is unsized.
return view.extend({
	render: function() {
		const d = E('div', { 'class': 'u-overview-stub' }, [ E('h2', {}, [ 'UniWRT overview' ]) ]);
		d.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24"><path d="M12 2 3 7v10l9 5 9-5V7z"/></svg>');
		return d;
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
