//
//  RemoveTouchView.swift
//  Peiyao_iPad_Guide
//
//  Created by 이서정 on 10/29/25.
//

import SwiftUI
import Supabase

// REST config (match SavedNextView)
private let supabaseBaseURL = URL(string: "https://vopzwwcdiqdteivkuyqr.supabase.co")!
private let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcHp3d2NkaXFkdGVpdmt1eXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTIxMzcsImV4cCI6MjA3NzE4ODEzN30.Jq4LiaOfpUHZszSPV0UzNI6SI4ea6bagRTsMXb8eMCw"

struct RemoveTouchView: View {
    let lang: AppLanguage
    let nationality: NationalityOption?
    @State private var goNext = false
    @State private var pollingTask: Task<Void, Never>? = nil
    private func log(_ s: String) { print("[RemoveTouchView] \(s)") }
    private struct Row: Decodable { let status: String? }

    // MARK: - Image by nationality (stringtouch)
    private func stringTouchAssetName() -> String {
        switch nationality {
        case .some(.japanese):
            return UIImage(named: "stringtouchj") != nil ? "stringtouchj" : "stringtouch"
        case .some(.foreignResident):
            return UIImage(named: "stringtouchf") != nil ? "stringtouchf" : "stringtouch"
        case .none:
            return "stringtouch"
        }
    }

    var body: some View {
        ZStack {
            // Full-bleed background
            Color(red: 255/255, green: 209/255, blue: 141/255)
                .ignoresSafeArea()
            Image("direct1")
                .resizable()
                .scaledToFit()
                .frame(width: 100) // 필요 시 조정
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 12)
                .offset(y: 80)
                .allowsHitTesting(false)

            GeometryReader { geo in
                VStack(spacing: 24) {
                    // Image that takes about 2/3 of the screen height
                    Image(stringTouchAssetName())
                        .resizable()
                        .scaledToFit()
                        .frame(height: geo.size.height * 0.66)
                        .foregroundColor(.gray.opacity(0.7))
                        .accessibilityLabel("String touch illustration")

                    // Explanatory text
                    Text(LocalizedText.message(for: lang))
                        .appSecondaryFont(lang, size: 28)
                        .multilineTextAlignment(.leading)
                        .foregroundColor(.black)
                        .lineSpacing(18)
                        .padding(.horizontal, 32)

                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                // Insert the footer anchored at the bottom, inside the ZStack
                VStack {
                    Spacer()
                    FooterView()
                        .environment(\.font, FontManager.font(for: lang, size: 14))
                        .frame(maxWidth: .infinity)
                        .padding(.bottom, 12)
                }
            }
        }
        .task {
            pollingTask?.cancel()
            pollingTask = Task { await monitorUnlockStatus() }
        }
        .onDisappear { pollingTask?.cancel(); pollingTask = nil }
        .fullScreenCover(isPresented: $goNext) {
            UnlockedView(lang: lang)
                .interactiveDismissDisabled(true)
        }
    }

    private func buildUnlockURL() -> URL? {
        var comps = URLComponents(url: supabaseBaseURL.appendingPathComponent("rest/v1/currentdata"), resolvingAgainstBaseURL: false)
        comps?.queryItems = [
            URLQueryItem(name: "select", value: "status"),
            URLQueryItem(name: "status", value: "eq.unlocknfctagged"),
            URLQueryItem(name: "limit", value: "1")
        ]
        return comps?.url
    }

    private func monitorUnlockStatus() async {
        // 1) 먼저 상태 감지만 수행 (있으면 이동 + 이전에 안전하게 전송/정리)
        guard let url = buildUnlockURL() else { log("Failed to build unlock URL"); return }
        var req = URLRequest(url: url)
        req.addValue("application/json", forHTTPHeaderField: "Accept")
        req.addValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        req.addValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.addValue("count=none", forHTTPHeaderField: "Prefer")

        while !Task.isCancelled {
            do {
                let (data, resp) = try await URLSession.shared.data(for: req)
                if let http = resp as? HTTPURLResponse { log("Polling unlock: HTTP \(http.statusCode)") }
                let rows = try JSONDecoder().decode([Row].self, from: data)
                if let first = rows.first, (first.status ?? "") == "unlocknfctagged" {
                    log("Detected status == unlocknfctagged — transferring to unlockeddata & clearing currentdata")
                    // 2) 전송 + 삭제 수행
                    await transferUnlockAndClear()
                    // 3) 화면 전환
                    await MainActor.run { goNext = true }
                    break
                }
            } catch {
                log("Polling error: \(error)")
            }
            try? await Task.sleep(nanoseconds: 1_500_000_000)
        }
    }

    private func transferUnlockAndClear() async {
        // (a) Find trigger rows in currentdata (status=unlocknfctagged)
        let currentBase = supabaseBaseURL.appendingPathComponent("rest/v1/currentdata")
        var cComps = URLComponents(url: currentBase, resolvingAgainstBaseURL: false)!
        cComps.queryItems = [
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "status", value: "eq.unlocknfctagged")
        ]
        let cURL = cComps.url!
        log("[unlock-join] select currentdata unlocknfctagged → \(cURL.absoluteString)")

        var cReq = URLRequest(url: cURL)
        cReq.httpMethod = "GET"
        cReq.addValue("application/json", forHTTPHeaderField: "Accept")
        cReq.addValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        cReq.addValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        cReq.addValue("count=none", forHTTPHeaderField: "Prefer")

        do {
            let (cData, cResp) = try await URLSession.shared.data(for: cReq)
            if let http = cResp as? HTTPURLResponse { log("[unlock-join] GET currentdata: HTTP \(http.statusCode)") }
            guard let currentRows = try JSONSerialization.jsonObject(with: cData) as? [[String: Any]], !currentRows.isEmpty else {
                log("[unlock-join] No unlocknfctagged rows; nothing to do")
                return
            }

            // Extract unique, non-null nfc_id values from current rows
            let nfcIDs: [String] = Array(Set(currentRows.compactMap { r in
                if let v = r["nfc_id"] as? String, !v.isEmpty { return v }
                return nil
            }))
            guard !nfcIDs.isEmpty else {
                log("[unlock-join] No nfc_id present in unlocknfctagged rows; aborting")
                return
            }
            log("[unlock-join] nfcIDs to process: \(nfcIDs)")

            // (b) For each nfc_id, fetch the matching lockeddata row
            let lockedBase = supabaseBaseURL.appendingPathComponent("rest/v1/lockeddata")
            var payload: [[String: Any]] = []
            let allowedLockedKeys: Set<String> = ["id", "nfc_id", "image_url", "meta", "created_at"]

            for nfc in nfcIDs {
                var lComps = URLComponents(url: lockedBase, resolvingAgainstBaseURL: false)!
                lComps.queryItems = [
                    URLQueryItem(name: "select", value: "*"),
                    URLQueryItem(name: "nfc_id", value: "eq.\(nfc)"),
                    URLQueryItem(name: "limit", value: "1")
                ]
                let lURL = lComps.url!
                log("[unlock-join] select lockeddata by nfc_id=\(nfc) → \(lURL.absoluteString)")

                var lReq = URLRequest(url: lURL)
                lReq.httpMethod = "GET"
                lReq.addValue("application/json", forHTTPHeaderField: "Accept")
                lReq.addValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
                lReq.addValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
                lReq.addValue("count=none", forHTTPHeaderField: "Prefer")

                let (lData, lResp) = try await URLSession.shared.data(for: lReq)
                if let http = lResp as? HTTPURLResponse { log("[unlock-join] GET lockeddata(nfc=\(nfc)): HTTP \(http.statusCode)") }

                guard
                    let rows = try JSONSerialization.jsonObject(with: lData) as? [[String: Any]],
                    let first = rows.first
                else {
                    log("[unlock-join] No lockeddata row for nfc=\(nfc); skipping")
                    continue
                }

                var m: [String: Any] = [:]
                for (k, v) in first where allowedLockedKeys.contains(k) {
                    if k == "created_at" {
                        continue
                    }
                    if !(v is NSNull) {
                        if k == "meta", let s = v as? String, let d = s.data(using: .utf8),
                           let json = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
                            m[k] = json
                        } else {
                            m[k] = v
                        }
                    }
                }
                m["created_at"] = ISO8601DateFormatter().string(from: Date())
                // Override status to unlocked for insert target
                m["status"] = "unlocked"
                payload.append(m)
            }

            guard !payload.isEmpty else {
                log("[unlock-join] Nothing to insert (no matching lockeddata rows)")
                return
            }

            // (c) Insert into unlockeddata
            let unlockedURL = supabaseBaseURL.appendingPathComponent("rest/v1/unlockeddata")
            log("[unlock-join] insert unlockeddata: \(unlockedURL.absoluteString) count=\(payload.count)")

            var uReq = URLRequest(url: unlockedURL)
            uReq.httpMethod = "POST"
            uReq.addValue("application/json", forHTTPHeaderField: "Content-Type")
            uReq.addValue("application/json", forHTTPHeaderField: "Accept")
            uReq.addValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
            uReq.addValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
            uReq.addValue("return=representation", forHTTPHeaderField: "Prefer")
            uReq.httpBody = try JSONSerialization.data(withJSONObject: payload, options: [])

            let (uData, uResp) = try await URLSession.shared.data(for: uReq)
            if let http = uResp as? HTTPURLResponse {
                log("[unlock-join] POST → unlockeddata: HTTP \(http.statusCode)")
                if http.statusCode >= 400 {
                    let msg = String(data: uData, encoding: .utf8) ?? "<no body>"
                    log("[unlock-join] unlockeddata POST error: \(msg)")
                    return // Do not delete on failure
                }
            }

            // (d1) Delete currentdata rows with status=unlocknfctagged
            var delCComps = URLComponents(url: currentBase, resolvingAgainstBaseURL: false)!
            delCComps.queryItems = [ URLQueryItem(name: "status", value: "eq.unlocknfctagged") ]
            let delCURL = delCComps.url!
            log("[unlock-join] DELETE currentdata unlocknfctagged: \(delCURL.absoluteString)")

            var delCReq = URLRequest(url: delCURL)
            delCReq.httpMethod = "DELETE"
            delCReq.addValue("application/json", forHTTPHeaderField: "Accept")
            delCReq.addValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
            delCReq.addValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
            delCReq.addValue("return=minimal", forHTTPHeaderField: "Prefer")
            let (_, delCResp) = try await URLSession.shared.data(for: delCReq)
            if let http = delCResp as? HTTPURLResponse { log("[unlock-join] DELETE currentdata: HTTP \(http.statusCode)") }

            // (d2) Delete lockeddata rows that matched by nfc_id (use IN filter)
            let joined = nfcIDs.joined(separator: ",")
            var delLComps = URLComponents(url: lockedBase, resolvingAgainstBaseURL: false)!
            delLComps.queryItems = [ URLQueryItem(name: "nfc_id", value: "in.(\(joined))") ]
            let delLURL = delLComps.url!
            log("[unlock-join] DELETE lockeddata by nfc_id IN: \(delLURL.absoluteString)")

            var delLReq = URLRequest(url: delLURL)
            delLReq.httpMethod = "DELETE"
            delLReq.addValue("application/json", forHTTPHeaderField: "Accept")
            delLReq.addValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
            delLReq.addValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
            delLReq.addValue("return=minimal", forHTTPHeaderField: "Prefer")
            let (_, delLResp) = try await URLSession.shared.data(for: delLReq)
            if let http = delLResp as? HTTPURLResponse { log("[unlock-join] DELETE lockeddata: HTTP \(http.statusCode)") }

        } catch {
            log("[unlock-join] error: \(error)")
        }
    }

    struct LocalizedText {
        static func message(for lang: AppLanguage) -> String {
            switch lang {
            case .ko:
                return "당신의 것과 색이 다른 소원 종이를 고르고, \n실에서 떼어내세요"
            case .en:
                return "To continue the wishes,\npick an wish paper\n of a different color from yours,\nremove it from the string"
            case .ja:
                return "あなたのものと色の違う願い紙を選び、\n糸からはがします。"
            case .zh:
                return "请选择与您对应颜色不同的签纸，\n并轻轻从绳子上解下 。"
            }
        }
    }
}

#Preview {
    RemoveTouchView(lang: .en ,nationality: .foreignResident)
}
