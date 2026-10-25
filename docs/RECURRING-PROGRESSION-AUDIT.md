# Recurring progression review — 2026-10-25

Release 2.4.0; frozen Retail build 12.1.5.70575.

Structurally screened **1714 compiled entries** (1528 after aliases). Focused runtime fixtures cover the systems below. This does **not** mean every route has a complete walkthrough or has been played in game.

## Changes from the review

- Aspirant and Valiant stages guide the daily opportunities; accumulated seals stay separate and carry over.

- Retained 18 inherited Tournament daily flags and corrected daily/weekly cadence in quest-derived routes. Archaeology keeps its explicit fortnightly override.

- Loamm Niffen recommends currently observed reputation work, keeping the 1,500-reputation weekly counter in the background. Inactive, expired, stale and unavailable map tasks are not recommended.

- Accepted wanted quests lead the poster guide; observations are collected while other guides are selected. One-time introductions cannot finish a weekly set.

- Known archaeology windows retain the observed chain and final turn-in through that window. Unknown or expired windows remain unknown.

- Soridormi’s weekly instructions keep the one-time friendship/toy reward separate.

- A consumed reward opportunity waits for its reset without learning the toy. Receiving an item and learning it remain separate.

## Verification boundaries

- **Tournament:** Both Aspirant branches and all ten Valiant cities separate daily opportunities from accumulated seals; one rotating weapon slot; dated turn-ins and resets. Checks: tests/argent-dailies-check.mjs, tests/recurring-progress-check.mjs.

- **Reputation:** Loamm prioritizes actual observed reputation activities; its weekly counter remains separate. Poster observation advances automatically and excludes one-time introductions from weekly completion. Checks: tests/recurring-progress-check.mjs, tests/guide-engine-check.py.

- **Archaeology:** All thirteen chain definitions screened; known window persists offline; initial quest and final turn-in remain separate; unknown/expired windows stay unknown. Checks: tests/recurring-progress-check.mjs.

- **Engineering:** Daily, elapsed and sequential charges retain separate timing. Recipe and profession evidence, unknown initial state, use/Undo and catch-up uncertainty remain distinct from toy ownership. Checks: tests/guide-engine-check.py, tests/guide-ui-check.py, tests/addon-check.py.

- **Farming and missions:** Observed raid lockouts, running mission waits and daily/weekly quest opportunity completion stay separate from receiving or learning a toy. Generic directions and missing prerequisites remain coverage gaps. Checks: tests/guide-engine-check.py, tests/recurring-progress-check.mjs.

## Remaining coverage

| Family | Canonical entries | Source-checked walkthroughs | Entries with gaps |
|---|---:|---:|---:|
| Other recurring activities | 154 | 79 | 84 |
| Raid farming | 6 | 0 | 6 |
| Other acquisition routes | 503 | 295 | 283 |
| Priority reputation weeklies | 6 | 2 | 6 |
| Currency and standing requirements | 345 | 34 | 323 |
| Tournament | 1 | 1 | 1 |
| Archaeology | 1 | 1 | 1 |
| Engineering cooldowns | 4 | 4 | 0 |
| Mission tables | 2 | 0 | 2 |
| Engineering progression | 433 | 51 | 382 |
| Faction progression | 73 | 0 | 73 |

- Zero recorded in-game route playtests.

- Source-checked acquisition coverage remains unchanged; this audit does not turn metadata into complete walkthroughs.

- A poster set includes only observed offers/accepted quests. Uninspected posters can still contain additional offers.

- Unavailable reputation APIs, unknown rotations, mission unlocks, currency acquisition paths and unverified reset rules remain explicit gaps or observation steps.

The full entry-by-entry inventory is in [RECURRING-PROGRESSION-AUDIT.json](RECURRING-PROGRESSION-AUDIT.json).

Source references: [pinned ATT Tournament records](https://github.com/ATTWoWAddon/AllTheThings/blob/52895ee664b61e08f091d514fe1556568d411570/.contrib/.db/standard/06%20-%20Expansion%20Features/03%20-%20Wrath%20of%20the%20Lich%20King/Argent%20Tournament.lua) and [Blizzard client task-map API declarations](https://github.com/Gethe/wow-ui-source/blob/live/Interface/AddOns/Blizzard_APIDocumentationGenerated/QuestTaskInfoDocumentation.lua).
