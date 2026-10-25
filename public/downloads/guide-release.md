# Toybox Guides 2.4.0

Cumulative walkthrough release for Retail build **12.1.5.70575**, reviewed 25 October 2026. Standalone operation remains the default; website and companion synchronization are optional. This release is usable, but it is **not the completed comprehensive product**.

## 2.4.0: catalogue walkthroughs and pre-playtest checks

This cumulative release adds 41 newly complete active acquisition paths, plus two directly selectable Nighthold LFR alternatives. Vendor/currency paths connect real resource activities and city introductions; instance paths include written interior directions and the Familiar Journal ritual; quest paths include original objectives, separate turn-ins and special reward handling. Sixty-nine crafting paths now have recipe/material/craft/learn checkpoints with upstream profession and skill gaps retained. Quality-ranked materials are alternatives rather than additive costs. Five older crafting paths previously counted as complete have been corrected to checkpoints because their upstream profession progression remains unfinished.

The frozen active catalogue remains exactly 1,000 acquisition routes. Of those, 306 have complete source-checked paths, 69 have usable checkpoints with unfinished upstream work, and 625 still need source research or action authoring. Thus 694 active paths remain unfinished, versus 730 in 2.3.0. All 1,208 catalogue toys and their availability classifications are preserved. The broader catalogue has 307 playable source routes across 270 toys. These figures are acquisition paths, not a claim that every route is ready for every character.

The repeatable compiler inlines parameterized prerequisites, filters optional breadcrumbs and faction branches, preserves current quest objectives, and keeps merchant access distinct from transferred currency or Warband Renown. A learned toy alone finishes a toy goal. Cursor actions cannot create progression. Old source-guide IDs resolve to their new canonical walkthroughs through existing preference interfaces; independent LFR choices use compatible guide IDs. No SavedVariables format or website credentials were changed.

A frozen-route audit rejects disappearing, reclassified or reassigned active routes. Complete-path checks reject missing evidence, generic placeholder actions, unknown critical prerequisites, invalid destinations, impossible cardinality, absent recovery and receipt-only completion. The downloadable route-by-route audit names every remaining gap. `node scripts/catalogue-audit.mjs --require-complete` deliberately fails until all active paths are complete; ordinary cumulative release checks remain separate.

Automated checks include 280 new shared Lua/TypeScript catalogue scenarios, returning mid-chain across all 44 newly authored quest stages, both factions, separate learning inputs, manual controls, currency/phase isolation, bundled guide dependencies and private database reads for old aliases and LFR preferences. These are fixtures, not gameplay. No new route is claimed playtested. The comprehensive content gate and actual Argent, reputation, Engineering, purchase/learn, recovery, transport and alt sessions remain pending. This is not the completed comprehensive product.

## 2.3.0: dependable guidance

The guide adds **I’m stuck** recovery detours with a return point, one quiet nearby suggestion, three per-character travel modes, individual transport exclusions, an inline leaving-stop check and resource forecasts. Recovery, Continue, Skip and leaving never create completion evidence. Selecting another checklist action exits a detour. Unchanged leaving warnings are shown once per stop per session.

Nearby candidates are indexed by researched destinations and evaluated on the current map. They require supported eligibility and affordability after planned resource reservations. A suggestion must share the authored stop or have a supported same-map distance of at most 500 yards. Rare/treasure/rotating suggestions require current availability evidence; target/mouseover sightings are removed when lost or dead. Suggestions are hidden during combat and NPC interactions. Adding one queues it after the stop without replacing the current instruction or arrow. Source gaps and unseen dynamic sources are not advertised as available.

Fastest verified is the default within supported Mapzeroth capabilities. Conserve cooldowns excludes hearthstones, consumables, documented cooldowns of at least thirty minutes and unknown cooldown classifications. Ordinary travel excludes personal spells/items. Each character can exclude individual sources. Routing uses a private context, known access/cooldowns and known affordable fares; it preserves manual waypoint priority and never activates transport. Preview lists supported choices, consumables and known fares. Version-checked helper behavior was exercised offline against Mapzeroth 2.0.3 and 2.0.4; this does not establish real in-game transport success.

Forecasts distinguish unfinished current-period opportunities from additional resets, deduplicate alternative/shared yields and use scoped resource reservations. Unknown balance, yield, current-period completion, bonuses or reset boundary produces an explanation. Mixed schedules and unsupported caps/rotations do not receive a precise finish date. Native fixed reward offers can supplement reviewed yields; reward choices are excluded. Calendar dates are shown only for an established next eligible boundary. Random drops receive no guaranteed completion date. The website labels observation age and cannot see unsaved live progress.

Capture identity now connects three separate stages: captured by WoW, observed in a settled saved file, and accepted by the server. Companion 1.4.0 reports its scan/version and bounded disk observations independently of report uploads. Matching replay is idempotent, reused identities with different contents are rejected, older captures are superseded, and same-second captures retain sequence ordering. Upload acknowledgments return through the fixed data-only inbox. Existing exports remain accepted without new fields. An identified capture is immutable; legacy backup recovery keeps its original timestamps. The companion never writes SavedVariables and the addon receives no website credentials.

### Personal content

- Argent: 160 researched quest variants, distinct acceptance/objective/turn-in actions, twelve authored daily mechanic families, introduction/mastery/challenge/ceremony checkpoints, additional-city alternatives, Champion writ reputation branches and city banner access checks. City Champion, Exalted, the actual merchant offer, affordability, purchase and learning remain separate. The Alliance Westfall journal location/identity is corrected; the Horde branch is kept separate. Daily collection goals continue across resets rather than demanding all seals in one day.
- Archaeology: all thirteen observed active specialist chains now have concrete authored mechanics, material requirements, native handoffs and final turn-ins. Academy camp coordinates are corrected. Received toy/container recovery remains usable after a window ends; only ownership completes a toy goal. Global rotation and fresh-character phase access are not inferred.
- Reputation: 34 researched quests and 26 toy links supply corrected introductions, objectives and reward targets for the six priority systems. Grand Hunt License/Renown and compiled campaign alternatives are preserved as alternatives. Siege requires actual event completion. Soridormi’s weekly uses account-scoped dated evidence. A partial poster inspection cannot establish the entire weekly set is complete. Renown toy access is not falsely gated behind an optional weekly event.
- Two additional acquisition routes were authored: B.F.F. Necklace and Vial of Red Goo. The latter’s unobserved source remains availability-unknown; uncertain spawn/drop conditions are not invented. Existing Engineering recipes, timers, charges and optional per-character selection are preserved; broader knowledge/unlock authoring still has gaps.

### Coverage and verification boundaries

Frozen Retail build **12.1.5.70575**, ATT **52895ee664b61e08f091d514fe1556568d411570**: **1,208 toys / 1,600 classified acquisition routes**. **271 routes cover 238 toys** with a complete source-checked path under the coverage rules. There are **302 complete guide paths and 52 source-checked checkpoint guides**; checkpoints do not count as full toy acquisition coverage. Of **1,000 classified ongoing routes, 730 remain acquisition-path gaps**. The decreased ongoing count also reflects uncertain vendor availability, not just new authoring. See the coverage JSON for each route’s limitation.

Automated checks cover Lua/TypeScript state agreement, all thirteen archaeology mid-chain returns, expired reward recovery, alternative prerequisites, partial reset periods, resource reservations, recovery return/Back/Skip/Undo, nearby sightings/range, leaving checks, helper travel filters, private database receipt ordering/replay/isolation, capability negotiation, companion immutability and data preservation. Local desktop and 390-pixel phone browser checks exercised saved-stage disclosure, forecast disclosure and travel preference saving with fixtures. Reproducible packages include source and attribution manifests.

**Zero actual in-game playtests are claimed.** WoW was closed during this release. Argent daily, reputation weekly, Engineering, purchase-and-learn, recovery, transport and alt sessions remain pending. Fresh roots and exceptional phasing remain named gaps; the comprehensive catalogue product is unfinished. Source-checked observed-entry instructions remain usable by default.

## 2.2.0: a connected daily session

The guide includes a clickable, scrollable checklist (up to five visible rows), direct Back/Skip/Undo/Details controls, a preparation list and a private “This instruction is wrong” button. Selecting an eligible checklist row chooses its instruction and destination without recording completion. Game evidence establishes checklist state; deferrals and browsing remain separate. Within-stop progression is automatic; another stop waits for Next stop. Window position, compact mode, resizing, text scale and existing bindings remain supported.

Unrestricted farming uses an active ten-minute block, shortened to the remaining positive budget. Pause, AFK and offline time do not consume it. Combat delays its finishing prompt. Blocks never record kills, lockouts or ownership. Session summaries distinguish finished planned work from unknown or currently unavailable work, and new observed daily periods start a new temporary checklist. Reset-limited bosses remain separate attempts.

Followed toys have an acquisition-path view, alternative routes and resource preparation. Known balances are reserved once across planned purchases. Observed character, transferable and Warband currency scopes remain distinct; transferable balances are not silently pooled. Receiving an item exposes learning; only Toy Box ownership finishes the goal. Engineering remains independently enabled per character. Alt suggestions use that character's evidence and freshness, including Druid-specific routes and additional raid opportunities; switching remains player-controlled.

Reports save locally with optional notes and Undo. Companion 1.3.0 uploads report revisions independently of progress and stages acknowledgments through the data-only inbox. A malformed report cannot block an ordinary snapshot. The private website inbox supports review states, export and deletion, and never publishes corrections automatically. Reports exclude credentials, chat, screenshots and unrelated inventory. Legacy addons receive compatible preference fields only. Temporary session and browsing state are stored separately from observations in new snapshots; older exports remain accepted.

Eight additional canonical routes for seven toys were researched and authored; six toys newly gain a source-checked route. Fifty-three priority vendor/reward alternatives connect existing recurring progression to prices, exact merchant offers, reward receipt and learning. These alternatives deliberately retain upstream campaign/material/reputation gaps and do not count as completed fresh-character walkthroughs. Original Champion daily instructions and exact questgiver stops are included. Source manifests retain the pinned factual references and candidate checksums.

Automated verification covers session states in both Lua and TypeScript, checklist selection, stop/arrow boundaries, pause/AFK blocks, report revisions/Undo, resource competition and scopes, character isolation, stale alts, exact merchants, private database authorization, deletion replay and capability negotiation. Website interaction checks use local fixtures. The representative Argent, reputation weekly, Engineering, purchase/learn and alt playthroughs remain pending; zero acquisition routes are claimed playtested.

## 2.1.4: recurring progression review

The recurring-progression audit structurally screens every compiled guide and records remaining coverage gaps separately from tested runtime behavior. See `RECURRING-PROGRESSION-AUDIT.json`. This is not an in-game playthrough or completion of the broader catalogue.

The Aspirant's 15-seal stage now uses the same daily-opportunity model as the Valiant stage, with faction-specific training, reins practice and one rotating weapon slot. Eighteen inherited Tournament daily flags are retained from the compiled ATT source. Daily and weekly quest-derived acquisition routes retain their actual cadence; archaeology's authored fortnightly window overrides its source's weekly bit.

Loamm Niffen's weekly puts observed reputation activities ahead of the 1,500-reputation total. The main counter belongs to the current activity; the weekly progress stays secondary. Missing or stale observations prompt map inspection and cannot finish the weekly. World-quest discovery supports both client map APIs, filters inactive and expired tasks, and does not invent an NPC turn-in for an automatically rewarded map task.

Accepted wanted quests take priority over the poster-inspection step. Offers and already accepted quests are collected even when another guide is selected, and one-time introductions cannot complete a weekly poster set. Known archaeology windows retain their observed chain and final turn-in through the window; an old or unknown window is not refreshed artificially. Completed daily/weekly reward opportunities wait for reset independently of toy ownership, while an observed reward in the bags can still be learned.

Twenty-three additional Lua/TypeScript scenarios cover Aspirant branches, Loamm task selection, missing data, weekly turn-in, posters and archaeology windows. Existing cooldown, charge, lockout, mission-wait, navigation, UI and database checks remain separate. Acquisition coverage is unchanged; real in-game validation remains pending.

## 2.1.3: visible guide controls

Back, Skip, Undo and Details are directly available in the guide footer, including Compact mode. Continue appears for eligible manual observation steps; Pause remains in the header. Optional keybindings and `/toybox back`, `/toybox skip` and `/toybox undo` provide the same controls.

Skip hides the current instruction for its existing reset/session scope and advances to the next eligible action. It bypasses unmet turn-ins and unavailable branches without recording progress. Back restores skipped or continued instructions, and Undo can reverse the latest manual action. If no eligible forward action remains, the window offers Activities and explains that the guide was not completed. Meaningful game observations re-evaluate that state. Stable step identities keep the selected instruction and waypoint together.

Interaction fixtures exercise actual button clicks, blocked and faction branches, Skip/Back/Undo/Continue, end-of-guide recovery, paused behavior and button containment at widths 340, 410 and 620 in expanded and Compact modes. In-game validation remains pending. Acquisition coverage is unchanged.

## 2.1.2: Valiant dailies across multiple days

While The Valiant's Charge is in the quest log, the viewer guides the current city's daily quests. Live objective counters belong to the daily being done. A secondary line shows today's four opportunities and the accumulated seals, which carry over between days. The three weapon-retrieval variants share one daily opportunity; the offered variant selects the actual walkthrough.

Turn-ins and current-period game flags establish daily completion. Finishing all four moves the activity to Upcoming until the observed daily reset, even below 25 seals. Missing or stale observations and skipped or abandoned quests cannot complete the set. At 25 seals, the collection turn-in takes priority and remains player-controlled. Bindings cover all ten faction/city branches. Thirteen actual-graph scenarios run in both Lua and TypeScript, with additional planner and window checks. Real in-game validation of this change remains pending.

## 2.1.1: guide window polish

The in-game viewer uses a compact dark panel, warm accent, explicit text sizes, a separate progress bar and one row of contextual controls. Extra actions live in a menu. Window height follows its content, long instructions scroll, and Compact mode, resizing, locking, item tooltips and keyboard bindings remain available. The same theme applies to library, settings and supporting windows.

Unknown navigation does not occupy the main instruction with a warning. Current collection progress and future toy ownership remain separate.

An appearance migration resets the old oversized default dimensions once and preserves their previous values. Position, progression observations, settings, sync records and staged preferences remain intact. Existing source-checked acquisition coverage is unchanged. A UI interaction check is distinct from playing a toy route to completion.

## What changed

The addon now interprets branching, data-only walkthroughs with stable action IDs. Accepting a quest, completing its objectives, turning it in, receiving an item and learning a toy are distinct actions. Authored instructions remain visible while live quest counters update. Abandonment, lost required items, expired observations and profession changes are re-evaluated.

Actions have their own destinations and recovery instructions. Arrival can complete a travel action; it cannot complete an interaction. Continue and Skip advance the cursor without creating observations or ownership; Undo reverses them. Inactive faction branches and unknown rotating branches do not become fabricated prerequisites. Quest convenience actions are restricted to the currently eligible accept/turn-in action and still pause for choices and costs.

The original presentation includes Katy’s Stampwhistle, treasures, puzzles, rares, instance encounters and crafting paths. Katy separates the starter variants, the Postmaster chain, the minigame, mailbox delivery, opening the package and learning the toy. A mailbox check before optional extra sorting handles conflicting source reports without making an unnecessary challenge a universal requirement. Other authored examples include the Syntactic Vault’s six symbol pins, Hanna’s six shellcrabs, five Lava Fountain levels, Drust chest combinations, timed reward containers and faction-specific Draenor schematic vendors.

Priority progression includes Argent quest/objective branches, all thirteen observed Dariness archaeology chains and six weekly reputation systems. Optional Engineering retains daily, Invent’s 20-hour timer and shared rechargeable Gearspring opportunities. Knowledge catch-up uses observed expansion-specific currency limits; unknown caps remain unknown. These systems contain explicit remaining prerequisite gaps where the research does not establish a complete route.

The website can preview the same compiled walkthrough against the latest saved character observations. It labels saved and older snapshots clearly. Live tracking remains inside WoW. Following a guide remains separate from completion, and old followed/excluded/prioritized route aliases retain their effect.

## Exact coverage

The frozen catalogue has **1,208 toys** and **1,600 classified acquisition routes**, after excluding duplicate summary relationships. Of these, **269 routes covering 236 toys** have a source-checked walkthrough. **740 of 1,009 ongoing routes** still have authoring or research gaps. Additional inactive, unknown, removed, unreleased and external sources are classified separately. Owned toys remain preserved regardless of availability.

There are **zero recorded in-game playtests** for this release. Source checking and playtesting are separate: source-checked guides are available by default. The coverage report lists each unresolved route and its missing facts. Generic live quest objectives and vendor prices without connected currency acquisition activities are partial directions, and do not qualify as completed walkthroughs.

Download the machine-readable report from `public/downloads/guide-coverage.json`. Catalogue presence, generated directions, partial graphs, complete acquisition routes and ongoing routines are different measurements. They must not be added together as a walkthrough total.

## Remaining work

- Finish the documented ongoing-route gaps, especially unique quest mechanics, currency acquisition, complete reputation introductions, mission-table unlocks/followers, instance interiors and encounter-specific requirements.
- Complete every Argent purchase path and the remaining early campaign/renown branches for the recurring reputation systems. An observed offered quest can guide a returning character, but does not fill the missing authored introduction for every new character.
- Broaden the Engineering knowledge and recipe-unlock library. Trainer crafts still retain skill-leveling gaps where a complete progression route is absent.
- Record real in-game window, navigation, NPC interaction, combat, transport, phase and recovery tests. The desktop capture tool timed out, so automated fixtures are not claimed as an actual WoW playthrough.
- Cross-character planning keeps the current session stable and shows a separate roster queue; a global character/currency allocation optimizer is not finished. The older website planner retains its exact two-character history bindings.
- ATT and SavedInstances remain optional. Direct game observations are supported; dedicated runtime state adapters for those addons are not implemented.

## Sources and authoring

The content pipeline imports factual relationships from the pinned **MIT ATT revision 52895ee664b61e08f091d514fe1556568d411570**, cross-checks versioned Simple Armory catalogue metadata and records additional source references. Restricted sources are consulted for facts; Toybox instructions are original. No WoW-Pro guide files, paid guide content or downloaded executable conditions are bundled.

`docs/GUIDE-CONTENT-SOURCES.json` records permitted source URLs, revisions, checksums, consultation references and approved content inputs. `docs/SOURCE-MANIFEST.json` records the release and helper versions. The richer ATT import retains constructor ancestry, faction/class branches, prerequisite cardinality, objective locations, prices and difficulty groups. An unordered prerequisite list is never silently treated as an AND requirement.

Edit the approved `lib/data/walkthrough-*.json` files and `lib/data/priority-guide-facts.json`; run `node scripts/build-guide-pack.mjs` to generate addon Lua, website definitions, manifests and coverage. Both runtimes use shared condition fixtures. `scripts/author-walkthrough.mjs` validates drafts or converts an opt-in recording into an unreviewed draft. Drafts are not automatically published. `scripts/acquire-guide-sources.py --download --check` verifies the pinned permitted cache.

`/toybox record` toggles the bounded local recorder. `/toybox diagnostics` exports observations, helper status and recent errors. A report should identify the route/action, expected behavior, actual behavior and Retail build.

## Compatibility, validation and installation

`ToyboxExport`, `ToyboxExportDB`, the companion outbox, existing exports and backups are preserved. Schema migration resets only the guide cursor for re-evaluation; it does not manufacture completion. Preference synchronization uses revisions and acknowledgements independently from observations. No website credentials enter the addon, downloaded data never becomes executable code, and the companion never rewrites WoW SavedVariables.

TomTom supplies the arrow. The Mapzeroth adapter supports 2.0.3 and 2.0.4, preserves unrelated waypoints and falls back to written/native directions if helpers are missing or incompatible. Offline tests exercise the actual pinned helper engines; actual travel remains unplayed.

Reproduce validation with `bash scripts/check-guides.sh`. Tests cover shared Lua/TypeScript tri-state conditions, branches, resume, abandonment, reset expiry, Warband and character isolation, cursor-only Continue/Skip with Undo, recipe invalidation, elapsed and sequential-charge timing, UI callbacks, quest automation safeguards, navigation ownership, data-only sync and real local database profile operations. Existing catalogue/planner/progression/companion regressions are also run. Browser checks cover desktop and phone layouts and walkthrough expansion; these do not establish in-game correctness.

`python3 scripts/package_addon.py`, `python3 scripts/package_companion.py` and `python3 scripts/package_source.py` produce deterministic downloads. Update the addon folder with a backup, then run **`/reload`**, followed by **`/toybox`**. Keep normal SavedVariables untouched. No scheduled notifications are added.
