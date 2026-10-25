# Toybox

**Toybox Guides 2.0** adds a standalone Retail guide addon and optional two-way companion preferences. See [the implementation and coverage report](docs/TOYBOX-GUIDES-RELEASE.md) for delivered behavior, reproducible checks and remaining requirements. This development release does not yet satisfy the completed comprehensive-product milestone. `/toybox` now opens the guide; `/toybox export` opens the manual snapshot.

The older website documentation below describes its retained features and historical limitations; use the release report for the new addon.


A private WoW Retail collection journal for Bar. Charcoal, gold, game item icons, and a Priest-first plan.

## Game connection

The primary Game connection path needs no addon:

- Battle.net authorization with the read-only `wow.profile` scope. Imports the full account toy collection, not just starter-catalog matches. Blizzard toy IDs are resolved through toy metadata to their distinct item IDs in resumable batches. Cached mappings and icons are shared; account ownership is private.
- The included ToyboxExport Retail addon exports owned toy item IDs, current reset countdowns, active raid saves by difficulty and boss, quest-log objectives, completed quest flags, and explicitly watched quests. It has no HTTP or automatic upload code. Run `/toybox` on each character and paste its JSON into the site.

The Blizzard character raid endpoint now imports each raid difficulty and boss kill timestamp. Sync raid attempts on the Game connection page; choose an account character and match it to the Priest or Druid slot. Positive kills since the configured EU weekly reset update matching catalog attempts. Old or missing history never clears manual attempts. Extended lockouts are not assumed. Snapshot times remain visible, and failed or malformed responses preserve the previous snapshot. The addon is optional and collapsed by default.

## Dailies & weeklies

A separate recurring progression mode contains Argent Tournament / Argent Crusade dailies, a Legion archaeology rare-quest window, custom daily/weekly/two-week routines, and links to existing daily/weekly toy runs. Routine completion can be per character or once per Warband. Priority, instructions and ongoing notes are editable. Retiring a routine hides it while keeping its history; restore it from the retired view. Regular planner backup/import includes routines.

Daily and weekly completion keys use the configured EU reset boundaries. Legion archaeology requires confirming the actual current Wednesday start once, then uses anchored 14-day periods; it does not claim to know the current quest or reward. Notes survive all resets. Daily quest turn-ins are checked manually without an addon; the completed-quest history endpoint does not establish the current day’s turn-in time.

The full imported collection remains available in Your toybox. Completed planned rewards retire their activities. The starter plan has 19 toys and 16 sourced activities; it is not an exhaustive farming database.

## Today and character progression

Today is the landing view. It remembers a 15-, 30-, 60-minute or custom 5–240-minute budget (30 by default). Unfinished essential routines appear in deadline order and remain visible over budget. Eligible pinned and important toy opportunities fill remaining time; equally ranked guaranteed progress precedes random drops. Nearby optional stops are grouped without estimating travel. Each character/difficulty is a separate opportunity. A matching Legion archaeology routine and toy quest share one completion unit, while the recurring routine remains active even after all its toys are owned.

`CharacterRef` binds each configured character to its exact EU roster ID. `CharacterProgress` retains categorized profile, relevant completed quests, reputations, professions and completed achievements, with successful/attempted timestamps and unavailable-source status. A source failure keeps its last successful data. Both the character-sync response and sync-read contract expose categorized progression, exact CharacterRefs and a versioned eligibility view with reasons, evidence and generation/source timestamps. Eligibility is Ready, Needs prerequisites, Unknown or Complete, with an explanation, next action and evidence. Confirmed access does not imply readiness for every raid difficulty; each difficulty can be confirmed separately. Character level alone never proves solo readiness.

Argent Tournament checkpoints include faction and city introductions, Aspirant challenges, Valiant charges and city champion challenges. Race is only a fallback for selecting a likely city, not an eligibility restriction. Account-wide Crusader achievements do not automatically establish an alt's daily access. Missing quest IDs are treated as unreported evidence rather than definitive non-completion. The user can permanently confirm a supported stage and city. Daily turn-ins remain manual.

The shared Archaeology profession is ID 794. Crystalline Eye uses quests 40857 → 41157; Starlight Beacon uses 41171 → 41172 → 41173. Historical completion does not prove the repeatable quest was completed in this window. The current Wednesday start and reward require explicit confirmation; the reward confirmation expires at the anchored 14-day boundary. Permanent confirmations stay with the exact character. Variable phase checks expire after 24 hours and invalidate when their control cycle changes.

“Sync both characters” refreshes progression and raids for both bound characters together with account toy ownership. It also runs on opening when authorization is valid and the last successful refresh is older than 30 minutes. A D1 lease coordinates concurrent tabs; recent automatic attempts have a 30-minute cooldown. Expired authorization asks the user to reconnect. Toy metadata resolution is resumable. Older responses cannot replace newer character or collection snapshots.

Backups export `toybox-v2`. Imports merge ownership, notes, settings and routines. An old `toybox-v1` backup with main/alt history requires explicit attribution to a bound character or an explicit skip before import. Old slot labels never automatically attach historical attempts or unlocks. Existing D1 JSON records and snapshots are reused; no destructive schema migration is needed.

Checkpoint provenance: [ATT Tournament definitions](https://github.com/ATTWoWAddon/AllTheThings/blob/0bb8f4be59bcc0262830400914516ef1698d789e/.contrib/.db/standard/06%20-%20Expansion%20Features/03%20-%20Wrath%20of%20the%20Lich%20King/Argent%20Tournament.lua), [ATT Archaeology definitions](https://github.com/ATTWoWAddon/AllTheThings/blob/0bb8f4be59bcc0262830400914516ef1698d789e/.contrib/.db/standard/10%20-%20Professions/Archaeology.lua). Account-wide achievement state is intentionally weaker than character quest/access evidence.

## Profession cooldowns

Profession sync retains expansion tiers and learned Blizzard recipe IDs with separate recipe timestamps and unavailable-data status. Recipe IDs and crafting spell IDs remain distinct. Preset v1 supports Jard’s Peculiar Energy Source, Secrets of Draenor Engineering, Gearspring Parts and Invent, plus optional Scroll of Wisdom, Secrets of Draenor Inscription and War Paints. Confirmed learned Engineering recipes on the main become essential routines; other recipes require opt-in. Missing recipe evidence offers an exact-character confirmation. A reported profession change blocks the old routines while retaining their history.

Daily recipes follow the configured reset. Invent uses the [official 20-hour cooldown](https://worldofwarcraft.blizzard.com/en-us/news/24134803/hotfixes-october-16-2024). Upgraded Gearspring Parts and War Paints have three charges with sequential 24-hour recovery; each base/upgraded pair produces one chosen opportunity, not two tasks. Variant mappings and timing evidence are pinned in `lib/profession-presets.ts`. The live Blizzard profession read verified Invent as recipe 50787, distinct from crafting spell 447312. Exact learned name inside Khaz Algar Engineering remains a fallback for future recipe variants; crafting spell IDs are never substituted for recipe IDs.

Current cooldown state starts unknown. Used now, earlier craft times and in-game observations produce manual estimates, with Undo for the last entered log. Cooling tasks appear under Upcoming and do not consume Today’s budget. Engineering is an expandable stop with separate two-minute craft groups, ingredients, tools, notes and Wowhead links. These estimates exclude travel and gathering. Logs never add materials, recipes or toy ownership, and toy ownership never retires a profession routine.

Versioned `cooldown2`, `profession-enabled2`, `profession-retired2` and recipe-confirmation records use exact character scopes. The existing tables and backup format remain valid; optional routine timing fields leave old routines unchanged. Backups support up to 20,000 records and imports validate everything before writing in batches of 500. Both sync interfaces expose a versioned `professionCooldowns` view; eligibility routines include timing and cooldown evidence. Failed source requests preserve cached recipe evidence and manual history.

## Fewer access questions

Toybox reuses an exact character's previous Blizzard boss clears, by difficulty, as farming evidence. It does not equate group clears with solo success. Ordinary seasonal vendor and open-world farm routes have no invented permanent-access gate. One route/character question covers nearby Arathi goals, and one raid question offers all its difficulties; ready farming opportunities stay distinct.

Toybox Export 1.2 records completed quest checkpoints, observed raid entry by instance map ID and difficulty, learned crafting spell IDs and the separate `skillLineAbilityID`, current recipe cooldown/charge observations, and supported archaeology quest offers seen through gossip. It caches observations by full player GUID; GUIDs are never decoded into Blizzard profile IDs. Import review attributes observations to the exact bound region/realm/name/class and CharacterRef. Unbound and old addon exports remain useful for their existing collection/attempt features without inventing a new character binding.

The importer stores source timestamps, keeps successful cached evidence on partial exports, and records cooldown observations separately from craft uses. Existing notes, manual history and ownership stay intact. A later exact-character replacement cannot inherit the old binding's access evidence. Curated pet-dungeon introduction quests establish that character's access; account-wide achievements do not. Historical archaeology completions cannot establish a rotation. Observed supported quest offers expire with the existing anchored window; other offers and unobserved phases can still need a check.

Pasting a valid export immediately previews it; Import snapshot saves it. Validation and server errors appear beside the paste field. Additional numeric quest-frequency values are preserved, without assigning them a daily or weekly cadence. Today acknowledges saved exports and reports captured quest, raid and profession coverage instead of repeating the initial import prompt. Empty recipe/cooldown lists remain unknown.

Primary client API references: [recipe IDs and learned status](https://github.com/Gethe/wow-ui-source/blob/live/Interface/AddOns/Blizzard_APIDocumentationGenerated/TradeSkillUITypesDocumentation.lua), [cooldown return usage](https://github.com/Gethe/wow-ui-source/blob/live/Interface/AddOns/Blizzard_ProfessionsTemplates/Blizzard_ProfessionsRecipeSchematicForm.lua), [own-profession context guards](https://github.com/Gethe/wow-ui-source/blob/live/Interface/AddOns/Blizzard_ProfessionsTemplates/Blizzard_Professions.lua), [instance/difficulty](https://github.com/Gethe/wow-ui-source/blob/live/Interface/AddOns/Blizzard_APIDocumentationGenerated/InstanceDocumentation.lua), [offered quest IDs](https://github.com/Gethe/wow-ui-source/blob/live/Interface/AddOns/Blizzard_APIDocumentationGenerated/GossipInfoDocumentation.lua). Pet unlock checkpoints use the pinned ATT [Pet Battles definitions](https://github.com/ATTWoWAddon/AllTheThings/blob/0bb8f4be59bcc0262830400914516ef1698d789e/.contrib/.db/standard/11%20-%20Character/Pet%20Battles.lua).

## Blizzard setup

Set `TOYBOX_SITE_ORIGIN` to your deployment origin in the server runtime (or ignored `.dev.vars` locally). Register a personal client at https://develop.battle.net/access/clients with your deployment origin followed by `/api/blizzard/callback`, for example:

`https://toybox.example.invalid/api/blizzard/callback`

Enter its client ID and secret in the private Game connection screen, then authorize Battle.net. ChatGPT remains the Site's identity provider. The connection requests data access only.

A runtime secret named `BLIZZARD_TOKEN_KEY` supplies 32 random bytes encoded as base64url. It is configured through Sites runtime secrets, not source. Client secrets and expiring access tokens are AES-GCM encrypted with per-user/per-record associated data in a separate D1 table. OAuth state is hashed, user-bound, expires after ten minutes, and is consumed once. Generic progress reads, backups, and sync status never expose credentials. No refresh token is assumed; reconnect when authorization expires.

Deterministic progression states, failure paths and reset boundaries use synthetic character fixtures and real local D1. Connect your own Battle.net account in the private deployment to load character data. The addon has offline Lua API-fixture validation and has not been run inside a WoW client.

## Reset and import behavior

- Version 2 attempts, permanent unlocks and routine completions use the Blizzard character ID, EU region and realm, plus the activity/difficulty/period where relevant. Main/alt labels never supply identity. Ownership remains account-wide. No destructive reset task is scheduled.
- EU defaults are Wednesday 04:00 UTC and daily 04:00 UTC. An EU addon export can supply observed game-reset anchors. Editing the manual hours clears those anchors.
- Permanent ownership, unlocks, notes, pins and snoozes remain separate.
- Variable Warfront-control and archaeology rotations still need explicit confirmation; availability confirmations expire after 24 hours.
- Addon imports update only positive, matched boss/quest completions. Names are matched to the configured main/alt, or explicitly assigned at import review. Unsupported classes and unmatched characters do not overwrite main-character attempts.
- Imported daily and weekly quests can open a prefilled collection-goal form. Matching goals show objective bars, capture times, and previous-reset warnings. Ready-to-turn-in quests remain separate from reported turn-ins.
- Explicit main/alt mapping also remembers the realm. EU attempts never update from another region, and non-Latin character names remain distinct.
- Older snapshots are rejected. An incomplete toy scan merges newly reported toys with the previous list. Older exports from another character cannot replace a newer observed reset schedule. Unconfirmed raid refreshes do not update raid attempts.

## Validation

Use the Sites lifecycle for builds and deployment. Generate schema migrations with `npm run db:generate`.

- `node node_modules/typescript/bin/tsc --noEmit`
- `node tests/planner-check.mjs`
- `node tests/raid-routine-check.mjs`
- `node tests/progression-today-check.mjs`
- `node tests/profession-check.mjs`
- `node tests/evidence-check.mjs`
- `node tests/addon-import-check.mjs`
- `node --import ./scripts/sites-env.mjs tests/evidence-sync-check.mjs`
- `node --import ./scripts/sites-env.mjs tests/profession-sync-check.mjs`
- `node --import ./scripts/sites-env.mjs tests/progression-sync-check.mjs`
- `node --import ./scripts/sites-env.mjs tests/api-check.mjs`
- `node --import ./scripts/sites-env.mjs tests/sync-check.mjs`
- `python tests/addon-check.py` (uses Lupa in the ignored `work/lua-runtime` directory)
- `python scripts/package_addon.py` rebuilds the deterministic downloadable ZIP from addon source.

Database fixtures use disposable local identities. The API checks exercise the actual handlers with the platform-identity boundary mocked. Sync checks cover OAuth state, encrypted secrets, toy/item ID mapping, whole collections, stale/incomplete exports, reset anchors, quest/character mapping, expiration, disconnect and account isolation.

## Sources and assets

- Blizzard's toy API announcement: https://us.forums.blizzard.com/en/blizzard/t/toys-and-heirlooms-apis/42252
- Official profile documentation: https://develop.battle.net/documentation/world-of-warcraft/profile-apis
- Official OAuth documentation: https://develop.battle.net/documentation/guides/using-oauth/authorization-code-flow
- WoW shipped UI/API documentation mirrored at https://github.com/Gethe/wow-ui-source/tree/live/Interface/AddOns
- Item icons: Blizzard game art, obtained via Wowhead's item XML and icon CDN. Local curated icons and remote public icon URLs. Wowhead’s official tooltip widget runs for item links; plain links and an independent details control work without it.
- Cinzel: Google Fonts, SIL Open Font License. License bundled under public/fonts.
- Gold chest/rune SVG ornaments: authored for this Site.

## Obtainable catalogue

`node scripts/import-toys.mjs` imports the pinned MIT Simple Armory snapshot (license in lib/data). Routes preserve unavailable/unreleased/resale flags, parent context, faction and acquisition class restrictions. Source availability is independent of character eligibility. A single active in-game route includes a toy; unknown windows, external promotions and retired routes do not inflate the denominator. All owned toys remain in Owned. The 2026 Hallow window deliberately uses confirmed interior days because the official announcement does not establish exact regional boundary times. Other event/rotation sources await evidence.

Interactive Sync both characters refreshes the public Blizzard toy index and verifies the pinned metadata once per 24 hours. Bounded item resolution resumes on subsequent syncs. Public cache uses a reserved snapshot scope and contains no profile data. `/api/sync` exposes catalogueCounts, catalogueCoverage and source timestamps independently of character progress. Add `?catalogue=1` for deduplicated entries with acquisition routes and availability evidence. Failures preserve last successful data.

`/api/toys?item=...` validates catalogue item IDs, caches public Wowhead tooltip metadata for 24 hours, strips HTML for the independent details panel and retains last successful details on source failure. Percentages from tooltip summaries are pooled reports with unspecified difficulty; they never become difficulty-specific probabilities. Unknown rates remain Unknown. Weekly/routine completion cannot write ownership. Positive Blizzard ownership wins over a manual unchecked box; legacy reward aliases remain supported.

Additional checks: `node tests/catalogue-check.mjs` and `node --import ./scripts/sites-env.mjs tests/catalogue-sync-check.mjs`.

## Background companion

Toybox Export 1.3 persists complete per-GUID JSON snapshots automatically. The Python watcher in `companion/` reads stable SavedVariables files, uploads changed snapshots after logout/reload, retries interruptions and stores credentials in the system credential store. The existing private Site access boundary is retained; a separate revocable device token links the watcher to the signed-in user's existing records. No visitor identity is synthesized. Pairing proof is hashed, pending links expire, and upload tokens are encrypted until claimed and then stored only in the OS credential store. Runtime service credentials are never embedded in the download. See [companion/README.md](companion/README.md) for setup and verification.

`/api/companion` implements pairing, approval, proof polling, device-authorized snapshot upload, heartbeat and owner-authorized revocation. `/api/sync` exposes public device status and per-character capture/upload timestamps; backups exclude authorization and temporary coordination records. Manual and companion imports share `lib/import-addon.ts` and a per-user import lease. A stale companion snapshot is acknowledged without overwriting newer data. Empty sources retain the existing evidence semantics and successful caches.

Build download archives with `python3 scripts/package_addon.py` and `python3 scripts/package_companion.py`. Run `companion/.venv/bin/python -m unittest discover -s companion -p 'test_*.py' -v` and `node --import ./scripts/sites-env.mjs tests/companion-sync-check.mjs` alongside the existing checks.


## Source privacy

This repository includes the website, WoW addon, companion, guide data, tests and downloadable packages. Character examples in tests are synthetic. Configure your own characters in the application; personal progress stays in the existing authenticated database, browser session, installed addon's SavedVariables and ignored companion state. Private credentials stay in the system credential store or server secret store.

Local `.env*`, `.dev.vars*`, companion state, game saves, browser session files, database files and generated work folders are ignored. `.dev.vars.example` contains only a placeholder origin. Before publishing, rebuild all three downloadable ZIPs from sanitized source and refresh `public/downloads/release-checksums.json`.
