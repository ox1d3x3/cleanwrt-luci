export function cursor() {
	return {
		get_all: (conf, sect) => (conf == 'cleanx' && sect == 'theme')
			? { mode: getenv('CX_MODE') ?? 'auto', dashboard: '1', animations: getenv('CX_ANIM') ?? 'balanced' } : null,
		get: () => null,
	};
}
