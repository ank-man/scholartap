<p align="center"><img src="assets/brand/scholartap-mark.svg" width="72" alt="ScholarTap"></p>

# ScholarTap

**Your research, one tap away.** The free digital business card for graduate & professional students: share your CV,
publications, scholarly profiles and links with an NFC tap, a QR code, or from Apple / Google / Samsung Wallet.
Hosted free on your own GitHub.

*An initiative of **GSA Connect**, UGA Graduate Student Association. Student-led; not an official University of Georgia website.*

## 👉 Make your card: https://ank-man.github.io/scholartap/

1. **Your details.** Name, photo, CV, research, publications, plus LinkedIn, Google Scholar, ORCID, ResearchGate, Scopus, Web of Science, GitHub, X, Bluesky, Mastodon and more.
2. **Pick a template.** 51 designs, one for every field (STEM, plants & insects, health, law, humanities, arts…), with a live preview of *your* card.
3. **Publish.** Connect GitHub once. The app creates your own copy of this repo, saves your profile, turns on free hosting and tells you when it's live.

Your card's link is `https://<you>.github.io/<card-name>/`. It **opens your finished card every time**, and it never changes,
so you can print it on QR codes and NFC tags. To change anything later, open **`<your link>/app/`** and choose *Edit my card*.

## What every card does

| | |
|---|---|
| 📇 **Save contact** | One-tap vCard for iPhone / Android / Outlook |
| 📄 **CV & research** | CV PDF, research interests, publications, projects, education, awards, office hours, events |
| 🔳 **QR** | On the card, plus print-ready `qr.svg` / `qr.png` |
| 📶 **NFC** | `<your link>/nfc.html` writes your link to an NFC tag from Chrome on Android (verify, batch, lock) |
| 👛 **Wallets** | Apple Wallet, Google Wallet and Samsung Wallet passes once keys are added (see `docs/WALLET-SETUP.md`) |
| 🎨 **51 templates** | Switch any time in the app, or change `"template"` in `card.json` |
| ⇄ **Swap cards** | A floating *Swap cards* button on every card. Both people keep each other's card, and mutual swaps are flagged |
| 📥 **Taps inbox** | See who tapped you, where you met and their note. People without a card can leave their details |
| 🔥 **Burn NFC cards** | Write your link to a blank NFC card right from the Taps app (Chrome on Android), with verify, batch and lock |
| 🔔 **Tap alerts** | A notification when someone taps you: iPhone (Home Screen app, iOS 16.4+), Android, desktop |
| 📲 **Lock-screen QR, home-screen app** | One-tap QR wallpaper, full-screen QR with screen wake lock, installable app with Scan / My QR / NFC shortcuts |

## Taps: 👉 https://ank-man.github.io/scholartap/taps/

Your ScholarTap, as an app on your phone: your QR (full screen, wallpaper, wallet), a scanner, an NFC card burner,
and **Taps**, everyone you've swapped cards with, plus notes, tags, *where we met*, follow-up reminders and CSV / vCard export.
*Event mode* tags every new tap with the event you're at. Sign in with GitHub (the account that hosts your card) to get an
inbox of who tapped you and to sync your taps across devices. Without signing in, everything stays on your phone.
How it works and how to run the relay: [`docs/TAPS.md`](docs/TAPS.md).

## How it works

```
app/                  the setup app (details → template → publish); talks to GitHub from your browser
card.json             your profile. "setup": false shows the setup app; the app sets it to true
index.html, css/, js/ your card (js/card.js fills the template from card.json)
templates/            51 templates: layouts/ (7 layouts), catalog.json (themes), previews/ (thumbnails)
nfc.html              NFC tag writer
taps/                 Taps app (PWA): QR, scanner, NFC burner, saved taps, inbox; config.json names the relay
relay/                Taps relay: Cloudflare Worker + D1 (swaps, inbox, sync, view counts, Google Wallet signing)
scripts/              build (vCard, QR, wallet passes, template), local dev server
kit/                  maintainer tools: themes.mjs, motifs.mjs → `npm run catalog`; screenshots.mjs
.github/workflows/    builds and deploys to GitHub Pages on every save
```

**Security:** the app uses a GitHub token you create (`public_repo` + `workflow` scopes). It stays in your browser,
is only sent to `api.github.com`, and you can revoke it at <https://github.com/settings/tokens>.

## Local development

```bash
npm run setup     # setup app at http://localhost:4173/app/
npm run dev       # your card at http://localhost:4173
npm install && npm run preview    # full production build (QR, wallets) in ./dist
npm run template -- --list        # switch template from the terminal
npm run catalog                   # after editing kit/themes.mjs or templates/layouts
npm run relay                     # Taps relay on http://localhost:8787 (node:sqlite, Node 22.5+)
npm run taps                      # Taps app; add ?relay=http://localhost:8787 once to use the local relay
npm test                          # relay tests
npm run vapid                     # key pair for tap alerts (push notifications)
```

## For GSA Connect

Add the Apple / Google / Samsung wallet secrets to a GitHub **organisation**, and every card created in that org
gets wallet passes automatically. UGA colours are used as text and colour only. Official UGA marks need approval
from UGA Brand & Licensing.

Developed by **Ankush Sharma** at the University of Georgia. MIT licensed.
