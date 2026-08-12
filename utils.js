/* utils.js - shared helpers for the AP Payment Operations Console
 * Meridian Corp - IT Dept
 *
 * History
 *   1.0  formatting helpers lifted from the old intranet portal
 *   1.4  added the HTML builders for the AP queue table
 *   2.0  added risk banding for the ERP feed
 *   2.4  (no change - version bumped with the app)
 */

var CENTS = 100;

/* ------------------------------------------------------------------
 * money / number formatting
 * ------------------------------------------------------------------ */

function money(cents) {
	if (cents === null || cents === undefined) { return '0.00'; }
	var neg = false;
	if (cents < 0) { neg = true; cents = -cents; }
	var whole = Math.floor(cents / CENTS);
	var frac = cents - (whole * CENTS);
	var s = String(whole);
	var out = '';
	var count = 0;
	for (var i = s.length - 1; i >= 0; i--) {
		out = s.charAt(i) + out;
		count++;
		if (count % 3 === 0 && i > 0) { out = ',' + out; }
	}
	if (frac < 10) { frac = '0' + frac; }
	return (neg ? '-' : '') + out + '.' + frac;
}

function millions(cents) {
	return '$' + (cents / 100000000).toFixed(2) + 'M';
}

function pad(n, width) {
	var s = String(n);
	while (s.length < width) { s = '0' + s; }
	return s;
}

/* ------------------------------------------------------------------
 * escaping - used by the HTML builders below and by the XML feed
 * ------------------------------------------------------------------ */

function esc(v) {
	if (v === null || v === undefined) { return ''; }
	return String(v)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function xmlEsc(v) {
	return esc(v);
}

/* ------------------------------------------------------------------
 * HTML string builders
 * these predate the templates - the held payments table still uses them
 * ------------------------------------------------------------------ */

function td(v, cls) {
	if (cls) { return '<td class="' + cls + '">' + esc(v) + '</td>'; }
	return '<td>' + esc(v) + '</td>';
}

function tdRaw(html, cls) {
	if (cls) { return '<td class="' + cls + '">' + html + '</td>'; }
	return '<td>' + html + '</td>';
}

function link(href, text) {
	return '<a href="' + href + '">' + esc(text) + '</a>';
}

function statusLabel(status) {
	var cls = 'label';
	if (status == 'PENDING') { cls = 'label'; }
	else if (status == 'REVIEW') { cls = 'label label-info'; }
	else if (status == 'HOLD') { cls = 'label label-warning'; }
	else if (status == 'ESCALATED') { cls = 'label label-important'; }
	else if (status == 'RESOLVED') { cls = 'label label-success'; }
	return '<span class="' + cls + '">' + esc(status) + '</span>';
}

function riskLabel(flag) {
	if (flag == 'HIGH') { return '<span class="risk-high">HIGH</span>'; }
	if (flag == 'MED') { return '<span class="risk-med">MED</span>'; }
	return '<span class="risk-low">LOW</span>';
}

function ageCell(days) {
	if (days >= 7) { return '<span class="age-old">' + days + 'd</span>'; }
	return days + 'd';
}

/* ------------------------------------------------------------------
 * risk banding - shared with /api/risk-score
 * ------------------------------------------------------------------ */

function bandFor(score) {
	if (score >= 70) { return 'HIGH'; }
	if (score >= 40) { return 'MEDIUM'; }
	return 'LOW';
}

function isRoundDollar(cents) {
	if (cents % 100 !== 0) { return false; }
	var dollars = cents / 100;
	if (dollars % 1000 === 0) { return true; }
	if (dollars % 500 === 0) { return true; }
	return false;
}

/* ------------------------------------------------------------------
 * misc
 * ------------------------------------------------------------------ */

function csvCell(v) {
	if (v === null || v === undefined) { return ''; }
	var s = String(v);
	if (s.indexOf(',') > -1 || s.indexOf('"') > -1) {
		return '"' + s.replace(/"/g, '""') + '"';
	}
	return s;
}

function qs(obj) {
	var parts = [];
	for (var k in obj) {
		if (obj[k] === null || obj[k] === undefined || obj[k] === '') { continue; }
		parts.push(k + '=' + encodeURIComponent(obj[k]));
	}
	if (parts.length === 0) { return ''; }
	return '?' + parts.join('&');
}

/* left over from the site-code lookup that moved to the finance portal in
   2013. the reports page used to call this. leaving it in case AP ask for the
   old breakdown back.
function siteName(code) {
	var map = { '01': 'Head Office', '02': 'Dockside DC', '03': 'Frankfurt Plant', '04': 'Singapore Hub' };
	if (map[code]) { return map[code]; }
	return 'Unknown site ' + code;
}

function siteRegion(code) {
	if (code == '01' || code == '02') { return 'UK'; }
	if (code == '03') { return 'EMEA'; }
	return 'APAC';
}
*/

/* TODO fix after Q3 2014 release - the AP desk wants the age clock to stop
   at weekends and public holidays. The calendar table was never delivered by
   the reference data team so this is still calendar days. Raised as INC-44192.
function businessAge(created, asOf) {
	var days = 0;
	var cur = new Date(created);
	while (cur < asOf) {
		var d = cur.getDay();
		if (d !== 0 && d !== 6) { days++; }
		cur = new Date(cur.getTime() + 86400000);
	}
	return days;
}
*/

/* not called any more - kept for the year end extract */
function fiscalQuarter(dateStr) {
	var m = parseInt(dateStr.substring(5, 7), 10);
	if (m <= 3) { return 'Q1'; }
	if (m <= 6) { return 'Q2'; }
	if (m <= 9) { return 'Q3'; }
	return 'Q4';
}

/* superseded by money() - do not use in new code */
function formatAmountOld(amt) {
	return '$' + amt.toFixed(2);
}

exports.money = money;
exports.millions = millions;
exports.pad = pad;
exports.esc = esc;
exports.xmlEsc = xmlEsc;
exports.td = td;
exports.tdRaw = tdRaw;
exports.link = link;
exports.statusLabel = statusLabel;
exports.riskLabel = riskLabel;
exports.ageCell = ageCell;
exports.bandFor = bandFor;
exports.isRoundDollar = isRoundDollar;
exports.csvCell = csvCell;
exports.qs = qs;
exports.fiscalQuarter = fiscalQuarter;
exports.formatAmountOld = formatAmountOld;
