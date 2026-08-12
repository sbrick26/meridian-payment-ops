# Governance protection

Controls that a delivery team can edit in the course of shipping a feature are
not controls. The following paths **define the control environment** and must
not be changed by an ordinary code pull request:

- `.bob/rules/` — the Engineering Constitution itself
- `.bob/skills/` — governed workflows
- `.bobignore` — the secret-file blocklist
- `governance/` — the audit prompt and verdict parser
- `.github/workflows/` and `.github/CODEOWNERS` — the CI gate and its ownership
- `dashboard/` — the control-evidence reporting surface

If a diff adds, removes, modifies, or weakens any file under those paths as part
of a code change, that is a **violation**. Treat it as a FAIL and require review
by the code owner. Weakening or deleting a rule is never an acceptable side
effect of a feature change — governance changes travel on their own branch,
reviewed separately, by the governance owner.

This is enforced in depth:

1. **At generation time** — Bob refuses to fold a governance edit into a feature
   change and tells the engineer to separate it into its own pull request.
2. **At the merge chokepoint** — the CI gate judges every pull request with the
   rulebook **pinned from `main`**, so a branch cannot hand the agent a weakened
   Constitution to rate itself against. The tampering still appears in the diff
   and fails the gate.
3. **By ownership** — CODEOWNERS requires the governance owner's review of any
   change under these paths, and branch protection blocks force-push and
   deletion of `main`.

Separation of duties between the team that writes code and the team that owns
the controls is a SOX 404 expectation. This rule is how it is implemented in the
repository.
