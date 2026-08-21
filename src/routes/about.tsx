import { HashLink } from "@/components/HashLink";

export function About() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <HashLink to="/" className="label-eyebrow hover:text-[var(--color-ink)]">
        ← back to the bench
      </HashLink>
      <h1 className="mt-6 font-display text-5xl">A short note on flexagons.</h1>

      <div className="prose prose-neutral mt-8 space-y-5 text-[var(--color-ink-soft)]">
        <p>
          In 1939 a young Arthur H. Stone, newly arrived at Princeton, was trimming American
          notebook paper down to a smaller British size when he began folding the leftover strips.
          One of those experiments produced a hexagon that, when pinched at its seams, opened to
          reveal a face that had not been there a moment before.
        </p>
        <p>
          Stone called the object a <em>flexagon</em>. A small committee of friends — Bryant
          Tuckerman, Richard Feynman, John Tukey — turned it into a small mathematical pastime, and
          Martin Gardner carried it to the rest of us in <em>Scientific American</em> a few years
          later.
        </p>
        <p>
          The <em>hexaflexagon</em> is the gentlest of the family. Three faces, one strip, ten
          triangles. This maker takes three pictures of your choosing, slices each into the six
          wedges of a hexagon, and arranges them along the strip so that — once cut, creased and
          glued — the toy in your hand mysteriously contains all three.
        </p>
        <p className="italic">What will you design?</p>
      </div>
    </main>
  );
}
