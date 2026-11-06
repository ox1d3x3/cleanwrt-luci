'use strict';
'require view';

// Stand-in for UniWRT's settings page (tests/ui/fixtures).
return view.extend({
	render: function() { return E('div', {}, [ E('h2', {}, [ 'UniWRT Theme' ]) ]); },
	handleSaveApply: null, handleSave: null, handleReset: null
});
