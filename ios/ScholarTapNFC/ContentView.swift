import SwiftUI

struct ContentView: View {
    @EnvironmentObject var writer: NFCWriter
    @AppStorage("link") private var savedLink = ""
    private let red = Color(red: 0.73, green: 0.05, blue: 0.18)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    Button { writer.write() } label: {
                        VStack(spacing: 10) {
                            Image(systemName: "wave.3.right").font(.system(size: 56, weight: .semibold))
                            Text(writer.batch ? "Burn cards" : "Burn my card").font(.title3.bold())
                        }
                        .frame(width: 220, height: 220)
                        .background(Circle().fill(red))
                        .foregroundStyle(.white)
                        .shadow(color: red.opacity(0.45), radius: 24, y: 14)
                    }
                    .padding(.top, 12)
                    .disabled(!writer.isSupported)

                    Text(writer.status).font(.callout).foregroundStyle(.secondary).multilineTextAlignment(.center)

                    VStack(alignment: .leading, spacing: 14) {
                        Text("Card link").font(.footnote.bold())
                        TextField("https://you.github.io/card/", text: $writer.link)
                            .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                            .padding(12).background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
                        Toggle("Batch mode: keep writing card after card", isOn: $writer.batch)
                        Toggle("Lock each card (permanent)", isOn: $writer.lock)
                        Button("Check a card: read what's on it") { writer.verify() }.disabled(!writer.isSupported)
                    }
                    .padding(16)
                    .background(RoundedRectangle(cornerRadius: 18).fill(Color(.systemBackground)).shadow(color: .black.opacity(0.06), radius: 10))

                    Text("Use NTAG213, 215 or 216 cards or stickers (about $1). Your link never changes, so a burned card keeps working when you edit your ScholarTap.")
                        .font(.footnote).foregroundStyle(.secondary)
                    Text("ScholarTap · developed by Ankush Sharma at the University of Georgia")
                        .font(.caption2).foregroundStyle(.tertiary).padding(.top, 8)
                }
                .padding(20)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Burn your NFC card")
        }
        .tint(red)
        .onAppear { if writer.link.isEmpty { writer.link = savedLink } }
        .onChange(of: writer.link) { savedLink = $0 }
    }
}
