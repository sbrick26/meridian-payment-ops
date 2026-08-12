/* payops.js
 * AP Payment Operations Console - screen behaviour
 * Meridian Corp IT Dept
 *
 * Requires jQuery 1.9.1 (loaded before this file).
 * Most of the screens are plain form posts - what is here is only the
 * bits the desk asked for after UAT: row highlighting, the confirm
 * prompts, the select-all box and the clock in the masthead.
 */

var PAYOPS_ROW_SELECTED = null;

/* called from onclick= on every row of the held payments queue */
function selectRow(el, id) {
	if (PAYOPS_ROW_SELECTED != null) {
		$('#row-' + PAYOPS_ROW_SELECTED).removeClass('row-selected');
	}
	PAYOPS_ROW_SELECTED = id;
	$('#row-' + id).addClass('row-selected');
	$('#selected-ref').html($('#ref-' + id).html());
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
	var el = $('#' + id);
	if (el.is(':visible')) {
		el.hide();
		$(linkEl).html('[show]');
	} else {
		el.show();
		$(linkEl).html('[hide]');
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
	$('#clock').html(hh + ':' + mm + ':' + ss);
}

$(document).ready(function () {
	payopsClock();
	setInterval(payopsClock, 1000);

	$('.exc-table tbody tr').each(function () {
		var tr = $(this);
		tr.attr('title', 'Click to select, double click to open');
	});

	/* keep the focus in the search box after a filter reload */
	if ($('#q').length > 0 && $('#q').val() != '') {
		$('#q').focus();
	}
});
