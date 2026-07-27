#!/usr/bin/env bash
set -euo pipefail

# One-time setup for the no-cost beta updater. Sparkle stores the private
# Ed25519 key in the current macOS login Keychain; it is never exported.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYCHAIN_ACCOUNT="${CONTROL_AGENT_FREE_BETA_KEYCHAIN_ACCOUNT:-huddle-control-agent-free-beta}"

swift package resolve --package-path "$ROOT"
KEY_TOOL="$ROOT/.build/artifacts/sparkle/Sparkle/bin/generate_keys"
[[ -x "$KEY_TOOL" ]] || { echo "Missing Sparkle generate_keys tool after package resolution." >&2; exit 1; }

exec "$KEY_TOOL" --account "$KEYCHAIN_ACCOUNT"
