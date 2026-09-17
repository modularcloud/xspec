# SPEC problems

## 2026-09-17 — 6.2's worked straddling-line case, 6.5's insertion rule, and 6.5's validity promise contradict one another for an in-line multi-line section with a plain whitespace remainder

**Where:** SPEC.md 6.2, the worked example: "a multi-line section whose
opening tag is followed on its origin line only by whitespace but preceded
there by non-whitespace contributes that line's within-construct remainder and
terminator at the origin, where the line is kept, and not at the destination,
where the line is dropped (3); such a node is `changed`". SPEC.md 6.5: the
moved text is "the section construct's own characters — from the first
character of its opening tag through the last character of its closing tag",
"inserted immediately before the target parent's closing tag — at the end of
the file for a top-level `new-id` — followed by a U+000A line terminator, and
preceded by one when the insertion point is not at the start of a line"; the
refusal list ("Move additionally MUST refuse: …"); and "These refusals keep
every successful move's finishing regeneration (6.4) on a valid workspace … so
it cannot fail for any validation reason". SPEC.md 14.20: well-formed MDX is
MDX syntax at major version 3, decided by derivability alone. Found while
refining TEST-SPEC.md T6.2-3, P-5, and S-6 (Phase 6, re-entered from Phase 9).

**What happens:** Under the grammar 14.20 fixes (verified against the stock
MDX 3 parser the repository's `node_modules` holds — micromark with the mdxjs
extensions plus the tag matching of `mdast-util-mdx`; the tokenizer alone,
which the AGENTS.md recipe runs, does not check tag matching and accepts every
shape below), a section whose opening tag is preceded on its line by
non-whitespace is an in-line (text-position) element inside a paragraph, and
its closing tag must stand within the same paragraph: `foo <S id="m">`,
U+000A, `body</S>` derives; `foo <S id="m">`, U+000A, `body`, U+000A, `</S>`
does not. A section-form move of that section inserts its moved text at the
start of a line (6.5), so the destination holds `<S id="m">`, U+000A,
`body</S>`, U+000A: an opening tag at line start followed on its line by
nothing — or, under the example's plain remainders, by spaces or a tab — is a
flow-position tag, whose element the closing tag inside the following
paragraph cannot close; the file is not well-formed ("Expected the closing tag
`</S>` either after the end of `paragraph` … or another opening tag after the
start of `paragraph`"), at top level and inside a parent section alike. So,
for the very class 6.2 uses as its worked example, a move performed exactly
as 6.5 specifies leaves the destination file unparseable (14.20): the
finishing regeneration cannot run on a valid workspace, 6.5's refusal list
names no reason for the move, and 6.2 describes it as successful with the
node `changed`. The three statements cannot all hold, the product's behavior
on such a move is unspecified, and no test can pin it: TEST-SPEC.md T6.2-3
cannot stage the plain-remainder case, and P-5's random section moves must
exclude it. The one realization of 6.2's example that derives on both sides is
a remainder of U+000B or U+000C alone — whitespace under 1.4, so the
destination line drops, but not whitespace to the MDX grammar, so the tag
stays in-line at the destination (`<S id="m">`, U+000C, U+000A, `body</S>`
derives, as does the origin `foo <S id="m">`, U+000C, U+000A, `body</S>`);
TEST-SPEC.md now stages that realization (T6.2-3, P-5, S-6) and records the
plain remainders as unstaged pending this decision. Affected by the same
mechanism: a moved multi-line in-line section whose opening tag is followed on
its line by tags or expression containers alone (e.g. `foo <S id="m">{/* c */}`,
U+000A, `body</S>`), which likewise becomes a flow tag at the destination.

**Resolution needed:** fix what a section-form move does when the moved text,
standing at the start of a line, would not be well-formed — for example (a) a
refusal (the moved construct's text does not derive in flow position: refused
before any modification, with a stable code and location, 14), keeping 6.5's
validity promise, with 6.2's example restated over a realization that derives
(the U+000B/U+000C remainder) or over the general straddling-line mechanism;
or (b) an insertion rule that keeps such a construct in-line at the
destination, with 6.2's straddling-line account and 6.5's exact-edit and
byte-determinism statements adjusted to it; or (c) another outcome the
specification chooses. Whichever it is, 6.2's example, 6.5's insertion rule
and refusal list, and 6.5's validity promise must agree, and the outcome must
be observable through the command surface so TEST-SPEC.md can pin it
(T6.2-3's plain-remainder arm, P-5's generator, S-6's vector).

**Resolution (2026-09-17, Phase 4 iteration 1):** SPEC.md now decides every
shape above and the five the Reviewer added (in-line target parents, origin
deletions leaving an interrupting line start, EOF insertion after a terminal
ESM block, import additions with no admissible offset, import removals
uncovering a comment that heads the block). 6.5 refuses a section-form move
whose exact edits would leave the origin or target file other than well-formed
MDX, or for which a needed import addition has no admissible offset, under the
new reason `refused-invalid-rewrite` (14: located at the moved construct and,
for an unplaceable addition, at the spellings needing it; `identities` the
paths of the files the rewrite would leave invalid); import additions are
placed only at admissible offsets (well-formed result, the added line an
import declaration); a created target file's initial content is fixed
(declarations, an empty line, the moved text); an import whose removal would
demote its block's other declarations stays, unused. 6.2's example is restated
over the realization that derives on both sides with plain whitespace — a
section whose opening tag ends its line and whose closing tag begins its line
(`foo <S id="m">`, `body`, `</S> bar`), verified against the full MDX 3 parse —
and states that the `body</S>` realization is refused unless the remainder is
U+000B or U+000C. The entry is addressed once the Reviewer confirms the text;
delete this file on HALT.
