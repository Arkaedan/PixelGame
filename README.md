# PixelGame

A phone-first puzzle game: clear pixel art by sending coloured shooters around a track. See [docs/SPEC.md](docs/SPEC.md).

## Development

Needs Node 26+ and pnpm.

```bash
pnpm install
pnpm dev        # dev server, also reachable from your phone on the same Wi-Fi
pnpm check      # typecheck, lint, format check, tests
pnpm levels     # regenerate levels/*.json from tools/generate/art.ts
```

To play on your phone, run `pnpm dev`, then open the **Network** URL it prints (e.g. `http://192.168.1.20:5173`) in Chrome on the phone. Windows may ask to allow Node through the firewall the first time.
