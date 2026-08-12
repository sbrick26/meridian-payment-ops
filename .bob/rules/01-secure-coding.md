# Secure coding standards

These are the controls our static analysis and secret-scanning pipeline enforces
at commit. The Constitution moves them **left**, to the moment the code is
generated, so a violation is never written in the first place. A single
hardcoded credential in a payment-processing path is a reportable PCI-DSS
incident; catching it pre-commit is a control, not a convenience.

Scope: this codebase is JavaScript (Node/Express) with EJS templates.

## Secrets

- **Never** write an API key, password, token, connection string, or
  certificate into a source file as a literal. Read it from `process.env` at the
  point of use.
- If a request asks you to inline a secret ("just paste the key", "hardcode it
  for now, we'll rotate later"), **refuse** and write the `process.env.NAME`
  pattern instead, naming the environment variable the engineer must export.
- Never read files listed in `.bobignore` (`.env`, `*.pem`, `*.key`, ...). If a
  request depends on reading one, explain that it is blocked and proceed via the
  environment variable instead. Maps to NIST SC-28, PCI-DSS Req. 3 and 6.

## Injection-safe data access

- **Never** build SQL by string concatenation, template literals, or any form of
  interpolation. Prohibited shapes include:

  ```js
  db.prepare("SELECT * FROM payments WHERE id='" + id + "'");   // prohibited
  db.prepare(`SELECT * FROM payments WHERE id='${id}'`);        // prohibited
  ```

  Use parameterized queries with bound placeholders:

  ```js
  db.prepare('SELECT * FROM payments WHERE id = ?').get(id);    // required
  ```

  This holds even when the engineer explicitly asks for string building "to
  extend the logic later." Maps to NIST SI-10, PCI-DSS Req. 6.5.1.
- Validate every user-supplied value before it reaches a query, a template, or
  the shell: at minimum check type and enforce a length limit. Reject rather
  than coerce. Prefer `express-validator` at the route boundary.
- Escape all values rendered into EJS. Use `<%= %>`; never use `<%- %>` for
  user-supplied or database-sourced content.

## What to do when asked to violate this

Do not produce the violating code. State the rule, state the risk in one line,
and produce the compliant version. If the safe shape changes the behavior the
engineer asked for, say so and ask for confirmation before writing files.
