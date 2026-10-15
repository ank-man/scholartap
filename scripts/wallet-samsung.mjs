// Samsung Wallet — "Add to Samsung Wallet" data-transmit link (generic card).
//
// Samsung requires partner onboarding at partner.walletsvc.samsung.com: you register a
// "Generic" card template, receive a Card ID, upload your CSR, and download Samsung's
// public certificate. Then set:
//   SAMSUNG_PARTNER_ID            partner code
//   SAMSUNG_CARD_ID               card template id
//   SAMSUNG_CERTIFICATE_ID        4-char certificate id shown in the portal
//   SAMSUNG_PARTNER_PRIVATE_KEY   PEM private key that matches the CSR you uploaded
//   SAMSUNG_PUBLIC_CERT           PEM certificate downloaded from Samsung
//
// The payload is JWE-encrypted to Samsung, then JWS-signed by you (the "cdata" token).
// Attribute names follow Samsung's Generic card spec — if your registered template uses
// different fields, adjust `attributes` below. Verify against the current partner docs.

const pem = (v) => (v || "").replace(/\\n/g, "\n");

export async function buildSamsung({ card, siteUrl, env }) {
  const need = ["SAMSUNG_PARTNER_ID", "SAMSUNG_CARD_ID", "SAMSUNG_CERTIFICATE_ID", "SAMSUNG_PARTNER_PRIVATE_KEY", "SAMSUNG_PUBLIC_CERT"];
  if (need.some((k) => !env[k])) return null;
  if (!siteUrl) throw new Error("SITE_URL is required");

  const { CompactEncrypt, CompactSign, importPKCS8, importX509 } = await import("jose");
  const now = Date.now();
  const w = card.wallet || {};
  const data = {
    card: {
      type: "generic",
      subType: "others",
      data: [{
        refId: `scholartap-${card.slug || "card"}`,
        createdAt: now,
        updatedAt: now,
        language: "en",
        attributes: {
          title: card.brand?.cardName || "ScholarTap",
          subtitle: card.brand?.org || "",
          providerName: card.brand?.orgShort || "GSA",
          "logoImage": new URL("assets/wallet-logo.png", siteUrl).href,
          "logoImage.darkUrl": new URL("assets/wallet-logo.png", siteUrl).href,
          bgColor: w.backgroundColor || "#BA0C2F",
          fontColor: "light",
          text1: card.name,
          text2: card.title || "",
          text3: card.gsaRole || "",
          text4: card.email || "",
          text5: card.phone || "",
          serial1: siteUrl,
          "serialType": "QRCODE",
          "csInfo": JSON.stringify({ call: card.phone || "", email: card.email || "", website: siteUrl }),
          appLinkName: "Open card",
          appLinkData: siteUrl,
          noticeDesc: "ScholarTap · An initiative of GSA Connect, UGA"
        }
      }]
    }
  };

  const samsungCert = await importX509(pem(env.SAMSUNG_PUBLIC_CERT), "RSA1_5");
  const jwe = await new CompactEncrypt(new TextEncoder().encode(JSON.stringify(data)))
    .setProtectedHeader({ alg: "RSA1_5", enc: "A128GCM" })
    .encrypt(samsungCert);

  const key = await importPKCS8(pem(env.SAMSUNG_PARTNER_PRIVATE_KEY), "RS256");
  const cdata = await new CompactSign(new TextEncoder().encode(jwe))
    .setProtectedHeader({
      alg: "RS256",
      cty: "CARD",
      ver: 2,
      partnerId: env.SAMSUNG_PARTNER_ID,
      certificateId: env.SAMSUNG_CERTIFICATE_ID,
      utc: now
    })
    .sign(key);

  return `https://a.swallet.link/atw/v1/${env.SAMSUNG_CARD_ID}#Clip?cdata=${cdata}`;
}
