# Toybox background companion

The companion reads Toybox's SavedVariables snapshots, uploads them to your private Toybox and optionally downloads guide preferences. It never evaluates Lua, writes game saves, performs in-game actions, or changes toy ownership based on a craft.

## Setup

Use Python 3.9 or newer. Run these commands from the project root:

```sh
python3 -m venv companion/.venv
companion/.venv/bin/python -m pip install -r companion/requirements.txt
companion/.venv/bin/python companion/toybox_companion.py configure --wow-dir '/Applications/World of Warcraft/_retail_'
companion/.venv/bin/python companion/toybox_companion.py pair
companion/.venv/bin/python companion/toybox_companion.py install
```

`configure` asks for the existing Sites private-service access credential in a hidden prompt. It is the Sites credential for this exact private website, separate from your Blizzard authorization. The Site owner can retrieve it through Sites `get_site`. Never put it in a command argument, source file, browser storage or plain-text configuration. The companion stores it in macOS Keychain, Windows Credential Manager, or a supported Linux system credential store. Plain-text fallback stores are rejected.

`pair` opens your private Toybox. Sign in normally and choose **Connect this computer**. Pairing links expire after ten minutes and require proof held by the companion. The browser never receives the companion's upload token. That revocable token is bound to your existing Toybox user; uploads cannot choose another account or rename the planner's bound characters. Use **Disconnect companion** in Game connection to revoke it.

Install Toybox Guides 2.0 or newer into `_retail_/Interface/AddOns/ToyboxExport`. Reload WoW after updating the addon. Open your own Engineering or Inscription window and relevant expansion recipe lists to capture profession observations.

## Everyday use

Play normally. The addon captures snapshots in memory, then WoW writes them to `WTF/Account/<account>/SavedVariables/ToyboxExport.lua` on normal logout, exit or `/reload`. The companion checks for changed files every five seconds, waits for writes to settle, and uploads new character snapshots. It can run while the website is closed. The website refreshes companion progress every 30 seconds while visible.

Files are not continuously flushed by WoW. A crash can leave the previous saved snapshot. The companion cannot observe unopened profession windows or infer unreported unlocks. Old timestamps stay old; missing data never becomes a new completion.

Toybox Export 1.4 keeps its last successful capture during shutdown, when game APIs can already be unloading. For legacy captures without stable identities, the companion also reads WoW's previous Toybox `.lua.bak` save to recover positive boss-clear evidence for the exact same character. Recovered evidence keeps its original timestamp; it never carries a raid attempt into a new reset or changes toy ownership. Missing or malformed backups do not block current snapshots.

Interrupted uploads retry after 5, 10, 20 seconds and progressively up to five minutes. Expired/revoked connections retry at five-minute intervals and show an actionable status. A repeated snapshot does not duplicate craft observations. Newer server data wins over an older local snapshot. Incomplete/invalid saves keep the last successful data and are retried after the next write. Never edit the save while WoW is running.

## Commands

```sh
# See local status, without exposing credentials.
companion/.venv/bin/python companion/toybox_companion.py status

# Check and sync saved files once.
companion/.venv/bin/python companion/toybox_companion.py watch --once

# Run in the foreground (macOS, Windows or Linux).
companion/.venv/bin/python companion/toybox_companion.py watch

# Stop automatic startup on macOS; retain connection and saved data.
companion/.venv/bin/python companion/toybox_companion.py uninstall
```

`install` starts a macOS LaunchAgent and enables startup at login. Its arguments contain no credentials. Other platforms can run `watch` through their startup manager; automatic Windows/Linux service installation has not been implemented or verified.

State, logs and non-secret configuration are in `work/companion/` beneath the project. A process lock prevents two watchers from uploading together. `--state-dir` can select another private local state directory, before the subcommand. Re-run `install` after reconnecting or moving the project. If the Site's service credential is rotated, run `configure`, then `install` again.

## Verification

```sh
companion/.venv/bin/python -m unittest discover -s companion -p 'test_*.py' -v
node --import ./scripts/sites-env.mjs tests/companion-sync-check.mjs
python3 tests/addon-check.py
```

Python checks cover saved-file parsing, UTF-8/escapes, rejected executable Lua, incomplete saves, debounce, persistent deduplication, retries, revoked credentials, realm/region isolation, older snapshots, protected state files and refusing credential-bearing redirects. Local database checks cover pairing proof, expiry, approval races, per-user device tokens, revocation, stale/replayed imports and preservation of existing progress. Lua tests exercise automatic captures and per-GUID outboxes. Actual logout/reload behavior additionally requires an in-game save with the installed addon.

## Two-way guide preferences (1.2)

The new guide roster supports every class/realm/region by full GUID. Website choices (followed/excluded guides, budget and per-character Engineering) sync separately from observed progress. The server accepts edits in order, acknowledges operation IDs and ignores replayed edits. The addon preserves unacknowledged local edits until accepted.

The companion stages only validated preference JSON, escaped as a string, into the installed addon's fixed `Inbox.lua` loader. It never downloads executable code or writes SavedVariables. Preferences take effect at the next reload/login. A mismatched profile or unsupported version is rejected while retaining the last working state. An unmanaged inbox is not overwritten; preference staging errors do not stop observation uploads.

WoW may read addon source files before PLAYER_LOGOUT uploads have finished, so a preference saved just at reload may require the following reload to be consumed. Play normally; ordinary guide tracking is always local. There are no scheduled external notifications.

## Daily sessions and private guide reports (1.3)

Addon 2.2 adds a saved checklist, separate temporary browsing state and private instruction reports. The companion negotiates `session-v1` and `reports-v1` only with compatible installed addons. Reports upload independently with stable IDs and revisions; duplicate uploads are acknowledged without duplication. Undo sends a deletion revision, and late notes cannot recreate a deleted report. Rejected report content stays local and cannot block ordinary progress uploads.

Report acknowledgments arrive through the fixed data-only inbox on the next reload/login. Old addons receive compatible preferences without newer keys or report acknowledgments. SavedVariables remain writable only by WoW. Status includes the watcher's running version and last scan time, separately from the command's installed version.

## Capture receipts (companion 1.4.0 / addon 2.3.0)

The addon assigns an immutable capture identity; the companion reports when that identity was read from a settled saved file and the server returns accepted, already-present or superseded status. Identified snapshots are not augmented from a changing backup. The server keeps prior dated evidence. Legacy exports remain supported.

The heartbeat includes the running companion version, scan time and bounded per-GUID disk identities without saved-file paths. Report-upload errors remain separate. New addons receive matching upload acknowledgments in the fixed data-only inbox at the next reload/login; older addons receive only compatible preference/report fields. Website status cannot establish newer unsaved game progress.

All three synchronization stages can be inspected inside the addon and website. Reconnect revoked devices, retry transient failures, and use a normal WoW reload/logout when waiting for an unsaved capture. Offline guide use remains available. The companion never rewrites SavedVariables.


### Deployment address

Set `TOYBOX_SITE_ORIGIN` to your own deployment's HTTPS origin before using the companion. For an installed background watcher, keep that address in the ignored `companion/site.local.json` file as `{"site":"https://toybox.example.invalid"}`, replacing the example with your own origin. This file contains no access token. Credentials remain in the system credential store. Include the local address file beside the script when moving your private installation; public companion downloads contain no personal deployment address.
