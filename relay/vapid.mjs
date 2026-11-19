// Prints a VAPID key pair for push notifications: `npm run vapid`, then `npx wrangler secret put VAPID_PUBLIC_KEY` / VAPID_PRIVATE_KEY.
const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
const pub = Buffer.from(await crypto.subtle.exportKey("raw", k.publicKey)).toString("base64url");
const d = (await crypto.subtle.exportKey("jwk", k.privateKey)).d;
console.log(`VAPID_PUBLIC_KEY=${pub}\nVAPID_PRIVATE_KEY=${d}`);
