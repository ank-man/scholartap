import CoreNFC
import Foundation

/// Writes a URL record to NDEF tags (NTAG213/215/216 cards and stickers) with Core NFC.
/// Modes: write once, batch (keep writing card after card), optional permanent lock, and verify (read back).
@MainActor
final class NFCWriter: NSObject, ObservableObject {
    enum Mode { case write, verify }

    @Published var link: String = ""
    @Published var batch = false
    @Published var lock = false
    @Published var written = 0
    @Published var status = "Hold a blank NFC card near the top of your iPhone."
    @Published var lastRead: String?

    private var session: NFCNDEFReaderSession?
    private var mode: Mode = .write

    var isSupported: Bool { NFCNDEFReaderSession.readingAvailable }

    var validURL: URL? {
        guard let u = URL(string: link.trimmingCharacters(in: .whitespacesAndNewlines)),
              let scheme = u.scheme?.lowercased(), scheme == "https" || scheme == "http", u.host != nil else { return nil }
        return u
    }

    func write() { start(.write) }
    func verify() { start(.verify) }

    private func start(_ m: Mode) {
        guard isSupported else { status = "This iPhone can't use NFC (iPhone 7 or newer needed)."; return }
        if m == .write && validURL == nil { status = "That link doesn't look right."; return }
        mode = m
        let s = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateAfterFirstRead: false)
        s.alertMessage = m == .write ? "Hold your NFC card near the top of your iPhone." : "Hold the card to check what's on it."
        session = s
        s.begin()
    }

    nonisolated private func finish(_ session: NFCNDEFReaderSession, ok: String? = nil, error: String? = nil) {
        if let ok { session.alertMessage = ok; session.invalidate() }
        else if let error { session.invalidate(errorMessage: error) }
    }
}

extension NFCWriter: NFCNDEFReaderSessionDelegate {
    nonisolated func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {}

    nonisolated func readerSessionDidBecomeActive(_ session: NFCNDEFReaderSession) {}

    nonisolated func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        let code = (error as? NFCReaderError)?.code
        Task { @MainActor in
            self.session = nil
            if code != .readerSessionInvalidationErrorUserCanceled && code != .readerSessionInvalidationErrorFirstNDEFTagRead {
                if self.written == 0 && self.mode == .write { self.status = error.localizedDescription }
            }
        }
    }

    nonisolated func readerSession(_ session: NFCNDEFReaderSession, didDetect tags: [NFCNDEFTag]) {
        guard let tag = tags.first else { return }
        if tags.count > 1 {
            session.alertMessage = "More than one card found. Hold just one."
            DispatchQueue.global().asyncAfter(deadline: .now() + .milliseconds(600)) { session.restartPolling() }
            return
        }
        Task { @MainActor in
            let mode = self.mode, url = self.validURL, lock = self.lock, batch = self.batch
            session.connect(to: tag) { error in
                if let error { self.finish(session, error: "Couldn't connect: \(error.localizedDescription)"); return }
                tag.queryNDEFStatus { state, capacity, error in
                    if let error { self.finish(session, error: "Couldn't read the card: \(error.localizedDescription)"); return }
                    switch mode {
                    case .verify: self.read(tag, session: session)
                    case .write:
                        guard let url, let record = NFCNDEFPayload.wellKnownTypeURIPayload(url: url) else {
                            self.finish(session, error: "That link doesn't look right."); return
                        }
                        let message = NFCNDEFMessage(records: [record])
                        switch state {
                        case .notSupported: self.finish(session, error: "This card isn't NFC Forum (NDEF) compatible.")
                        case .readOnly: self.finish(session, error: "This card is locked and can't be rewritten.")
                        case .readWrite:
                            if message.length > capacity { self.finish(session, error: "The link is too long for this card (\(capacity) bytes)."); return }
                            tag.writeNDEF(message) { error in
                                if let error { self.finish(session, error: "Write failed: \(error.localizedDescription)"); return }
                                let done: () -> Void = {
                                    Task { @MainActor in
                                        self.written += 1
                                        self.status = "Burned \(self.written) card\(self.written == 1 ? "" : "s"). Tap one with any phone to test."
                                    }
                                    if batch {
                                        session.alertMessage = "Done. Hold the next card."
                                        DispatchQueue.global().asyncAfter(deadline: .now() + .seconds(1)) { session.restartPolling() }
                                    } else {
                                        self.finish(session, ok: "Burned! Your card now opens your ScholarTap.")
                                    }
                                }
                                if lock {
                                    tag.writeLock { error in
                                        if let error { session.alertMessage = "Written, but couldn't lock: \(error.localizedDescription)" }
                                        done()
                                    }
                                } else { done() }
                            }
                        @unknown default: self.finish(session, error: "Unknown card state.")
                        }
                    }
                }
            }
        }
    }

    nonisolated private func read(_ tag: NFCNDEFTag, session: NFCNDEFReaderSession) {
        tag.readNDEF { message, error in
            let urls = (message?.records ?? []).compactMap { $0.wellKnownTypeURIPayload()?.absoluteString }
            Task { @MainActor in
                self.lastRead = urls.first ?? (error == nil ? "Blank card" : "Nothing readable")
                let mine = urls.contains { u in
                    guard let target = self.validURL?.absoluteString.split(separator: "?").first else { return false }
                    return u.hasPrefix(String(target))
                }
                self.status = mine ? "This card opens your ScholarTap." : "This card holds: \(self.lastRead ?? "")"
            }
            self.finish(session, ok: urls.isEmpty ? "Blank card." : "Read: \(urls[0])")
        }
    }
}
