import { HashLink } from "@/components/HashLink";

const STEPS = [
  {
    n: "I",
    label: "Double-sided print",
    t: "Cut",
    b: "Cut around the solid outline of the strip. The shape will be a long parallelogram of ten triangles.",
  },
  {
    n: "I",
    label: "Single-sided print",
    t: "Cut and Glue",
    b: "Cut around the solid outline of the strip. Fold along the center seam and glue the two halves together. Do not glue the end triangles. The shape will be a long parallelogram of ten triangles.",
  },
  {
    n: "II",
    t: "Score Every Fold",
    b: "Press a firm crease along every line, in both directions. Flatten the strip again.",
  },
  {
    n: "III",
    t: "Fold from the Left",
    b: "With Face I up, lift the left side up and north so that the third and fourth triangles meet.",
  },
  {
    n: "IV",
    t: "Fold from the Right",
    b: "Take the last four triangle on the right side and fold them back and north. You should have a hexagon with a triangle on top.",
  },
  {
    n: "V",
    t: "Switch and Flip",
    b: "Switch the rear arm with the front tab. Flip the whole thing over.",
  },
  {
    n: "VI",
    t: "Glue the Tab",
    b: "Add a small amount of glue on the tab marked 'glue'. Hold for a minute, then let dry.",
  },
  {
    n: "VII",
    t: "Flex",
    b: "Pinch two adjacent triangles upward into a peak; press the opposite side down; open the hexagon from its centre. A new face appears.",
  },
];

export function HowToFold() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <HashLink to="/" className="label-eyebrow hover:text-[var(--color-ink)]">
        ← back to the bench
      </HashLink>
      <h1 className="mt-6 font-display text-5xl">How to fold.</h1>
      <p className="mt-4 text-[var(--color-ink-soft)]">
        Prefer to{" "}
        <HashLink
          to="/animation"
          target="_blank"
          className="text-[var(--color-oxblood)] hover:underline"
        >
          watch the instructions? ↗
        </HashLink>
      </p>

      <ol className="mt-10 space-y-8">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="grid grid-cols-[3rem_1fr] gap-5 border-t border-[var(--color-hairline)] pt-6"
          >
            <span className="roman-numeral font-display text-3xl leading-none">{s.n}</span>
            <div>
              {s.label && <span className="label-eyebrow">{s.label}</span>}
              <h2 className="font-display text-2xl">{s.t}</h2>
              <p className="mt-2 text-[var(--color-ink-soft)]">{s.b}</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
