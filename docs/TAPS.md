# Taps: swap cards, inbox, NFC burner

Cards stay static on each student's GitHub Pages. Taps adds two pieces that live only in the main ScholarTap repo:

| Piece | Where | What it does |
|---|---|---|
| **Taps app** | `taps/` → `https://ank-man.github.io/scholartap/taps/` | Installable PWA: your QR, scanner, NFC burner, lock-screen wallpaper, saved taps, inbox |
| **Relay** | `relay/` → a Cloudflare Worker + D1 | Stores swaps and guest details, syncs saved taps, counts views, signs Google Wallet passes |

## The flow

1. Jordan's card shows a floating **Swap cards with Jordan** button (added by `js/card.js` to every template).
2. It opens the Taps app with `?swap=<Jordan's card>`. The Taps app runs on one shared origin, so it knows who the visitor is.
   - **Alex has ScholarTap**: Alex adds where they met and a note, then taps *Swap*. Jordan's card goes into Alex's taps,
     the relay puts Alex in Jordan's inbox, and if Jordan already tapped Alex it says *It's mutual 🤝*.
   - **Sam has no card**: Sam leaves a name, email and note. Jordan sees Sam as a *guest* tap.
3. Jordan opens Taps and sees **New: Alex tapped you at Poster Night**. One button taps back.

Signed out, the app still works: your QR, scanner, NFC burner and saved taps stay on the phone (localStorage).
The inbox and sync need the relay and a sign-in.

**Identity** is the GitHub account that hosts your card: a card at `<login>.github.io/...` belongs to `<login>`.
Sign in with GitHub (OAuth, identity scope only) or paste the token from card setup. The relay reads the username once and
never stores the token. Sessions are HMAC-signed and last 120 days.

**What the relay stores:** taps (who, to whom, when, where met, note), guest details people choose to leave,
your saved-taps list if you sign in, and per-day view counts per card (`?via=qr|nfc|link`, one per visitor per day,
with IPs hashed). Nothing else.

## Phone features

- **Full-screen QR** with a screen wake lock, plus a **lock-screen wallpaper** generator (PNG sized for phones).
- **Scanner**: `BarcodeDetector` where available, otherwise jsQR loaded from jsDelivr.
- **Burn NFC**: Web NFC (Chrome on Android). Writes `<card>?via=nfc`, with verify, batch mode and optional permanent lock.
  On iPhone it shows NFC Tools instructions. Any iPhone can *read* the cards.
- **Install**: manifest shortcuts (My QR, Scan, Burn NFC, Taps), share target (share a card link to Taps to open it), app badge for new taps.
- **Wallet**: uses the card's own passes (`wallet/wallet.json`), otherwise the relay's shared Google Wallet issuer.

## Deploy the relay (Cloudflare, free tier)

```bash
cd relay
npx wrangler login
npx wrangler d1 create scholartap               # paste database_id into wrangler.toml
npx wrangler d1 execute scholartap --remote --file schema.sql
npx wrangler secret put SESSION_SECRET          # long random string: openssl rand -base64 48
npx wrangler deploy                             # → https://scholartap-relay.<you>.workers.dev
```

Then set `taps/config.json` → `{ "relay": "https://scholartap-relay.<you>.workers.dev" }` and push. Every card picks it up.

Optional:

- **Sign in with GitHub**: create a GitHub OAuth App with callback `<relay>/auth/github/callback`, then
  `wrangler secret put GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
- **Google Wallet for every card**: `GOOGLE_WALLET_ISSUER_ID` and `GOOGLE_WALLET_SA_KEY` (see `WALLET-SETUP.md`).
  Apple Wallet still needs per-build signing (`scripts/wallet-apple.mjs`).

## Local development

```bash
npm run relay       # relay on :8787 using node:sqlite (relay/local.db)
npm run taps        # Taps app; open once with ?relay=http://localhost:8787
npm test            # relay tests: auth, swaps, mutual, guests, rate limits, sync, stats, Google Wallet JWT
```

Locally, a card at `http://localhost:4173/<name>/` is treated as owned by `<name>`.
