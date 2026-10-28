IMPORTANT: This file may only be edited and interpreted by Liaison. Only Liaison has the full context required to interpret this file. Driver, Engineer, Specialist, and other agents should not infer answers from this file.

## Documentation

- The process keeps `docs/` and `README.md` current. Any change that alters what users see or do (commands, options, outputs, configuration, findings, behavior) updates them alongside the change, so the documentation never lags the released product. Documentation is not a separate chore left to Developer. (Developer, 2026-10-28)

## Releases

- Once a patch's pull request has merged, follow-up work for that patch that leaves the product's specs, code and test harness untouched, such as a docs update or a release rule Developer gives, is committed and pushed straight to `main`, with no new branch or pull request. A change to the product's specs, code or harness still enters the process as new work. (Developer, 2026-10-28)

## Product identity

- The spec never ties the product to a literal package or distribution name. The name the product is published under (today the npm package `@modularcloud/xspec`) is a distribution detail, and users must be able to use the product under that name with a plain install: no aliasing, and no reason to install some other package that happens to share a short name. (Developer, 2026-10-28)
