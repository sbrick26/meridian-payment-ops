-- The five rows the AFTER frame shows.
-- Read from the seeded database, not from the rendered page: the seed is
-- deterministic, so the mock is reproducible, and a browser read costs a turn
-- and returns a screenshot nobody needs.
SELECT json_group_array(json_object(
  'ref',     e.payment_ref,
  'vendor',  v.name,
  'invoice', e.invoice_no,
  'amount',  printf('%,.2f', e.amount_cents / 100.0),
  'ccy',     e.currency,
  'status',  upper(e.status),
  'reason',  e.reason_code || ' · ' || e.reason_text,
  'age',     e.age_days || 'd',
  'risk',    upper(e.risk_flag),
  'detail',  'detail'
))
-- Open items only: Held Payments is a work queue, and a mock full of
-- RESOLVED rows shows a screen nobody uses.
FROM (SELECT * FROM exceptions
      WHERE upper(status) <> 'RESOLVED'
      ORDER BY age_days DESC, id ASC LIMIT 5) e
JOIN vendors v ON v.id = e.vendor_id;
