import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';

// The site renders the repository's usage docs directly from ../docs —
// the same files GitHub renders; there is no separate content copy.
export const docs = defineDocs({
  dir: '../docs',
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

// Page titles come from frontmatter. Each file also keeps a leading `#`
// heading so it reads well on GitHub; strip it here so pages don't render
// the title twice. Runs before rehype, so the heading never enters the TOC.
function remarkStripLeadingH1() {
  return (tree: { children: { type: string; depth?: number }[] }) => {
    const index = tree.children.findIndex(
      (node) => node.type === 'heading' && node.depth === 1,
    );
    if (index !== -1 && index <= 1) tree.children.splice(index, 1);
  };
}

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkStripLeadingH1],
  },
});
