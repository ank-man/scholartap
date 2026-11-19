import SwiftUI

// Opened from the Taps app with scholartap-nfc://write?url=<card link>
@main
struct ScholarTapNFCApp: App {
    @StateObject private var writer = NFCWriter()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(writer)
                .onOpenURL { url in
                    guard url.scheme == "scholartap-nfc",
                          let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems,
                          let link = items.first(where: { $0.name == "url" })?.value,
                          !link.isEmpty else { return }
                    writer.link = link
                    if items.contains(where: { $0.name == "auto" && $0.value == "1" }) { writer.write() }
                }
        }
    }
}
