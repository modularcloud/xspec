IMPORTANT: This file may only be edited and interpreted by Liaison. Only Liaison has the full context required to interpret this file. Driver, Engineer, Specialist, and other agents should not infer answers from this file.

## Documentation

- The process keeps `docs/` and `README.md` current. Any change that alters what users see or do (commands, options, outputs, configuration, findings, behavior) updates them alongside the change, so the documentation never lags the released product. Documentation is not a separate chore left to Developer. (Developer, 2026-10-28)

## Releases

- Once a patch's pull request has merged, follow-up work for that patch that leaves the product's specs, code and test harness untouched, such as a docs update or a release rule Developer gives, is committed and pushed straight to `main`, with no new branch or pull request. A change to the product's specs, code or harness still enters the process as new work. (Developer, 2026-10-28)

## Product identity

- The spec never ties the product to a literal package or distribution name. The name the product is published under (today the npm package `@modularcloud/xspec`) is a distribution detail, and users must be able to use the product under that name with a plain install: no aliasing, and no reason to install some other package that happens to share a short name. (Developer, 2026-10-28)

## Residual gaps

- When a narrow, low-impact gap turns up late in a run, in the product or in how the test harness checks it, finish the current work and accept the gap exactly as it is. Record it honestly and park it for a follow-up change through the normal process, rather than reopening finished phases to close it. Accepting a gap means no partial mitigation, workaround or tests for it in the current run. A gap that hurts behavior users rely on still goes to Developer. (Developer, 2026-10-22, on TypeScript being unable to report a type error for requirement paths named after members of `Object`: "this seems like a minor issue that doesn't hurt most use cases and id rather finish this feature than put in a fix", and "just accept the error as is and we will add the sentence to the spec and implement later through the official process".)
  - Applied by Liaison on 2026-10-29 to two limits on how the harness checks IP 0002's promise that xspec never resolves the configuration's import: trap placement, and four fixed import spellings. Each could hide a product fault only together with a second, harness fault. The loud failure modes are still caught, and the randomized spelling test keeps the coverage.
