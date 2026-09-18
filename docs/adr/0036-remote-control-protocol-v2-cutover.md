# ADR 0036: hard-cut Remote Control protocol v2

## Status

Accepted.

## Decision

Remote Control uses protocol version 2 exclusively. Startup requests, approval,
and native helper-token redemption require `protocolVersion: 2`; the minted
agent JWT metadata also carries that version. A mismatch is a documented
update-required domain outcome, not a compatibility fallback.

Version 2 adds reliable `remote-control:stop-intent { sessionId }`. Browsers
accept it only from the active session's exact Sharer or Controller. Agents
also require their SFU-attested grant to match that session and sender before
releasing held input, stopping clipboard work, unpublishing, and disconnecting.
Malformed, replayed, bystander, wrong-session, and v1 packets fail closed.

The release requirement is Control Agent 0.2.0 for macOS arm64 and Windows x64
and arm64. Operators publish immutable artifacts and checksums before setting
the signed Windows minimum to 0.2.0. They deploy the API guard, run the
Remote-Control-only cutover command to end pending/active grants with a
protocol-upgrade audit reason and disconnect agents, verify no remote-control
state remains, then deploy the v2 web client. Ordinary calls are never ended.

## Consequences

An additive v1/v2 migration was rejected: accepting a legacy packet weakens the
authorization boundary and leaves a Stop path with ambiguous semantics. Existing
in-session Stop remains available until the operator cutover; after it, stale
agents are asked to update rather than being silently admitted.
