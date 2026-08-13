/* utils-server.js - server-side helpers shared between server.js and the v2 routes
 * Meridian Corp - IT Dept
 *
 * Exports the two functions that were previously defined inline in server.js:
 *   scoreRow(row)          - APRSK01 risk model (ported from COBOL)
 *   statusDescription(s)   - human-readable label for an exception status
 *
 * Both functions are pure: they read from the row / string passed in and from
 * utils.js (bandFor, isRoundDollar).  They do NOT touch the database.
 */

'use strict';

var utils = require('./utils');

/* ------------------------------------------------------------------
 * statusDescription
 * ------------------------------------------------------------------ */

function statusDescription(status) {
	if (status == 'PENDING')   { return 'Awaiting first review'; }
	if (status == 'REVIEW')    { return 'Under review by an AP clerk'; }
	if (status == 'HOLD')      { return 'Held - awaiting vendor or goods receipt'; }
	if (status == 'ESCALATED') { return 'Escalated to AP controls'; }
	if (status == 'RESOLVED')  { return 'Closed - released or returned'; }
	return 'Unknown';
}

/* ------------------------------------------------------------------
 * scoreRow  - APRSK01 risk scoring model
 * Do not change the bands without raising a change request.
 * ------------------------------------------------------------------ */

function scoreRow(row) {
	var score = 0;
	var amt   = row.amount_cents;

	if      (amt >= 25000000) { score += 45; }
	else if (amt >= 10000000) { score += 35; }
	else if (amt >= 5000000)  { score += 28; }
	else if (amt >= 1000000)  { score += 18; }
	else if (amt >= 250000)   { score += 10; }
	else                      { score += 4;  }

	if (row.ptype == 'WIRE') {
		score += (amt >= 5000000) ? 14 : 9;
	} else if (row.ptype == 'SEPA') {
		score += 6;
	} else {
		score += (row.channel == 'EDI') ? 5 : 3;
	}

	if      (row.country == 'US') { score += 2;  }
	else if (row.country == 'GB') { score += 3;  }
	else if (row.country == 'DE') { score += 3;  }
	else if (row.country == 'SG') { score += 7;  }
	else if (row.country == 'MX') { score += 11; }
	else                          { score += 8;  }

	if      (row.age_days >= 14) { score += 16; }
	else if (row.age_days >= 7)  { score += 11; }
	else if (row.age_days >= 4)  { score += 6;  }
	else if (row.age_days >= 2)  { score += 2;  }

	if (utils.isRoundDollar(amt)) {
		score += (amt >= 1000000) ? 9 : 4;
	}

	if (row.bank_chg_days >= 0) {
		if      (row.bank_chg_days <= 30) { score += 14; }
		else if (row.bank_chg_days <= 90) { score += 7;  }
		else                              { score += 2;  }
	}

	if (row.new_vendor == 'Y') { score += 6; }

	if      (row.reason_code == 'H21') { score += 12; }
	else if (row.reason_code == 'H07') { score += 9;  }
	else if (row.reason_code == 'H41') { score += 7;  }
	else if (row.reason_code == 'H09') { score += 5;  }

	if      (row.risk_flag == 'HIGH') { score += 10; }
	else if (row.risk_flag == 'MED')  { score += 4;  }

	if (score > 100) { score = 100; }
	if (score < 0)   { score = 0;   }

	return { score: score, band: utils.bandFor(score) };
}

module.exports = { scoreRow: scoreRow, statusDescription: statusDescription };
