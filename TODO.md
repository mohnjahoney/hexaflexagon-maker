# Hexaflexagon Atelier — release TODOs

The app is currently in a playable test-build state. The production build and lint checks pass; lint has only pre-existing warnings.

## Ready for testers

- [x] Compose three faces from bundled art, uploads, camera, or random cats.
- [x] Crop each image to a hexagon.
- [x] Export single-sided and double-sided PDF templates.
- [x] Open the folding animation with the current faces.
- [x] Publish a static build through GitHub Pages on pushes to `main`.
- [x] Keep the folding guide reachable from the main navigation.

## Before calling it a polished release

- [x] For double-sided print, add 2 more copies.
- [X ] Reduce extra AI verbiage.
- [ ] Run a physical print/fold test for both layouts at 100% scale.
- [ ] Verify duplex alignment on at least one home/office printer.
- [x] Add a quiet “made by Studio Pique” attribution to the printable sheets.
- [X] Decide whether the dormant Studio Pique support card belongs in a future public release.
- [ ] Test camera capture and upload/crop flows on iOS Safari and Android Chrome.
- [ ] Add a lightweight feedback/report link for testers.
- [ ] Add automated tests for strip geometry and PDF page/layout selection.
- [ ] Reduce the initial JavaScript bundle or split the animation/Three.js path.
- [ ] Add a small browser smoke test covering navigation and PDF generation.
- [ ] Replace the external random-cat dependency with a fallback or make it optional offline.
- [ ] Track down license for the flower image - can I use it? Need to attribute?
- [ ] Look up license agreement for the cat image API - can I use for commercial? need to attribute?

## Suggested tester script

1. Open the deployed site.
2. Use the default faces, then replace one face with an upload or camera capture.
3. Try both print layouts and download each PDF.
4. Open the animation and flex through all three faces.
5. Print one template at 100%, fold it, and note where the instructions or geometry are confusing.
6. Report device/browser, layout chosen, and what happened.
