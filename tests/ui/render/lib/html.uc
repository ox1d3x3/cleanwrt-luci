export function striptags(s) { return replace(`${s ?? ''}`, /<[^>]*>/g, ''); }
export function entityencode(s, attr) {
	s = replace(`${s ?? ''}`, '&', '&#38;'); s = replace(s, '<', '&#60;'); s = replace(s, '>', '&#62;');
	if (attr) { s = replace(s, '"', '&#34;'); s = replace(s, "'", '&#39;'); }
	return s;
}
