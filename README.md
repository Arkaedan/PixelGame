# PixelGame

A phone-first puzzle game: clear pixel art by sending coloured shooters around a track. See [docs/SPEC.md](docs/SPEC.md).

## Development

Needs Node 26+ and pnpm.

```bash
pnpm install
pnpm dev        # dev server, also reachable from your phone on the same Wi-Fi
pnpm check      # typecheck, lint, format check, tests
pnpm levels     # regenerate levels/*.json (or `pnpm levels 007` for one level)
pnpm build      # production build in dist/ (served from /PixelGame/)
pnpm exec vite preview   # serve the production build at http://localhost:4173/PixelGame/
pnpm icons      # redraw the app icons in public/icons
```

To play on your phone while developing, run `pnpm dev`, then open the **Network** URL it prints (e.g. `http://192.168.1.20:5173`) in Chrome on the phone. Windows may ask to allow Node through the firewall the first time.

## Installing on a phone

Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which runs `pnpm check`, builds, and publishes to GitHub Pages at `https://arkaedan.github.io/PixelGame/`. Open that in Chrome on Android and choose **Add to Home screen** / **Install app**. It then opens full-screen and works offline; new versions are picked up the next time it's opened online.

## Adding a level

Levels are listed in [tools/generate/levels.ts](tools/generate/levels.ts). Each entry has an id, a name, a difficulty (`easy`, `medium` or `hard`), a seed and some art:

- **From a PNG:** put the image in `art/` and use `importPng(join(artDir, 'my-image.png'), { size: 40, maxColours: 6 })`. `size` is the board's longer side in cells; transparent areas become empty.
- **Drawn in code:** add a function to [tools/generate/art.ts](tools/generate/art.ts) using `Painter` (rectangles, circles, ellipses, polygons, outlines).

Boards must be 30×30, 40×40, 50×50 or 60×60 (for a PNG, set `size` to one of those). The generator adjusts a few edge pixels so each colour's pixel count is a multiple of 10, which lets every shooter's ammo be a multiple of 10.

Then run `pnpm levels <id>`. It prints stats, including whether the difficulty target was met. If it wasn't, try another seed.
