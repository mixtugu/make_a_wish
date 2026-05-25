import SwiftUI

struct NFCView: View {
    let detectedStatus: String?
    
    init(detectedStatus: String? = nil) {
        self.detectedStatus = detectedStatus
    }
    // MARK: - Supabase REST config (read-only anon)
    private let supabaseBaseURL = URL(string: "https://vopzwwcdiqdteivkuyqr.supabase.co")!
    private let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcHp3d2NkaXFkdGVpdmt1eXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTIxMzcsImV4cCI6MjA3NzE4ODEzN30.Jq4LiaOfpUHZszSPV0UzNI6SI4ea6bagRTsMXb8eMCw"

    @Environment(\.scenePhase) private var scenePhase
    @State private var goHome: Bool = false
    @State private var pollingTask: Task<Void, Never>? = nil

    private var statusMessage: String {
        switch detectedStatus?.lowercased() {
        case "waiting":
            return "make\na\nwish"
        case "unlockwaiting":
            return "fulfill\nsomepne's\nwish"
        default:
            return "Make a Wish"
        }
    }

    var body: some View {
        ZStack {
            Color(red: 255/255, green: 209/255, blue: 141/255).ignoresSafeArea()
            VStack(spacing: 20) {
                // Top icon
                ZStack {
                    Image("nfctouchphone")
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: .infinity)
                        .padding(.top, 16)
                        .scaleEffect(1.2)
                    Text(statusMessage)
                        .font(.custom("Chalkduster", size: 29))
                        .foregroundColor(.white)
                        .multilineTextAlignment(.center)
                        .lineSpacing(10)
                        .padding(.top, 120)
                        .offset(y: -125)
                        .offset(x: 5)
                }
                ZStack {
                    Circle()
                        .stroke(Color.white, lineWidth: 6)
                        .frame(width: 200, height: 200)
                    
                    Text("make a wish")
                        .font(.custom("Chalkduster", size: 39))
                        .foregroundColor(.black)
                }
            }
            .padding()
        }
        .onAppear {
            startPolling()
        }
        .onChange(of: scenePhase) { newPhase in
            if newPhase == .active {
                startPolling()
            } else if newPhase == .background || newPhase == .inactive {
                stopPolling()
            }
        }
        .onDisappear { stopPolling() }
        .overlay(alignment: .center) {
            if goHome {
                MainView()
                    .ignoresSafeArea()
                    .transition(.identity)
                    .zIndex(1)
            }
        }
        .transaction { t in t.disablesAnimations = true }
    }
}

// MARK: - Polling Helpers
private extension NFCView {
    struct CurrentRow: Decodable { let status: String? }

    func startPolling() {
        // 중복 실행 방지
        pollingTask?.cancel()
        pollingTask = Task { await pollLoop() }
    }

    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }

    func buildCheckURL() -> URL? {
        // /rest/v1/currentdata?select=status&or=(status.eq.waiting,status.eq.unlockwaiting)&limit=1
        var comps = URLComponents(url: supabaseBaseURL.appendingPathComponent("rest/v1/currentdata"), resolvingAgainstBaseURL: false)
        comps?.queryItems = [
            URLQueryItem(name: "select", value: "status"),
            URLQueryItem(name: "or", value: "(status.eq.waiting,status.eq.unlockwaiting)"),
            URLQueryItem(name: "limit", value: "1")
        ]
        return comps?.url
    }

    func pollLoop() async {
        guard let url = buildCheckURL() else { return }
        var req = URLRequest(url: url)
        req.addValue("application/json", forHTTPHeaderField: "Accept")
        req.addValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        req.addValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.addValue("count=none", forHTTPHeaderField: "Prefer")

        while !Task.isCancelled {
            do {
                let (data, response) = try await URLSession.shared.data(for: req)
                if let http = response as? HTTPURLResponse {
                    print("[NFCView] poll HTTP=\(http.statusCode) bytes=\(data.count)")
                }
                // rows가 0이면 메인으로
                let rows = try JSONDecoder().decode([CurrentRow].self, from: data)
                if rows.isEmpty {
                    print("[NFCView] no waiting/unlockwaiting rows → goHome")
                    await MainActor.run {
                        goHome = true
                    }
                    break
                } else {
                    print("[NFCView] still has \(rows.count) row(s) with waiting/unlockwaiting → stay")
                }
            } catch {
                print("[NFCView] poll error: \(error)")
            }
            // backoff 1.5s
            try? await Task.sleep(nanoseconds: 1_500_000_000)
        }
    }
}

#Preview {
    NFCView(detectedStatus: "waiting")
}
