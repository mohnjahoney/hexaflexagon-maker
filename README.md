# Hexaflexagon Atelier

A small browser maker for composing three images into a printable hexaflexagon.

## Local development

```bash
npm install
npm run dev
```

Open the local URL Vite prints. The production checks are:

```bash
npm run lint
npm run build
```

## Release status

The app is ready for a first round of hands-on testing. See [TODO.md](TODO.md) for the release checklist and tester script.

The site is built as a static Vite app and deployed to GitHub Pages by `.github/workflows/deploy-pages.yml` when `main` changes.
