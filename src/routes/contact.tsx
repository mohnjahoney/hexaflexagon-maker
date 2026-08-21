import { HashLink } from "@/components/HashLink";

export function Contact() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <HashLink to="/" className="label-eyebrow hover:text-[var(--color-ink)]">
        ← back to the maker
      </HashLink>

      <div className="mt-16 text-center">
        <p className="label-eyebrow">A note from the studio</p>
        <h1 className="mt-4 font-display text-5xl">Interested in collaborating?</h1>
        <p className="mx-auto mt-6 max-w-sm leading-relaxed text-[var(--color-ink-soft)]">
          Want to share something you&apos;ve made?
          <br />
          Or just want to talk paper?
        </p>
        <p className="mt-10 font-display text-2xl">Get in touch.</p>
        <a
          href="mailto:studiopique@gmail.com"
          className="mt-3 inline-block text-[var(--color-oxblood)] hover:underline"
        >
          studiopique@gmail.com
        </a>
      </div>
    </main>
  );
}
