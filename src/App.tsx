import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { About } from "@/routes/about";
import { Animation } from "@/routes/animation";
import { Contact } from "@/routes/contact";
import { Flex } from "@/routes/flex";
import { Home } from "@/routes/index";
import { Support } from "@/routes/support";

const routes = {
  "/": { title: "Hexaflexagon Maker — design & print", component: Home },
  "/about": { title: "About — Hexaflexagon Maker", component: About },
  // The written guide was replaced by the animation; old links still land somewhere useful.
  "/how-to-fold": { title: "Fold and flex — Hexaflexagon Maker", component: Flex },
  "/animation": { title: "Fold and flex — Hexaflexagon Maker", component: Flex },
  // Legacy: the original folding animation, kept for reference.
  "/animation-legacy": {
    title: "Strip fold animation (legacy) — Hexaflexagon Maker",
    component: Animation,
  },
  "/support": { title: "Support — Hexaflexagon Maker", component: Support },
  "/contact": { title: "Contact — Hexaflexagon Maker", component: Contact },
} as const;

function currentPath() {
  return window.location.hash.slice(1).split("?")[0] || "/";
}

function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="font-display text-7xl">404</h1>
        <p className="mt-3 text-[var(--color-ink-soft)]">That page could not be found.</p>
        <a href="#/" className="mt-6 inline-block text-[var(--color-oxblood)] hover:underline">
          Go home
        </a>
      </div>
    </main>
  );
}

export function App() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onHashChange = () => setPath(currentPath());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const route = routes[path as keyof typeof routes];
  useEffect(() => {
    document.title = route?.title ?? "Page not found — Hexaflexagon Maker";
    window.scrollTo(0, 0);
  }, [route]);

  const Page = route?.component;
  return (
    <>
      {Page ? <Page /> : <NotFound />}
      <Toaster position="bottom-center" />
    </>
  );
}
