# Wallet setup: Apple, Google, Samsung

All three passes are generated in GitHub Actions by `scripts/build.mjs`. Each pass shows your name, role
and GSA position, plus a **QR code that opens your card**. Each wallet runs only when all its secrets are present.
Secrets live in **Settings → Secrets and variables → Actions** (repo) or at the organisation level.

> Multi-line PEM values can be pasted as-is into GitHub secrets. If a tool flattens them, `\n` escapes are also accepted.

---

## Apple Wallet (`.pkpass`)

Requires an [Apple Developer Program](https://developer.apple.com/programs/) membership.

1. **Certificates, IDs & Profiles → Identifiers → +** → *Pass Type IDs* → e.g. `pass.edu.uga.gsa.connect`.
2. Select it → **Create Certificate** → upload a CSR (Keychain Access → Certificate Assistant → *Request a Certificate…*).
3. Download `pass.cer`, double-click it to add it to Keychain, then export it **with its private key** as `pass.p12`.
4. Convert to PEM:
   ```bash
   openssl pkcs12 -in pass.p12 -clcerts -nokeys -out signerCert.pem -legacy
   openssl pkcs12 -in pass.p12 -nocerts -out signerKey.pem -legacy       # set a passphrase
   curl -sO https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer
   openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem
   ```
5. Add the secrets:

| Secret | Value |
|---|---|
| `APPLE_PASS_TYPE_ID` | `pass.edu.uga.gsa.connect` |
| `APPLE_TEAM_ID` | 10-character Team ID (top right of the developer portal) |
| `APPLE_SIGNER_CERT` | contents of `signerCert.pem` |
| `APPLE_SIGNER_KEY` | contents of `signerKey.pem` |
| `APPLE_SIGNER_KEY_PASSPHRASE` | the passphrase you chose |
| `APPLE_WWDR_CERT` | contents of `wwdr.pem` |

Result: `https://…/wallet/card.pkpass`. Safari on iPhone opens it straight into Wallet.
Pass artwork lives in `wallet/apple/model.pass/` (`icon.png`, `logo.png`, and `@2x`/`@3x` versions). Replace it to rebrand.

## Google Wallet (Save to Google Wallet link)

Free.

1. Go to [pay.google.com/business/console](https://pay.google.com/business/console) → **Google Wallet API** → create an issuer and note the **Issuer ID**.
2. In [Google Cloud Console](https://console.cloud.google.com/) enable the **Google Wallet API**, create a **service account**, and download a **JSON key**.
3. Back in the Wallet console → **Users** → invite the service-account email as *Developer*.
4. Add the secrets:

| Secret | Value |
|---|---|
| `GOOGLE_WALLET_ISSUER_ID` | e.g. `3388000000012345678` |
| `GOOGLE_WALLET_SA_KEY` | the full JSON key file contents |

New issuers start in **demo mode**: only accounts you add as test users can save passes. Request publishing
access in the console to open it to everyone. The link is a signed JWT containing only public card data.

## Samsung Wallet (Add to Samsung Wallet link)

1. Apply at the [Samsung Wallet Partners portal](https://partner.walletsvc.samsung.com/) and get approved.
2. Create a **Wallet Card** of type *Generic* and note the **Card ID**.
3. Generate a key pair + CSR, upload the CSR, note the **Certificate ID**, and download Samsung's certificate:
   ```bash
   openssl req -new -newkey rsa:2048 -nodes -keyout samsung_partner.key -out samsung.csr
   ```
4. Add the secrets:

| Secret | Value |
|---|---|
| `SAMSUNG_PARTNER_ID` | your partner code |
| `SAMSUNG_CARD_ID` | the card template id |
| `SAMSUNG_CERTIFICATE_ID` | certificate id shown in the portal |
| `SAMSUNG_PARTNER_PRIVATE_KEY` | contents of `samsung_partner.key` (PKCS#8 PEM) |
| `SAMSUNG_PUBLIC_CERT` | Samsung's certificate (PEM) |

> ⚠️ Samsung's generic-card attribute names depend on the template you register. `scripts/wallet-samsung.mjs`
> uses the common Generic fields (`title`, `text1…5`, `serial1`, `logoImage`, `bgColor`, `appLinkData`). Check them
> against your template in the portal and adjust if Samsung's validator rejects a field.

## Badges

The buttons are styled to fit each template. For production, Apple and Google ask you to use their official badge artwork:
- Apple: [Add to Apple Wallet guidelines](https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/)
- Google: [Google Wallet brand guidelines](https://developers.google.com/wallet/generic/resources/brand-guidelines)
- Samsung: badge kit in the partner portal

Swap the contents of the `<a data-wallet="…">` tags in `index.html` for the official SVGs.

## Troubleshooting

- **Buttons don't appear** → open the Actions log. Each wallet prints `✓`, `✗ <reason>`, or nothing if its secrets are missing.
  Set `WALLET_STRICT=1` in the workflow to make a wallet failure fail the build.
- **`.pkpass` downloads as a file instead of opening Wallet** → it has to be opened in Safari on iOS. Other browsers just save it.
- **Google link refused** → links over ~1,800 characters can fail in some browsers. Trim `links` / `researchInterests`.
