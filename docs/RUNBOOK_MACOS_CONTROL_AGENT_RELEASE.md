# Release the macOS Control Agent

**Owner:** Huddle release maintainer | **Frequency:** for every public macOS candidate
**Last updated:** 2026-09-18 | **Last channel verification:** Apple-Silicon no-cost beta 0.2.0 (6), an ad-hoc build

## Purpose

Use this runbook to publish and verify a macOS Control Agent release without
breaking the installed app's update path. It covers two deliberately separate
lanes:

| Lane                       | Audience and trust                        | Immutable release                   | Mutable channel           |
| -------------------------- | ----------------------------------------- | ----------------------------------- | ------------------------- |
| Apple-Silicon no-cost beta | arm64 only; ad-hoc signed and unnotarized | `control-agent-free-beta-vX.Y.Z-bN` | `control-agent-free-beta` |
| Developer ID public beta   | arm64 and x86_64; signed and notarized    | `control-agent-vX.Y.Z`              | `control-agent-beta`      |

Do not mix their Sparkle keys, artifacts, or channel names. A checksum and
Sparkle archive signature verify bytes; neither removes the no-cost beta's
unnotarized Gatekeeper warning.

## Release invariants

- A versioned release asset is immutable. Changed bytes require a higher
  `CFBundleVersion` and a new versioned tag; never overwrite a versioned DMG.
- Every updater-enabled app embeds a non-empty `SUPublicEDKey` and its lane's
  HTTPS `SUFeedURL`. An already-published app with either field empty cannot
  be fixed remotely; it needs one manual transition install.
- Every no-cost beta must use `CODE_SIGN_IDENTITY=-`, producing a fresh ad-hoc
  signature. macOS treats each installed release as a new Screen Recording and
  Accessibility client; approving grants again is an expected release step.
- The no-cost appcast must point to the immutable versioned DMG, not to the
  mutable manual-download DMG on `control-agent-free-beta`.
- The permanent no-cost appcast contains exactly one entry for the current
  immutable archive. Generate it fresh for each rollout; do not merge stale
  feed history that can retain duplicate or malformed archive URLs.
- `generate_appcast --download-url-prefix` must end with `/`. Without it,
  Sparkle generates `.../releases/download/Huddle-…dmg` and drops the release
  tag from the archive URL.
- The no-cost private Sparkle key remains in the publisher's macOS login
  Keychain under `huddle-control-agent-free-beta`. Never export, commit, or
  put it on the VPS.

## Prerequisites

- [ ] Use an Apple-Silicon Mac for the no-cost arm64 beta. Use matching
      physical hardware for each architecture accepted for the Developer ID lane.
- [ ] Authenticate `gh` as a repository maintainer with release write access.
- [ ] Record physical release-candidate acceptance. Source, packaging, and
      GitHub checks do not prove macOS privacy permissions, WebRTC, or a real
      Sparkle installation.
- [ ] Plan to grant Screen Recording and Accessibility to the exact installed
      no-cost release candidate, even if an earlier Huddle build has grants.
- [ ] Before the first no-cost updater build, allow the local Keychain prompt
      from `configure-free-beta-updater.sh`. Do not create or rotate a key
      casually.

## Procedure: Apple-Silicon no-cost beta

### 1. Choose the build number and review scope

Every changed release byte needs a fresh build number.

```bash
git status --short
git diff --check
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' apps/control-agent/Info.plist
/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' apps/control-agent/Info.plist
```

If the planned DMG differs from an existing
`control-agent-free-beta-vX.Y.Z-bN` release, increase `CFBundleVersion`
first. Do not reuse the tag because the marketing version is unchanged.

**Expected result:** the version, build number, and changed files are
deliberate.

**If it fails:** stop. Resolve the scope or choose a new build number before
creating an artifact.

### 2. Run source and script preflight checks

```bash
swift test --package-path apps/control-agent
bash -n apps/control-agent/scripts/configure-free-beta-updater.sh apps/control-agent/scripts/build-free-beta.sh apps/control-agent/scripts/publish-free-beta.sh
plutil -lint apps/control-agent/Info.plist
git diff --check
```

**Expected result:** Swift tests, shell syntax, plist validation, and whitespace
checks pass.

**If it fails:** fix and repeat this step. A package build alone is not release
acceptance.

### 3. Confirm the local Sparkle key

Run this only for the first no-cost updater build:

```bash
./apps/control-agent/scripts/configure-free-beta-updater.sh
```

For an established key, confirm it is usable without printing or exporting
private material:

```bash
apps/control-agent/.build/artifacts/sparkle/Sparkle/bin/generate_keys --account huddle-control-agent-free-beta -p >/dev/null
```

**Expected result:** the command exits successfully. The public key is embedded
during the build; the private key remains in the login Keychain.

**If it fails:** stop. Recover the established key. A silent key rotation
creates a separate update lineage and leaves older updater-enabled builds unable
to verify future archives.

### 4. Build and inspect the staged app and DMG

```bash
./apps/control-agent/scripts/build-free-beta.sh

APP='apps/control-agent/dist/Huddle Control Agent.app'
DMG='apps/control-agent/dist/Huddle-Control-Agent-macos-arm64.dmg'
REPOSITORY="${GITHUB_REPOSITORY:-abenezer-ayalneh/huddle}"
EXPECTED_FEED="https://github.com/${REPOSITORY}/releases/download/control-agent-free-beta/appcast-arm64.xml"

test -n "$(/usr/libexec/PlistBuddy -c 'Print :SUPublicEDKey' "$APP/Contents/Info.plist")"
test "$(/usr/libexec/PlistBuddy -c 'Print :SUFeedURL' "$APP/Contents/Info.plist")" = "$EXPECTED_FEED"
hdiutil verify "$DMG"
codesign --verify --deep --strict "$APP"
codesign -dvv "$APP" 2>&1 | rg -qx 'Signature=adhoc'
lipo -info "$APP/Contents/MacOS/HuddleControlAgent"
test "$(shasum -a 256 "$DMG" | awk '{print $1}')" = "$(awk 'NR == 1 {print $1}' "$DMG.sha256")"
```

**Expected result:** a non-empty updater public key, exact permanent feed URL,
valid arm64 DMG, ad-hoc signature, valid app seal, and matching checksum
sidecar.

**If it fails:** discard only the local candidate, correct the configuration,
increase the build number if bytes changed, and rebuild. Do not publish it.

### 5. Publish the immutable archive and permanent channel

```bash
./apps/control-agent/scripts/publish-free-beta.sh
```

The script publishes or verifies the immutable
`control-agent-free-beta-vX.Y.Z-bN` archive, then advances the permanent
`control-agent-free-beta` channel with the manual DMG, checksum, and signed
`appcast-arm64.xml`.

**Expected result:** it prints the permanent channel URL. The Downloads page
uses the permanent DMG; Sparkle uses the immutable versioned DMG.

**If it fails after creating the versioned release:** never delete or overwrite
that archive. Complete the remote checks and repair only the mutable channel, or
publish a higher build.

### 6. Verify the deployed release, not just local output

```bash
APP='apps/control-agent/dist/Huddle Control Agent.app'
VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist")"
BUILD_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP/Contents/Info.plist")"
REPOSITORY="${GITHUB_REPOSITORY:-abenezer-ayalneh/huddle}"
VERSION_TAG="control-agent-free-beta-v${VERSION}-b${BUILD_VERSION}"
CHANNEL_TAG='control-agent-free-beta'
ARCHIVE="Huddle-Control-Agent-macos-arm64-${VERSION}-${BUILD_VERSION}.dmg"
CHANNEL_DMG='Huddle-Control-Agent-macos-arm64.dmg'
VERIFY_DIR="$(mktemp -d)"
trap 'rm -rf "$VERIFY_DIR"' EXIT

gh release view "$VERSION_TAG" --repo "$REPOSITORY" --json tagName,assets
gh release view "$CHANNEL_TAG" --repo "$REPOSITORY" --json tagName,assets
gh release download "$CHANNEL_TAG" --repo "$REPOSITORY" --pattern appcast-arm64.xml --dir "$VERIFY_DIR"
xmllint --noout "$VERIFY_DIR/appcast-arm64.xml"
test "$(rg -F -o "https://github.com/${REPOSITORY}/releases/download/${VERSION_TAG}/${ARCHIVE}" "$VERIFY_DIR/appcast-arm64.xml" | wc -l | tr -d ' ')" -eq 1
! rg -F '/releases/download/Huddle-Control-Agent-' "$VERIFY_DIR/appcast-arm64.xml"
rg -F 'sparkle:edSignature=' "$VERIFY_DIR/appcast-arm64.xml"
curl --fail --silent --show-error --location --range 0-0 --output /dev/null "https://github.com/${REPOSITORY}/releases/download/${VERSION_TAG}/${ARCHIVE}"
curl --fail --silent --show-error --location "https://github.com/${REPOSITORY}/releases/download/${CHANNEL_TAG}/${CHANNEL_DMG}" --output "$VERIFY_DIR/$CHANNEL_DMG"
test "$(shasum -a 256 "$VERIFY_DIR/$CHANNEL_DMG" | awk '{print $1}')" = "$(shasum -a 256 'apps/control-agent/dist/Huddle-Control-Agent-macos-arm64.dmg' | awk '{print $1}')"
```

This proves the Downloads page and appcast serve the intended bytes.

**Expected result:** GitHub lists the immutable DMG and sidecar; the permanent
channel lists the appcast and manual DMG; the remote appcast has exactly one
signed entry for the exact versioned archive URL; the archive is retrievable.

**If it fails:** do not declare rollout complete. Follow
[Troubleshooting](#troubleshooting).

### 7. Perform a physical update acceptance test

In a disposable macOS test account, copy an earlier **updater-enabled** Control
Agent to `/Applications`, then run it from there rather than from a DMG or
temporary folder.

1. Confirm the updates card shows the toggle and **Check for updates**, not the
   legacy no-channel message.
2. With no Remote Control session active, leave automatic updates off, click
   **Check for updates**, and accept the offered update.
3. Reopen the app, grant Screen Recording and Accessibility to this exact new
   ad-hoc build, and confirm its permission badges refresh.
4. Confirm the newer version keeps the updater card and remains inert until a
   new approved link is opened. Record the macOS version, architecture,
   Gatekeeper behavior, candidate version, and result in the release record.

An app opened from a mounted DMG is expected to report that it cannot update
from a read-only or temporary location. That proves discovery only, not a
successful installation.

## Procedure: Developer ID public beta

Use the no-cost procedure only for `control-agent-free-beta`. For a trusted
release, first complete physical acceptance on Apple Silicon and Intel Macs,
then create a `control-agent-vX.Y.Z` tag. The
[`control-agent-release.yml`](../.github/workflows/control-agent-release.yml)
workflow must build and notarize both architectures, publish the immutable tag
release with both DMGs and `SHA256SUMS`, then advance `control-agent-beta`
with the signed release manifest and both architecture-specific appcasts.

Verify the same three updater invariants for each architecture: a non-empty
`SUPublicEDKey`, an HTTPS architecture-specific feed URL, and an appcast whose
archive URL retains the tag and ends in the matching DMG. Its
`--download-url-prefix` also must retain the trailing slash.

## Troubleshooting

| Symptom                                         | Likely cause                                           | Recovery                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Updates card says the build has no channel      | Published app has blank `SUPublicEDKey` or `SUFeedURL` | Publish a higher build with both values embedded. Users of the blank build need one manual install.                                    |
| Updated app needs macOS privacy grants again    | Expected fresh ad-hoc signature for this release       | Grant Screen Recording and Accessibility to the exact installed app, then confirm its permission badges refresh.                       |
| Appcast URL is `.../releases/download/Huddle-…` | Generator prefix lacks its trailing `/`                | Keep the immutable DMG. Regenerate and upload only the signed permanent appcast, then repeat remote verification.                      |
| Appcast lacks a current archive or signature    | The channel update did not complete                    | Do not direct users to it. Regenerate the appcast from the exact immutable DMG and re-upload it.                                       |
| Appcast has duplicate or stale archive entries  | An existing feed was merged during generation          | Regenerate a fresh one-entry appcast from the current immutable DMG, upload it to the mutable channel, and repeat remote verification. |
| Staged and permanent DMGs have different hashes | A stale manual asset is served                         | Stop rollout claims. Upload the matching DMG and checksum, then repeat remote checks.                                                  |
| Versioned tag already has different bytes       | Build number was reused                                | Leave it intact, increase `CFBundleVersion`, rebuild, and publish a new tag.                                                           |
| Key lookup or appcast signing fails             | Login Keychain key unavailable                         | Stop publication and recover the established key. Do not silently rotate it.                                                           |
| Sparkle cannot update from a mounted DMG        | macOS correctly treats it as read-only                 | Copy the app to `/Applications`, relaunch, and repeat the test.                                                                        |

## Rollback and escalation

Never delete, overwrite, or repoint an immutable versioned archive. If the
latest archive is bad, publish a higher replacement build and make the permanent
channel point to it. If only the appcast is bad, replace that mutable channel
asset with a newly generated signed appcast for a known-good immutable DMG, then
repeat remote verification.

Escalate to the Huddle release maintainer when the Keychain signing key, GitHub
release permission, Developer ID certificate, notarization credentials, or a
physical macOS acceptance device is unavailable. Do not weaken Gatekeeper, skip
archive verification, or substitute a no-cost artifact into the trusted channel.

## History

| Date       | Run by                    | Notes                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-18 | Huddle release maintainer | Published no-cost beta 0.2.0 (6) after correcting a 0.2.0 (5) build that shipped without embedded Sparkle metadata. Every no-cost release deliberately uses an ad-hoc signature and repeats privacy-grant acceptance. Added remote appcast URL, immutable-asset, signature, and single-entry verification; regenerated the permanent appcast to remove stale duplicate history. |
