# Active catalogue walkthrough audit

Retail 12.1.5.70575; pinned ATT `52895ee664b61e08f091d514fe1556568d411570`; release 2.4.0.

The frozen 1,000 active routes retain their exact item and source identities. No route was hidden or reclassified to improve coverage. The source catalogue contains 1,208 toys, including owned and currently unavailable toys.

| Active route status | Count |
| --- | ---: |
| Complete source-checked acquisition path | 306 |
| Usable checkpoint; upstream path unfinished | 69 |
| Further source research/action authoring required | 625 |
| Actually playtested | 0 |

The comprehensive content gate is **not passed**. The machine-readable per-route report is `public/downloads/catalogue-route-audit.json`. It names the unfinished facts and action authoring rather than treating a database label as a finished guide.

Run `bash scripts/check-guides.sh` for runtime/data/database preflight, and `node scripts/catalogue-audit.mjs --require-complete` for the independent full-catalogue content gate. Source-checked checkpoints remain usable, visibly marked as partial. Runtime fixtures cannot establish real-world phasing, spawn behavior, transport success or window comfort.

## This batch

Forty-one formerly incomplete active routes now have complete paths. Five previously overstated crafting paths were corrected to checkpoints. The net change is 270 to 306 complete active routes. Two additional Nighthold LFR walkthroughs are alternatives for existing source routes, not extra catalogue entries.

The new content inputs are recorded with hashes in `docs/GUIDE-CONTENT-SOURCES.json`, with their factual references in `docs/SOURCE-MANIFEST.json`. Restricted sources were consulted for factual research; Toybox instructions are original. ATT data remains under the bundled MIT license. Uncertain and conflicting source claims remain explicit in the input records.

## Remaining work

Most unfinished routes need connected expansion or faction introductions, detailed quest branches, reputation/resource procurement, recipe/skill progression, encounter/puzzle directions or unanchored source relationships. In particular, ordinary daily checkpoints do not establish a full Argent fresh-character path, a quest-wrapper does not establish every Lorewalking scenario, and catalogue membership does not establish acquisition.

No in-game playthrough is recorded for this release. SavedVariables, observations, notes, ownership, preferences and the companion inbox are preserved. Standalone play remains independent of the optional website/companion.
