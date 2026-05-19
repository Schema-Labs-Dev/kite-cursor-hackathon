# Kite

> **Your dollars. On your phone. Set free.**

Kite is a mobile-first dollar account built on Base. Earn interest on USDC, send to any Basename in seconds for free, spend anywhere a card works.

This repo contains the marketing site (Next.js 16 + Tailwind v4). See [`BRIEF.md`](./BRIEF.md) for the full product, brand, and go-to-market brief.

---

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Type**: Fraunces (display) + Geist Sans (body) — via `next/font`
- **Language**: TypeScript

## Run locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Project structure

```
app/
  layout.tsx          # fonts, metadata
  globals.css         # design tokens (cream / ink / sun / sky / mint)
  page.tsx            # landing-page composition
components/
  sections/           # one file per landing-page section
    nav.tsx
    hero.tsx
    bank-wont.tsx
    pillars.tsx
    built-on-base.tsx
    deeper.tsx
    card-section.tsx
    moat.tsx
    developers.tsx
    trust.tsx
    stats.tsx
    discover.tsx
    get-app.tsx
    footer.tsx
  ui/                 # reusable primitives
    kite-logo.tsx
    phone-frame.tsx
    card-mockup.tsx
    string-decor.tsx
    screens/          # mocked phone screens
      hold-screen.tsx
      send-screen.tsx
      spend-screen.tsx
```

## Design system

Brand palette (defined as Tailwind tokens in `app/globals.css`):

| Token       | Hex       | Use                                  |
|-------------|-----------|--------------------------------------|
| `cream`     | `#F1EAD8` | Background                           |
| `cream-soft`| `#F6F1E3` | Cards, raised surfaces               |
| `cream-deep`| `#E9DFC4` | Footer-y stripes                     |
| `ink`       | `#0B1230` | Text, dark surfaces                  |
| `sun`       | `#FF5A2C` | Primary accent (the kite at dusk)    |
| `sky`       | `#3461FF` | Secondary accent (Base-flavored)     |
| `mint`      | `#B6F0C5` | Success pills, "earning" tags        |

Type:

- `font-display` — Fraunces (editorial serif, used for headlines)
- `font-display-italic` — Fraunces italic with softer optical sizing
- `font-sans` — Geist Sans (UI, body)
- `font-mono` — Geist Mono (numbers, code, badges)

## Building on Base

Kite integrates the full Base ecosystem. See `components/sections/built-on-base.tsx` for the user-facing pitch. Stack:

- **Identity** — Basenames (`you.base.eth`)
- **Account** — Coinbase Smart Wallet (passkey, ERC-4337)
- **Gas** — CDP Paymaster (sponsored transactions)
- **Money** — USDC + EURC + MXNB
- **Yield** — Morpho + Aave v3 + Spark
- **On/off-ramp** — Coinbase Onramp
- **Distribution** — MiniKit (Kite as a mini-app inside Coinbase Wallet)
- **Cards** — Rain on Visa rails

## Scripts

| Script           | What it does                       |
|------------------|------------------------------------|
| `npm run dev`    | Start dev server with Turbopack    |
| `npm run build`  | Production build (static export-ready) |
| `npm run start`  | Serve the production build         |

## License

UNLICENSED — proprietary, all rights reserved by Kite Labs, Inc.

Made with care in San Francisco, México, and Lagos.
