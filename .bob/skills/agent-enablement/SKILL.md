---
name: agent-enablement
description: >-
  Use when exposing a modernized service to an assistant channel: generating the
  service's MCP or OpenAPI tool interface, creating or deploying a watsonx
  Orchestrate agent, wiring a scoped identity for the tool layer, or enabling
  chat or voice access to an internal API. Applies when the request is to make a
  service callable by an assistant, publish an agent to a channel, bind a phone
  number, or verify that an assistant's write access is correctly refused.
---

# Assistant enablement for a modernized service

This skill governs how an internal service is exposed to an assistant channel.
The always-on engineering controls in `.bob/rules/` apply throughout — in
particular the assistant access governance rule, which this skill implements and
does not restate.

The unit of work is not "an agent exists". It is: a tool interface derived from
the service, a scoped identity the tool layer authenticates with, an agent
deployed to the live environment, a channel a person can reach it on, and a
recorded smoke test proving both that the read path answers and that the write
path is refused by identity.

Execute the phases in order. Every command below is run as written with the
placeholders substituted; every phase carries an **expect** line, and an
unmatched expectation stops the run and is reported rather than worked around.

## Placeholders

| Placeholder | Meaning |
| --- | --- |
| `<SERVICE_DIR>` | repository directory of the modernized service |
| `<SERVICE_URL>` | base URL of the running modernized service, e.g. `http://localhost:4600` |
| `<PUBLIC_URL>` | externally reachable base URL of the same service (tunnel or hostname) |
| `<AGENT_NAME>` | agent name, e.g. `meridian_ap_assistant` |
| `<TOOLKIT_NAME>` | toolkit name, e.g. `ap_payments_tools` |
| `<APP_ID>` | connection app id, e.g. `ap_inquiry_identity` |
| `<ENV_NAME>` | the Orchestrate environment for this work, e.g. `align-sf` |

## Environment facts that govern every command

The `orchestrate` CLI keeps its active environment in machine-global state. Any
other process on the machine can have changed it. Nothing in this skill is
executed before phase B has confirmed the active environment, and no command in
this skill activates an environment on its own initiative.

Imports write to the **draft** environment only. Nothing a person reaches — a
deployed agent, a webchat embed, a phone number — is served from draft. An
import that is not followed by a deploy has changed nothing the demonstration
or the user will see.

Connections are configured **per environment**. A connection configured only for
draft produces an agent that works in the builder preview and fails in live with
an authentication error. Credentials are set twice, once per environment,
always.

---

## Phase A — Expose the service as a tool interface

The tool interface is generated from the modernized service and mounted inside
it. It is not a second service and it does not re-implement business logic: each
handler calls the service's own `/api/v2` routes, so the equivalence-proven
implementation stays the single source of behaviour.

1. Copy the MCP endpoint template into the service and mount it:

   ```bash
   cp templates/mcp-endpoint.js <SERVICE_DIR>/routes/mcp-endpoint.js
   ```

   In the service entrypoint, after the `/api/v2` routes are mounted:

   ```js
   app.use('/mcp', require('./routes/mcp-endpoint'));
   ```

   The template is dependency-free — Express plus the Node standard library. Do
   not add an MCP SDK dependency to satisfy it; the approved-libraries rule
   applies to this file like any other.

2. Scope enforcement is not implemented in the tool layer. Each route mounts the
   identity middleware, exactly as the `/api/v2` routes do:

   ```js
   const { requireScope } = require('../vault/middleware/vault-scope');
   ```

   Read tools (`payment_status_lookup`, `payments_search`, `payment_risk`) mount
   `requireScope('inquiry')`. Write tools (`payment_release`, `payment_hold`)
   mount `requireScope('ops')`. A tool that does not mount a scope is a defect,
   not a shortcut.

3. Verify locally before involving the platform:

   ```bash
   node --check <SERVICE_DIR>/routes/mcp-endpoint.js
   curl -s -X POST <SERVICE_URL>/mcp \
     -H 'Content-Type: application/json' \
     -H 'Accept: application/json, text/event-stream' \
     -H "Authorization: Bearer $INQUIRY_TOKEN" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

   **expect:** `node --check` silent; the `tools/list` response lists all five
   tool names with input schemas.

4. Verify the identity boundary at the tool layer, with the inquiry token:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST <SERVICE_URL>/mcp \
     -H 'Content-Type: application/json' \
     -H 'Accept: application/json, text/event-stream' \
     -H "Authorization: Bearer $INQUIRY_TOKEN" \
     -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"payment_release","arguments":{"ref":"<REF>"}}}'
   ```

   **expect:** the tool result carries the service's `identity_scope_denied`
   refusal naming the token's policies. If a release succeeds, stop: the write
   route is mounted with the wrong scope.

If the platform cannot reach the endpoint (no public URL available) or the
remote toolkit import fails, fall through to the OpenAPI variant in phase C.2
rather than weakening the auth model to make MCP work.

---

## Phase B — Confirm the environment and configure the connection

1. Confirm which environment the CLI is pointed at. This is always the first
   platform command of the run:

   ```bash
   orchestrate env list
   ```

   **expect:** `<ENV_NAME>` is listed and marked active. If it is not active,
   **stop and report it**. Do not activate an environment on your own
   initiative — another session may be mid-import against the active one.

2. Create the connection that carries the tool layer's identity, and configure
   it for **both** environments:

   ```bash
   orchestrate connections add --app-id <APP_ID>

   orchestrate connections configure --app-id <APP_ID> \
     --environment draft --type team --kind bearer --url <PUBLIC_URL>
   orchestrate connections configure --app-id <APP_ID> \
     --environment live  --type team --kind bearer --url <PUBLIC_URL>

   orchestrate connections set-credentials --app-id <APP_ID> \
     --environment draft --token "$INQUIRY_VAULT_TOKEN"
   orchestrate connections set-credentials --app-id <APP_ID> \
     --environment live  --token "$INQUIRY_VAULT_TOKEN"
   ```

   `INQUIRY_VAULT_TOKEN` is read from the identity provider's token file
   (`vault/.tokens.env`) into the shell environment. The token value is never
   written into a YAML file, a JSON file, a script, or a commit. A token that
   appears in a file tracked by the repository is a credential leak and is
   handled as one — revoke, re-mint, and record it.

   **expect:** both `configure` calls and both `set-credentials` calls report
   success. Confirm with:

   ```bash
   orchestrate connections list
   ```

   **expect:** the row for `<APP_ID>` shows configured credentials for draft
   *and* live.

---

## Phase C — Import the toolkit and the agent

### C.1 Remote MCP toolkit (preferred)

Verified against ADK 2.13. `orchestrate toolkits add` is the command that takes
CLI arguments; `orchestrate toolkits import` accepts only `--file/-f` (a toolkit
spec file) and `--app-id/-a`, and is used to replay a spec exported earlier.

```bash
orchestrate toolkits add \
  --kind mcp \
  --name <TOOLKIT_NAME> \
  --description "Read and write tools for the AP payments service" \
  --url <PUBLIC_URL>/mcp \
  --transport streamable_http \
  --tools "*" \
  --app-id <APP_ID>
```

Notes that follow from the 2.13 specification model:

- `--url` and `--transport` must be given **together**; supplying either alone
  is rejected.
- With `--url`/`--transport` set, the local options `--package`,
  `--package-root`, `--language` and `--command` are rejected. Remote and local
  MCP are exclusive.
- Authentication headers are not a CLI flag. The bearer credential reaches the
  server through the connection named by `--app-id`; that is why phase B runs
  before this one.
- `--tools "*"` imports every tool the server advertises; a comma-separated list
  restricts it.

**expect:** the command reports the toolkit created and lists the five tools.
Confirm the exact tool names the platform assigned — the agent definition must
use them verbatim:

```bash
orchestrate toolkits list
orchestrate tools list
```

### C.2 OpenAPI tools (fallback)

Use this when the platform cannot reach `<PUBLIC_URL>/mcp`, or when the remote
toolkit import fails for a reason that is not a fixable input error. The tool
surface and the identity model are unchanged; only the transport differs.

```bash
orchestrate tools import \
  --kind openapi \
  --file <SERVICE_DIR>/openapi-tools.json \
  --app-id <APP_ID>
```

`orchestrate tools import` in 2.13 accepts `--kind/-k` (`openapi|python|flow|
langflow`), `--file/-f`, `--app-id/-a`, `--package-root/-p`, `--name/-n`,
`--requirements-file/-r`, `--auto-discover`, `--llm`, `--env-file/-e`,
`--function`, `--save-flow-json`, `--translation` and `--safe`. There is no
header flag here either: the bearer credential comes from the connection.

Generate `openapi-tools.json` from `templates/openapi-tools.json`, substituting
the server URL. Its `bearerAuth` security scheme is what binds it to `<APP_ID>`.

**expect:** each operation in the document is reported as an imported tool.

### C.3 Agent

Copy `templates/agent.yaml`, substitute the placeholders, then import:

```bash
orchestrate agents import --file <SERVICE_DIR>/agent.yaml
```

**expect:** the agent is reported created or updated. `orchestrate agents list`
shows `<AGENT_NAME>`.

Two constraints the template already reflects:

- In ADK 2.13 a `toolkits:` list on the agent is accepted **only** for
  `experimental_customer_care` style agents; on any other style the import is
  rejected with "Toolkits are only supported for experimental_customer_care
  style agents". A `react_core` agent therefore references the toolkit's tools
  individually under `tools:`, using the names from `orchestrate tools list`.
- The model is set to a generally available instruct model unless a premier
  model is entitled on this environment. Confirm what is available with
  `orchestrate models list` and set `llm:` to a name from that output rather
  than a name carried over from another environment.

---

## Phase D — Deploy to live and open the channels

1. Deploy. Imports touched draft only; this is the step that makes the agent
   reachable:

   ```bash
   orchestrate agents deploy --name <AGENT_NAME>
   ```

   **expect:** deployment reported successful. `orchestrate agents list` shows
   the agent as deployed.

2. Web chat embed for the service's own pages:

   ```bash
   orchestrate channels webchat embed --agent-name <AGENT_NAME> --env live
   ```

   **expect:** an HTML snippet is printed. Capture it — phase E installs it.

3. Voice, when the plan calls for it. Configure the voice provider first:

   ```bash
   orchestrate voice-configs list
   orchestrate voice-configs import --file <voice-config.yaml>
   ```

   If the managed-key path is unavailable on this environment, create the voice
   configuration in the Orchestrate console (Manage → Voice) and re-run
   `orchestrate voice-configs list` to confirm it exists before continuing.
   Reference it from the agent definition's `voice_configuration` field and
   re-import and re-deploy the agent.

   Then create the phone configuration and bind the number:

   ```bash
   orchestrate phone create --name <PHONE_CONFIG> --type <TYPE> \
     --field <key>=<value>
   orchestrate phone add-number --name <PHONE_CONFIG> \
     --number "+1XXXXXXXXXX" --agent-name <AGENT_NAME> --env live
   ```

   `--type` is one of the values reported by `orchestrate phone list`.

   **expect:** `orchestrate phone list-numbers --name <PHONE_CONFIG>` shows the
   number attached to `<AGENT_NAME>` in `live`.

---

## Phase E — Smoke test and surface the channel

1. Run the post-deploy check:

   ```bash
   sh templates/smoke-test.sh
   ```

   It asks a status question about a known invoice and asserts the answer names
   that invoice's vendor, then asks for a payment release and asserts the answer
   carries the identity refusal.

   **expect:** `PASS` on both lines. A `FAIL` on the read line means the toolkit
   or the connection is wrong for the live environment; a `FAIL` on the write
   line means the write route's scope is wrong and the agent has been given
   access it must not have — that one is stop-work.

2. Install the channel where the plan says to. The web chat snippet from phase
   D.2 goes into the modernized service's layout; a phone number is displayed as
   text on the page the plan names, not hard-coded into a component that other
   pages inherit.

   **expect:** loading the page shows the launcher; the number rendered matches
   the number bound in phase D.3.

---

## Phase F — Record the evidence

Assistant enablement is a change to who can reach an internal service, so it
carries the same evidentiary burden as any other change to access.

1. Change-log entry, per the audit rule: the tool surface added, the identity
   the tool layer authenticates as, the scopes that identity holds, the
   environments the connection was configured for, and the channels opened.

2. Pull request body lines:

   - Tool interface: `<N>` tools exposed — `<names>` — each calling `/api/v2`.
   - Identity: tool layer authenticates as `<identity>` holding `<policies>`;
     read scope only. Write tools are mounted and are expected to be refused.
   - Connection `<APP_ID>` configured for draft and live.
   - Agent `<AGENT_NAME>` imported and deployed to live.
   - Channels: `<web chat / phone number>`.
   - Smoke test output, verbatim, including both `PASS` lines.

3. State any deviation explicitly: a fallback taken, an expectation that did not
   match and what was done about it, a step completed in the console rather than
   the CLI. A deviation that is only visible in a terminal scrollback will not
   survive review.

## Gate semantics

The work is complete when the smoke test passes both lines and its output is in
the pull request. An agent that is imported but not deployed, deployed but not
smoke-tested, or smoke-tested only against draft, is not complete — report it as
incomplete rather than closing the subtask.

At the end of a run, list every file written, every platform object created
(connection, toolkit, tools, agent, phone configuration), and every expectation
that did not match.
