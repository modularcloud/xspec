// TEST-SPEC T12.0-1, H-3, H-4 (SPEC 12.0, 14) — the shared human-findings
// check: what the human form of a findings report must mention of the
// findings its `--json` twin carries. A findings report — a failing
// `build`'s validation errors, `check`'s findings, a refused operation's
// refusal reasons, a gated read's gate report (12.7, 13.3) — carries, for
// every finding, its stable code, a location per offending construct (its
// containing file and source range, 1.7), the file or path it concerns
// where it has no in-source location, and the identities it names — a
// context entity's, a refusal reason's concerned identity (14); and the
// JSON form carries "the same information as the human report" (12.0). `assertHumanFindingsMentions` asks a human report
// for all of it, taken from the decoded findings after the caller's own
// JSON assertions (a product-to-itself comparison, H-4), through
// helpers/adapters/human.ts's matchers and the conventions its module
// header states, in three calls:
// - every location's file, every concerned path, and every identity
//   (`identityMention`: an identity-or-path boundary, so `specs/T.mdx`
//   never counts inside `out/specs/T.mdx` or `specs/T.mdx#p`);
// - every stable code (`codeMention`: case-insensitive, its words joined by
//   one character that is neither letter nor digit or by nothing, never
//   where it ends a longer code), matched with the findings' files,
//   concerned paths, and identities — and any further literal data the
//   caller names (its `blank` option: the spellings a message quotes as
//   data) — blanked out of the report, so a code's spelling inside a datum
//   never stands in for it;
// - every location's start and end (`numberMention`: whole numbers),
//   matched with the digit-holding data among those blanked out, save a
//   datum that is itself a whole number (`digitHoldingData`,
//   section-10.7-i.ts).
// A call with nothing to ask is skipped (`assertReportMentions` refuses an
// empty mention list), so a report whose findings locate nothing and name
// no path or identity is asked its codes alone. The module runs no
// command: each caller runs the human form itself — the same argv without
// `--json`, at the state of the decoded `--json` run, directly after that
// run's own assertions — and asserts its exit code first.
//
// Conservative operationalizations (noted per H-3/H-4):
// - A message is never blanked and never compared: it is free text (H-3)
//   that may state its own location and quote its own data. So a whole
//   number a message spells (the `14` and `1` of a citation `SPEC 14.1`)
//   may stand in for an offset of its value, a numbered condition's
//   message may spell its code's words (`missing ID` for `missing-id`), so
//   a code counts there too, and a message may name a file, a path, or an
//   identity itself — each caller's module header records what that leaves
//   unasked at its site.
// - No mention is associated with another — no same line, no adjacency, no
//   order (H-3): which file, range, code, concerned path, and identity
//   belong to which finding stays with the JSON assertions, and a datum, a
//   code, or a number counts wherever the report prints it.
// - Escapable data are not asked. SPEC fixes no human spelling, and a human
//   report may quote or escape a character a line or a quoted spelling
//   cannot carry as it stands: a file, concerned path, or identity holding
//   `"`, `'`, `\`, a C0 control character (U+0000 through U+001F), DEL, a
//   C1 control character (U+0080 through U+009F), U+2028, or U+2029 is not
//   asked of the report, nor is a path the JSON form carries in the marked
//   byte form (12.0, 12.7). Both are still blanked as the JSON form spells
//   them — a string as it stands, a marked byte form by its hexadecimal
//   digits — so their spellings never stand in for a code or a number.
//
// A module of its own, holding no test definitions: every registration
// module may import it without closing an import cycle, and an ES-module
// cycle evaluates one module before the other's bindings exist —
// section-14.ts imports section-12.1-12.2.ts, which imports
// section-13.3.ts, so a check living in section-14.ts could serve no test
// in section-13.3.ts. It imports no registration module but
// section-10.7-i.ts (for `digitHoldingData`), which imports none but
// support.ts.

import type { Finding, PathValue } from "../../helpers/adapters/index.js";
import {
  assertReportMentions,
  codeMention,
  identityMention,
  numberMention,
} from "../../helpers/adapters/index.js";
import type { RunResult } from "../../helpers/subprocess.js";
import { digitHoldingData } from "./section-10.7-i.js";

/**
 * The single code points a human report may quote or escape rather than
 * print as they stand (the module header): the double quote, the single
 * quote, the backslash, U+2028, and U+2029 — beside the C0 and C1 control
 * ranges and DEL, which `holdsEscapable` reads as ranges.
 */
const ESCAPABLE_CODE_POINTS: ReadonlySet<number> = new Set([
  0x22, 0x27, 0x5c, 0x2028, 0x2029,
]);

/**
 * Whether a literal datum holds a character a human report may quote or
 * escape (the module header): `"`, `'`, `\`, a C0 control character, DEL,
 * a C1 control character, U+2028, or U+2029.
 */
function holdsEscapable(datum: string): boolean {
  for (const character of datum) {
    const codePoint = character.codePointAt(0)!;
    if (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      ESCAPABLE_CODE_POINTS.has(codePoint)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Assert a findings report's human form mentions what its decoded findings
 * carry (T12.0-1's information parity; SPEC 12.0, 14; the module header):
 * every location's file, every concerned path, and every identity
 * (`identityMention`) — each that is a plain string holding no escapable
 * character; then, in a second call, every non-null stable code
 * (`codeMention`), matched with every file, concerned path, identity, and
 * `options.blank` datum blanked out; then, in a third, every location's
 * start and end (`numberMention`), matched with the digit-holding data
 * among those blanked out (`digitHoldingData`). A message is never blanked,
 * and a call with nothing to ask is skipped. `human` is the caller's run of
 * the same argv without `--json`, its exit code already asserted, at the
 * state of the `--json` run that decoded `findings`; `context` names that
 * run in each diagnosis. Robust matching (H-3): presence, never wording,
 * and no mention associated with another.
 */
export function assertHumanFindingsMentions(
  human: RunResult,
  findings: readonly Finding[],
  context: string,
  options: { readonly blank?: readonly string[] } = {},
): void {
  const asked = new Set<string>();
  const literal = new Set<string>(options.blank ?? []);
  const codes = new Set<string>();
  const offsets = new Set<number>();
  const datum = (value: PathValue): void => {
    if (typeof value !== "string") {
      literal.add(value.bytes);
      return;
    }
    literal.add(value);
    if (!holdsEscapable(value)) asked.add(value);
  };
  for (const finding of findings) {
    if (finding.code !== null) codes.add(finding.code);
    for (const location of finding.locations) {
      datum(location.file);
      offsets.add(location.range.start);
      offsets.add(location.range.end);
    }
    if (finding.path !== null) datum(finding.path);
    for (const identity of finding.identities) datum(identity);
  }
  if (asked.size > 0) {
    assertReportMentions(
      human,
      [...asked].map(identityMention),
      `${context}: every finding's location files, concerned path, and ` +
        `identities — what each reported finding identifies, as the JSON ` +
        `findings carry it (escapable data and marked byte forms excepted; ` +
        `SPEC 12.0, 14)`,
    );
  }
  if (codes.size > 0) {
    assertReportMentions(
      human,
      [...codes].map(codeMention),
      `${context}: every finding's stable code, matched with the findings' ` +
        `files, concerned paths, and identities — and any data the caller ` +
        `names beside them — blanked out (SPEC 12.0, 14)`,
      { blank: [...literal] },
    );
  }
  if (offsets.size > 0) {
    assertReportMentions(
      human,
      [...offsets].map(numberMention),
      `${context}: the start and end of every location's range, whole ` +
        `numbers, matched with the digit-holding data among the findings' ` +
        `files, concerned paths, and identities — and any data the caller ` +
        `names beside them — blanked out, save a datum that is itself a ` +
        `whole number (SPEC 1.7, 12.0, 14)`,
      { blank: digitHoldingData([...literal]) },
    );
  }
}
