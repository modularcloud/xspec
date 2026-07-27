# xspec docs site

A [Fumadocs](https://fumadocs.dev) (Next.js) site that renders the usage
documentation in [`../docs`](../docs) — the same Markdown files GitHub
renders; there is no separate content copy.

Requires Node.js ≥ 22 (like the rest of the repository). Run it locally:

```sh
cd website
npm install
npm run dev      # http://localhost:3000 — docs at /docs
```

Production build:

```sh
npm run build
npm run start
```

Notes:

- Page titles and descriptions come from the frontmatter in `../docs/*.md`;
  the leading `#` heading of each file is used as the on-page title source
  on GitHub and is kept out of the rendered body here (see
  `source.config.ts`).
- `docs/README.md` is served as the docs index (`/docs`).
- The site is self-contained under `website/` and is not part of the xspec
  product or its test harness; nothing in `src/` or `test/` depends on it.
