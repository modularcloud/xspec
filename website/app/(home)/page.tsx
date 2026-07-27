import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1 px-4">
      <h1 className="text-3xl font-bold mb-4">xspec</h1>
      <p className="text-fd-muted-foreground mb-6 max-w-xl mx-auto">
        Requirement traceability for specifications written in MDX: typed
        requirement references, a project-wide dependency graph, coverage,
        impact analysis, and staged reviews.
      </p>
      <p>
        <Link
          href="/docs"
          className="font-medium underline underline-offset-4"
        >
          Read the documentation
        </Link>
      </p>
    </div>
  );
}
