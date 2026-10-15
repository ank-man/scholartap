# NFC tap cards & print

## Make a tap-to-share card (like Popl / Wave)

### Easiest: the built-in writer (Android)

Every card ships with a writer page at **`https://<user>.github.io/<repo>/nfc.html`**.

1. Open it in **Chrome on an Android phone** (NFC turned on).
2. Tap **Write to tag**, then hold the tag to the back of the phone until it buzzes.
3. Tap **Read / verify a tag** to confirm it opens your card.
4. Optional: *Event mode & advanced* has **batch mode** for writing many tags in a row, and **lock** (permanent).

It uses the [Web NFC API](https://developer.mozilla.org/docs/Web/API/Web_NFC_API), which needs HTTPS (GitHub Pages has it) and
Chrome 89+ on Android. iPhones can *read* tags but Safari can't write them, so iPhone users follow the app steps below.
On a computer, the page shows a QR code that opens it on your phone.

### Any phone: the NFC Tools app

1. Buy blank **NTAG215** (or NTAG213/216) NFC cards, stickers or keychains. They cost about $0.50–$1 each in bulk.
2. Install **NFC Tools** (iOS / Android, free).
3. *Write → Add a record → URL/URI* → paste your card URL (`https://<user>.github.io/<repo>/`) → *Write* → hold the tag to your phone.
4. Optional: *Other → Lock tag* so it can't be overwritten. **Locking is permanent**, so only lock it once the URL is final.

Any modern iPhone or Android phone opens the link with a tap. No app is needed.

> Tip: because the URL never changes, you can edit `card.json` forever and every tag/QR you've handed out stays current.

## QR for print

Each deploy publishes:
- `https://…/qr.svg`: vector, for posters, badges and slides
- `https://…/qr.png`: 1024 px raster

Leave a quiet zone around the code at least 4 modules wide, and print it at least 2 cm / 0.8 in wide.

## Physical card layout (suggested)

Standard CR80 card: 85.6 × 54 mm.
- **Front:** name, title, *UGA GSA Connect*, small *Powered by ScholarTap*
- **Back:** QR code + short URL + a "Tap or scan" icon
- Embed the NFC inlay behind the back face (or use a pre-encoded PVC NFC card)
