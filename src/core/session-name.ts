// Session names (SPEC 10.1).
//
// Pure core, and deliberately free of imports: the CLI's argument parser
// (cli/args.ts) judges a session name's form on every invocation naming
// one — SPEC 12.0 places "a session name outside the form of 10.1" in the
// syntax class, reported without loading configuration — so this rule must
// not pull the review model (core/review.ts, which reaches the TypeScript
// compiler through core/config.ts) into the parser's load.

/**
 * SPEC 10.1: a session name consists of one or more characters from `A–Z`,
 * `a–z`, `0–9`, `.`, `_`, and `-`, and does not begin with `.`.
 */
export function isValidSessionName(name: string): boolean {
  return /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(name);
}

/**
 * The usage-error diagnostic for an invalid session name, or null for a
 * valid one (SPEC 10.1 → 12.0: any other name is a usage error).
 */
export function sessionNameProblem(name: string): string | null {
  if (isValidSessionName(name)) {
    return null;
  }
  const reason =
    name.length === 0
      ? "it is empty"
      : name.startsWith(".")
        ? "it begins with `.`"
        : "it contains a character outside `A-Z a-z 0-9 . _ -`";
  return (
    `invalid session name ${JSON.stringify(name)}: ${reason} — a session ` +
    `name must consist of one or more characters from A-Z, a-z, 0-9, ` +
    `\`.\`, \`_\`, and \`-\`, and must not begin with \`.\` (SPEC 10.1)`
  );
}
