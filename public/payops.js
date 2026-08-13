/* ---------------------------------------------------------------------------
 * Function: AP Payment Ops console — client-side behaviour
 * Owner:    payments-platform-team
 * Control:  AU-2 (audit)   (SOX/PCI: PCI Req. 6.5)
 * Reviewed: 2026-08-13
 * ------------------------------------------------------------------------- */

var PAYOPS_ROW_SELECTED = null;

/* called from onclick= on every row of the held payments queue */
function selectRow(el, id) {
	if (PAYOPS_ROW_SELECTED != null) {
		var prev = document.getElementById('row-' + PAYOPS_ROW_SELECTED);
		if (prev) {
			prev.classList.remove('row-selected');
			prev.setAttribute('aria-selected', 'false');
		}
	}
	PAYOPS_ROW_SELECTED = id;
	var row = document.getElementById('row-' + id);
	if (row) {
		row.classList.add('row-selected');
		row.setAttribute('aria-selected', 'true');
	}
	var refCell = document.getElementById('ref-' + id);
	var selectedSpan = document.getElementById('selected-ref');
	if (refCell && selectedSpan) {
		selectedSpan.innerHTML = refCell.innerHTML;
	}
}

/* row double click opens the item - asked for by the AP-DESK-1 team */
function openRow(id) {
	window.location.href = '/exceptions/' + id;
}

function openSelected() {
	if (PAYOPS_ROW_SELECTED == null) {
		alert('Please select a row first.');
		return false;
	}
	openRow(PAYOPS_ROW_SELECTED);
	return false;
}

function clearFilter() {
	window.location.href = '/exceptions';
	return false;
}

function submitFilter() {
	document.getElementById('filterForm').submit();
	return false;
}

function setSort(sortKey) {
	document.getElementById('sortField').value = sortKey;
	document.getElementById('filterForm').submit();
	return false;
}

/* the action form - stop the desk releasing an invoice by accident */
function confirmAction(action) {
	var msg = 'Apply action ' + action + ' to this payment?';
	if (action == 'RELEASE') {
		msg = 'RELEASE this payment to the vendor? This cannot be undone from this screen.';
	}
	if (action == 'RETURN') {
		msg = 'RETURN this invoice to the vendor?';
	}
	if (!confirm(msg)) {
		return false;
	}
	document.getElementById('actionField').value = action;
	document.getElementById('resolveForm').submit();
	return false;
}

function toggleBlock(id, linkEl) {
	var el = document.getElementById(id);
	if (!el) { return false; }
	if (el.style.display === 'none') {
		el.style.display = '';
		linkEl.innerHTML = '[hide]';
	} else {
		el.style.display = 'none';
		linkEl.innerHTML = '[show]';
	}
	return false;
}

function printPage() {
	window.print();
	return false;
}

function exportCsv(status) {
	if (status == null || status == '') {
		window.location.href = '/reports/export.csv';
	} else {
		window.location.href = '/reports/export.csv?status=' + status;
	}
	return false;
}

/* masthead clock - the desk use it for the payment run cut-off times */
function payopsClock() {
	var d = new Date();
	var hh = d.getHours();
	var mm = d.getMinutes();
	var ss = d.getSeconds();
	if (hh < 10) { hh = '0' + hh; }
	if (mm < 10) { mm = '0' + mm; }
	if (ss < 10) { ss = '0' + ss; }
	var clock = document.getElementById('clock');
	if (clock) { clock.innerHTML = hh + ':' + mm + ':' + ss; }
}

document.addEventListener('DOMContentLoaded', function () {
	payopsClock();
	setInterval(payopsClock, 1000);

	document.querySelectorAll('.exc-table tbody tr').forEach(function (tr) {
		tr.setAttribute('title', 'Click to select, double click to open');
	});

	/* keyboard navigation: Enter or Space on a focused row fires click */
	document.querySelectorAll('.exc-table tbody tr').forEach(function (tr) {
		tr.addEventListener('keydown', function (e) {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				tr.click();
			}
		});
	});

	/* keep the focus in the search box after a filter reload */
	var q = document.getElementById('q');
	if (q && q.value !== '') {
		q.focus();
	}
});
