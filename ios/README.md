# ScholarTap NFC (iPhone)

Safari can't write NFC tags, and no iOS browser can: Apple keeps NFC writing for native apps through Core NFC.
This small SwiftUI app writes your ScholarTap link onto NFC business cards and stickers from an iPhone (iPhone 7 or newer, iOS 16+).

The Taps app's **Burn NFC** screen opens it on iPhone with your link already filled in:
`scholartap-nfc://write?url=<your card link>` (add `&auto=1` to start the NFC sheet immediately).

Features: write once, batch mode (card after card, for tabling), permanent lock, verify (read a card back), size check.

## Build

```bash
brew install xcodegen
cd ios && xcodegen && open ScholarTapNFC.xcodeproj
```

In Xcode: **Signing & Capabilities** → choose your Team (a free Apple ID can run it on your own iPhone for 7 days;
the $99/year Apple Developer Program, budgeted in the proposal, is needed for TestFlight and the App Store).
The **Near Field Communication Tag Reading** capability comes from `ScholarTapNFC.entitlements`.

Once it's on TestFlight or the App Store, put its link in `taps/config.json` as `"iosApp"` so iPhone users without
the app are sent there.

Next step worth considering: an **App Clip**, so iPhone users can write a card without installing anything.
It needs an App Store listing and an `apple-app-site-association` file on the Taps domain.
