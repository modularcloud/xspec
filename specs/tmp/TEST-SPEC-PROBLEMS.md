# TEST-SPEC problems

## 2026-09-17 — T3-3: the kept form of the multi-line opening tag, with retained non-whitespace before the `<S`, is not well-formed MDX

**Where:** TEST-SPEC.md §3 T3-3, "Multi-line constructs": "A multi-line
opening tag — `<S`, U+000A, `  id="x"`, U+000A, `>` — is deleted the same way
(3: any removed construct): the three lines it spans merge into one, dropped
when left empty purely by the removal and kept with its residue otherwise,
byte-asserted with retained non-whitespace before the `<S` and after the
`>`." CERTIFICATIONS.md §CONF-MD stages every file well-formed MDX (14.20) and
names the arm in scope ("an opening tag spanning several lines among them
(T3-3's merged-lines arm …)"). Harness: `test/suite/registry/section-3.ts`,
fixture `DROP_SOURCE`.

**What happens:** Under the MDX grammar 14.20 fixes (micromark with the mdxjs
extensions — the product's own parser, `node_modules/micromark-extension-mdxjs`),
a paragraph-continuation line whose first non-whitespace character is `>`
interrupts the paragraph as a block quote; MDX disables indented code, so no
indentation before the `>` rescues it. A tag that opens after retained text on
its line is a text-context tag inside that paragraph, and it cannot close on
such a line: `foo <S`, U+000A, `  id="x"`, U+000A, `> bar` does not derive —
the stock tokenizer and the product alike refuse it ("Unexpected end of file
before attribute name" at the end of the `id` line; the product reports 14.20,
exits 1, emits nothing). Placing the `>` after one, three, or four spaces
changes nothing, and no container (block quote, list item) changes it either:
a `>` after the container's own prefix opens a nested block quote. The bare
`>` line closes a multi-line tag only when the tag opens at line start: the
JSX flow attempt is a concrete construct whose lines no container may pierce,
and when it fails on the ` bar` after the `>` the fallback paragraph already
spans the three lines — `<S`, U+000A, `  id="x"`, U+000A, `> bar` derives (a
text tag), compiles to ` bar` plus its terminator, and the product answers
exactly that. So, with the shape the test fixes, retained non-whitespace
*after* the `>` is stageable and retained non-whitespace *before* the `<S` is
not: no well-formed workspace holds the kept form as written, and CONF-MD's
scope (every file well-formed) cannot admit it.

**What the harness stages meanwhile:** the drop form (the tag on its own
lines, flow context; the merged line left empty drops with its terminator) and
the kept form with retained non-whitespace after the `>` alone (the tag opening
at line start; the merged line ` bar` kept with its terminator), both
byte-asserted; the residue-before-`<S` clause is not staged. The CONF-MD
conformer's hand-rolled lexer accepts the unparseable shape (it knows no block
quotes), so a fixture staging it would pass certification vacuously while the
product refuses it as 14.20 — a harness defect, not a diagnosed product
failure — which is why the harness does not stage it.

**Resolution needed:** either (a) revise the kept form to retained
non-whitespace after the `>` only, the tag opening at line start (MDX admits
no paragraph-continuation line that begins with `>`); or (b) give the
text-context kept form a shape whose third line does not begin with `>` — e.g.
`foo <S`, U+000A, `  id="x"`, U+000A, `  coverage="required"> bar`, a
three-line tag whose interior terminators are deleted with it just the same,
compiling to `foo  bar`; or (c) a two-line text-context tag, `foo <S`, U+000A,
`  id="x"> bar`, compiling to `foo  bar`. The test's point — a terminator among
a removed construct's own characters is deleted with it, the residues joining
into one kept line — holds under each.
