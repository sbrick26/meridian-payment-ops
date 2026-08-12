# Assistant access to internal services

An AI assistant that calls an internal service is a non-human consumer of that
service, and is governed as one. NIST SP 800-53 access enforcement (AC-3) and
least privilege (AC-6) do not distinguish between a person, a batch job, and an
assistant: the control is the identity the caller presents and the authorizations
that identity carries.

This rule applies to every assistant channel that reaches a Meridian service —
chat, voice, embedded widget, or an agent invoked by another agent — regardless
of which platform hosts it.

## (a) The assistant authenticates as itself

Every call an assistant makes into an internal service carries a credential
issued to that assistant, from the enterprise identity provider, distinct from
any credential held by a person or by another assistant.

An assistant must not reuse a service account shared with an application, must
not be given an operator's credential, and must not call a service that accepts
unauthenticated traffic from inside the network. If the assistant's identity
cannot be resolved from the credential, the service refuses the call — an
unidentifiable caller is denied, not defaulted.

Authorization is derived from that identity at the service, from the policies
attached to it at the identity provider. A scope, a role, or a claim supplied in
the request body or in a tool argument is input, not authorization, and is never
treated as such.

## (b) Minimum scope for the function

An assistant receives the narrowest set of permissions its stated function
requires, and no more. Read-only is the default and the assumption.

An assistant may hold a scope that permits writing, state changes, financial
movement, or the release of funds only where all of the following exist:

- a written approval from the service owner and the control owner, naming the
  assistant, the operations extended, and the limits;
- the approval recorded in the plan document for the change that grants it;
- a stated review date.

Absent that record, the write scope is not granted. Convenience during
implementation, a demonstration, or a deadline are not grounds for granting it,
and a scope granted "temporarily" without the record is a finding.

Where an assistant's interface exposes operations it is not authorized to
perform, the operations remain exposed and the authorization layer refuses them.
The refusal is the control. Hiding the operation is not an equivalent measure:
it moves enforcement into the assistant's own reasoning, where it cannot be
audited.

## (c) Denials are auditable events

A refused call is recorded, not swallowed. Each denial records the calling
identity, the authorizations that identity actually held, the operation
attempted, the scope required, and the time.

The refusal returned to the caller states the identity and what it lacked, in
terms an operator can act on. An assistant that receives a refusal relays it as
issued; it does not paraphrase it into a generic apology, does not represent the
operation as having succeeded, and does not attempt an alternative route to the
same effect.

Denial records are retained on the same schedule as the service's other access
logs and are available to review without a request to engineering.

## (d) No long-lived shared credentials

Credentials used by an assistant are short-lived, issued to that assistant
alone, and revocable independently of any other consumer.

They are held in the platform's credential store or the identity provider, and
supplied to the tool layer through a configured connection. A credential must
never appear in an agent definition, a tool definition, a specification file, a
script, an environment file committed to the repository, a screenshot, or a
commit message. A credential that appears in any of these is treated as
disclosed: revoke it, reissue it, and record the event in the change log.

Credentials are configured for every environment the assistant is deployed to.
An assistant that works in one environment because its credential was configured
only there is not a working assistant; it is an unverified deployment.

## Evidence at review

A change that gives an assistant access to a service does not merge without, in
the pull request body:

- the identity the assistant authenticates as, and the authorizations it holds;
- the operations exposed, and which of them that identity may perform;
- the recorded output of a test showing an authorized operation succeeding and
  an unauthorized operation being refused;
- for any write scope, a link to the written approval that granted it.
