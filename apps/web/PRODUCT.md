# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Huddle is for small teams and technical operators who want reliable browser
meetings on infrastructure they control.

A signed-in Host creates an Instant Meeting or Scheduled Meeting and controls
admission and room actions. Guests open a shared link and complete the Device
Check without installing an app or creating an account. A Guest may also be
signed in, but that does not make them a Host.

During attended Remote Control, the Controller stays in the browser. Only the
Sharer installs the macOS Control Agent.

## Product Purpose

Huddle lets a team run dependable real-time meetings on its own infrastructure
without giving up a familiar, low-friction browser workflow. Success means
participants can complete a reliable call, Guests can enter through a shared
link with minimal setup, and the Host retains clear, server-enforced authority
over the room.

## Positioning

Huddle combines self-hosted meeting infrastructure with managed-room authority:
Guests join through account-free links and a Waiting Room, while identity,
admission, media grants, recording actions, and privileged controls remain
server-authorized.

Huddle is a self-hosted-only product, not a multi-tenant SaaS or a per-seat
subscription service. Its deployment target is a single VPS or Docker host for
small teams; it is not positioned as an enterprise-scale Zoom or Google Meet
replacement.

## Operating Context

- A Host signs in, starts an Instant Meeting or creates a Scheduled Meeting,
  and shares its stable Room Code link.
- A Guest opens the link, completes the Device Check, Knocks, waits in the
  Waiting Room, and enters after the Host chooses Admit. An eligible signed-in
  Guest may use a call-scoped Direct Rejoin Grant after leaving or disconnecting.
- Participants use camera, microphone, participant layouts, Present, in-call
  chat, device switching and recovery, call shortcuts, and background-call
  behavior from a modern desktop or mobile browser.
- The Host manages admission, Mute on Entry, participant mute or removal, and
  Recording. A Recording is a room-composite MP4 stored temporarily in MinIO;
  a Host may connect a private Google Drive destination for delivery.
- Remote Control begins inside an active room. The Controller sends a Request
  Control action, the Sharer explicitly approves it, then the Sharer launches
  the macOS Control Agent and selects an entire physical display.
- The core deployment uses Next.js, NestJS, self-hosted LiveKit, Redis,
  Postgres, MinIO, Caddy, and Docker Compose. Google sign-in and Google Drive
  delivery are optional integrations and do not change the self-hosted product
  model.

## Capabilities and Constraints

- The browser never receives the LiveKit API secret. The server decides
  participant identity, room scope, grants, and Host authority.
- Managed Rooms use generated Room Codes. Hosts must have an account; Guests
  can join anonymously through a shared link.
- The calling experience includes camera and microphone publishing, live
  participant layouts, mute and camera controls, connection recovery, Present,
  chat, host controls, scheduling, and Recording.
- Direct Rejoin is available only to an admitted signed-in Guest for the same
  active call. It is not standing room access and is revoked when the call ends
  or the Host removes that Guest.
- Recording must remain visible to everyone through the Recording Indicator.
  Local copies have finite retention; optional Google Drive delivery is private
  and separately connected by the Host.
- Remote Control is attended, room-scoped, identity-bound, and mutually
  exclusive with Present. The Sharer can stop it at any time and must reconfirm
  it every 30 minutes.
- Remote Control exposes the Sharer's selected physical display to the room and
  permits the approved Controller to send mouse, keyboard, Trackpad Scroll, and
  bounded plain-text Clipboard Sharing input. Clipboard contents remain
  ephemeral and must not enter HTTP, Redis, Postgres, room metadata, logs,
  recordings, or audit records.
- Unattended access, support codes outside a room, rich or binary clipboard
  transfer, files, desktop audio, and Windows or Linux Control Agents are out of
  scope. Bounded plain-text Clipboard Sharing is ephemeral and room-scoped. The
  macOS Control Agent is the only native companion; the meeting itself remains
  browser-based.
- Live WebRTC behavior, physical macOS permissions, signed Control Agent
  releases, and external-provider integrations require real-device or
  account-bound acceptance. Source, tests, and builds alone do not establish
  those outcomes.
- Huddle is released under the Apache-2.0 license. Third-party dependencies keep
  their own licenses and attribution requirements. The official deployment is a
  capacity-limited evaluation demo, not a hosted subscription service; operators
  provide their own infrastructure and provider costs for production use.

## Brand Commitments

The product name is **Huddle**. Product copy is direct, technically clear, and
honest about authority, consent, platform limitations, and verification gaps.
Use the domain language defined in the repository glossary, including Managed
Room, Host, Guest, Room Code, Device Check, Knock, Waiting Room, Admit / Deny,
Present, Recording, Request Control, Sharer, Controller, and Control Agent.

Existing Huddle marks and product assets must remain attributable to Huddle.
Visual styling decisions belong in `DESIGN.md`, not in this product record.

## Evidence on Hand

- Product scope, status, and acceptance boundaries:
  `README.md`, `docs/PRD.md`, and `docs/ROADMAP.md`.
- Durable terminology and user-facing behavior: `CONTEXT.md`.
- Architecture, authority, privacy, and lifecycle decisions:
  `docs/ARCHITECTURE.md` and `docs/adr/`.
- Current web behavior and copy: `apps/web/src/app/`,
  `apps/web/src/components/`, and `apps/web/src/lib/`.
- Existing Huddle assets: `apps/web/public/logo.svg`,
  the illustrative portrait set under
  `apps/web/public/landing-portraits/`, and the application icon and social
  preview files under `apps/web/public/` and `apps/web/src/app/`.
- Deployment URLs and public operator identity are supplied from the validated
  environment contract; this init did not perform live deployment acceptance.
- The repository has implementation, automated checks, and documented manual
  verification notes. It does not provide confirmed customer testimonials,
  customer logos, adoption figures, independent benchmarks, or complete
  physical-device and external-account acceptance. Future work must not invent
  or imply that evidence.

## Product Principles

1. **Own the infrastructure and the authority.** Keep the media stack
   self-hosted and privileged room decisions server-enforced.
2. **Make joining easy without weakening trust.** Guests should need only a
   link and Device Check, while admission and identity remain controlled.
3. **Make consent visible and reversible.** Recording and Remote Control must
   clearly show their active state and give the responsible participant a way
   to stop.
4. **Prefer reliable calls and honest evidence over feature claims.** Protect
   the core meeting path and distinguish implemented code from live,
   device-bound, or account-bound acceptance.
5. **Use native software only where the browser ends.** Keep the meeting in the
   web app; use the narrow macOS companion only for selected-display capture and
   approved operating-system input.

## Accessibility & Inclusion

Preserve a practical accessibility baseline across modern desktop and mobile
browsers: keyboard-operable actions, visible focus states, semantic controls,
appropriate labels and live-region feedback, and responsive layouts. Huddle
does not currently claim formal WCAG conformance; future work must not imply
that an accessibility audit or certification has occurred without evidence.
