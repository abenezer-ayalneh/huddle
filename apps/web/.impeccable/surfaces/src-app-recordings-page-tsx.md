---
version: 1
slug: "src-app-recordings-page-tsx"
primary_target: "src/app/recordings/page.tsx"
related_targets: ["src/app/recordings/loading.tsx","src/app/recordings/RecordingsPageShell.tsx"]
---

# Recordings archive

- **Mode:** Operate.
- **Audience and job:** A signed-in Host needs to locate a past room recording, understand its temporary/local or Google Drive delivery state, and open or download it without confusing delivery configuration with the archive itself.
- **Direction:** Signal Handoff archive desk: a warm, framed field with the Huddle mark anchored left, utility actions right, a compact private-archive rail, a delivery sidecar, and a chronological recording ledger.
- **Memorable moment:** The private Google Drive destination sits beside—not above—the host's own recording history, so retention and delivery constraints remain legible at a glance.
- **Constraints:** Preserve session gating, OAuth/backfill/disconnect behavior, every recording action and status, visible focus, reduced motion, and responsive single-column fallback.
