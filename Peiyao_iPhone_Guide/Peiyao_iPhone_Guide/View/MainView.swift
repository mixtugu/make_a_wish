//
//  MainView.swift
//  Peiyao_iPhone_Guide
//
//  Created by 이서정 on 10/30/25.
//

import SwiftUI


struct MainView: View {
    // MARK: - Supabase (REST) Config
    private let supabaseBaseURL = URL(string: "https://vopzwwcdiqdteivkuyqr.supabase.co")!
    private let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcHp3d2NkaXFkdGVpdmt1eXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTIxMzcsImV4cCI6MjA3NzE4ODEzN30.Jq4LiaOfpUHZszSPV0UzNI6SI4ea6bagRTsMXb8eMCw"

    // MARK: - State
    @State private var showNFC = false
    @State private var pollingTask: Task<Void, Never>? = nil
    @State private var detectedStatus: String? = nil
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        // 기본 메인 화면만 렌더링하고, 조건 만족 시 전체 화면으로 NFCView를 덮어씌웁니다.
        ZStack {
            Color(red: 255/255, green: 209/255, blue: 141/255).ignoresSafeArea()
            ZStack {
                Circle()
                    .stroke(Color.white, lineWidth: 6)
                    .frame(width: 200, height: 200)
                
                Text("Make a Wish")
                    .font(.custom("Chalkduster", size: 39))
                    .foregroundColor(.black)
            }
        }
        .onAppear {
            startPolling()
        }
        .onChange(of: scenePhase) { newPhase in
            if newPhase == .active {
                startPolling()
            } else if newPhase == .background {
                stopPolling()
            }
        }
        .onDisappear {
            stopPolling()
        }
        .overlay(alignment: .center) {
            if showNFC {
                NFCView(detectedStatus: detectedStatus)
                    .ignoresSafeArea()
                    .transition(.identity)  // no transition animation
                    .zIndex(1)              // ensure it stays on top
            }
        }
    }

    // MARK: - Polling
    private func startPolling() {
        // 중복 방지
        pollingTask?.cancel()
        pollingTask = Task {
            await pollLoop()
        }
    }

    private func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }

    private func buildCheckURL() -> URL {
        var comps = URLComponents(url: supabaseBaseURL.appendingPathComponent("rest/v1/currentdata"), resolvingAgainstBaseURL: false)!
        // status IN ('waiting','unlockwaiting') AND select status only, limit=1
        comps.queryItems = [
            URLQueryItem(name: "select", value: "status"),
            URLQueryItem(name: "status", value: "in.(waiting,unlockwaiting)"),
            URLQueryItem(name: "limit", value: "1")
        ]
        return comps.url!
    }

    private func makeGETRequest(url: URL) -> URLRequest {
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.addValue("application/json", forHTTPHeaderField: "Accept")
        req.addValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        req.addValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.addValue("count=none", forHTTPHeaderField: "Prefer")
        return req
    }

    private func pollLoop() async {
        let url = buildCheckURL()
        var req = makeGETRequest(url: url)

        while !Task.isCancelled && !showNFC {
            do {
                let (data, resp) = try await URLSession.shared.data(for: req)
                if let http = resp as? HTTPURLResponse {
                    #if DEBUG
                    print("[MainView] Poll HTTP \(http.statusCode)")
                    #endif
                }
                // rows: [{"status":"waiting"}] OR empty array
                if let arr = try JSONSerialization.jsonObject(with: data) as? [[String: Any]],
                   let first = arr.first,
                   let status = (first["status"] as? String)?.lowercased(),
                   status == "waiting" || status == "unlockwaiting" {
                    await MainActor.run {
                        detectedStatus = status
                        showNFC = true
                    }
                    break
                }
            } catch {
                #if DEBUG
                print("[MainView] Poll error: \(error)")
                #endif
            }
            // backoff
            try? await Task.sleep(nanoseconds: 1_500_000_000) // 1.5s
            // refresh request instance each loop in case of caching (defensive)
            req = makeGETRequest(url: url)
        }
    }
}

// 미리보기
#Preview {
    MainView()
}
