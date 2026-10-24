# SPEC problems

## 2026-10-24 — SPEC 6.5 removes a nested spec module import that stands as another statement's body, leaving that statement without one; where the file needs no import addition, no refusal reason applies (Phase 10 FIX_PLAN Task 33)

**Where.**

- SPEC 4: "In a TypeScript file, an import declaration is a spec module import exactly when its specifier ends in `.xspec`". This holds wherever the declaration stands.
- SPEC 14.20: a TypeScript source is well-formed exactly when TypeScript 5.9.3's scanning and parsing report no syntax error, with "TypeScript's post-parse grammar checks ... excluded". The parser accepts an import declaration anywhere a statement may stand. That includes the body of an `if`, `else`, `do`, `while`, `for`, `for…in`, `for…of`, or `with` statement, and a labeled statement's body. For example, `if (x) import A from "../specs/A.xspec";` parses with no syntax error; TS1232 ("An import declaration can only be used at the top level of a namespace or module") is a post-parse check. The binder declares the import's bindings in the scope of the enclosing function, module, or file, so they root chains anywhere in that scope (4.5).
- SPEC 6.5, "Import edits": "an existing spec module import is removed exactly when an occurrence used a binding of its before the rewrite and none uses any binding of its after it". And: "An import removal deletes the declaration's own characters in place, and lines left empty or whitespace-only purely by that deletion are dropped with their line terminators". The paragraph ends: "while the workspace stays valid".
- SPEC 6.5, "Validation and refusals": `refused-invalid-rewrite` covers only the origin's and target's MDX well-formedness and "a file the rewrite must add an import to holding no admissible offset". The section then says: "These refusals keep every successful move's finishing regeneration (6.4) on a valid workspace, so it cannot fail for any validation reason, its removals included".

**The gap.** Suppose the declaration stands as another statement's body. Deleting its own characters leaves that statement with no body.

- If the statement is the last one in its statement list, the file no longer parses (14.20).
- Otherwise, the statement takes the next statement as its body. The meaning changes and nothing detects it.

Where the file also needs an import addition, no candidate offset is admissible, because 6.5 requires that "the file, as every edit of the rewrite leaves it, is well-formed under its grammar". The move is then `refused-invalid-rewrite`, as 6.5 provides. Where the file needs no addition, because it already holds a timely binding of the target module, no refusal reason applies. 6.5 then calls the move successful even though its finishing regeneration meets an unparseable code source. Keeping the declaration instead would contradict the removal rule.

**Staging.** A fresh scratch workspace configured with `specs: { main: ["specs/**/*.mdx"] }` and `code: { app: ["src/**/*.ts"] }`, no emission. `specs/A.mdx` holds `a` and `a.b`; `specs/B.mdx` holds `z`. Each statement is on its own line with two-space indents.

- `src/p.ts` holds `import B from "../specs/B.xspec";` / `declare const x: boolean;` / `export function g() {` / `  A.a.b;` / `  if (x) import A from "../specs/A.xspec";` / `}` / `B.z;`. `build` is clean. `move specs/A.mdx#a.b specs/B.mdx#b` re-roots the marker at `B`, which is held and timely. 6.5 then requires removing the `if` body's `import A`, since its only use leaves. The composed text puts `  if (x) ` directly before `}`, which does not parse. The product with Task 33's change (this entry's commit) refuses the move, through its post-move re-validation rather than any 6.5 reason. It exits 1 with one `unparseable-source` at `src/p.ts` [99, 99) of the would-be text, and modifies nothing. `--preview` gives the same result.
- Same file, but with `  B.z;` inside `g` after the `if` line instead of `B.z;` at the top level: the move succeeds, and `B.z;` becomes the `if`'s body.
- Without the top-level `import B …` and `B.z;`, the file needs an addition, and the move is `refused-invalid-rewrite` (no admissible offset), as 6.5 provides.
- A labeled statement's body (`l: import A …;`) and the other bodies listed above behave alike.

**Relation to the accepted residual.** The Developer accepted "the SPEC 6.5 gap for TypeScript import removals joined by automatic semicolon insertion" (AGENTS.md's bullet beginning "Known SPEC 6.5 gap"). The case above involves no automatic semicolon insertion: the removal leaves a statement without its body. It has arisen only since nested spec module imports are removed (Task 33).

Removing nested imports also lets the residual's own mechanism occur inside a nested statement list. Example: in `g`, `  A.a.b;` / `  let a = 1` / `  import A from "../specs/A.xspec"` / `  /re/.test("x")`, in a file that already imports B. The product refuses that move the same way, with `unparseable-source` at 82. The product treats this as covered by the residual's wording; please confirm.

**Expected.** SPEC to say what a section move does when the removal rule takes a spec module import that stands as another statement's body. The options are:

- remove it so that the enclosing statement keeps a body, for example by putting an empty statement in its place;
- keep it; or
- refuse the move, naming the reason.

**A related reading the product takes (no defect claimed).** For nested declarations, the product reads 6.5's timeliness by position, as the rule states it ("positions in pre-operation coordinates"). A top-level statement that encloses a nested declaration never counts as standing between, and statements nested beside it are not top-level statements. The rationale sentence assumes each import runs where it stands. TypeScript's CommonJS output never runs a nested import: it drops a namespace's import declaration (TS1147) and emits a function body's verbatim (TS1232). So the rationale does not decide any nested case.

Example: `import A from "../specs/A.xspec";` / `export namespace N {` / `  import B from "../specs/B.xspec";` / `  export function f() {` / `    A.a.b;` / `    B.z;` / `  }` / `}`, moved as above. The product re-roots the marker at the nested `B`, which is timely by position, and removes `import A`. With `export const k = 1;` between `import A …` and the namespace, it adds `import B2 from "../specs/B.xspec"` at A's place instead.

**Resolution (Phase 4 refinement, 2026-10-24; the file stays until HALT).**

- Statement-body removal: SPEC 6.5 "Import edits" now keeps a TypeScript declaration that stands as another statement's body. That covers either `if` branch and the body of a `do`, `while`, `for`, `for…in`, `for…of`, `with`, or labeled statement. The declaration stays with its bindings unused and no removal reported, as the same rule already keeps an ESM block's first declaration. 6.5's guarantee sentence and 6.2's refusal sentence were updated to match. A TypeScript import removal now also deletes the declaration's decorators and modifiers (6.5), and 14 locates import conditions the same way.
- Second example (ASI inside a nested statement list): this is an import removal joined by automatic semicolon insertion. By its wording, the Developer's accepted residual ("the SPEC 6.5 gap for TypeScript import removals joined by automatic semicolon insertion") covers it, whatever statement list holds the declaration. No SPEC change; deferred to Phase 11.
- Timeliness reading: 6.5 now states it. A top-level statement stands between two declarations exactly when it lies wholly between them, never when it encloses either. The CommonJS rationale is limited to top-level declarations. Separately, 6.5 now requires a held binding to be visible at the occurrence, and 4.5's collision rules read the import's own scope.
