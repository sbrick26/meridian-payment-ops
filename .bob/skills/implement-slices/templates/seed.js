/* seed.js
 * AP Payment Operations Console - database load utility
 * Meridian Corp - IT Dept - Finance Systems Team
 *
 * Loads the nightly ERP payables extract into payops.db. Run from the app
 * directory:
 *     node seed.js
 * The console will also call this automatically when payops.db is missing.
 *
 * NOTE: the extract is generated from a fixed sequence so that the numbers on
 * the dashboard match the numbers in the monthly payables control pack. Do not
 * put a clock or a random call in here - the control pack reconciliation will
 * break.
 */

var fs = require('fs');
var path = require('path');
var Database = require('better-sqlite3');

var DB_FILE = process.env.DB_PATH || path.join(__dirname, 'payops.db');
var BASE_DATE = '2026-08-01';           /* as-of date for the extract */
var OPEN_TARGET = 247;                  /* open inquiries / held payments */
var RESOLVED_TARGET = 150;              /* closed items kept for reporting */
var HELD_TARGET_CENTS = 231000000;      /* 2.31M payable held - per control pack */
var AVG_AGE_TARGET_DAYS = 4.2;
var HIGH_RISK_TARGET = 12;

/* ------------------------------------------------------------------ */
/* fixed sequence generator (linear congruential - same as the old VB  */
/* extract tool used, kept so the record order does not move around)   */
/* ------------------------------------------------------------------ */
var seedState = 1013904223;
function nextRand() {
	seedState = (seedState * 1664525 + 1013904223) % 4294967296;
	return seedState / 4294967296;
}
function pick(arr) {
	return arr[Math.floor(nextRand() * arr.length) % arr.length];
}
function between(lo, hi) {
	return lo + Math.floor(nextRand() * (hi - lo + 1));
}

/* ------------------------------------------------------------------ */
/* reference data                                                      */
/* ------------------------------------------------------------------ */

var VENDOR_NAMES = [
	'Northwind Supply', 'Calder Industrial', 'Blue Harbor Logistics',
	'Redstone Packaging', 'Kestrel Marine Supply', 'Ardmore Textiles',
	'Rheinbach Werke', 'Casa Delgado Foods', 'Pinnacle Freight',
	'Sundara Trading', 'Orchard Lane Retail', 'Fairmont Bearings',
	'Monterrey Metals', 'Loxley Chemicals', 'Anders Beck Elektronik',
	'Windrow Agriculture', 'Silverpine Paper', 'Bramley Print Works',
	'Cortland Motors', 'Weissbach Optik', 'Marisol Alimentos',
	'Dunmore Packaging', 'Sable Ridge Energy', 'Hollis Instruments',
	'Keppel Straits Shipping', 'Fennimore Grain', 'Ostheim Kunststoff',
	'Ravenswood Media', 'Del Rio Interiors', 'Talbot Ironworks',
	'Serrano Produce', 'Ashford Medical Supply', 'Lindberg Marine',
	'Copperfield Mining', 'Yeo Heng Manufacturing', 'Whitcombe Dairy',
	'Beaumont Aerospace', 'Gruner Landtechnik', 'Villalobos Coffee',
	'Sedgewick Plastics', 'Corbin Rail Services', 'Marina Bay Exports',
	'Thornbury Estates', 'Hartwell Chemicals', 'Neustadt Maschinenbau',
	'Castilla Wines', 'Pemberton Glass', 'Ironvale Fabricators',
	'Lion City Trading', 'Ellingham Foods', 'Redmond Circuit Works',
	'Baumgartner Stahl', 'Puerta Norte Logistics', 'Stanhope Timber',
	'Waverly Pumps', 'Nanyang Chemicals', 'Highfield Timber',
	'Foxcroft Beverages', 'Hessler Precision', 'Alvarado Textiles'
];

var COUNTRY_FOR = [
	'US', 'GB', 'US', 'US', 'SG', 'MX', 'DE', 'MX', 'US', 'SG',
	'GB', 'US', 'MX', 'GB', 'DE', 'US', 'GB', 'GB', 'US', 'DE',
	'MX', 'GB', 'US', 'US', 'SG', 'US', 'DE', 'GB', 'MX', 'US',
	'MX', 'GB', 'SE', 'US', 'SG', 'GB', 'US', 'DE', 'MX', 'GB',
	'US', 'SG', 'GB', 'US', 'DE', 'MX', 'GB', 'US', 'SG', 'GB',
	'US', 'DE', 'MX', 'GB', 'US', 'SG', 'GB', 'US', 'DE', 'MX'
];

/* purchasing category the vendor is set up against in the ERP */
var CATEGORIES = ['MRO', 'LOGISTICS', 'RAW MATERIALS', 'SERVICES', 'IT', 'FACILITIES'];

var AP_CLERKS = [
	['D. Whitaker', 'DWH', 'AP-DESK-1', 'd.whitaker@meridiancorp.example'],
	['R. Okafor', 'ROK', 'AP-DESK-1', 'r.okafor@meridiancorp.example'],
	['M. Castellanos', 'MCA', 'AP-DESK-1', 'm.castellanos@meridiancorp.example'],
	['S. Brannigan', 'SBR', 'AP-DESK-2', 's.brannigan@meridiancorp.example'],
	['L. Fontaine', 'LFO', 'AP-DESK-2', 'l.fontaine@meridiancorp.example'],
	['T. Nakashima', 'TNA', 'AP-DESK-2', 't.nakashima@meridiancorp.example'],
	['P. Aderinto', 'PAD', 'AP-CONTROLS', 'p.aderinto@meridiancorp.example'],
	['G. Hollins', 'GHO', 'AP-CONTROLS', 'g.hollins@meridiancorp.example']
];

var PTYPES = ['WIRE', 'WIRE', 'WIRE', 'ACH', 'ACH', 'SEPA'];
var OPEN_STATUSES = ['PENDING', 'PENDING', 'PENDING', 'REVIEW', 'REVIEW', 'HOLD', 'ESCALATED'];

/* ERP payment block / hold reasons */
var REASON_CODES = [
	['H14', 'Missing goods receipt - GR/IR not cleared'],
	['H21', 'Duplicate invoice suspected'],
	['H33', 'PO mismatch - price or quantity'],
	['H07', 'Bank details changed - verification required'],
	['H41', 'Over approval limit - second sign-off required'],
	['H52', 'Vendor onboarding incomplete'],
	['H18', 'Invoice exceeds remaining PO balance'],
	['H09', 'Vendor on payment block'],
	['H26', 'Cost centre or GL coding missing'],
	['H63', 'Tax certificate expired']
];

/* vendor bank BICs carried on the remittance record */
var VENDOR_BANKS = [
	'BARCGB22', 'CHASUS33', 'DEUTDEFF', 'DBSSSGSG', 'BNMXMXMM',
	'CITIUS33', 'HSBCGB2L', 'COBADEFF', 'UOVBSGSG', 'WFBIUS6S'
];

var NOTE_TEXT = [
	'Vendor called the AP hotline chasing a payment date - advised item is held.',
	'Goods receipt confirmed by the warehouse, GR/IR now cleared.',
	'Emailed the vendor for a corrected invoice, no response yet. Chased.',
	'Passed to AP-CONTROLS, out of scope for AP-DESK-1.',
	'Duplicate check run against the prior five payment runs - no match found.',
	'Awaiting sign-off from the cost centre owner, over the approval limit.',
	'Bank change request not on file - callback to the vendor master team raised.',
	'Held pending funding confirmation from treasury for the Friday run.',
	'Buyer confirmed the price variance, PO amended and re-matched.',
	'Second pair of eyes requested per procedure AP-114.'
];

var RESOLUTIONS = ['RELEASED', 'RELEASED', 'RELEASED', 'RETURNED', 'CANCELLED', 'CORRECTED'];

/* the ERP feeds the payment run the item is queued against */
var RUN_SUFFIX = ['ACH', 'WIRE', 'SEPA', 'ACH', 'ACH'];

/* ------------------------------------------------------------------ */
/* date helpers - plain UTC arithmetic, no library                     */
/* ------------------------------------------------------------------ */
function baseMillis() {
	var p = BASE_DATE.split('-');
	return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}
function dateMinusDays(days) {
	var d = new Date(baseMillis() - (days * 86400000));
	return d.toISOString().substring(0, 10);
}
function stampMinusDays(days, hh, mm) {
	var two = function (n) { return (n < 10 ? '0' : '') + n; };
	return dateMinusDays(days) + ' ' + two(hh) + ':' + two(mm) + ':00';
}

/* ------------------------------------------------------------------ */
/* schema                                                              */
/* ------------------------------------------------------------------ */
var SCHEMA = [
	'CREATE TABLE vendors (',
	'  id INTEGER PRIMARY KEY,',
	'  name TEXT NOT NULL,',
	'  country TEXT NOT NULL,',
	'  vendor_no TEXT NOT NULL,',
	'  category TEXT NOT NULL,',
	'  new_vendor TEXT NOT NULL',
	');',
	'CREATE TABLE ap_clerks (',
	'  id INTEGER PRIMARY KEY,',
	'  name TEXT NOT NULL,',
	'  initials TEXT NOT NULL,',
	'  team TEXT NOT NULL,',
	'  email TEXT NOT NULL',
	');',
	'CREATE TABLE exceptions (',
	'  id INTEGER PRIMARY KEY,',
	'  payment_ref TEXT NOT NULL,',
	'  invoice_no TEXT NOT NULL,',
	'  po_no TEXT NOT NULL,',
	'  vendor_id INTEGER NOT NULL,',
	'  ptype TEXT NOT NULL,',
	'  amount_cents INTEGER NOT NULL,',
	'  currency TEXT NOT NULL,',
	'  status TEXT NOT NULL,',
	'  risk_flag TEXT NOT NULL,',
	'  age_days INTEGER NOT NULL,',
	'  created_date TEXT NOT NULL,',
	'  invoice_date TEXT NOT NULL,',
	'  due_date TEXT NOT NULL,',
	'  expected_pay_date TEXT NOT NULL,',
	'  value_date TEXT NOT NULL,',
	'  payment_run_id TEXT NOT NULL,',
	'  clerk_id INTEGER,',
	'  reason_code TEXT NOT NULL,',
	'  reason_text TEXT NOT NULL,',
	'  remit_to TEXT NOT NULL,',
	'  bank_bic TEXT NOT NULL,',
	'  bank_chg_days INTEGER NOT NULL,',
	'  channel TEXT NOT NULL,',
	'  resolved_date TEXT,',
	'  resolution TEXT',
	');',
	'CREATE TABLE notes (',
	'  id INTEGER PRIMARY KEY,',
	'  exception_id INTEGER NOT NULL,',
	'  author TEXT NOT NULL,',
	'  note_date TEXT NOT NULL,',
	'  body TEXT NOT NULL',
	');',
	'CREATE INDEX ix_exc_status ON exceptions (status);',
	'CREATE INDEX ix_exc_ref ON exceptions (payment_ref);',
	'CREATE INDEX ix_exc_inv ON exceptions (invoice_no);',
	'CREATE INDEX ix_notes_exc ON notes (exception_id);'
].join('\n');

/* ------------------------------------------------------------------ */
/* build                                                               */
/* ------------------------------------------------------------------ */
function build() {
	if (fs.existsSync(DB_FILE)) {
		fs.unlinkSync(DB_FILE);
	}
	var db = new Database(DB_FILE);
	db.exec(SCHEMA);

	/* vendors */
	var insVendor = db.prepare('INSERT INTO vendors (id,name,country,vendor_no,category,new_vendor) VALUES (?,?,?,?,?,?)');
	var i;
	for (i = 0; i < VENDOR_NAMES.length; i++) {
		insVendor.run(
			i + 1,
			VENDOR_NAMES[i],
			COUNTRY_FOR[i],
			'V' + (100240 + (i * 17)),
			CATEGORIES[i % CATEGORIES.length],
			(i % 13 === 5 ? 'Y' : 'N')
		);
	}

	/* AP clerks */
	var insClerk = db.prepare('INSERT INTO ap_clerks (id,name,initials,team,email) VALUES (?,?,?,?,?)');
	for (i = 0; i < AP_CLERKS.length; i++) {
		insClerk.run(i + 1, AP_CLERKS[i][0], AP_CLERKS[i][1], AP_CLERKS[i][2], AP_CLERKS[i][3]);
	}

	/* ---- open / held payments ---------------------------------- */
	var rows = [];
	var refCounter = 8812;
	var invCounter = 4400;
	var poCounter = 40120;
	var totalOpen = OPEN_TARGET;

	for (i = 0; i < totalOpen; i++) {
		var vendIdx = between(0, VENDOR_NAMES.length - 1);
		var country = COUNTRY_FOR[vendIdx];
		var ptype = pick(PTYPES);
		if (country === 'DE' && nextRand() < 0.62) { ptype = 'SEPA'; }
		if (country === 'SG' || country === 'MX') { ptype = (nextRand() < 0.78 ? 'WIRE' : 'ACH'); }

		var currency = 'USD';
		if (ptype === 'SEPA') { currency = 'EUR'; }
		else if (country === 'GB' && nextRand() < 0.55) { currency = 'GBP'; }
		else if (country === 'SG' && nextRand() < 0.35) { currency = 'SGD'; }

		var amount = drawAmountCents();
		var reason = REASON_CODES[between(0, REASON_CODES.length - 1)];

		rows.push({
			payment_ref: 'MT-2026-0' + (refCounter += between(1, 4)),
			invoice_no: 'INV-2026-' + (invCounter += between(1, 4)),
			po_no: 'PO-' + (poCounter += between(1, 6)),
			vendor_id: vendIdx + 1,
			ptype: ptype,
			amount_cents: amount,
			currency: currency,
			status: pick(OPEN_STATUSES),
			risk_flag: 'LOW',
			age_days: drawAgeDays(),
			terms_days: pick([30, 30, 30, 45, 60]),
			inv_lead_days: between(2, 20),
			payment_run_id: 'PR-2026-' + pad3(between(112, 148)) + '-' + pick(RUN_SUFFIX),
			clerk_id: between(1, AP_CLERKS.length),
			reason_code: reason[0],
			reason_text: reason[1],
			remit_to: remitTo(VENDOR_NAMES[vendIdx]),
			bank_bic: pick(VENDOR_BANKS),
			bank_chg_days: drawBankChangeDays(),
			channel: pick(['ERP', 'EDI', 'PORTAL', 'MANUAL', 'ERP']),
			resolved_date: null,
			resolution: null
		});
	}

	normaliseAmounts(rows, HELD_TARGET_CENTS);
	normaliseAges(rows, Math.round(AVG_AGE_TARGET_DAYS * totalOpen));
	applyRiskFlags(rows, HIGH_RISK_TARGET);

	/* the largest held items are escalated - matches the AP desk procedure */
	for (i = 0; i < rows.length; i++) {
		if (rows[i].risk_flag === 'HIGH' && rows[i].status === 'PENDING') {
			rows[i].status = 'ESCALATED';
		}
		rows[i].created_date = dateMinusDays(rows[i].age_days);
		rows[i].value_date = dateMinusDays(rows[i].age_days > 1 ? rows[i].age_days - 1 : 0);
		var invAge = rows[i].age_days + rows[i].inv_lead_days;
		rows[i].invoice_date = dateMinusDays(invAge);
		rows[i].due_date = dateMinusDays(invAge - rows[i].terms_days);
		rows[i].expected_pay_date = dateMinusDays(-(1 + (i % 12)));
	}

	/* the AP hotline quote INV-2026-4471 all week, keep it in the extract */
	forceInvoiceNumber(rows, 12, 'INV-2026-4471');

	/* ---- closed items ------------------------------------------ */
	for (i = 0; i < RESOLVED_TARGET; i++) {
		var rIdx = between(0, VENDOR_NAMES.length - 1);
		var rType = pick(PTYPES);
		var rAge = between(9, 74);
		var rReason = REASON_CODES[between(0, REASON_CODES.length - 1)];
		var rLead = between(2, 20);
		var rTerms = pick([30, 30, 30, 45, 60]);
		var rResolved = dateMinusDays(rAge - between(1, 6));
		rows.push({
			payment_ref: 'MT-2026-0' + (refCounter += between(1, 4)),
			invoice_no: 'INV-2026-' + (invCounter += between(1, 4)),
			po_no: 'PO-' + (poCounter += between(1, 6)),
			vendor_id: rIdx + 1,
			ptype: rType,
			amount_cents: drawAmountCents(),
			currency: (rType === 'SEPA' ? 'EUR' : 'USD'),
			status: 'RESOLVED',
			risk_flag: (nextRand() < 0.08 ? 'HIGH' : (nextRand() < 0.4 ? 'MED' : 'LOW')),
			age_days: rAge,
			created_date: dateMinusDays(rAge),
			invoice_date: dateMinusDays(rAge + rLead),
			due_date: dateMinusDays(rAge + rLead - rTerms),
			expected_pay_date: rResolved,
			value_date: dateMinusDays(rAge - 1),
			payment_run_id: 'PR-2026-' + pad3(between(96, 128)) + '-' + pick(RUN_SUFFIX),
			clerk_id: between(1, AP_CLERKS.length),
			reason_code: rReason[0],
			reason_text: rReason[1],
			remit_to: remitTo(VENDOR_NAMES[rIdx]),
			bank_bic: pick(VENDOR_BANKS),
			bank_chg_days: drawBankChangeDays(),
			channel: pick(['ERP', 'EDI', 'PORTAL', 'MANUAL']),
			resolved_date: rResolved,
			resolution: pick(RESOLUTIONS)
		});
	}

	var insExc = db.prepare(
		'INSERT INTO exceptions (id,payment_ref,invoice_no,po_no,vendor_id,ptype,amount_cents,currency,status,' +
		'risk_flag,age_days,created_date,invoice_date,due_date,expected_pay_date,value_date,payment_run_id,' +
		'clerk_id,reason_code,reason_text,remit_to,bank_bic,bank_chg_days,channel,resolved_date,resolution) ' +
		'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
	);
	var insNote = db.prepare('INSERT INTO notes (exception_id,author,note_date,body) VALUES (?,?,?,?)');

	var loadAll = db.transaction(function () {
		var k, r, n, noteCount;
		for (k = 0; k < rows.length; k++) {
			r = rows[k];
			insExc.run(
				k + 1, r.payment_ref, r.invoice_no, r.po_no, r.vendor_id, r.ptype, r.amount_cents,
				r.currency, r.status, r.risk_flag, r.age_days, r.created_date, r.invoice_date,
				r.due_date, r.expected_pay_date, r.value_date, r.payment_run_id, r.clerk_id,
				r.reason_code, r.reason_text, r.remit_to, r.bank_bic, r.bank_chg_days,
				r.channel, r.resolved_date, r.resolution
			);
			noteCount = (r.status === 'RESOLVED' ? 2 : between(0, 3));
			for (n = 0; n < noteCount; n++) {
				insNote.run(
					k + 1,
					AP_CLERKS[between(1, AP_CLERKS.length) - 1][1],
					stampMinusDays(r.age_days > n ? r.age_days - n : 0, between(8, 17), between(0, 59)),
					NOTE_TEXT[between(0, NOTE_TEXT.length - 1)]
				);
			}
		}
	});
	loadAll();

	var openCount = db.prepare("SELECT COUNT(*) c FROM exceptions WHERE status <> 'RESOLVED'").get().c;
	var held = db.prepare("SELECT SUM(amount_cents) s FROM exceptions WHERE status <> 'RESOLVED'").get().s;
	var avgAge = db.prepare("SELECT AVG(age_days) a FROM exceptions WHERE status <> 'RESOLVED'").get().a;
	var high = db.prepare("SELECT COUNT(*) c FROM exceptions WHERE status <> 'RESOLVED' AND risk_flag = 'HIGH'").get().c;
	db.close();

	console.log('payops.db loaded.');
	console.log('  held payments ..... ' + openCount);
	console.log('  payable held ...... ' + (held / 100000000).toFixed(2) + 'M');
	console.log('  average age ....... ' + avgAge.toFixed(1) + 'd');
	console.log('  flagged ........... ' + high);
	console.log('  closed (history) .. ' + (rows.length - openCount));
}

function pad3(n) {
	var s = String(n);
	while (s.length < 3) { s = '0' + s; }
	return s;
}

/* remit-to line as it comes across on the vendor master record */
function remitTo(vendorName) {
	var r = nextRand();
	if (r < 0.45) { return vendorName + ' - Lockbox ' + between(1000, 9899); }
	if (r < 0.75) { return vendorName + ' - Accounts Receivable'; }
	return vendorName + ' - Remittance Desk';
}

/* days since the vendor bank record was last amended, -1 if never */
function drawBankChangeDays() {
	var r = nextRand();
	if (r < 0.78) { return -1; }
	if (r < 0.90) { return between(91, 400); }
	if (r < 0.96) { return between(31, 90); }
	return between(0, 30);
}

/* the AP hotline quote a handful of invoice numbers all week - make sure
   the well known one is actually in the extract */
function forceInvoiceNumber(rows, idx, invoiceNo) {
	var i;
	for (i = 0; i < rows.length; i++) {
		if (rows[i].invoice_no === invoiceNo) { return; }
	}
	rows[idx].invoice_no = invoiceNo;
}

/* invoice value bands - roughly the shape of a normal AP week */
function drawAmountCents() {
	var r = nextRand();
	if (r < 0.55) { return between(80000, 700000); }
	if (r < 0.80) { return between(700000, 2000000); }
	if (r < 0.92) { return between(12000, 80000); }
	if (r < 0.975) { return between(2000000, 5000000); }
	if (r < 0.995) { return between(5000000, 12000000); }
	return between(12000000, 48000000);
}

function drawAgeDays() {
	var r = nextRand();
	if (r < 0.30) { return between(0, 1); }
	if (r < 0.62) { return between(2, 3); }
	if (r < 0.84) { return between(4, 6); }
	if (r < 0.95) { return between(7, 10); }
	return between(11, 21);
}

/* scale the extract so the held total agrees with the control pack */
function normaliseAmounts(rows, targetCents) {
	var sum = 0, i;
	for (i = 0; i < rows.length; i++) { sum += rows[i].amount_cents; }
	var factor = targetCents / sum;
	sum = 0;
	for (i = 0; i < rows.length; i++) {
		rows[i].amount_cents = Math.max(12000, Math.round(rows[i].amount_cents * factor));
		sum += rows[i].amount_cents;
	}
	/* park the rounding difference on the largest item */
	var biggest = 0;
	for (i = 1; i < rows.length; i++) {
		if (rows[i].amount_cents > rows[biggest].amount_cents) { biggest = i; }
	}
	rows[biggest].amount_cents += (targetCents - sum);
}

/* nudge ages so the average age agrees with the control pack */
function normaliseAges(rows, targetTotal) {
	var sum = 0, i;
	for (i = 0; i < rows.length; i++) { sum += rows[i].age_days; }
	i = 0;
	while (sum > targetTotal) {
		if (rows[i].age_days > 0) { rows[i].age_days -= 1; sum -= 1; }
		i = (i + 1) % rows.length;
	}
	while (sum < targetTotal) {
		if (rows[i].age_days < 30) { rows[i].age_days += 1; sum += 1; }
		i = (i + 1) % rows.length;
	}
}

/* the biggest exposures carry the HIGH flag, the next tier MED */
function applyRiskFlags(rows, highCount) {
	var order = [], i;
	for (i = 0; i < rows.length; i++) { order.push(i); }
	order.sort(function (a, b) {
		if (rows[b].amount_cents !== rows[a].amount_cents) {
			return rows[b].amount_cents - rows[a].amount_cents;
		}
		return a - b;
	});
	for (i = 0; i < order.length; i++) {
		if (i < highCount) { rows[order[i]].risk_flag = 'HIGH'; }
		else if (i < highCount + 46) { rows[order[i]].risk_flag = 'MED'; }
		else { rows[order[i]].risk_flag = 'LOW'; }
	}
}

module.exports = { build: build, DB_FILE: DB_FILE, BASE_DATE: BASE_DATE };

if (require.main === module) {
	build();
}
