# SPEC problems

## 2026-10-15 — SPEC 10.1's "modifying nothing" for a corrupt session's report contradicts 13.5's refresh-first order for `review create`; for the other review outcomes past the gate the order is unstated (Phase 6 TEST-SPEC review, refinement 5, item I1)

**Where.**

- 10.1, corrupt sessions: "every `review` subcommand naming that session — on a workspace passing `build`'s validations, the only state in which a `review` subcommand reads a session (13.3, 12.0) — reports the corruption and exits 1, modifying nothing".
- 13.5 scopes every statement of that kind: "Acquisition's and release's writes count as modification in no statement of this specification that a command modifies nothing or acts before modifying anything — such statements concern sources, durable files, derived files, and graph data". No other write is exempt.
- 13.5 fixes `create`'s order: "`review create` examines the session directory only past the gate and refresh of 13.3 — its existing-name refusal (10.7), the corruption reported in that refusal's place (14.21), and the obstruction of its own write path (14.22) follow any refresh write". 14.22 says the same of the obstruction: "on a passing workspace the refusal follows the refresh, stale graph data already rewritten (13.3)".
- 13.3: on a workspace passing `build`'s validations, `review` refreshes stale graph data "before answering".

**The contradiction.** Take a workspace that passes `build`'s validations, with stale graph data (a section's text edited after `build`), holding a corrupt session `s`. Run `xspec review create --strategy audit --name s`. `create` names `s`. Under 10.7, when the named session is corrupt, "its corruption (14.21) is reported in the refusal's place".

- By 13.5, the refresh rewrites graph data first, and the corruption report follows it.
- By 10.1, read under 13.5's scope sentence, the command modifies nothing, graph data included, so graph data stays stale.

No product meets both. TEST-SPEC.md's T10.1-6 stages exactly this case and asserts 13.5's order: "graph data refreshed and no session file written or changed".

**The same question past `create`.** 13.3 puts the refresh "before answering". 14.22 cites 13.3 for a refusal that follows the refresh. Apart from `create`'s outcomes, SPEC never says which outcomes after the gate count as answering in that sense. On a stale workspace that passes `build`'s validations, these outcomes are left open:

- every other subcommand's report of a corrupt session it names (`status`, `next`, `show`, `export`, `resolve`, `split`), where 10.1 says "modifying nothing";
- a session whose recorded baseline can no longer be reconstructed, where 10.7 says "fails per 6.3 as a usage error (12.0), modifying nothing";
- `resolve`'s refusal of a blocked item, and `split`'s refusal of an item of another kind or with a childless scope root. For these, 10.7 states neither an order nor what is left unmodified.

If every outcome past the gate follows the refresh, the first two contradict 10.1 and 10.7 just as `create`'s does. If not, "modifying nothing" alone implies that those outcomes come before any refresh. 12.0 and 13.3 never state that order. All 12.0 says is that the item-ID check runs past the gate, with a corruption "reported in the check's place". For the refusals, 14.22's citation of 13.3 suggests the refresh comes first, but SPEC states that order for `create`'s refusals alone.

**What TEST-SPEC.md does meanwhile.**

- T10.1-6's corrupt-name arm follows 13.5 against 10.1, as above.
- T10.1-4's corruption arms and T10.7-3's recorded-baseline arms assert "modifies nothing". They are staged with no source edited after the session's creation, so graph data is current and every reading agrees.
- Item I1 of this refinement's review asks TEST-SPEC.md to state what a review refusal leaves unmodified. It covers T10.7-9's childless `split`, which is staged on a stale workspace, and the refused `resolve` of T10.3-2 and T10.7-10. It would assert the refresh, reading 13.3 as 14.22 does. So I1 waits on this entry, together with T10.1-6's corrupt-name arm.

**Possible resolutions (for the SPEC owner).** Either:

- state that every outcome of a `review` subcommand past the gate follows the refresh of 13.3: its answer, a refusal (10.7), a corruption report (14.21), and a baseline failure (6.3). Then replace each "modifying nothing" for those outcomes with what the outcome does leave unmodified, for example 14.22's "writes no session file"; or
- keep "modifying nothing" and order those outcomes before any refresh, `create`'s corruption report included. Then state the order for the refusals as well.
