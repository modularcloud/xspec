// TEST-SPEC §12.0 IV (global command conventions, fourth part) — SUITE-42
// continued: T12.0-15 (human-form reports). This registration carries the
// `build` and `check` family — T14-11's per-condition fixtures, T12.2-2's
// per-family workspaces, and T1.5-2's every arm — the gated reads' reports of
// the same findings on T13.3-3's stagings, the non-UTF-8 marking clause on
// T1.5-2's arms, the `rename`/`move` family — the performed reports of
// T6.4-1 and T6.5-1 and the refused real operations of T6.4-3, T6.4-6,
// T6.5-4, T6.5-6, T6.5-16, T6.5-17, T6.5-20, T6.5-21, and T14-7, the
// previews being T6.6-7's (section-6.6.ts), which this test cites rather
// than repeats — the `impact` family, the reports of T5.6-1 through
// T5.6-6 and T9-1 through T9.3-3 — and, of the `review` family, `list`
// (T10.7-5, a corrupt session's report included), `status` (T10.7-6),
// `next` (T10.7-7: the item returned, and the fully-resolved report),
// `show` (T10.7-8: the full item with its text payload), the refusals of
// T10.7-1, T10.7-9, and T10.7-10, and `status`, `next`, `show`, `resolve`,
// and `split` naming each corrupt session of T10.1-4 — and the
// `coverage`/`ids`/`show` family: `coverage` (T8.2-1: every profile's
// counts, node identities, covering paths, and ignored nodes' reasons),
// `ids` (T12.3-1, `--tree` included), and `show` (T12.4-1, its root and
// non-root arms) — and, of the exit-2 family, T12.7-3's
// configuration-error stagings (each concerned-path form), T6.3-6's
// journal errors at a given baseline, T13.5-2's busy workspace, and
// T14-10's exit-2 read failures; the family's T14-9 write failures are
// added beside them by the plan written at 2a2b94e's FIX_PLAN Task 135, in
// its last part.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspaces (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes reports through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 12.0: where SPEC.md defines report content, the human report carries
// it and the JSON form the same information; the output form never changes
// an exit code or standard-error content; wherever an output carries a path
// that is not valid UTF-8 it is presented in an explicitly marked byte form
// carrying its exact bytes, distinguishable from every plain path string,
// deterministically, and a valid-UTF-8 path never in it. SPEC 14: every
// reported condition carries its stable code, a location per offending
// construct (its file and source range, 1.7), the file or path it concerns
// where it has no in-source location, and the identities it names; a
// refusal renders as precisely as a finding, and the invalid-workspace
// refusal reports the workspace's numbered findings alone, each under its
// own condition's code (6.4). SPEC 6.4: a successful rename's report is the
// applied mapping — the complete identity mapping the operation journaled,
// the preview's `mapping` — carried in JSON in the applied-mapping document
// form of 12.7; 6.5: a successful move reports its applied mapping as
// rename does. SPEC 8.2: the coverage report includes the counts of
// required, covered, uncovered, and ignored nodes, the identity of every
// covered, uncovered, and ignored node, one shortest covering path per
// covered node, and each ignored node's exclusion reasons, all that apply,
// in a fixed order. SPEC 12.3: `ids` lists one entry per discovered spec
// source in byte order of path, each holding its file's listed IDs in
// document order, present even when it holds none, `--tree` rendering them
// as a tree following section nesting in the same orders. SPEC 12.4: `show`
// prints the identity, source range, own and subtree text, hashes, tags
// and coverage attribute (both absent for a root node), and edges by kind.
//
// Conservative operationalizations (noted per H-3/H-4):
// - The twin (`expectHumanFindingsTwin`): at a fixture's state the
//   invocation runs with `--json` — its exit the staging's premise where the
//   home test pins one — and its stdout is decoded form-exact as the
//   findings-only report (12.7); the same argv without `--json` then runs on
//   the same pre-invocation state and must exit as its twin, its standard
//   error byte-identical (T12.0-2), and its report — decoded by the human
//   findings decoder (helpers/adapters/human-reports.ts: fitted to the
//   built product's layout, shape-aware, value-blind, failing loudly) —
//   must carry the twin's findings (`assertHumanFindingsReportCarries`):
//   every finding's stable code, its locations (each file and its range's
//   two byte offsets), its concerned path, and its identities, as multisets,
//   one human finding per `--json` finding, order free (SPEC fixes no order
//   for a findings report's human form; 12.7's is the JSON form's), each
//   path in form and bytes; a finding's message is free wording, never
//   compared (H-3). A human report printing nothing, or omitting or
//   changing any datum, fails, naming it against the nearest human finding.
// - The same pre-invocation state: where the run writes nothing at that
//   state — a failing `build` (12.1: it modifies nothing), `check` (13.3: it
//   never refreshes and writes nothing), a gated read on a failing workspace
//   (13.3), a `review` read naming a corrupt session (10.1) — both forms
//   run on the workspace itself inside one whole-root modifies-nothing
//   compare, the lock path compared like any other path (none of these
//   acquires, 13.5; H-6), so the human run's state is the `--json` run's
//   pre-invocation state, observed. Where the run writes — a
//   mutating command (`review create`, `resolve`, `split`, `rename`,
//   `move`, performed or refused; 13.5), or a successful `build` (T14-11's
//   valid trailing-comma arm, T12.2-2's states where `build` succeeds and
//   regenerates) — each form runs on a fresh byte copy of the state
//   (`copyTreeBytes`, `.git` included, the lock path left out unread as
//   T6.4-1's human-form copy leaves it, and beside the copy's root a byte
//   copy of what the staging put beside the original's in its temporary
//   directory, so a symbolic link reaching out of the root reaches the same
//   state from the copy — T6.5-4's outside-root link arms' `specs/sub` →
//   `../../outside`; each copy checked against the workspace before
//   anything runs there — a difference is a harness error, never a product
//   verdict; a copy composes no source text, so S-9 has nothing to judge),
//   the workspace itself untouched, so the staging it belongs to continues
//   exactly as its home test's does. A copy
//   is a different directory, so a product writing its absolute workspace
//   root to standard error would differ there across the two forms: the
//   built product writes nothing to standard error at exit 0 or 1.
// - The fixtures, each staged by its home module's own staging, never
//   re-spelled: T14-11's per-condition fixtures (section-14.ts
//   `T14_11_FIXTURES`: the range-rule arms, (n)'s repeated `d`, (ab)'s
//   trailing comma, and — Linux leg — (o)'s refused read, the unreadable
//   file left out of the compare), `build` (exit 1, or 0 at (ab)) and
//   `check` (exit 1: every fixture fails validation or, at (ab), was never
//   built) on each; T12.2-2's family states (section-12.1-12.2.ts
//   `runT1222Families`: each state its arms reach, the staging between
//   them T12.2-2's own), `build` (its exit unpinned there: T12.2-2 pins
//   `check`'s alone) and `check` (exit 1) at each; T1.5-2's every arm
//   (section-1.5.ts `T1_5_2_ARMS`, its located arm included, the non-UTF-8
//   arms on the Linux leg), `build` and `check` (exit 1 each) on each; and
//   T13.3-3's stagings (section-13.3.ts `runT1333GateStagings`: the
//   invalid-sources workspace, the garbage journal line and the obstructed
//   write path, each with its stale twin), each gated invocation's twin
//   (exit 1) — `ids`, `show`, `coverage`, `impact --base` where staged, and
//   `review status`, and the mutating `review` subcommands, gated past their
//   acquisition, on fresh copies — but `query`'s, a JSON-only surface with
//   no human form (SPEC 11). T13.3-3's own assertions (its pinned findings,
//   never-gated contrasts, and stale twins' premises) are its own: this
//   test asserts the two forms against each other.
// - The performed reports (`expectHumanPerformedTwin`): T6.4-1's rename and
//   each of T6.5-1's five file moves, staged as their home tests stage them
//   (section-6.4.ts `T6_4_1_STAGING`, section-6.5.ts
//   `T6_5_1_FILE_MOVE_STAGINGS`) and built; the operation with `--json` on
//   a fresh copy — exit 0, the staging's premise, its stdout decoded
//   form-exact as the performed-operation document (12.7: exactly
//   `{"findings", "mapping"}`, `findings` `[]`) — and without it on another,
//   exiting 0 alike, its standard error byte-identical, its report decoded
//   by the human performed-report decoder (helpers/adapters/human-reports.ts)
//   and carrying the twin's applied mapping (`assertHumanPerformedReportCarries`):
//   every pair's `from` and `to` identity, a multiset, order free (12.7's
//   `from`-byte order is the JSON form's); a pair the human report omits,
//   changes, or lists beside the twin's fails, named. The mapping's content
//   is the home tests' (each pins it); this test compares the two forms.
// - The refused real operations (`expectHumanRefusalTwin`, the findings
//   twin above on fresh copies, exit 1): T6.4-6's invalid-workspace arm on
//   its own staging (section-6.4.ts `stageT646InvalidWorkspace`, 14.5), then
//   every refusal T6.6-3's refusal stagings stage (section-6.6.ts
//   `runT663RefusalStagings`: each refusal of T6.4-3, T6.5-4, T6.5-6,
//   T6.5-16, T6.5-17, T6.5-20, T6.5-21, and T14-7 staged identically from
//   its home module's exports — the invalid-workspace precondition, T6.4-6's
//   refused-writes staging among it, the exact self-moves, the same-file
//   collision, and T14-7's own stagings included — the sweep T6.6-3 and
//   T6.6-7 run with their own twins): each refusal finding's code,
//   locations, concerned path, and identities as its `--json` twin's (14: a
//   refusal renders as precisely as a finding), and an invalid-workspace
//   refusal's numbered findings each under its own condition's code; a
//   human refusal printing nothing or omitting any datum fails. The
//   expected refusal findings stay the home tests' premises.
// - Non-UTF-8 paths (12.0): on every arm of T1.5-2, each human report's
//   paths — every finding's location files and concerned path — must be,
//   as a multiset in form and bytes, exactly the paths T1.5-2 pins for the
//   arm (`T152Arm.expected`), whatever the `--json` twin carries: the
//   non-UTF-8 path, the 14.19 finding's concerned path and the located
//   arm's location file, presented in the marked byte form, which the
//   decoder tells from a plain path string by the mark alone and decodes to
//   the path's exact bytes (the staged bytes); and every valid-UTF-8 path —
//   the `#` and U+FFFD arms' concerned paths — a plain string, never marked.
//   A non-UTF-8 path printed raw fails the decode at once (a report's bytes
//   must be valid UTF-8); one printed lossily (U+FFFD-substituted) or
//   otherwise unmarked reads as a plain path differing from the marked one,
//   and a valid path printed marked as a marked path differing from the
//   plain one. On the Linux-leg non-UTF-8 arms each human report is run a
//   second time on the same state (inside the same compare), its stdout
//   byte-identical to the first's (H-6: deterministic presentation).
// - The `impact` reports (`expectHumanImpactTwin`): the stagings of T5.6-1
//   through T5.6-6, T9-1 through T9.2-5, and T9.3-1 through T9.3-3, each
//   run as its home test runs it (section-5.6.ts `T5_6_IMPACT_STAGINGS`,
//   section-9.ts `T9_IMPACT_STAGINGS`, section-9.3.ts
//   `T9_3_IMPACT_STAGINGS`: their workspaces, git baselines, edits,
//   journaled renames, and builds; every source they stage a staged-source
//   record, S-9), each `impact --base <ref>` read they reach handed to the
//   twin in place of the home test's own assertions: at that state —
//   built, so graph data is current and the read refreshes nothing (13.3),
//   and `impact` acquires nothing (13.5) — the `--json` read and the human
//   one run inside one whole-root modifies-nothing compare, `.git` and the
//   lock path included (T12.0-11: a git-reading invocation leaves `.git`
//   untouched), each exiting 0 (impact is informational, 9.3; the home
//   tests pin it), standard error byte-identical, the `--json` report
//   decoded by the impact adapter (reports.ts) and the human one by the
//   human impact decoder (helpers/adapters/human-reports.ts: fitted to the
//   built product's layout, shape-aware, value-blind, failing loudly),
//   which must carry the twin's information (`assertHumanImpactReportCarries`):
//   each category of each entry with the nodes it covers — a collapsed
//   chain's every member — its deletion (a deleted node under its baseline
//   identity mapped forward), and the category's attribution, and each
//   impacted location under its group with its witness edge's kind and
//   target and its witness path in order, as multisets, order free (SPEC
//   fixes no order for the report itself; 9.3 groups it by category, so the
//   `--json` form's gathering of a node's categories into one entry is no
//   datum). The reports' content is the home tests' (each pins it); this
//   test compares the two forms, the readings without differences (T9-1's
//   empty reports) included.
// - The `review` family's listings and status reads (`expectHumanListTwin`,
//   `expectHumanStatusTwin`): T10.7-5's staging (section-10.7-i.ts
//   `runT1075Listings`: a git-backed workspace, the audit session a2 — its
//   resolved item made stale by an edit — the path-blocks session a, the
//   coverage session B, then the audit session c corrupted by unparseable
//   bytes) and T10.7-6's (`runT1076Stages`: an audit session through its
//   four stages), each `review list` or `review status s` read they reach
//   handed to the twin in place of the home test's own assertions, the
//   staging between the reads the home test's own: at that state — built,
//   so graph data is current and the read refreshes nothing (13.3); reads
//   never write a session (10.4) and acquire nothing (13.5) — the `--json`
//   read (its exit the staging's premise: `list` 1 iff a session is
//   corrupt, else 0; `status` 0) and the human one run inside one
//   whole-root modifies-nothing compare, the lock path compared, exiting
//   alike, standard error byte-identical, the human report decoded by the
//   human review-list or review-status decoder
//   (helpers/adapters/human-reports.ts: fitted to the built product's
//   layout, shape-aware, value-blind, failing loudly) and carrying the
//   twin's information (`assertHumanSessionListReportCarries`,
//   `assertHumanSessionStatusReportCarries`): every session's name with its
//   strategy and its item counts by stored status — or its corruption in
//   their place — and each corrupt session's condition-21 finding (14.21);
//   every item's id, kind, scope node, status, and blocked state, and the
//   totals by status. T12.0-15 lists 10.7's `list` and `status` among the
//   orders SPEC fixes for the report itself, so the human report lists the
//   sessions and the items in the twin's order — byte order of session
//   name, item order — every other datum compared order free; a status the
//   human report prints no count or total for reads as 0, the review
//   adapter's own convention (whether a zero appears is concrete shape,
//   H-3). The listings' and reads' content is the home tests' (each pins
//   it); this test compares the two forms.
// - The `review` family's `next` and `show` reads (`expectHumanNextTwin`,
//   `expectHumanShowTwin`): T10.7-7's staging (section-10.7-ii.ts
//   `runT1077Reads`: an audit session's order walk — four items, then its
//   fully-resolved report — continued by the full-resolution arm's added
//   source, its fully-resolved report and, once a leaf item is re-resolved
//   `updated`, the new section's item; an audit session over no
//   requirement node; and a path-blocks session's payload walk, a.k's
//   item, a's, and the code location's, present and then deleted) and
//   T10.7-8's (`runT1078ShowReads`: an audit session, x.k's item — the one
//   `next` returns — and the root's, blocked by x's), each `review next s`
//   or `review show s <item>` read they reach handed to the twin in place
//   of the home test's own assertions, the staging between the reads the
//   home test's own (T10.7-8's continuation — its split, `export`, unknown
//   ids, and invalidation — left to it): at that state — built, so graph
//   data is current and the read refreshes nothing (13.3); reads never
//   write a session (10.4) and acquire nothing (13.5) — the `--json` read
//   (exit 0, the staging's premise) and the human one run inside one
//   whole-root modifies-nothing compare, the lock path and `.git` compared
//   (T12.0-11: the payload walk's baseline session reads git), exiting
//   alike, standard error byte-identical, the human report decoded by the
//   human review-next or review-item decoder
//   (helpers/adapters/human-reports.ts: fitted to the built product's
//   layout, shape-aware, value-blind, failing loudly) and carrying the
//   twin's information (`assertHumanNextReportCarries`,
//   `assertHumanItemReportCarries`): for `next`, the session reported fully
//   resolved exactly where the twin reports it so, else the item returned —
//   its id, kind, status, blocked state, blockers, note, and a reason, the
//   self-contained payload being the JSON form's alone (T12.0-15); for
//   `show`, the full item — those fields, the scope node's identity,
//   presence, source range, and text, each context entry's and each origin
//   entry's (an origin entry's range and its before and after sides'
//   presence and text), and the `baseline` and `current` recorded states,
//   each node's presence and hashes or absent marker — order free (SPEC
//   fixes none for either report). The reason is informational wording
//   (10.2: its composition unpinned), so its presence alone is asked (H-3).
//   The reads' content is the home tests' (each pins it); this test
//   compares the two forms.
// - The `review` family's refusals (`runReviewRefusalTwins`, the findings
//   twin above on fresh copies, exit 1): T10.7-1's staging
//   (section-10.7-i.ts `runT1071Stagings`: `create --name s` naming the
//   existing valid session s, and naming s under each of T10.1-4's
//   corruptions — unparseable bytes, an invariant violation, a directory,
//   a symbolic link to a valid session — `create --name Foo` beside a
//   corrupt foo.json, and on the Linux leg the three case pairs: both
//   corrupt, `--name Foo`; foo.json valid and FOO.json corrupt, `--name
//   Foo` and `--name foo`; both valid, `--name Foo`), T10.7-9's
//   (section-10.7-ii.ts `runT1079Stagings`: the path-blocks fixture's
//   `split` of N's parent-consistency item and of N.a's leaf item, the
//   audit fixture's of N's parent-consistency item and of s's leaf item,
//   and Q's item once its only child is deleted), and T10.7-10's
//   (`runT10710Stagings`: `resolve` of p's blocked item), each run with a
//   refusal visitor (support.ts `ReviewRefusalVisitor`) whose `home` is
//   false: every refused invocation handed to the twin in place of the
//   home test's own check, the stagings' other assertions — the arms the
//   home tests assert beside the refusals, T10.7-9's (f) and (g), the
//   later re-derivations — left to the home tests, and their workspaces,
//   sessions, premises, and the items the refusals name kept, so the run
//   reaches each refusal at the state its home test refuses at (the built
//   product fails T10.7-1 at case pair (i)'s count and T10.7-9 at the
//   path-blocks fixture's (b), neither asserted here). Each refusal's two
//   forms run each on its own fresh copy (a refused `create`, `split`, or
//   `resolve` is still a mutating subcommand's run, 13.5): the human
//   findings report carries every refusal finding's code, locations,
//   concerned path, and identities as its `--json` twin's (14: a refusal
//   renders as precisely as a finding) — a code-less refusal's absent code
//   and path, a corruption's condition-21 code and the corrupt session's
//   own file as its concerned path (10.7: the corruption reported in a
//   `create` refusal's place, one finding per corrupt match) — whatever
//   the twin reports: the refusals and corruptions themselves stay the
//   home tests' premises.
// - The subcommands naming each corrupt session of T10.1-4: every corrupt
//   state (section-10.1.ts `T10_1_4_CORRUPT_STATES`), each staged on a
//   fresh workspace as T10.1-4 stages it, then each subcommand of
//   T10.1-4's own list (`t1014NamingSubcommands`) with a human form —
//   `status`, `next`, and `show` on the same state, `resolve` and `split`,
//   mutating subcommands, each form on its own fresh copy — through the
//   findings twin above, exit 1 (the staging's premise, as T10.1-4 pins
//   it): the corruption is the report (SPEC 10.1, 14.21), so the human
//   report carries the condition-21 finding's code and concerned path —
//   the session's own file, a symbolic link there by its own path — as its
//   `--json` twin's. `export`, JSON-only (10.7), has no human form.
// - The `coverage`, `ids`, and `show` families (`expectHumanReadTwin`):
//   T8.2-1's staging (section-8.ts `runT821Reads`: the report workspace's
//   default run, `coverage prof-aux`, and `coverage --check`, then the
//   covered fixture's `coverage --check`), T12.3-1's (section-12.3-12.5.ts
//   `runT1231Listings`: the ordering workspace's flat and tree listings,
//   its two `--file` globs over `apecs`, and its inside spellings matching
//   nothing, the restricted-tree workspace's `--unreferenced` flat and tree
//   listings and TEST-SPEC's pinned inside spellings, and the entries
//   workspace's flat and tree listings, each under `--unreferenced` too,
//   and its `--file` glob matching only code sources — its outside-root
//   `--file` arms, plain usage errors, left to the home test by the
//   visitor's `home: false`), and T12.4-1's (`runT1241Shows`: the non-root
//   arm's `show specs/S.mdx#star` and the root arm's `show specs/S.mdx`),
//   each read they reach handed to the twin in place of the home test's
//   own assertions, the staging between the reads the home test's own: at
//   that state — built, so graph data is current and the read refreshes
//   nothing (13.3); none of these reads acquires (13.5) — the `--json`
//   read (its exit the staging's premise: `coverage --check` 1 iff a
//   required node is uncovered, else 0; every other read 0) and the human
//   one run inside one whole-root modifies-nothing compare, the lock path
//   compared, exiting alike, standard error byte-identical, the human
//   report decoded by the human coverage, ids, ids tree, or show decoder
//   (helpers/adapters/human-reports.ts: fitted to the built product's
//   layout, shape-aware, value-blind, failing loudly) and carrying the
//   twin's information (`assertHumanCoverageReportCarries`,
//   `assertHumanIdsReportCarries`, `assertHumanIdsTreeReportCarries`,
//   `assertHumanNodeReportCarries`): for `coverage`, every profile matched
//   by name, its four counts, its covered nodes with their covering paths
//   node for node, its uncovered and ignored nodes, and each ignored node's
//   reasons, classified onto 8.2's four as the `--json` twin's are, in the
//   order 8.2 fixes for the report itself (T12.0-15 lists 8.2's reasons
//   among the orders SPEC fixes for the report), every other datum order
//   free; for `ids`, every entry — an empty one included — in byte order of
//   path, its IDs in document order, a tree's nodes nested as the twin's
//   are (T12.0-15 lists 12.3's listing among those orders); for `show`, the
//   identity, the source range's two byte offsets, the own and the subtree
//   text, the four hashes, the tags as a set and the coverage attribute,
//   each absent exactly where the twin's is (a root's, 12.4, 11), and the
//   incoming and outgoing edges as multisets of kind and endpoints. The
//   reads' content is the home tests' (each pins it); this test compares
//   the two forms.
// - The exit-2 errors (`expectHumanErrorTwin`; TEST-SPEC T12.0-15: without
//   JSON output in effect, an exit-2 error's standard-error message is its
//   only report): T12.7-3's configuration-error stagings (section-12.7.ts
//   `runT1273ConfigurationErrorStagings`: the found configuration file from
//   the root and from a nested working directory; `--config` naming the
//   broken file with a `./` segment; from `work/`, `--config` naming no
//   file — as spelled, non-canonically, and absolutely — and then the
//   malformed file, likewise; the failed upward search's `.` from the root
//   and from a nested working directory; the three-defect file; and —
//   Linux leg — `--config` from the symbolic-link working directory, its
//   `PWD` the link: every concerned-path form, the found file, `.`, and
//   `--config`'s canonical anchoring and as-given forms; the bare
//   `inventory` run, a JSON-only surface with no human form, left to
//   T12.7-3), T6.3-6's journal errors at a given baseline (section-6.3.ts
//   `runT636JournalErrorStagings`: (a)–(d), `impact --base` and `review
//   create --base … --name n` at each, under each arm's staging), and
//   T13.5-2's busy workspace (section-13.5.ts `runT1352HeldRun`: each
//   excluded mutating command while command 1 holds, every run bounded and
//   exiting while command 1 still holds), and T14-10's exit-2 read
//   failures (section-14-ii.ts `runT1410ReadFailureStagings`: (b)'s given
//   baselines on the unreadable journal, `impact --base` and `review create
//   --base … --name n`, each resolution's journal error; (d)'s
//   configuration errors on the unreadable configuration file, `build` and
//   `ids`; (g)'s refused listing of `specs/sub` — `build`, `check`, `ids`,
//   `review list`, and a `rename` — and its precedence arms: `coverage
//   <unknown-profile>`, the syntax class's surplus operand and outside-root
//   `--file` pattern (plain usage errors), the read failure beside a source
//   failing validation, and the invalid configuration preceding the read;
//   (h)'s refused listing of `.xspec/reviews`, `review list` and `check`;
//   (i)'s acquisition stagings at the lock path, one mutating command each,
//   and the second discovery's refused `specs/sub` during a held `rename`;
//   (k)'s entered, mode-000 working directory `R/tools`, configured and
//   bare, `build`, `ids`, `coverage <unknown-profile>`, and the syntax
//   class's `ids extra`; and (l)'s kind halves under mode-000 directories —
//   `.xspec`'s `build`, `ids`, and `impact --base c1`, and on its failing
//   twin `build`, `ids`, and `check`; `.xspec/reviews`'s `review status s`;
//   and the entered root's `build` and `ids` with `--config
//   xspec.config.ts`), each run as its home test runs it, every exit-2
//   invocation handed to the twin in place of the home test's own check
//   (support.ts `ErrorInvocationVisitor`, `home` false: the stagings' other
//   assertions — T13.5-2's held-state comparison, second commands, and
//   determinism repeats among them, and T14-10's exit-0 and exit-1 runs,
//   compares, and recoveries — the home tests' own; a JSON-only surface's
//   exit-2 run — `inventory`, `occurrences`, `view`, `at`, which have no
//   human form — and (j)'s refused git data, a plain usage error and no
//   read failure, left to them): inside one whole-root modifies-nothing
//   compare (an exit-2 run modifies nothing — 12.1, 6.3, 13.5, 14.25 — the
//   lock path aside where a mutating command reached acquisition, H-6, and
//   left out of both walks at T14-10(i), whose staging stands there and
//   whose home test prunes it so), the `--json` run exits 2, the staging's
//   premise (each home test pins it), its stdout decoded form-exact as the
//   error document (12.7); then the human run on the same pre-invocation
//   state — the `--json` run's working directory, environment, and staging
//   (T6.3-6's journal-path occupants and unsearchable git directories and
//   T14-10's refused objects, each made just before each run and restored
//   once it ends — T6.3-6's FIFO checked unopened after each, T14-10(k)'s
//   and (l)(iii)'s directories entered first and staged once entered, and
//   at T14-10(i) the lock path an earlier run's acquisition and release
//   left cleared before the staging is made again, so the human run meets
//   the state the `--json` run met, at the same absolute path) — exits 2 alike
//   with standard output empty (12.0), its standard error byte-identical
//   (12.0: the output form never changes standard-error content; T12.0-2),
//   and its message — decoded by the exit-2 adapter
//   (helpers/adapters/human-reports.ts `decodeHumanErrorMessage`: fitted to
//   the built product's layout, shape-aware, value-blind, failing loudly)
//   — carries the stable code and the concerned path, in form and bytes,
//   its twin's error document carries (`assertHumanErrorMessageCarries`),
//   wording free; a code-less twin, a plain usage error, is asserted for
//   neither (14: it carries no code and concerns no path). The errors'
//   codes and paths are the home tests' (each pins them); this test
//   compares the two forms. T14-9's write failures join them in the last
//   part of the plan written at 2a2b94e's FIX_PLAN Task 135.

import { Buffer } from "node:buffer";
import type {
  Finding,
  HumanFindingsReport,
  PathValue,
} from "../../helpers/adapters/index.js";
import {
  assertHumanCoverageReportCarries,
  assertHumanErrorMessageCarries,
  assertHumanFindingsReportCarries,
  assertHumanIdsReportCarries,
  assertHumanIdsTreeReportCarries,
  assertHumanImpactReportCarries,
  assertHumanItemReportCarries,
  assertHumanNextReportCarries,
  assertHumanNodeReportCarries,
  assertHumanPerformedReportCarries,
  assertHumanSessionListReportCarries,
  assertHumanSessionStatusReportCarries,
  decodeCoverageReport,
  decodeFindingsReport,
  decodeIdsReport,
  decodeIdsTreeReport,
  decodeImpactReport,
  decodeItemReport,
  decodeNextReport,
  decodeNodeReport,
  decodePerformedOperationReport,
  decodeSessionListReport,
  decodeSessionStatusReport,
  pathValueBytes,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  assertStdoutEmpty,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { EXCLUDE_LOCK_PATH, isLockPathBytes } from "../../helpers/lock-path.js";
import { stageReadRefusalOfFile } from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import {
  assertLeavesUnchanged,
  diffSnapshots,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import type { SnapshotOptions } from "../../helpers/snapshot.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { copyTreeBytes } from "../../helpers/tree-copy.js";
import {
  TestWorkspace,
  WORKSPACE_ROOT_DIRECTORY_NAME,
} from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import type { T152Arm } from "./section-1.5.js";
import { stageT152Arm, T1_5_2_ARMS } from "./section-1.5.js";
import type { PerformedOperationStaging } from "./section-6.4.js";
import {
  stageT646InvalidWorkspace,
  T6_4_1_STAGING,
  T6_4_6_INVALID_WORKSPACE_CASE,
  T6_4_6_INVALID_WORKSPACE_CONFIG,
  T6_4_6_INVALID_WORKSPACE_FILES,
} from "./section-6.4.js";
import { T5_6_IMPACT_STAGINGS } from "./section-5.6.js";
import { T6_5_1_FILE_MOVE_STAGINGS } from "./section-6.5.js";
import { runT636JournalErrorStagings } from "./section-6.3.js";
import {
  T10_1_4_CORRUPT_STATES,
  t1014NamingSubcommands,
} from "./section-10.1.js";
import {
  runT1071Stagings,
  runT1075Listings,
  runT1076Stages,
} from "./section-10.7-i.js";
import {
  runT1077Reads,
  runT1078ShowReads,
  runT1079Stagings,
  runT10710Stagings,
} from "./section-10.7-ii.js";
import type { RefusalStagingTwin } from "./section-6.6.js";
import { runT663RefusalStagings } from "./section-6.6.js";
import { runT821Reads } from "./section-8.js";
import { runT1222Families } from "./section-12.1-12.2.js";
import { runT1231Listings, runT1241Shows } from "./section-12.3-12.5.js";
import { runT1273ConfigurationErrorStagings } from "./section-12.7.js";
import { runT1333GateStagings } from "./section-13.3.js";
import { runT1352HeldRun } from "./section-13.5.js";
import { T14_11_FIXTURES } from "./section-14.js";
import { runT1410ReadFailureStagings } from "./section-14-ii.js";
import { T9_IMPACT_STAGINGS } from "./section-9.js";
import { T9_3_IMPACT_STAGINGS } from "./section-9.3.js";
import type {
  ErrorInvocation,
  ErrorInvocationVisitor,
  ReviewRefusalVisitor,
} from "./support.js";
import { buildOk, expectErrorDocument, expectExit, runCli } from "./support.js";

// ---------------------------------------------------------------------------
// The twin
// ---------------------------------------------------------------------------

/**
 * Where a twin's two runs meet the pre-invocation state (the module
 * header): `"same"` — both on the workspace itself, inside one whole-root
 * modifies-nothing compare (a run writing nothing at that state);
 * `"fresh"` — each on its own fresh byte copy of the state, the workspace
 * untouched (a mutating command, or a run that writes).
 */
type TwinState = "same" | "fresh";

/** {@link expectHumanFindingsTwin}'s options. */
interface HumanFindingsTwinOptions {
  /** Where the two runs meet the pre-invocation state. */
  readonly state: TwinState;
  /**
   * The `--json` run's exit as the staging's premise, where the home test
   * pins one; absent, the twin asserts only that the human run exits as the
   * `--json` run did.
   */
  readonly expectedExit?: number;
  /**
   * Entries a `"same"` compare leaves out, unread — a file staged
   * unreadable, which no snapshot can read (T14-11 (o)).
   */
  readonly exclude?: SnapshotOptions["exclude"];
  /**
   * Run the human form a second time on the same state, its report
   * byte-identical to the first's (12.0's deterministic presentation of a
   * non-UTF-8 path; H-6).
   */
  readonly repeatHuman?: boolean;
}

/** One twin's outcome: the `--json` run's findings and the human report. */
interface HumanFindingsTwin {
  /** The `--json` twin's findings, decoded form-exact (12.7). */
  readonly findings: readonly Finding[];
  /** The human run. */
  readonly human: RunResult;
  /** Its report, decoded onto the information model. */
  readonly decoded: HumanFindingsReport;
}

/** The workspace root's own name in its temporary directory, as bytes. */
const ROOT_NAME_BYTES = Buffer.from(WORKSPACE_ROOT_DIRECTORY_NAME, "utf8");

/**
 * A snapshot exclusion leaving out the workspace root itself, the
 * temporary directory's other entries kept: what a staging put beside the
 * root.
 */
const EXCLUDE_ROOT: SnapshotOptions = {
  exclude: (relPathBytes) => Buffer.from(relPathBytes).equals(ROOT_NAME_BYTES),
};

/**
 * Run `body` on a fresh workspace holding a byte copy of `workspace` as it
 * stands (the module header): helpers/tree-copy.ts's `copyTreeBytes`
 * (directories, plain files, and symbolic links, names as bytes; `.git`
 * included), the lock path left out unread (`isLockPathBytes`: a product
 * may make its entries unreadable, H-4), and beside the copy's root a byte
 * copy of whatever stands beside the original's in its temporary directory
 * — what the staging put there, which a symbolic link reaching out of the
 * root then reaches in the copy as in the original (T6.5-4's outside-root
 * link arms: `specs/sub` → `../../outside`, an empty directory beside the
 * root; the harness's own git scratch there is copied alike, and the
 * product never reads it) — each checked against the original, the lock
 * path aside, before `body` runs — a difference is a harness error, never
 * a product verdict — then dispose of the copy (H-1).
 */
async function onFreshCopy<T>(
  workspace: TestWorkspace,
  context: string,
  body: (copy: TestWorkspace) => Promise<T>,
): Promise<T> {
  const copy = await TestWorkspace.create({});
  try {
    await copyTreeBytes(
      Buffer.from(workspace.tempRoot),
      Buffer.from(copy.tempRoot),
      EXCLUDE_ROOT.exclude,
    );
    await copyTreeBytes(
      Buffer.from(workspace.root),
      Buffer.from(copy.root),
      isLockPathBytes,
    );
    const differences = [
      ...diffSnapshots(
        await snapshotDirectory(workspace.tempRoot, EXCLUDE_ROOT),
        await snapshotDirectory(copy.tempRoot, EXCLUDE_ROOT),
      ),
      ...diffSnapshots(
        await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH),
        await snapshotDirectory(copy.root, EXCLUDE_LOCK_PATH),
      ),
    ];
    if (differences.length > 0) {
      throw new Error(
        `harness error: ${context}: the byte copy of ${workspace.root} at ` +
          `${copy.root}, with what stands beside it in ` +
          `${workspace.tempRoot}, differs from it (the lock path aside): ` +
          differences
            .slice(0, 10)
            .map((change) => `${change.change} ${change.path}`)
            .join(", "),
      );
    }
    return await body(copy);
  } finally {
    await copy.dispose();
  }
}

/**
 * The `--json` run's exit, or a diagnosed failure where it ended by signal
 * (H-5: every invocation's exact exit code is asserted).
 */
function exitOf(json: RunResult, context: string): number {
  if (json.exitCode === null) {
    fail(
      `${context}: the \`--json\` run ended by signal ${String(json.signal)}, ` +
        `never exiting — its human twin has no exit code to match (SPEC ` +
        `12.0; TEST-SPEC H-5, T12.0-15)`,
    );
  }
  return json.exitCode;
}

/**
 * Run the `--json` form at `at`: its exit asserted where the staging pins
 * one (`expectedExit`, the premise), else whatever it is (the twin then
 * asks the human form only to match it).
 */
async function runJsonForm(
  product: ProductBinding,
  at: TestWorkspace,
  jsonArgv: readonly string[],
  expectedExit: number | undefined,
  premise: string,
): Promise<RunResult> {
  if (expectedExit !== undefined) {
    return await expectExit(product, at, jsonArgv, expectedExit, premise);
  }
  return await runCli(product, at, jsonArgv);
}

/**
 * T12.0-15's twin of one findings-report invocation at the state a staging
 * left (the module header): `argv` with `--json` — its exit
 * `options.expectedExit` where given, the staging's premise — decoded
 * form-exact as the findings-only report (SPEC 12.7); then `argv` itself,
 * the human form, on the same pre-invocation state (`options.state`),
 * exiting as its `--json` twin with its standard error byte-identical
 * (SPEC 12.0: the output form never changes an exit code or
 * standard-error content; T12.0-2), its report decoded by the human
 * findings decoder and carrying the twin's findings — every code,
 * location, concerned path, and identity (TEST-SPEC T12.0-15;
 * `assertHumanFindingsReportCarries`); with `options.repeatHuman`, the
 * human form run again on the same state, its report byte-identical (H-6).
 */
async function expectHumanFindingsTwin(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
  options: HumanFindingsTwinOptions,
): Promise<HumanFindingsTwin> {
  const jsonArgv = [...argv, "--json"];
  const jsonCommand = `\`${jsonArgv.join(" ")}\``;
  const humanCommand = `\`${argv.join(" ")}\` (human report)`;
  const premise =
    `${context}: ${jsonCommand} — the staging's premise: exit ` +
    `${String(options.expectedExit)}, as the home test pins it (SPEC 12.0)`;
  const humanExitWhy = (exit: number): string =>
    `${context}: ${humanCommand} — run without \`--json\` on the same ` +
    `pre-invocation state, it exits as its \`--json\` twin did ` +
    `(${String(exit)}; SPEC 12.0: the output form never changes an exit ` +
    `code; TEST-SPEC T12.0-15, T12.0-2)`;

  // The two forms against each other, once both have run.
  const judge = (json: RunResult, human: RunResult): HumanFindingsTwin => {
    const findings = decodeFindingsReport(
      parseJsonStdout(
        json,
        `${context}: ${jsonCommand} — a single JSON document as the ` +
          `entire stdout (SPEC 12.0)`,
      ),
      `${context}: ${jsonCommand}`,
    ).findings;
    assertBytesEqual(
      human.stderrBytes,
      json.stderrBytes,
      `${context}: ${humanCommand} — its standard error byte-identical to ` +
        `its \`--json\` twin's (SPEC 12.0: the output form never changes ` +
        `standard-error content; T12.0-2)`,
    );
    const decoded = assertHumanFindingsReportCarries(
      human,
      findings,
      `${context}: ${humanCommand}`,
    );
    return { findings, human, decoded };
  };
  const assertRepeated = (first: RunResult, again: RunResult): void => {
    assertBytesEqual(
      again.stdoutBytes,
      first.stdoutBytes,
      `${context}: ${humanCommand} run twice on the same state — the ` +
        `human report byte-identical across the two runs (SPEC 12.0: the ` +
        `marked byte form presented deterministically; TEST-SPEC T12.0-15, ` +
        `H-6)`,
    );
  };

  if (options.state === "same") {
    return await assertLeavesUnchanged(
      workspace.root,
      async () => {
        const json = await runJsonForm(
          product,
          workspace,
          jsonArgv,
          options.expectedExit,
          premise,
        );
        const exit = exitOf(json, `${context}: ${jsonCommand}`);
        const human = await expectExit(
          product,
          workspace,
          argv,
          exit,
          humanExitWhy(exit),
        );
        const twin = judge(json, human);
        if (options.repeatHuman === true) {
          assertRepeated(
            human,
            await expectExit(
              product,
              workspace,
              argv,
              exit,
              humanExitWhy(exit),
            ),
          );
        }
        return twin;
      },
      `${context}: ${jsonCommand} and its human twin on the same state — ` +
        `neither writes anything there, the lock path included (SPEC 12.1: ` +
        `a failing \`build\` modifies nothing; 13.3: \`check\` never ` +
        `refreshes, and a gated read on a failing workspace modifies ` +
        `nothing; 10.1: a \`review\` read naming a corrupt session ` +
        `modifies nothing; none of them acquires, 13.5; TEST-SPEC H-6, ` +
        `T12.0-15)`,
      options.exclude === undefined ? {} : { exclude: options.exclude },
    );
  }
  const json = await onFreshCopy(
    workspace,
    `${context}: the state copied for ${jsonCommand}`,
    (copy) =>
      runJsonForm(product, copy, jsonArgv, options.expectedExit, premise),
  );
  const exit = exitOf(json, `${context}: ${jsonCommand}`);
  const human = await onFreshCopy(
    workspace,
    `${context}: the state copied for ${humanCommand}`,
    (copy) => expectExit(product, copy, argv, exit, humanExitWhy(exit)),
  );
  const twin = judge(json, human);
  if (options.repeatHuman === true) {
    assertRepeated(
      human,
      await onFreshCopy(
        workspace,
        `${context}: the state copied again for ${humanCommand}`,
        (copy) => expectExit(product, copy, argv, exit, humanExitWhy(exit)),
      ),
    );
  }
  return twin;
}

// ---------------------------------------------------------------------------
// `build` and `check`: T14-11's per-condition fixtures
// ---------------------------------------------------------------------------

/** A snapshot exclusion leaving out exactly the workspace-relative `rel`. */
function excludingFile(rel: string): SnapshotOptions["exclude"] {
  const bytes = Buffer.from(rel, "utf8");
  return (relPathBytes) => Buffer.from(relPathBytes).equals(bytes);
}

/**
 * T14-11's per-condition fixtures (section-14.ts `T14_11_FIXTURES`), each
 * on a fresh workspace staged as T14-11 stages it: `build` — exit 1 at a
 * staged condition, on the same state (a failing `build` modifies nothing,
 * 12.1); exit 0 at (ab)'s valid attribute, each form on a fresh copy (a
 * successful `build` writes) — then `check` on the same state, exit 1
 * (every fixture fails `build`'s validations or, at (ab), was never built:
 * 12.2, 14.10). At (o) the source is staged unreadable around both twins
 * (Linux leg, E-1), the file left out of the compares (no snapshot reads
 * it).
 */
async function runT1411Twins(product: ProductBinding): Promise<void> {
  for (const fixture of T14_11_FIXTURES) {
    const context = `T12.0-15 (T14-11 (${fixture.arm}) ${fixture.rule})`;
    const workspace = await TestWorkspace.create({ files: fixture.files });
    try {
      const staging =
        fixture.refused === undefined
          ? undefined
          : await stageReadRefusalOfFile(workspace.path(fixture.refused));
      try {
        const exclude =
          fixture.refused === undefined
            ? undefined
            : excludingFile(fixture.refused);
        await expectHumanFindingsTwin(product, workspace, ["build"], context, {
          state: fixture.buildExit === 0 ? "fresh" : "same",
          expectedExit: fixture.buildExit,
          ...(exclude === undefined ? {} : { exclude }),
        });
        await expectHumanFindingsTwin(product, workspace, ["check"], context, {
          state: "same",
          expectedExit: 1,
          ...(exclude === undefined ? {} : { exclude }),
        });
      } finally {
        await staging?.restore();
      }
    } finally {
      await workspace.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// `build` and `check`: T12.2-2's per-family workspaces
// ---------------------------------------------------------------------------

/**
 * T12.2-2's family states (section-12.1-12.2.ts `runT1222Families`: each
 * state its arms reach, staged as T12.2-2 stages it): at each, `build` —
 * each form on a fresh copy, its exit unpinned (T12.2-2 pins `check`'s
 * alone; where the sources pass, `build` succeeds and writes) — and
 * `check` on the same state, exit 1 (T12.2-2's family assertion: `check`
 * reports each family with exit 1).
 */
async function runT1222Twins(product: ProductBinding): Promise<void> {
  await runT1222Families(product, async (workspace, state) => {
    const context = `T12.0-15 (T12.2-2 ${state.label})`;
    await expectHumanFindingsTwin(product, workspace, ["build"], context, {
      state: "fresh",
    });
    await expectHumanFindingsTwin(product, workspace, ["check"], context, {
      state: "same",
      expectedExit: 1,
    });
  });
}

// ---------------------------------------------------------------------------
// `build` and `check`: T1.5-2's every arm, and the non-UTF-8 paths
// ---------------------------------------------------------------------------

/** Every path a finding carries: its location files, then its concerned path. */
function pathsOf(
  findings: readonly {
    readonly locations: readonly { readonly file: PathValue }[];
    readonly path: PathValue | null;
  }[],
): PathValue[] {
  return findings.flatMap((finding) => [
    ...finding.locations.map((location) => location.file),
    ...(finding.path === null ? [] : [finding.path]),
  ]);
}

/** A path's presentation and bytes, as one comparable key. */
function presentationKey(path: PathValue): string {
  return `${typeof path === "string" ? "plain" : "marked"}:${pathValueBytes(path).toString("hex")}`;
}

/** A path's presentation, rendered for a diagnosis. */
function describePresentation(path: PathValue): string {
  return typeof path === "string"
    ? `the plain string ${JSON.stringify(path)}`
    : `the marked byte form of ${renderPathValue(path)}`;
}

/**
 * T12.0-15's non-UTF-8 clause on one human report of a T1.5-2 arm (the
 * module header): the paths the decoded report presents — every finding's
 * location files and concerned path — are, as a multiset in form and
 * bytes, exactly the paths T1.5-2 pins for the arm, whatever the `--json`
 * twin carries: a non-UTF-8 path in the explicitly marked byte form
 * carrying its exact bytes (the decoder recognizing it by the mark alone),
 * every valid-UTF-8 path a plain string, never marked (SPEC 12.0, 12.7).
 */
function assertPathsPresented(
  decoded: HumanFindingsReport,
  arm: T152Arm,
  context: string,
): void {
  const expected = pathsOf(arm.expected);
  const presented = pathsOf(decoded.findings);
  const sortedKeys = (paths: readonly PathValue[]): string[] =>
    paths.map(presentationKey).sort();
  if (
    JSON.stringify(sortedKeys(presented)) ===
    JSON.stringify(sortedKeys(expected))
  ) {
    return;
  }
  fail(
    `${context}: every path T1.5-2's arm reports is presented in the form ` +
      `12.0 fixes, whatever the \`--json\` twin carries — a path that is ` +
      `not valid UTF-8 in the explicitly marked byte form carrying its ` +
      `exact bytes, told from a plain path string by the mark alone, and ` +
      `every valid-UTF-8 path (the \`#\` and U+FFFD arms' among them) a ` +
      `plain string, never marked (SPEC 12.0, 12.7; TEST-SPEC T12.0-15): ` +
      `the arm's findings carry [${expected.map(describePresentation).join(", ")}]; ` +
      `the human report presents [${presented.map(describePresentation).join(", ")}] ` +
      `(a path printed lossily, U+FFFD-substituted, or otherwise unmarked ` +
      `reads as a plain path; one printed marked, as a marked path).\n` +
      `Human report lines: ${decoded.findings.map((finding) => finding.text).join("\n")}`,
  );
}

/**
 * T1.5-2's every arm (section-1.5.ts `T1_5_2_ARMS`, the non-UTF-8 arms on
 * the Linux leg, where T1.5-2 stages them), each on a fresh workspace
 * staged as T1.5-2 stages it: `build`, then `check`, each exit 1 on the
 * same state (the arm fails `build`'s validations and was never built:
 * 12.1, 12.2), each human report's paths held to 12.0's forms
 * (`assertPathsPresented`), and on a non-UTF-8 arm each human report run
 * twice, byte-identical (H-6).
 */
async function runT152Twins(product: ProductBinding): Promise<void> {
  for (const arm of T1_5_2_ARMS) {
    if (arm.nonUtf8 && process.platform !== "linux") continue;
    const context = `T12.0-15 (T1.5-2 ${arm.label})`;
    const workspace = await stageT152Arm(arm);
    try {
      for (const command of ["build", "check"] as const) {
        const twin = await expectHumanFindingsTwin(
          product,
          workspace,
          [command],
          context,
          { state: "same", expectedExit: 1, repeatHuman: arm.nonUtf8 },
        );
        assertPathsPresented(
          twin.decoded,
          arm,
          `${context}: \`${command}\` (human report)`,
        );
      }
    } finally {
      await workspace.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// The gated reads' reports of the same findings: T13.3-3's stagings
// ---------------------------------------------------------------------------

/**
 * T13.3-3's stagings (section-13.3.ts `runT1333GateStagings`, staged as
 * T13.3-3 stages them, its own assertions left to it): at each gated
 * invocation but `query`'s — a JSON-only surface, no human form (SPEC 11)
 * — the human twin, exit 1 (the gate reports the findings a `build` would
 * report and answers nothing, 13.3): a gated read on the same state, a
 * mutating `review` subcommand each form on a fresh copy.
 */
async function runT1333Twins(product: ProductBinding): Promise<void> {
  await runT1333GateStagings(product, {
    home: false,
    probe: async (workspace, invocation) => {
      if (invocation.argv[0] === "query") return;
      await expectHumanFindingsTwin(
        product,
        workspace,
        invocation.argv.filter((token) => token !== "--json"),
        `T12.0-15 (${invocation.context})`,
        { state: invocation.mutating ? "fresh" : "same", expectedExit: 1 },
      );
    },
  });
}

// ---------------------------------------------------------------------------
// `rename` and `move`: the performed reports of T6.4-1 and T6.5-1
// ---------------------------------------------------------------------------

/**
 * Stage a fresh workspace of `config` and `files` — records, every one: the
 * workspace is created after this body's first product invocation (S-9's
 * timing clause) — run `body`, dispose (H-1).
 */
async function withStaging<T>(
  config: StagedTs,
  files: Readonly<Record<string, InitialFileContents>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": config, ...files },
  });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * T12.0-15's twin of one performed `rename`/`move` at the state a staging
 * left (the module header), each form on its own fresh byte copy of the
 * state, the workspace untouched: `argv` with `--json` — exit 0, the
 * staging's premise (the operation its home test performs there) — its
 * report decoded form-exact as the performed-operation document (SPEC
 * 12.7: exactly `{"findings", "mapping"}`, `findings` `[]`); then `argv`
 * itself, the human form, exiting as its twin with its standard error
 * byte-identical (SPEC 12.0; T12.0-2), its report decoded by the human
 * performed-report decoder and carrying the twin's applied mapping — every
 * pair's `from` and `to` identity, a multiset, order free (TEST-SPEC
 * T12.0-15; SPEC 6.4: a successful rename's report is the applied mapping,
 * and a move reports its own as rename does, 6.5;
 * `assertHumanPerformedReportCarries`).
 */
async function expectHumanPerformedTwin(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<void> {
  const jsonArgv = [...argv, "--json"];
  const jsonCommand = `\`${jsonArgv.join(" ")}\``;
  const humanCommand = `\`${argv.join(" ")}\` (human report)`;
  const json = await onFreshCopy(
    workspace,
    `${context}: the state copied for ${jsonCommand}`,
    (copy) =>
      expectExit(
        product,
        copy,
        jsonArgv,
        0,
        `${context}: ${jsonCommand} — the staging's premise: exit 0, the ` +
          `operation performed as its home test performs it on this state ` +
          `(SPEC 6.4, 6.5, 12.0)`,
      ),
  );
  const report = decodePerformedOperationReport(
    parseJsonStdout(
      json,
      `${context}: ${jsonCommand} — a single JSON document as the entire ` +
        `stdout (SPEC 12.0)`,
    ),
    `${context}: ${jsonCommand}`,
  );
  const human = await onFreshCopy(
    workspace,
    `${context}: the state copied for ${humanCommand}`,
    (copy) =>
      expectExit(
        product,
        copy,
        argv,
        0,
        `${context}: ${humanCommand} — run without \`--json\` on a fresh ` +
          `copy of the same pre-invocation state, it exits as its ` +
          `\`--json\` twin did (0; SPEC 12.0: the output form never changes ` +
          `an exit code; TEST-SPEC T12.0-15, T12.0-2)`,
      ),
  );
  assertBytesEqual(
    human.stderrBytes,
    json.stderrBytes,
    `${context}: ${humanCommand} — its standard error byte-identical to its ` +
      `\`--json\` twin's (SPEC 12.0: the output form never changes ` +
      `standard-error content; T12.0-2)`,
  );
  assertHumanPerformedReportCarries(
    human,
    report,
    `${context}: ${humanCommand}`,
  );
}

/**
 * The performed reports (the module header): T6.4-1's rename and each of
 * T6.5-1's file moves, each staged as its home test stages it
 * (section-6.4.ts `T6_4_1_STAGING`, section-6.5.ts
 * `T6_5_1_FILE_MOVE_STAGINGS`: its files under its configuration, the
 * premise `build`), then the performed operation's human twin on fresh
 * copies of the built state.
 */
async function runPerformedTwins(product: ProductBinding): Promise<void> {
  const stagings: readonly PerformedOperationStaging[] = [
    T6_4_1_STAGING,
    ...T6_5_1_FILE_MOVE_STAGINGS,
  ];
  for (const staging of stagings) {
    const context = `T12.0-15 (${staging.name})`;
    await withStaging(staging.config, staging.files, async (workspace) => {
      await buildOk(
        product,
        workspace,
        `${context}: the premise \`build\` over the staged workspace (SPEC ` +
          `12.1)`,
      );
      await expectHumanPerformedTwin(product, workspace, staging.argv, context);
    });
  }
}

// ---------------------------------------------------------------------------
// `rename` and `move`: the refused real operations
// ---------------------------------------------------------------------------

/**
 * T12.0-15's twin of one refused real `rename`/`move` (the module header):
 * the findings twin (`expectHumanFindingsTwin`), exit 1, each form on its
 * own fresh byte copy of the state — the real operation is a mutating
 * command's run (13.5) — the workspace untouched, so the staging continues
 * as its own. Handed to T6.6-3's refusal stagings
 * (`runT663RefusalStagings`), it compares the two forms whatever the
 * refusal reports: the expected findings stay the home tests' premises.
 */
const expectHumanRefusalTwin: RefusalStagingTwin = async (
  product,
  workspace,
  argv,
  _expected,
  context,
) => {
  await expectHumanFindingsTwin(product, workspace, argv, context, {
    state: "fresh",
    expectedExit: 1,
  });
};

/**
 * The refused real operations of T6.4-3, T6.4-6, T6.5-4, T6.5-6, T6.5-16,
 * T6.5-17, T6.5-20, T6.5-21, and T14-7 (the module header): T6.4-6's
 * invalid-workspace arm on its own staging (section-6.4.ts
 * `stageT646InvalidWorkspace`: built, then specs/Other.mdx broken, 14.5),
 * then every refusal of T6.6-3's refusal stagings (section-6.6.ts
 * `runT663RefusalStagings`, staged as T6.6-3 stages each from its home
 * module's exports, T6.4-6's refused-writes staging among them), each
 * refused operation's human twin on fresh copies of its state.
 */
async function runRefusalTwins(product: ProductBinding): Promise<void> {
  const context = `T12.0-15 rename refusal (T6.4-6 ${T6_4_6_INVALID_WORKSPACE_CASE.reason})`;
  await withStaging(
    T6_4_6_INVALID_WORKSPACE_CONFIG,
    T6_4_6_INVALID_WORKSPACE_FILES,
    async (workspace) => {
      await stageT646InvalidWorkspace(
        product,
        workspace,
        "T12.0-15 (T6.4-6's invalid-workspace staging)",
      );
      await expectHumanRefusalTwin(
        product,
        workspace,
        T6_4_6_INVALID_WORKSPACE_CASE.argv,
        T6_4_6_INVALID_WORKSPACE_CASE.expected,
        context,
      );
    },
  );
  await runT663RefusalStagings(
    product,
    expectHumanRefusalTwin,
    "T12.0-15",
    "the refused operation and its human twin, each run on a fresh copy",
  );
}

// ---------------------------------------------------------------------------
// `impact`: the reports of T5.6-1 through T5.6-6 and T9-1 through T9.3-3
// ---------------------------------------------------------------------------

/**
 * T12.0-15's twin of one `impact --base <ref>` read at the state a staging
 * reached (the module header): inside one whole-root modifies-nothing
 * compare, the lock path compared — the staging built the workspace, so
 * graph data is current and the read refreshes nothing (SPEC 13.3), and
 * `impact` acquires nothing (13.5) — `impact --base <ref> --json`, exit 0,
 * the staging's premise (impact is informational, 9.3; its home test pins
 * the exit), decoded by the impact adapter; then `impact --base <ref>`, the
 * human form, exiting 0 as its twin, its standard error byte-identical
 * (SPEC 12.0; T12.0-2), its report decoded by the human impact decoder and
 * carrying the twin's information — each category of each entry with the
 * nodes the entry covers, its deletion, and its attribution, and each
 * impacted location of each group with its witness edge and path, as
 * multisets, order free (TEST-SPEC T12.0-15; SPEC 5.6, 9.1–9.3;
 * `assertHumanImpactReportCarries`).
 */
async function expectHumanImpactTwin(
  product: ProductBinding,
  workspace: TestWorkspace,
  ref: string,
  context: string,
): Promise<void> {
  const argv = ["impact", "--base", ref];
  const jsonArgv = [...argv, "--json"];
  const jsonCommand = `\`${jsonArgv.join(" ")}\``;
  const humanCommand = `\`${argv.join(" ")}\` (human report)`;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const json = await expectExit(
        product,
        workspace,
        jsonArgv,
        0,
        `${context}: ${jsonCommand} — the staging's premise: exit 0, impact ` +
          `is informational whether or not differences exist, as the home ` +
          `test pins it (SPEC 9.3, 12.0)`,
      );
      const report = decodeImpactReport(
        parseJsonStdout(
          json,
          `${context}: ${jsonCommand} — a single JSON document as the ` +
            `entire stdout (SPEC 12.0)`,
        ),
        `${context}: ${jsonCommand}`,
      );
      const human = await expectExit(
        product,
        workspace,
        argv,
        0,
        `${context}: ${humanCommand} — run without \`--json\` on the same ` +
          `pre-invocation state, it exits as its \`--json\` twin did (0; ` +
          `SPEC 12.0: the output form never changes an exit code; 9.3; ` +
          `TEST-SPEC T12.0-15, T12.0-2)`,
      );
      assertBytesEqual(
        human.stderrBytes,
        json.stderrBytes,
        `${context}: ${humanCommand} — its standard error byte-identical to ` +
          `its \`--json\` twin's (SPEC 12.0: the output form never changes ` +
          `standard-error content; T12.0-2)`,
      );
      assertHumanImpactReportCarries(
        human,
        report,
        `${context}: ${humanCommand}`,
      );
    },
    `${context}: ${jsonCommand} and its human twin on the same state — ` +
      `neither writes anything there, the lock path and \`.git\` included ` +
      `(SPEC 13.3: the staging built the workspace, so graph data is ` +
      `current and the read refreshes nothing; \`impact\` acquires ` +
      `nothing, 13.5; TEST-SPEC H-6, T12.0-11, T12.0-15)`,
  );
}

/**
 * The `impact` family (the module header): the stagings of T5.6-1 through
 * T5.6-6 (section-5.6.ts `T5_6_IMPACT_STAGINGS`), T9-1 through T9.2-5
 * (section-9.ts `T9_IMPACT_STAGINGS`), and T9.3-1 through T9.3-3
 * (section-9.3.ts `T9_3_IMPACT_STAGINGS`), each run as its home test runs
 * it, every `impact --base` read it reaches handed to the human twin in
 * place of the home test's own assertions.
 */
async function runImpactTwins(product: ProductBinding): Promise<void> {
  for (const staging of [
    ...T5_6_IMPACT_STAGINGS,
    ...T9_IMPACT_STAGINGS,
    ...T9_3_IMPACT_STAGINGS,
  ]) {
    await staging.run(product, async (workspace, read) => {
      await expectHumanImpactTwin(
        product,
        workspace,
        read.ref,
        `T12.0-15 (${read.label})`,
      );
    });
  }
}

// ---------------------------------------------------------------------------
// `review`: the listings of T10.7-5, the status reads of T10.7-6, and the
// subcommands naming each corrupt session of T10.1-4
// ---------------------------------------------------------------------------

/**
 * T12.0-15's twin of one `review list` read at the state T10.7-5's staging
 * reached (the module header): inside one whole-root modifies-nothing
 * compare, the lock path compared — the staging built the workspace, so
 * graph data is current and the read refreshes nothing (SPEC 13.3), and
 * `list` acquires nothing (13.5) — `review list --json`, its exit the
 * staging's premise (10.7: 1 iff any corrupt session exists, else 0, as
 * the home test pins it), decoded by the review adapter; then `review
 * list`, the human form, exiting as its twin, its standard error
 * byte-identical (SPEC 12.0; T12.0-2), its report decoded by the human
 * review-list decoder and carrying the twin's listing — every session's
 * name with its strategy and item counts by stored status, or its
 * corruption in their place, in the order 10.7 fixes, and each corrupt
 * session's condition-21 finding (TEST-SPEC T12.0-15; SPEC 10.7, 14.21;
 * `assertHumanSessionListReportCarries`).
 */
async function expectHumanListTwin(
  product: ProductBinding,
  workspace: TestWorkspace,
  expectedExit: number,
  context: string,
): Promise<void> {
  const argv = ["review", "list"];
  const jsonArgv = [...argv, "--json"];
  const jsonCommand = `\`${jsonArgv.join(" ")}\``;
  const humanCommand = `\`${argv.join(" ")}\` (human report)`;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const json = await expectExit(
        product,
        workspace,
        jsonArgv,
        expectedExit,
        `${context}: ${jsonCommand} — the staging's premise: exit ` +
          `${String(expectedExit)}, 1 iff any corrupt session exists, as the ` +
          `home test pins it (SPEC 10.7, 14.21, 12.0)`,
      );
      const listing = decodeSessionListReport(
        parseJsonStdout(
          json,
          `${context}: ${jsonCommand} — a single JSON document as the ` +
            `entire stdout (SPEC 12.0)`,
        ),
        `${context}: ${jsonCommand}`,
      );
      const human = await expectExit(
        product,
        workspace,
        argv,
        expectedExit,
        `${context}: ${humanCommand} — run without \`--json\` on the same ` +
          `pre-invocation state, it exits as its \`--json\` twin did ` +
          `(${String(expectedExit)}; SPEC 12.0: the output form never ` +
          `changes an exit code; TEST-SPEC T12.0-15, T12.0-2)`,
      );
      assertBytesEqual(
        human.stderrBytes,
        json.stderrBytes,
        `${context}: ${humanCommand} — its standard error byte-identical to ` +
          `its \`--json\` twin's (SPEC 12.0: the output form never changes ` +
          `standard-error content; T12.0-2)`,
      );
      assertHumanSessionListReportCarries(
        human,
        listing,
        `${context}: ${humanCommand}`,
      );
    },
    `${context}: ${jsonCommand} and its human twin on the same state — ` +
      `neither writes anything there, the lock path included (SPEC 13.3: ` +
      `the staging built the workspace, so graph data is current and the ` +
      `read refreshes nothing; 10.4: reads never write a session; \`list\` ` +
      `acquires nothing, 13.5; TEST-SPEC H-6, T12.0-15)`,
  );
}

/**
 * T12.0-15's twin of one `review status <session>` read at the state
 * T10.7-6's staging reached (the module header): inside one whole-root
 * modifies-nothing compare, the lock path compared — the staging built the
 * workspace, so graph data is current and the read refreshes nothing (SPEC
 * 13.3); reads never write the session (10.4) and acquire nothing (13.5) —
 * `review status <session> --json`, exit 0 (the staging's premise, the
 * home test pinning it), decoded by the review adapter; then the human
 * form, exiting 0 as its twin, its standard error byte-identical (SPEC
 * 12.0; T12.0-2), its report decoded by the human review-status decoder
 * and carrying the twin's report — every item's id, kind, scope node,
 * status, and blocked state in item order, and the totals by status
 * (TEST-SPEC T12.0-15; SPEC 10.7; `assertHumanSessionStatusReportCarries`).
 */
async function expectHumanStatusTwin(
  product: ProductBinding,
  workspace: TestWorkspace,
  session: string,
  context: string,
): Promise<void> {
  const argv = ["review", "status", session];
  const jsonArgv = [...argv, "--json"];
  const jsonCommand = `\`${jsonArgv.join(" ")}\``;
  const humanCommand = `\`${argv.join(" ")}\` (human report)`;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const json = await expectExit(
        product,
        workspace,
        jsonArgv,
        0,
        `${context}: ${jsonCommand} — the staging's premise: exit 0, a read ` +
          `of a healthy session, as the home test pins it (SPEC 10.7, 12.0)`,
      );
      const report = decodeSessionStatusReport(
        parseJsonStdout(
          json,
          `${context}: ${jsonCommand} — a single JSON document as the ` +
            `entire stdout (SPEC 12.0)`,
        ),
        `${context}: ${jsonCommand}`,
      );
      const human = await expectExit(
        product,
        workspace,
        argv,
        0,
        `${context}: ${humanCommand} — run without \`--json\` on the same ` +
          `pre-invocation state, it exits as its \`--json\` twin did (0; ` +
          `SPEC 12.0: the output form never changes an exit code; TEST-SPEC ` +
          `T12.0-15, T12.0-2)`,
      );
      assertBytesEqual(
        human.stderrBytes,
        json.stderrBytes,
        `${context}: ${humanCommand} — its standard error byte-identical to ` +
          `its \`--json\` twin's (SPEC 12.0: the output form never changes ` +
          `standard-error content; T12.0-2)`,
      );
      assertHumanSessionStatusReportCarries(
        human,
        report,
        `${context}: ${humanCommand}`,
      );
    },
    `${context}: ${jsonCommand} and its human twin on the same state — ` +
      `neither writes anything there, the lock path included (SPEC 13.3: ` +
      `the staging built the workspace, so graph data is current and the ` +
      `read refreshes nothing; 10.4: reads never write the session file; ` +
      `\`status\` acquires nothing, 13.5; TEST-SPEC H-6, T12.0-15)`,
  );
}

/**
 * The `review` family's listings and status reads (the module header):
 * T10.7-5's staging (section-10.7-i.ts `runT1075Listings`), its clean and
 * corrupt listings each handed to the `review list` twin, then T10.7-6's
 * (`runT1076Stages`), each of its four stages' `review status s` read
 * handed to the `review status` twin — in place of the home tests' own
 * assertions, the staging between the reads theirs.
 */
async function runListingAndStatusTwins(
  product: ProductBinding,
): Promise<void> {
  await runT1075Listings(
    product,
    async (workspace, listing) => {
      await expectHumanListTwin(
        product,
        workspace,
        listing.expectedExit,
        listing.label,
      );
    },
    "T12.0-15 (T10.7-5)",
  );
  await runT1076Stages(
    product,
    async (workspace, stage) => {
      await expectHumanStatusTwin(
        product,
        workspace,
        stage.session,
        stage.label,
      );
    },
    "T12.0-15 (T10.7-6)",
  );
}

/**
 * T12.0-15's twin of one `review next <session>` read at the state
 * T10.7-7's staging reached (the module header): inside one whole-root
 * modifies-nothing compare, the lock path and `.git` compared — the
 * staging built the workspace, so graph data is current and the read
 * refreshes nothing (SPEC 13.3); reads never write the session (10.4) and
 * acquire nothing (13.5) — `review next <session> --json`, exit 0 (the
 * staging's premise, a read of a healthy session, as the home test pins
 * it), decoded by the review adapter; then the human form, exiting 0 as
 * its twin, its standard error byte-identical (SPEC 12.0; T12.0-2), its
 * report decoded by the human review-next decoder and carrying the twin's
 * answer — the session fully resolved exactly where the twin reports it
 * so, else the item returned: its id, kind, status, blocked state,
 * blockers, note, and a reason — `next --json`'s self-contained payload
 * being the JSON form's alone (TEST-SPEC T12.0-15; SPEC 10.7;
 * `assertHumanNextReportCarries`).
 */
async function expectHumanNextTwin(
  product: ProductBinding,
  workspace: TestWorkspace,
  session: string,
  context: string,
): Promise<void> {
  const argv = ["review", "next", session];
  const jsonArgv = [...argv, "--json"];
  const jsonCommand = `\`${jsonArgv.join(" ")}\``;
  const humanCommand = `\`${argv.join(" ")}\` (human report)`;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const json = await expectExit(
        product,
        workspace,
        jsonArgv,
        0,
        `${context}: ${jsonCommand} — the staging's premise: exit 0, a read ` +
          `of a healthy session — the item returned, or the session fully ` +
          `resolved — as the home test pins it (SPEC 10.7, 12.0)`,
      );
      const report = decodeNextReport(
        parseJsonStdout(
          json,
          `${context}: ${jsonCommand} — a single JSON document as the ` +
            `entire stdout (SPEC 12.0)`,
        ),
        `${context}: ${jsonCommand}`,
      );
      const human = await expectExit(
        product,
        workspace,
        argv,
        0,
        `${context}: ${humanCommand} — run without \`--json\` on the same ` +
          `pre-invocation state, it exits as its \`--json\` twin did (0; ` +
          `SPEC 12.0: the output form never changes an exit code; 10.7: a ` +
          `fully-resolved session exits 0 in both forms; TEST-SPEC T12.0-15, ` +
          `T12.0-2)`,
      );
      assertBytesEqual(
        human.stderrBytes,
        json.stderrBytes,
        `${context}: ${humanCommand} — its standard error byte-identical to ` +
          `its \`--json\` twin's (SPEC 12.0: the output form never changes ` +
          `standard-error content; T12.0-2)`,
      );
      assertHumanNextReportCarries(
        human,
        report,
        `${context}: ${humanCommand}`,
      );
    },
    `${context}: ${jsonCommand} and its human twin on the same state — ` +
      `neither writes anything there, the lock path and \`.git\` included ` +
      `(SPEC 13.3: the staging built the workspace, so graph data is ` +
      `current and the read refreshes nothing; 10.4: reads never write the ` +
      `session file; \`next\` acquires nothing, 13.5; TEST-SPEC H-6, ` +
      `T12.0-11, T12.0-15)`,
  );
}

/**
 * T12.0-15's twin of one `review show <session> <item-id>` read at the
 * state T10.7-8's staging reached (the module header): inside one
 * whole-root modifies-nothing compare, the lock path compared — the
 * staging built the workspace, so graph data is current and the read
 * refreshes nothing (SPEC 13.3); reads never write the session (10.4) and
 * acquire nothing (13.5) — `review show <session> <item-id> --json`, exit 0
 * (the staging's premise, the item the home test reads there), decoded by
 * the review adapter; then the human form, exiting 0 as its twin, its
 * standard error byte-identical (SPEC 12.0; T12.0-2), its report decoded by
 * the human review-item decoder and carrying the twin's full item — its
 * id, kind, status, blocked state, blockers, note, and a reason; its scope
 * node's identity, presence, source range, and text; each context and
 * origin entry with its presence, range, and text, an origin entry's
 * before and after sides; and the `baseline` and `current` recorded
 * states, each node's presence and hashes or absent marker (TEST-SPEC
 * T12.0-15: the full item with its text payload; SPEC 10.2, 10.7;
 * `assertHumanItemReportCarries`).
 */
async function expectHumanShowTwin(
  product: ProductBinding,
  workspace: TestWorkspace,
  session: string,
  itemId: string,
  context: string,
): Promise<void> {
  const argv = ["review", "show", session, itemId];
  const jsonArgv = [...argv, "--json"];
  const jsonCommand = `\`${jsonArgv.join(" ")}\``;
  const humanCommand = `\`${argv.join(" ")}\` (human report)`;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const json = await expectExit(
        product,
        workspace,
        jsonArgv,
        0,
        `${context}: ${jsonCommand} — the staging's premise: exit 0, a read ` +
          `of an item of a healthy session, as the home test pins it (SPEC ` +
          `10.7, 12.0)`,
      );
      const item = decodeItemReport(
        parseJsonStdout(
          json,
          `${context}: ${jsonCommand} — a single JSON document as the ` +
            `entire stdout (SPEC 12.0)`,
        ),
        `${context}: ${jsonCommand}`,
      );
      const human = await expectExit(
        product,
        workspace,
        argv,
        0,
        `${context}: ${humanCommand} — run without \`--json\` on the same ` +
          `pre-invocation state, it exits as its \`--json\` twin did (0; ` +
          `SPEC 12.0: the output form never changes an exit code; TEST-SPEC ` +
          `T12.0-15, T12.0-2)`,
      );
      assertBytesEqual(
        human.stderrBytes,
        json.stderrBytes,
        `${context}: ${humanCommand} — its standard error byte-identical to ` +
          `its \`--json\` twin's (SPEC 12.0: the output form never changes ` +
          `standard-error content; T12.0-2)`,
      );
      assertHumanItemReportCarries(human, item, `${context}: ${humanCommand}`);
    },
    `${context}: ${jsonCommand} and its human twin on the same state — ` +
      `neither writes anything there, the lock path included (SPEC 13.3: ` +
      `the staging built the workspace, so graph data is current and the ` +
      `read refreshes nothing; 10.4: reads never write the session file; ` +
      `\`show\` acquires nothing, 13.5; TEST-SPEC H-6, T12.0-15)`,
  );
}

/**
 * The `review` family's `next` reads (the module header): T10.7-7's staging
 * (section-10.7-ii.ts `runT1077Reads`), each `review next s` read it
 * reaches — the order arm's four items and its fully-resolved report, the
 * full-resolution arm's fully-resolved report and the new section's item,
 * the empty session's fully-resolved report, and the payload arm's four
 * reads — handed to the `review next` twin in place of the home test's own
 * assertions, the staging between the reads its own.
 */
async function runNextTwins(product: ProductBinding): Promise<void> {
  await runT1077Reads(
    product,
    async (workspace, read) => {
      await expectHumanNextTwin(product, workspace, read.session, read.label);
    },
    "T12.0-15 (T10.7-7)",
  );
}

/**
 * The `review` family's `show` reads (the module header): T10.7-8's staging
 * (section-10.7-ii.ts `runT1078ShowReads`), its two `review show s <item>`
 * reads — x.k's item and the root's — handed to the `review show` twin in
 * place of the home test's own assertions; T10.7-8's continuation (its
 * split, `export`, unknown ids, and invalidation) is its own.
 */
async function runShowTwins(product: ProductBinding): Promise<void> {
  await runT1078ShowReads(
    product,
    async (workspace, read) => {
      await expectHumanShowTwin(
        product,
        workspace,
        read.session,
        read.itemId,
        read.label,
      );
    },
    "T12.0-15 (T10.7-8)",
  );
}

// ---------------------------------------------------------------------------
// `review`: the refusals of T10.7-1, T10.7-9, and T10.7-10
// ---------------------------------------------------------------------------

/**
 * The `review` family's refusals (the module header): T10.7-1's staging
 * (section-10.7-i.ts `runT1071Stagings`), T10.7-9's (section-10.7-ii.ts
 * `runT1079Stagings`), and T10.7-10's (`runT10710Stagings`), each run with
 * a refusal visitor whose `home` is false — the stagings' other assertions
 * the home tests' own — every refused `create`, `split`, and `resolve` it
 * reaches handed to the findings twin in place of the home test's check:
 * exit 1, the staging's premise (a refused review operation, 10.7, as the
 * home test pins it), each form on its own fresh copy of the state (a
 * refused mutating subcommand's run, 13.5), the human findings report
 * carrying the refusal's every finding as its `--json` twin's.
 */
async function runReviewRefusalTwins(product: ProductBinding): Promise<void> {
  const visitor: ReviewRefusalVisitor = {
    home: false,
    refusal: async (workspace, refusal) => {
      await expectHumanFindingsTwin(
        product,
        workspace,
        refusal.argv,
        refusal.label,
        { state: "fresh", expectedExit: 1 },
      );
    },
  };
  await runT1071Stagings(product, visitor, "T12.0-15 (T10.7-1)");
  await runT1079Stagings(product, visitor, "T12.0-15 (T10.7-9)");
  await runT10710Stagings(product, visitor, "T12.0-15 (T10.7-10)");
}

/**
 * The subcommands naming each corrupt session of T10.1-4 (the module
 * header): every corrupt state (section-10.1.ts `T10_1_4_CORRUPT_STATES`),
 * each staged on a fresh workspace of its own as T10.1-4 stages it, then
 * the human twin of every subcommand of T10.1-4's list
 * (`t1014NamingSubcommands`) with a human form — `status`, `next`, and
 * `show` on the same state, `resolve` and `split`, mutating subcommands,
 * each form on its own fresh copy — exit 1, the corruption the report
 * (SPEC 10.1, 14.21): its condition-21 finding's code and concerned path
 * as the `--json` twin's. `export`, JSON-only (10.7), has no human form.
 */
async function runCorruptNamingTwins(product: ProductBinding): Promise<void> {
  for (const corrupt of T10_1_4_CORRUPT_STATES) {
    const context = `T12.0-15 (T10.1-4 [${corrupt.state}])`;
    const workspace = await TestWorkspace.create({ files: corrupt.files });
    try {
      const staged = await corrupt.stage(product, workspace, context);
      for (const naming of t1014NamingSubcommands(
        staged.session,
        staged.itemId,
      )) {
        if (naming.jsonOnly) continue;
        await expectHumanFindingsTwin(
          product,
          workspace,
          naming.argv,
          context,
          {
            state: naming.mutating ? "fresh" : "same",
            expectedExit: 1,
          },
        );
      }
    } finally {
      await workspace.dispose();
    }
  }
}

// ---------------------------------------------------------------------------
// `coverage`, `ids`, and `show`: T8.2-1's, T12.3-1's, and T12.4-1's reads
// ---------------------------------------------------------------------------

/**
 * How one informational read's two forms are judged (the module header):
 * the premise naming why its `--json` run exits as the home test pins it,
 * the `--json` decode, and the human report's decode and comparison with
 * it.
 */
interface HumanReadTwin<T> {
  /** Why the `--json` run exits as it does, the staging's premise. */
  readonly premise: string;
  /** The `--json` document's decode (H-3). */
  readonly decode: (doc: unknown, context: string) => T;
  /** The human report's decode and comparison with the decoded twin. */
  readonly carries: (human: RunResult, json: T, context: string) => unknown;
}

/**
 * T12.0-15's twin of one informational read — a `coverage`, `ids`, or
 * `show` invocation — at the state its home test's staging reached (the
 * module header): inside one whole-root modifies-nothing compare, the lock
 * path compared — the staging built the workspace, so graph data is current
 * and the read refreshes nothing (SPEC 13.3), and none of these reads
 * acquires (13.5) — `argv` with `--json`, its exit `expectedExit` (the
 * staging's premise, as the home test pins it), decoded by `read.decode`;
 * then `argv` itself, the human form, exiting alike, its standard error
 * byte-identical (SPEC 12.0: the output form never changes an exit code or
 * standard-error content; T12.0-2), its report decoded by the human-report
 * decoder and carrying the twin's information (`read.carries`; TEST-SPEC
 * T12.0-15).
 */
async function expectHumanReadTwin<T>(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  expectedExit: number,
  read: HumanReadTwin<T>,
  context: string,
): Promise<void> {
  const jsonArgv = [...argv, "--json"];
  const jsonCommand = `\`${jsonArgv.join(" ")}\``;
  const humanCommand = `\`${argv.join(" ")}\` (human report)`;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const json = await expectExit(
        product,
        workspace,
        jsonArgv,
        expectedExit,
        `${context}: ${jsonCommand} — the staging's premise: exit ` +
          `${String(expectedExit)}, ${read.premise}`,
      );
      const decoded = read.decode(
        parseJsonStdout(
          json,
          `${context}: ${jsonCommand} — a single JSON document as the ` +
            `entire stdout (SPEC 12.0)`,
        ),
        `${context}: ${jsonCommand}`,
      );
      const human = await expectExit(
        product,
        workspace,
        argv,
        expectedExit,
        `${context}: ${humanCommand} — run without \`--json\` on the same ` +
          `pre-invocation state, it exits as its \`--json\` twin did ` +
          `(${String(expectedExit)}; SPEC 12.0: the output form never ` +
          `changes an exit code; TEST-SPEC T12.0-15, T12.0-2)`,
      );
      assertBytesEqual(
        human.stderrBytes,
        json.stderrBytes,
        `${context}: ${humanCommand} — its standard error byte-identical to ` +
          `its \`--json\` twin's (SPEC 12.0: the output form never changes ` +
          `standard-error content; T12.0-2)`,
      );
      read.carries(human, decoded, `${context}: ${humanCommand}`);
    },
    `${context}: ${jsonCommand} and its human twin on the same state — ` +
      `neither writes anything there, the lock path included (SPEC 13.3: ` +
      `the staging built the workspace, so graph data is current and the ` +
      `read refreshes nothing; the read acquires nothing, 13.5; TEST-SPEC ` +
      `H-6, T12.0-15)`,
  );
}

/**
 * The `coverage` family (the module header): T8.2-1's staging (section-8.ts
 * `runT821Reads`), each `coverage` read it reaches — the default run,
 * `coverage prof-aux`, `coverage --check`, and the covered fixture's
 * `coverage --check` — handed to the twin in place of the home test's own
 * assertions, the human report carrying every profile's counts, node
 * identities, covering paths, and ignored nodes' reasons, the reasons in
 * the order 8.2 fixes (`assertHumanCoverageReportCarries`).
 */
async function runCoverageTwins(product: ProductBinding): Promise<void> {
  await runT821Reads(
    product,
    async (workspace, read) => {
      await expectHumanReadTwin(
        product,
        workspace,
        read.argv,
        read.expectedExit,
        {
          premise:
            "as the home test pins it — with `--check`, 1 iff a required " +
            "node is uncovered, else 0; without it, 0, an informational " +
            "report (SPEC 8.2, 12.0)",
          decode: decodeCoverageReport,
          carries: assertHumanCoverageReportCarries,
        },
        read.label,
      );
    },
    "T12.0-15 (T8.2-1)",
  );
}

/**
 * The `ids` family (the module header): T12.3-1's staging
 * (section-12.3-12.5.ts `runT1231Listings`) with a visitor whose `home` is
 * false — its outside-root `--file` arms, plain usage errors, left to the
 * home test — each listing it reaches, flat or tree, handed to the twin in
 * place of the home test's own assertions, the human listing carrying the
 * twin's entries entry for entry in the order 12.3 fixes
 * (`assertHumanIdsReportCarries`, `assertHumanIdsTreeReportCarries`).
 */
async function runIdsTwins(product: ProductBinding): Promise<void> {
  const premise =
    "an informational listing, as the home test pins it (SPEC 12.3, 12.0)";
  await runT1231Listings(
    product,
    {
      home: false,
      listing: async (workspace, listing) => {
        if (listing.tree) {
          await expectHumanReadTwin(
            product,
            workspace,
            listing.argv,
            0,
            {
              premise,
              decode: decodeIdsTreeReport,
              carries: assertHumanIdsTreeReportCarries,
            },
            listing.label,
          );
          return;
        }
        await expectHumanReadTwin(
          product,
          workspace,
          listing.argv,
          0,
          {
            premise,
            decode: decodeIdsReport,
            carries: assertHumanIdsReportCarries,
          },
          listing.label,
        );
      },
    },
    "T12.0-15 (T12.3-1)",
  );
}

/**
 * The `show` family (the module header): T12.4-1's staging
 * (section-12.3-12.5.ts `runT1241Shows`), its non-root and root arms'
 * `show` reads handed to the twin in place of the home test's own
 * assertions, the human report carrying the full 12.4 enumeration
 * (`assertHumanNodeReportCarries`).
 */
async function runNodeShowTwins(product: ProductBinding): Promise<void> {
  await runT1241Shows(
    product,
    async (workspace, show) => {
      await expectHumanReadTwin(
        product,
        workspace,
        ["show", show.node],
        0,
        {
          premise:
            "an informational report, as the home test pins it (SPEC 12.4, " +
            "12.0)",
          decode: decodeNodeReport,
          carries: assertHumanNodeReportCarries,
        },
        show.label,
      );
    },
    "T12.0-15 (T12.4-1)",
  );
}

// ---------------------------------------------------------------------------
// The exit-2 errors: T12.7-3's configuration errors, T6.3-6's journal errors
// at a given baseline, and T13.5-2's busy workspace
// ---------------------------------------------------------------------------

/**
 * T12.0-15's twin of one exit-2 invocation at the state its home test's
 * staging reached (the module header): inside one whole-root
 * modifies-nothing compare under `invocation.root` (an exit-2 run modifies
 * nothing; acquisition's coordination writes at the lock path aside, H-6 —
 * and `invocation.exclude` left out of both walks where given, T14-10(i)'s
 * lock path, as its home test leaves it out),
 * the command line with `--json` — exit 2, the staging's premise, as the
 * home test pins it — its stdout decoded form-exact as the error document
 * (SPEC 12.7); then the command line without it, the human form, on the
 * same pre-invocation state (`invocation.run`: the same working directory,
 * environment, and staging), exiting 2 as its twin, standard output empty
 * (SPEC 12.0: with JSON output not in effect, an exit-2 error leaves
 * standard output empty), standard error byte-identical (12.0: the output
 * form never changes standard-error content; T12.0-2), and its message —
 * the error's only report — decoded by the exit-2 adapter and carrying the
 * stable code and the concerned path the twin's error document carries
 * (TEST-SPEC T12.0-15, H-5; `assertHumanErrorMessageCarries`: a code-less
 * twin, a plain usage error, asserted for neither, 14). Each run's
 * `settled` premise is checked as it ends, before anything is asserted on
 * it.
 */
async function expectHumanErrorTwin(
  invocation: ErrorInvocation,
): Promise<void> {
  const context = `T12.0-15 (${invocation.label})`;
  const jsonCommand = `\`${invocation.jsonArgv.join(" ")}\``;
  const humanCommand = `\`${invocation.argv.join(" ")}\` (human form)`;
  await assertLeavesUnchanged(
    invocation.root,
    async () => {
      const json = await invocation.run(invocation.jsonArgv);
      await invocation.settled?.(json, `${context}: ${jsonCommand}`);
      assertExitCode(
        json,
        2,
        `${context}: ${jsonCommand} — the staging's premise: exit 2, a ` +
          `usage or configuration error, as the home test pins it (SPEC ` +
          `12.0)`,
      );
      const error = expectErrorDocument(json, `${context}: ${jsonCommand}`);
      const human = await invocation.run(invocation.argv);
      await invocation.settled?.(human, `${context}: ${humanCommand}`);
      assertExitCode(
        human,
        2,
        `${context}: ${humanCommand} — run without \`--json\` on the same ` +
          `pre-invocation state, it exits as its \`--json\` twin did (2; ` +
          `SPEC 12.0: the output form never changes an exit code; TEST-SPEC ` +
          `T12.0-15, T12.0-2)`,
      );
      assertStdoutEmpty(
        human,
        `${context}: ${humanCommand} — without JSON output in effect, an ` +
          `exit-2 error leaves standard output empty (SPEC 12.0; TEST-SPEC ` +
          `T12.0-15, H-5)`,
      );
      assertBytesEqual(
        human.stderrBytes,
        json.stderrBytes,
        `${context}: ${humanCommand} — its standard error byte-identical to ` +
          `its \`--json\` twin's (SPEC 12.0: the output form never changes ` +
          `standard-error content; T12.0-2)`,
      );
      assertHumanErrorMessageCarries(
        human,
        { code: error.code, path: error.path },
        `${context}: ${humanCommand}`,
      );
    },
    `${context}: ${jsonCommand} and its human twin on the same state — ` +
      `neither modifies anything (SPEC 12.0: an exit-2 error; 12.1: a build ` +
      `failing at configuration load modifies nothing; 6.3: a given ` +
      `baseline's resolution failing modifies nothing; 13.5: a busy ` +
      `refusal modifies nothing; 14.25: a command stops at a refused read, ` +
      `attempting nothing further — acquisition's own writes at the lock ` +
      `path aside, H-6; TEST-SPEC T12.0-15)`,
    invocation.exclude === undefined ? {} : { exclude: invocation.exclude },
  );
}

/**
 * T12.0-15's visitor of the exit-2 stagings (support.ts
 * `ErrorInvocationVisitor`): its human twin at each exit-2 invocation
 * (`expectHumanErrorTwin`) in place of the home test's own check, and
 * nothing beside it — the stagings' other assertions are the home tests'.
 */
const HUMAN_ERROR_TWINS: ErrorInvocationVisitor = {
  error: (invocation) => expectHumanErrorTwin(invocation),
  home: false,
};

/**
 * The configuration errors (the module header): T12.7-3's
 * configuration-error stagings (section-12.7.ts
 * `runT1273ConfigurationErrorStagings`), each `build --json` they run —
 * every concerned-path form: the found file, `.` for a failed upward
 * search, and `--config`'s canonical anchoring and as-given forms — handed
 * to the twin, the human message carrying `configuration-error` and the
 * concerned path as its twin's error document does (SPEC 14, 14.14).
 */
async function runConfigurationErrorTwins(
  product: ProductBinding,
): Promise<void> {
  await runT1273ConfigurationErrorStagings(product, HUMAN_ERROR_TWINS);
}

/**
 * The journal errors at a given baseline (the module header): T6.3-6's
 * stagings (a)–(d) (section-6.3.ts `runT636JournalErrorStagings`), each
 * `impact --base` and `review create --base … --name n` run handed to the
 * twin under its arm's staging, the human message carrying condition 13's
 * code and concerned path as its twin's error document does (SPEC 6.3,
 * 14.13).
 */
async function runJournalErrorTwins(product: ProductBinding): Promise<void> {
  await runT636JournalErrorStagings(product, HUMAN_ERROR_TWINS);
}

/**
 * The busy workspace (the module header): T13.5-2's held run
 * (section-13.5.ts `runT1352HeldRun`), each excluded mutating command run
 * while command 1 holds handed to the twin — each form bounded and exiting
 * while command 1 still holds — the human message carrying
 * `workspace-busy` and the lock path as its twin's error document does
 * (SPEC 13.5, 14.26).
 */
async function runBusyRefusalTwins(product: ProductBinding): Promise<void> {
  await runT1352HeldRun(product, HUMAN_ERROR_TWINS, "T13.5-2");
}

/**
 * The exit-2 read failures and the errors beside them (the module header):
 * T14-10's exit-2 stagings (section-14-ii.ts `runT1410ReadFailureStagings`:
 * (b)'s given baselines, (d)'s configuration errors, (g)'s refused
 * discovery listing and its precedence arms, (h)'s session-directory
 * listings, (i)'s acquisition and second-discovery read failures, (k)'s
 * entered-directory sweeps, and (l)'s kind halves), each exit-2 invocation
 * with a human form handed to the twin, the human message carrying
 * `read-failure` — or the configuration error's, the journal error's, or
 * a write failure's code where the staging meets one — and the concerned
 * path as its twin's error document does, a plain usage error's asserted
 * for neither (SPEC 14.25, 14.14, 6.3, 14.24, 14). Linux leg only (E-1).
 */
async function runReadFailureTwins(product: ProductBinding): Promise<void> {
  await runT1410ReadFailureStagings(product, HUMAN_ERROR_TWINS);
}

// ---------------------------------------------------------------------------
// T12.0-15
// ---------------------------------------------------------------------------

const T12_0_15 = defineProductTest({
  id: "T12.0-15",
  title:
    "human-form reports — this registration's families: `build` and `check` on T14-11's per-condition fixtures, T12.2-2's per-family workspaces, and T1.5-2's every arm (its located arm included), and each gated read and mutating `review` subcommand on T13.3-3's stagings but `query` (JSON-only), each run again without `--json` on the same pre-invocation state (a fresh copy of it for a mutating command or a run that writes), exit as its `--json` twin, standard error byte-identical, its report — decoded by the human findings decoder — carrying every finding's stable code, locations (each file and its range's two byte offsets), concerned path, and identities as its twin does, order free, messages never compared, a human report printing nothing or omitting or changing any datum failing; and on T1.5-2's arms every reported path presented as 12.0 fixes, whatever the twin carries — the non-UTF-8 path (the condition-19 finding's concerned path, the located arm's location file) explicitly marked, the adapter recovering its exact bytes by the mark alone, each such report byte-identical across two runs on the same state, and every valid-UTF-8 path (the `#` and U+FFFD arms') a plain string, never marked; `rename` and `move` — the performed reports of T6.4-1's rename and T6.5-1's five file moves, staged as their home tests stage them and built, each form run on its own fresh copy of the built state, the human run exiting 0 as its `--json` twin, standard error byte-identical, its report — decoded by the human performed-report decoder — carrying the applied mapping the form-exact performed-operation document carries, every pair's `from` and `to` identity, a multiset, order free, a pair omitted, changed, or listed beside the twin's failing (the previews are T6.6-7's); and the refused real operations of T6.4-3, T6.4-6, T6.5-4, T6.5-6, T6.5-16, T6.5-17, T6.5-20, T6.5-21, and T14-7 — T6.4-6's invalid-workspace arm and every refusal of T6.6-3's refusal stagings, staged as T6.6-3 stages each from its home module, T6.4-6's refused-writes staging among them — each form on its own fresh copy of the state, exit 1, the human findings report carrying every refusal finding's code, locations, concerned path, and identities, and the invalid-workspace refusal's findings each under its own condition's code, a human refusal printing nothing or omitting any of them failing; `impact` — every `impact --base <ref>` read of the stagings of T5.6-1 through T5.6-6 and T9-1 through T9.3-3, run as their home tests run them, the read and its human twin on the same built state, exit 0 each, standard error byte-identical, the human report — decoded by the human impact decoder — carrying each category with its attribution, the collapsed chains, deleted nodes under their baseline identities, and each impacted location under its group with its witness edge and path as the `--json` twin does, order free, a datum omitted, changed, or misplaced failing; `review` — the human `review list` at T10.7-5's clean and corrupt listings and `review status s` at T10.7-6's four stages, staged as their home tests stage them, each run on the same built state as its `--json` twin and exiting as it (`list` 1 iff a session is corrupt, else 0; `status` 0), standard error byte-identical, the human report — decoded by the human review-list or review-status decoder — carrying every session's name with its strategy and item counts by stored status, or its corruption in their place, and each corrupt session's condition-21 finding, or every item's id, kind, scope, status, and blocked state and the totals by status, the sessions and the items in the order 10.7 fixes, a datum omitted, changed, or misordered failing; the human `review next s` at each read of T10.7-7's staging — the order walk's four items and its fully-resolved report, the full-resolution arm's fully-resolved report and new section's item, the empty session's fully-resolved report, and the payload walk's four reads — and the human `review show s <item>` at T10.7-8's two reads, x.k's item and the root's, staged as their home tests stage them, each run on the same built state as its `--json` twin, exit 0 each, standard error byte-identical, the human report — decoded by the human review-next or review-item decoder — reporting the session fully resolved exactly where the twin does, else carrying the item's id, kind, status, blocked state, blockers, note, and a reason (its wording never compared; `next --json`'s self-contained payload the JSON form's alone), and for `show` also the scope node's identity, presence, source range, and text, each context and origin entry with its presence, range, text, and before and after sides, and the `baseline` and `current` recorded states, each node's presence and hashes or absent marker, order free, a datum omitted or changed failing; the refusals of T10.7-1 — `create` naming an existing session, naming one under each of T10.1-4's corruptions, naming a corrupt one ignoring ASCII case alone, and on the Linux leg naming a case pair, both corrupt, one of them corrupt, or both valid — of T10.7-9 — `split` of an item of another kind or of a `subtree-coherence` item whose scope root has no children, on its path-blocks and audit fixtures and in its Q session — and of T10.7-10 — `resolve` of a blocked item — staged as their home tests stage them, the home tests' other assertions theirs, each form run on its own fresh copy of the state, exit 1, the human findings report carrying every refusal finding's code, locations, concerned path, and identities as its twin does, a code-less refusal's and a corruption's condition-21 finding alike; and `status`, `next`, `show`, `resolve`, and `split` naming the corrupt session of each of T10.1-4's states, staged as T10.1-4 stages them, exit 1, each mutating subcommand's two forms on their own fresh copies, the human findings report carrying the condition-21 finding's code and concerned path as its twin does; `coverage` — every read of T8.2-1's staging (the default run, `coverage prof-aux`, `coverage --check`, and the covered fixture's `coverage --check`) — `ids` — every listing of T12.3-1's staging at exit 0, flat and `--tree` — and `show` — T12.4-1's non-root and root arms — staged as their home tests stage them, each run on the same built state as its `--json` twin and exiting as it (`coverage --check` 1 iff a required node is uncovered, else 0; every other read 0), standard error byte-identical, the human report — decoded by the human coverage, ids, ids tree, or show decoder — carrying every profile's counts, node identities, covering paths, and ignored nodes' reasons, the reasons in 8.2's fixed order; every entry of the listing, an empty one included, in byte order of path, its IDs in document order or nested as the twin's tree; or the identity, source range, own and subtree text, hashes, tags and coverage attribute — a root's absent — and edges by kind, a datum omitted, changed, or misordered failing; and exit-2 errors — each configuration error of T12.7-3's stagings (the found file from the root and from a nested working directory; `--config` naming the broken file with a `./` segment; from `work/`, `--config` naming no file and then the malformed file, each as spelled, non-canonically, and absolutely; the failed upward search's `.` from the root and from a nested working directory; the three-defect file; and on the Linux leg `--config` from a symbolic-link working directory), each journal error at a given baseline of T6.3-6's (a)–(d) at `impact --base` and `review create --base`, each busy refusal of T13.5-2's held run, and on the Linux leg each exit-2 invocation with a human form of T14-10's stagings — (b)'s given baselines on the unreadable journal (`impact --base`, `review create --base`), (d)'s configuration errors on the unreadable configuration file (`build`, `ids`), (g)'s refused listing of specs/sub (`build`, `check`, `ids`, `review list`, a `rename`) with its precedence arms (`coverage <unknown-profile>`, the syntax class's `ids extra` and `ids --file ../x`, a source failing validation, and the invalid configuration preceding the read), (h)'s refused listing of .xspec/reviews (`review list`, `check`), (i)'s acquisition stagings at the lock path (`rename`, `move`, `review create`, `resolve`, `split`) and the second discovery's refused specs/sub during a held `rename`, (k)'s entered mode-000 working directory, configured and bare (`build`, `ids`, `coverage <unknown-profile>`, `ids extra`), and (l)'s kind halves (.xspec's `build`, `ids`, and `impact --base`, and on its failing twin `build`, `ids`, and `check`; .xspec/reviews's `review status`; the entered root's `build` and `ids` with `--config`), its JSON-only surfaces' runs and (j)'s plain git-data errors left to T14-10 — staged as their home tests stage them, each run again without `--json` on the same pre-invocation state (at T14-10(i) the lock path an earlier run left cleared before the staging is made again), exiting 2 as its twin with standard output empty and standard error byte-identical, its standard-error message — decoded by the exit-2 adapter — carrying the stable code and the concerned path its twin's error document carries, a message omitting either failing, a plain usage error's asserted for neither; T14-9's write failures follow (the plan written at 2a2b94e, FIX_PLAN Task 135) (SPEC 12.0, 12.7, 14, 1.7, 6.4, 6.5, 5.6, 9.1, 9.2, 9.3, 10.1, 10.7, 14.21, 8.2, 12.3, 12.4, 6.3, 13.5, 14.13, 14.14, 14.25, 14.26; H-3, H-5, H-6)",
  run: async (product) => {
    await runT1411Twins(product);
    await runT1222Twins(product);
    await runT152Twins(product);
    await runT1333Twins(product);
    await runPerformedTwins(product);
    await runRefusalTwins(product);
    await runImpactTwins(product);
    await runListingAndStatusTwins(product);
    await runNextTwins(product);
    await runShowTwins(product);
    await runReviewRefusalTwins(product);
    await runCoverageTwins(product);
    await runIdsTwins(product);
    await runNodeShowTwins(product);
    await runConfigurationErrorTwins(product);
    await runJournalErrorTwins(product);
    await runBusyRefusalTwins(product);
    await runReadFailureTwins(product);
    await runCorruptNamingTwins(product);
  },
});

/** TEST-SPEC §12.0 IV: T12.0-15, in canonical ID order (SUITE-42). */
export const section120ivTests: readonly ProductTestEntry[] = [T12_0_15];
