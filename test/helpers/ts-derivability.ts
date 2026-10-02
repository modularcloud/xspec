// TEST-SPEC S-9's TypeScript check: whether a code source or a configuration
// file is well-formed TypeScript under the grammar SPEC 14.20 fixes —
// TypeScript's grammar at release 5.9.3, TSX or plain as the file name
// selects, at the language level ESNext, derivability there being that
// release's acceptance. Harness machinery only: no product imports, no I/O,
// no test-framework dependence. Its self-test is
// test/self/s9-typescript-well-formedness.test.ts; the MDX side of S-9 is
// helpers/mdx-derivability.ts.
//
// The check is made by a means independent of the product (S-9): the
// harness's own TypeScript, `typescript-5.9.3` (an npm alias of
// `typescript@5.9.3`; harness code never imports the product's
// `typescript`). Its parser decides: a reading accepts the text exactly when
// the parse reports no diagnostic — the scanner's errors and the parser's,
// the list a program's `getSyntacticDiagnostics` returns verbatim for a
// TypeScript file — whatever tree the error-tolerant parser builds. No
// program, binder, or checker is created, so the rules 14.20 excludes beyond
// parsing take no part: the checker's post-parse grammar checks (a misplaced
// modifier, a rest parameter that is not last), name binding (a duplicate
// declaration, and the binder's strict-mode errors), and type checking.
//
// Two readings. 14.20 makes a text well-formed when that release accepts it
// both as a module's code and as a script's, and leaves unfixed a text it
// accepts read one way only; the readings differ in how they take top-level
// `await` (`await /re/;` derives only as module code, `let a = await / 2 /
// 1;` only as script code). The release's parser reads a file as script code
// first and, when the file is a module, reparses in an await context each
// statement that may hold a top-level `await`; whether the file is a module
// is its source file's module indicator, which the `setExternalModuleIndicator`
// option of `createSourceFile` exists to set. Forcing the indicator on
// (`true`) and off (`undefined`) gives the two readings, whatever imports or
// exports the text holds; `ts.isExternalModule` confirms each took.
//
// The grammar the name selects: a name ending `.tsx` parses as TSX, any other
// name as plain TypeScript (SPEC 14.20), the suffix matched as SPEC spells it.
// The parser is handed a neutral name of the selected kind and the matching
// script kind, so nothing else of the real name takes part — given a
// declaration file's name (`.d.ts`, `.d.mts`, `.d.css.ts`, …) the release
// would parse in an ambient context and skip the top-level-await reparse.
//
// Two rules the parser does not apply are 14.20's: bytes that are not valid
// UTF-8, or that begin with a byte-order mark, are unparseable (SPEC 1.6:
// "a discovered spec or code source that is not valid UTF-8 or that begins
// with a byte-order mark is unparseable (14.20)") — the release's scanner
// itself skips a leading U+FEFF as whitespace. A string is taken as the
// file's decoded content, so a leading U+FEFF is its byte-order mark, and a
// lone surrogate, which no UTF-8 encodes, makes it unparseable (as
// `deriveMdx` takes a string).
//
// Verdicts: well-formed (both readings accept), unparseable (both reject),
// and one-way (exactly one accepts). No fixture is text accepted read one
// way only (S-9), so a one-way text is a harness error whatever its
// declaration — `tsDeclarationProblem` says so for every declaration.

import ts from "typescript-5.9.3";

/** The two readings of 14.20: as a module's code and as a script's. */
export const TS_READINGS = ["module", "script"] as const;

export type TsReading = (typeof TS_READINGS)[number];

/** One syntax error a reading reports, located in the decoded text. */
export interface TsSyntaxError {
  /** TypeScript's diagnostic code (TS1121 for a legacy octal literal, …). */
  readonly code: number;
  /** The diagnostic's message, flattened. */
  readonly message: string;
  /** The error's start as an index into the decoded text (UTF-16 code units). */
  readonly index: number;
  /** The same point as a byte offset into the text's UTF-8 encoding. */
  readonly offset: number;
  /** 1-based line, counting the line terminators the release's scanner counts. */
  readonly line: number;
  /** 1-based column, in UTF-16 code units. */
  readonly column: number;
}

/** Each reading's syntax errors, in the order the release reports them. */
export type TsReadingErrors = Readonly<
  Record<TsReading, readonly TsSyntaxError[]>
>;

export type TsVerdict =
  | { readonly verdict: "well-formed" }
  | {
      readonly verdict: "unparseable";
      readonly reason: string;
      /** Both empty when the bytes never reach the parser (SPEC 1.6). */
      readonly errors: TsReadingErrors;
    }
  | {
      readonly verdict: "one-way";
      /** The one reading that accepts the text. */
      readonly accepts: TsReading;
      readonly reason: string;
      readonly errors: TsReadingErrors;
    };

/** What the document declares of a code source or configuration file. */
export type TsDeclaration = "well-formed" | "unparseable";

// TypeScript 5.9.3 keeps both fields off its public declarations: the module
// indicator `setExternalModuleIndicator` sets, and the parse's diagnostics.
interface ParsedSourceFile {
  externalModuleIndicator?: unknown;
  readonly parseDiagnostics?: unknown;
}

const ENCODER = new TextEncoder();

/**
 * One reading of `text` under the grammar `name` selects: the syntax errors
 * that release's scanning and parsing report — none when it accepts.
 */
export function readTypeScript(
  text: string,
  name: string,
  reading: TsReading,
): readonly TsSyntaxError[] {
  const tsx = name.endsWith(".tsx");
  const asModule = reading === "module";
  const file = ts.createSourceFile(
    tsx ? "s9-judged.tsx" : "s9-judged.ts",
    text,
    {
      languageVersion: ts.ScriptTarget.ESNext,
      setExternalModuleIndicator: (sourceFile) => {
        (sourceFile as unknown as ParsedSourceFile).externalModuleIndicator =
          asModule ? true : undefined;
      },
    },
    false,
    tsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  if (ts.isExternalModule(file) !== asModule) {
    throw new Error(
      `S-9's TypeScript check: the ${reading} reading did not take — ` +
        `TypeScript ${ts.version} ignored the forced module indicator`,
    );
  }
  const diagnostics = (file as unknown as ParsedSourceFile).parseDiagnostics;
  if (!Array.isArray(diagnostics)) {
    throw new Error(
      `S-9's TypeScript check: TypeScript ${ts.version}'s source file ` +
        "carries no parse diagnostics list",
    );
  }
  return (diagnostics as readonly ts.Diagnostic[]).map((diagnostic) =>
    syntaxError(file, text, diagnostic),
  );
}

/**
 * Judges a code source or configuration file — its bytes (or decoded
 * content) and its name — under SPEC 14.20's TypeScript grammar.
 */
export function judgeTypeScript(
  source: Uint8Array | string,
  name: string,
): TsVerdict {
  const decoded = decode(source);
  if (typeof decoded !== "string") {
    return {
      verdict: "unparseable",
      reason: decoded.reason,
      errors: { module: [], script: [] },
    };
  }
  const errors: TsReadingErrors = {
    module: readTypeScript(decoded, name, "module"),
    script: readTypeScript(decoded, name, "script"),
  };
  const moduleAccepts = errors.module.length === 0;
  const scriptAccepts = errors.script.length === 0;
  if (moduleAccepts && scriptAccepts) return { verdict: "well-formed" };
  if (!moduleAccepts && !scriptAccepts) {
    return {
      verdict: "unparseable",
      reason:
        `rejected read as module code (${describeErrors(errors.module)}) ` +
        `and as script code (${describeErrors(errors.script)})`,
      errors,
    };
  }
  const accepts: TsReading = moduleAccepts ? "module" : "script";
  const rejects: TsReading = moduleAccepts ? "script" : "module";
  return {
    verdict: "one-way",
    accepts,
    reason:
      `accepted read as ${accepts} code only, rejected read as ${rejects} ` +
      `code (${describeErrors(errors[rejects])})`,
    errors,
  };
}

/**
 * S-9's judgement of a declaration: undefined when the verdict agrees with
 * what the document declares, else the harness error's text. A one-way text
 * is an error whatever the declaration — no fixture is text accepted read
 * one way only, SPEC 14.20 leaving its well-formedness unfixed.
 */
export function tsDeclarationProblem(
  verdict: TsVerdict,
  declared: TsDeclaration,
): string | undefined {
  switch (verdict.verdict) {
    case "one-way":
      return (
        `declared ${declared}, but under TypeScript ${ts.version} it is ` +
        `${verdict.reason} — text whose well-formedness SPEC 14.20 leaves ` +
        "unfixed, which no fixture or draw may be, whatever its " +
        "declaration (S-9)"
      );
    case "well-formed":
      return declared === "unparseable"
        ? `declared unparseable, but TypeScript ${ts.version} accepts it ` +
            "both as module code and as script code — SPEC 14.20 makes it " +
            "well-formed"
        : undefined;
    case "unparseable":
      return declared === "well-formed"
        ? `declared well-formed, but it is not well-formed TypeScript ` +
            `(${ts.version}, SPEC 14.20): ${verdict.reason}`
        : undefined;
  }
}

function syntaxError(
  file: ts.SourceFile,
  text: string,
  diagnostic: ts.Diagnostic,
): TsSyntaxError {
  const index = diagnostic.start ?? 0;
  const { line, character } = file.getLineAndCharacterOfPosition(index);
  return {
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
    index,
    offset: ENCODER.encode(text.slice(0, index)).length,
    line: line + 1,
    column: character + 1,
  };
}

function describeErrors(errors: readonly TsSyntaxError[]): string {
  const first = errors[0];
  if (first === undefined) return "no error";
  const more = errors.length > 1 ? `, and ${errors.length - 1} more` : "";
  return (
    `TS${first.code} "${first.message}" at line ${first.line}, column ` +
    `${first.column} (byte offset ${first.offset})${more}`
  );
}

/** The decoded text, or why the content is unparseable before any parse. */
function decode(
  source: Uint8Array | string,
): string | { readonly reason: string } {
  let text: string;
  if (typeof source === "string") {
    const lone = firstLoneSurrogate(source);
    if (lone !== undefined) {
      return {
        reason: `not encodable as UTF-8: a lone surrogate at index ${lone}`,
      };
    }
    text = source;
  } else {
    try {
      text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        source,
      );
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      return {
        reason:
          "not valid UTF-8: an invalid sequence at byte offset " +
          `${firstInvalidOffset(source)} (SPEC 1.6)`,
      };
    }
  }
  if (text.charCodeAt(0) === 0xfeff) {
    return { reason: "begins with a byte-order mark, U+FEFF (SPEC 1.6)" };
  }
  return text;
}

function firstLoneSurrogate(text: string): number | undefined {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++;
        continue;
      }
      return i;
    }
    if (code >= 0xdc00 && code <= 0xdfff) return i;
  }
  return undefined;
}

/**
 * Where the first ill-formed UTF-8 sequence begins, for bytes a fatal
 * decoder rejects: the same decoder fed one byte at a time throws at the byte
 * that makes the pending sequence ill-formed (or at the end, for a truncated
 * one), and that sequence began after the last byte completing a character.
 */
function firstInvalidOffset(bytes: Uint8Array): number {
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let start = 0;
  try {
    for (let i = 0; i < bytes.length; i++) {
      const chars = decoder.decode(bytes.subarray(i, i + 1), { stream: true });
      if (chars.length > 0) start = i + 1;
    }
    decoder.decode();
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
  }
  return start;
}
