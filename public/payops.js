/* ---------------------------------------------------------------------------
 * Function: payops (client-side screen behaviour)
 * Owner:    payments-platform-team
 * Control:  SI-10   (PCI Req. 6.5; WCAG 2.4.7 keyboard access)
 * Reviewed: 2026-08-13
 *
 * Vanilla JS — jQuery 1.9.1 dependency removed (KAN-53 / KAN-51).
 * Behaviour is identical to the previous version; DOM manipulation now uses
 * native element methods so Bootstrap 2 + jQuery can be unlinked from the
 * header without breaking the screens.
 * --------------------------------------------------------------------------- */

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
  el.classList.add('row-selected');
  el.setAttribute('aria-selected', 'true');
  var refEl = document.getElementById('ref-' + id);
  var selEl = document.getElementById('selected-ref');
  if (refEl && selEl) { selEl.innerHTML = refEl.innerHTML; }
}

/* keyboard support on table rows (WCAG 2.4.7 / 2.1.1) */
function rowKeyDown(event, id) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectRow(event.currentTarget, id);
  }
}

/* row double click opens the item */
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

/* the action form — stop the desk releasing an invoice by accident */
function confirmAction(action) {
  var msg = 'Apply action ' + action + ' to this payment?';
  if (action == 'RELEASE') {
    msg = 'RELEASE this payment to the vendor? This cannot be undone from this screen.';
  }
  if (action == 'RETURN') {
    msg = 'RETURN this invoice to the vendor?';
  }
  if (!confirm(msg)) { return false; }
  document.getElementById('actionField').value = action;
  document.getElementById('resolveForm').submit();
  return false;
}

function toggleBlock(id, linkEl) {
  var el = document.getElementById(id);
  if (!el) { return false; }
  if (el.style.display === 'none' || el.style.display === '') {
    el.style.display = 'block';
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

/* masthead clock */
function payopsClock() {
  var d = new Date();
  var hh = String(d.getHours()).padStart(2, '0');
  var mm = String(d.getMinutes()).padStart(2, '0');
  var ss = String(d.getSeconds()).padStart(2, '0');
  var el = document.getElementById('clock');
  if (el) { el.textContent = hh + ':' + mm + ':' + ss; }
}

document.addEventListener('DOMContentLoaded', function () {
  payopsClock();
  setInterval(payopsClock, 1000);

  var rows = document.querySelectorAll('.exc-table tbody tr');
  rows.forEach(function (tr) {
    tr.setAttribute('title', 'Click to select, double click to open');
  });

  /* keep focus in the search box after a filter reload */
  var q = document.getElementById('q');
  if (q && q.value !== '') { q.focus(); }
});
