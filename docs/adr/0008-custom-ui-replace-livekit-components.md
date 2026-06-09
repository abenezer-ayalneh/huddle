# Replace LiveKit UI components with custom cyberpunk-themed components

Status: accepted

We are removing `@livekit/components-react`'s high-level UI components
(`VideoConference`, `PreJoin`, `ConnectionStateToast`) and their stylesheet
(`@livekit/components-styles`), replacing them with hand-built React components
styled to a dark cyberpunk/futuristic aesthetic (magenta + cyan palette, glass
effects, clipped corners, animated borders, dot-grid backgrounds).

We **keep** the headless layer: `LiveKitRoom` (the React context provider) and
all hooks (`useRemoteParticipants`, `useTracks`, `useLocalParticipant`,
`useConnectionState`, etc.). These provide state and media bindings with zero UI
opinion.

## Why this is worth an ADR

Hard to reverse: once we own the video grid, control bar, device picker, and
connection-state handling, going back to the library components means discarding
that work. Surprising: the LiveKit component library is purpose-built for this
use case, so a future reader will ask why we don't use it. Trade-off is real:
full visual control vs. maintaining more rendering code ourselves.

## What we're replacing

| LiveKit component                     | Custom replacement                                               |
| ------------------------------------- | ---------------------------------------------------------------- |
| `VideoConference`                     | `VideoGrid` (auto-grid) + `ControlBar` (floating pill)           |
| `PreJoin`                             | `PreJoinScreen` (full-screen camera preview + floating controls) |
| `ConnectionStateToast`                | `ConnectionStatus` (styled toast/HUD indicator)                  |
| chat panel (inside `VideoConference`) | `ChatPanel` (glass slide-out, `useChat`)                         |
| `@livekit/components-styles`          | Removed entirely; all styles are Tailwind + custom CSS           |

**Screen share and chat were features delivered _by_ `VideoConference`** (ADR
context: Roadmap Phases 4 & 5 were "delivered by the prebuilt component"). They
are therefore not free once it is removed — they are reimplemented on the same
headless primitives: screen share via `useTrackToggle({ source: ScreenShare })`
in `ControlBar` (the share track is rendered as a prominent tile in `VideoGrid`),
and chat via `useChat` in `ChatPanel`. The API token already grants `canPublish`
and `canPublishData`, so no backend change was needed.

## What we're keeping

- `LiveKitRoom` — wraps the call view, provides Room context
- `useRemoteParticipants`, `useTracks`, `useLocalParticipant` — state hooks
- `useConnectionState`, `useRoomInfo` — connection and metadata hooks
- `livekit-client` SDK — the underlying Room, Track, Participant objects

## Why replace

- **Visual control**: the cyberpunk design (clipped corners, animated gradient
  borders, scanline overlays, glass effects, dot-grid backgrounds) cannot be
  achieved by CSS-overriding the library components. Their DOM structure and class
  names are internal implementation details that break across versions.
- **Feature integration**: our HostPanel, knock system, mute-on-entry, and
  recording controls need tight integration with the call UI. With custom
  components, controls live where the design puts them, not where the library's
  layout dictates.
- **Bundle size**: dropping the component library and its stylesheet reduces the
  client bundle. The hooks are a fraction of the size.

## Why keep the hooks and provider

The hooks are thin wrappers around `livekit-client` events — they provide
reactive state (participant lists, track subscriptions, connection changes) with
no UI opinion. Reimplementing them would be pure boilerplate with no design
benefit. `LiveKitRoom` manages the Room lifecycle (connect, disconnect, cleanup)
correctly; rewriting that is risk for zero visual gain.

## Consequences

- We own the video tile rendering pipeline: layout algorithm, tile sizing,
  active-speaker detection, track attachment/detachment. Bugs in video rendering
  are ours to fix, not upstream's.
- Device enumeration and selection (camera, mic, speaker) must be built from
  `livekit-client`'s `Room.getLocalDevices()` and related APIs.
- Future LiveKit features (e.g., new track types, E2EE UI) require manual
  integration rather than a component update.
- The app becomes dark-only (light mode dropped); the cyberpunk aesthetic
  requires dark backgrounds for neon glows and glass effects to work.
