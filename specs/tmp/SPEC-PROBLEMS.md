# SPEC problems

## 2026-09-29 — SPEC 6.5: whether an added TypeScript import may stand where a removed statement ended is undecided (Phase 6 TEST-SPEC review, round 1 of the revisit, item I4)

**Ambiguity that decides an outcome.** SPEC 6.5 ("Added imports") admits an offset in a TypeScript source only where it "follows the end of a top-level statement with nothing but whitespace (1.4) between". It does not say which text that clause reads when the statement is itself removed by the same rewrite. The other admissibility judgements name their text. "lies inside none of the file's statements before the edit" reads the pre-operation text. Timeliness uses "positions in pre-operation coordinates". Well-formedness reads "the file, as every edit of the rewrite leaves it". Whether an insertion point is at a line start "is judged over the composed text ..., never over the pre-operation text alone". The statement-end clause is the only one left open. Under 6.5's composition rules, an insertion at the offset where a removal's range ends "stands after that edit's result", so in the composed text the removed statement is gone.

**The case it decides is the most basic TypeScript section move.** Take a code source whose only spec import is the origin module's, at the file's head:

```ts
import O from "../specs/origin.xspec"
export function f() { O.x }
```

Run `xspec move specs/origin.mdx#x specs/target.mdx#y`. `O` loses its last use, so its declaration is removed with its line: range 0 to the start of line 2. The marker needs a binding of the target module, which the file lacks, so a declaration must be added. Offset 0 follows no statement under either reading. Every offset after `f` is untimely, because a non-import statement stands between it and `O`'s declaration. That leaves the removal's end, the pre-operation start of line 2:

- **Pre-operation reading:** the offset follows the end of `O`'s declaration with only U+000A between. It is timely, since nothing stands between it and `O`'s declaration. So it is admissible, and the move is performed: `import X from "../specs/target.xspec"`, U+000A, `export function f() { X.y }`, U+000A.
- **Composed reading:** that offset is the start of the composed file and follows no statement. The file then has no admissible offset for an addition it needs, so the move is refused as `refused-invalid-rewrite`.

A product could implement either reading. The two differ on whether nearly every TypeScript consumer can have its node moved at all. TEST-SPEC.md cannot pin either one without adding a requirement.

**What TEST-SPEC.md does meanwhile.** The arms that staged this shape are T6.5-11(a), T6.5-11(b), and T6.5-18. They are restaged so that a retained declaration comes before the removed one. The removal's start then follows a statement's end, and both readings admit the one composed position. The basic case above stays untested until SPEC 6.5 says which text the clause reads, and, if it is the composed text, confirms that such moves are meant to be refused. The same question could arise for "at or after the end of the file's directive prologue", but a move never removes a prologue statement.

## 2026-09-29 — SPEC 6.5: whether Annex B's `escape` and `unescape` are barred names is unsettled (minor; same review, item C10)

6.5's second "Added imports" bullet bars "a property ECMAScript 2024 defines on the global object". ECMAScript 2024's Annex B (B.2.1) adds `escape` and `unescape` as properties of the global object. That annex is normative but required only of web browsers, so the wording does not settle whether the two names are barred. TEST-SPEC.md T6.5-22(a) asserts neither way. This is not blocking on its own, because avoiding both names conforms under either reading. It is logged here so the same pass can make the list exact.
