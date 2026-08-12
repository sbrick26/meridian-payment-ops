# Compliance headers (control traceability)

Every new route handler, exported function, module, or view template must begin
with a header comment tying the code to the control it implements. This is what
makes a change auditable after the fact and gives SOX change management a
machine-readable anchor.

## JavaScript files

```js
/* ---------------------------------------------------------------------------
 * Function: <name>
 * Owner:    payments-platform-team
 * Control:  <NIST 800-53 control id>   (SOX/PCI: <control reference>)
 * Reviewed: <YYYY-MM-DD>
 * ------------------------------------------------------------------------- */
```

## EJS templates

```ejs
<%#
  ---------------------------------------------------------------------------
  View:     <template name>
  Owner:    payments-platform-team
  Control:  <NIST 800-53 control id>   (SOX/PCI: <control reference>)
  Reviewed: <YYYY-MM-DD>
  ---------------------------------------------------------------------------
%>
```

## Control mapping

| The code does...                          | NIST 800-53   | SOX / PCI-DSS / FFIEC          |
|-------------------------------------------|---------------|--------------------------------|
| Authentication / session handling         | AC-2, IA-2    | PCI Req. 8; SOX ITGC access    |
| Authorization / operator entitlements     | AC-6          | SOX 404 segregation of duties  |
| Database / persistence                    | AC-3          | PCI Req. 7; SOX ITGC           |
| Secrets, encryption, data at rest         | SC-13, SC-28  | PCI Req. 3                     |
| Logging, audit, change tracking           | AU-2, AU-12   | PCI Req. 10; SOX 404           |
| Input validation                          | SI-10         | PCI Req. 6.5                   |
| Configuration / dependency management     | CM-2, CM-6    | SOX ITGC change management     |
| Network / transport security              | SC-8, SC-23   | PCI Req. 4                     |
| Payment exception handling / reconciliation | AU-6, SI-4  | FFIEC operational risk         |

If nothing fits, write `Control: TBD` **and** flag it for human review in the
change log (rule 03). A `TBD` control that ships without review is itself a
finding.
