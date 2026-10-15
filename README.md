# GSA Connect

**One link to create your digital business card.** Built for UGA graduate & professional students: share your CV,
research and links with a tap, a QR code, or from Apple / Google / Samsung Wallet. Free, hosted on your own GitHub.
Powered by **ScholarTap**.

## 👉 Make your card: https://ank-man.github.io/gsa-connect/

1. **Your details.** Name, photo, CV, research, publications, links.
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

## How it works

```
app/                  the setup app (details → template → publish); talks to GitHub from your browser
card.json             your profile. "setup": false shows the setup app; the app sets it to true
index.html, css/, js/ your card (js/card.js fills the template from card.json)
templates/            51 templates: layouts/ (7 layouts), catalog.json (themes), previews/ (thumbnails)
nfc.html              NFC tag writer
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
```

## For the GSA

Add the Apple / Google / Samsung wallet secrets to a GitHub **organisation**, and every card created in that org
gets wallet passes automatically. UGA colours and the text "UGA GSA" are used as text only. Official UGA marks
need approval from UGA Brand & Licensing.

MIT licensed.
