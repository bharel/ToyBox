Toybox Guides 2.0.0 — Retail

Install this existing ToyboxExport folder in _retail_/Interface/AddOns and reload.
Keep your existing WTF SavedVariables: ToyboxExportDB and its companion outbox are retained.

/toybox                 Open or close the in-game Today guide
/toybox export          Copy the existing JSON snapshot manually
/toybox library         Search toys and their routes
/toybox settings        Budget, Engineering, text size and convenience settings
/toybox navigate        Resume Toybox directions after a personal waypoint
/toybox used 0          Record the selected learned cooldown used now
/toybox used 120        Record it used 120 minutes ago
/toybox undo            Undo the last skip or manual cooldown change
/toybox record          Toggle the optional guide recorder
/toybox diagnostics     Copy diagnostics and recorded events
/toybox status          Existing exporter status
/toybox watch 12345     Existing watched quest support

TomTom supplies the arrow. Mapzeroth 2.0.3/2.0.4 supplies full transport planning.
Without compatible helpers, written directions remain usable. Unrelated personal
waypoints are preserved. Travel actions are player-clicked, and unknown flight
access/cooldowns are not treated as known usable transport.

Engineering is optional per character in Settings. Open your own recipe windows
and expansion lists to observe recipes and cooldowns. Linked/guild/NPC recipes do
not establish your learned recipes. Crafting never implies a toy was learned.

Guide quests may be accepted/turned in only when unambiguous and costs are known
zero. Reward choices and unknown/costly interactions remain manual. Gossip and
free guide flight selection are separate opt-ins. Nothing automatically buys,
spends currencies, learns items, crafts, changes difficulty or launches missions.

The addon works standalone. The optional companion uploads saved observations
after logout/reload and stages website preferences for the next reload/login.
It never edits SavedVariables. No website credentials enter this addon.

Coverage includes authored directions and a larger library of source-based
routes. These are different from verified detailed walkthroughs. Unknown rotations,
spawns, rates and access remain unknown. See the included source manifest and the
project's coverage/limitations report. ATT facts use the included MIT license;
no WoW-Pro or Zygor guide text/code is included.
