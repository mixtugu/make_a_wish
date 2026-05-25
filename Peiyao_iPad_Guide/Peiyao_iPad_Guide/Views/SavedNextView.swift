//
//  SavedNextView.swift
//  Peiyao_iPad_Guide
//
//  Created by 이서정 on 10/29/25.
//

import SwiftUI
import Supabase

struct SavedNextView: View {
    let lang: AppLanguage
    let nationality: NationalityOption?
    let drawingImage: UIImage?
    
    // Supabase configuration (avoid accessing internal properties on SupabaseClient)
    private let supabaseBaseURL = URL(string: "https://vopzwwcdiqdteivkuyqr.supabase.co")!
    private let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcHp3d2NkaXFkdGVpdmt1eXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTIxMzcsImV4cCI6MjA3NzE4ODEzN30.Jq4LiaOfpUHZszSPV0UzNI6SI4ea6bagRTsMXb8eMCw"
    
    @State private var loadedImage: UIImage? = nil
    @Environment(\.scenePhase) private var scenePhase
    @State private var goNext = false
    @State private var pollingTask: Task<Void, Never>? = nil
    
    private func log(_ message: String) {
        print("[SavedNextView] \(message)")
    }
    
    // MARK: - Storage Upload Helper
    private func uploadSavedDrawingAndReturnURL() async -> String? {
        // Load PNG from Documents
        let fileName = "saved_drawing.png"
        let fm = FileManager.default
        guard let docs = fm.urls(for: .documentDirectory, in: .userDomainMask).first else {
            log("[Storage] Documents directory not found")
            return nil
        }
        let fileURL = docs.appendingPathComponent(fileName)
        guard let data = try? Data(contentsOf: fileURL) else {
            log("[Storage] Failed to read saved image data at \(fileURL.path)")
            return nil
        }

        // Build Storage upload URL: /storage/v1/object/<bucket>/<objectPath>
        // NOTE: Bucket must exist and allow anon uploads by policy.
        let bucket = "drawings"
        let objectPath = "\(UUID().uuidString).png"
        let uploadURL = supabaseBaseURL.appendingPathComponent("storage/v1/object/\(bucket)/\(objectPath)")
        log("[Storage] Upload URL: \(uploadURL.absoluteString)")

        var req = URLRequest(url: uploadURL)
        req.httpMethod = "POST"
        req.httpBody = data
        req.addValue("image/png", forHTTPHeaderField: "Content-Type")
        req.addValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        req.addValue(supabaseAnonKey, forHTTPHeaderField: "apikey")

        do {
            let (respData, resp) = try await URLSession.shared.data(for: req)
            if let http = resp as? HTTPURLResponse {
                log("[Storage] Upload HTTP \(http.statusCode)")
                if http.statusCode >= 300 {
                    let msg = String(data: respData, encoding: .utf8) ?? "<no body>"
                    log("[Storage] Upload error body: \(msg)")
                    return nil
                }
            }
            // Build public URL (bucket must be public or have public policy)
            let publicURL = supabaseBaseURL.appendingPathComponent("storage/v1/object/public/\(bucket)/\(objectPath)")
            log("[Storage] Public URL: \(publicURL.absoluteString)")
            return publicURL.absoluteString
        } catch {
            log("[Storage] Upload error: \(error)")
            return nil
        }
    }
    
    // MARK: - Supabase REST Polling for status == "nfctagged"
    struct CurrentDataRow: Decodable { let status: String? }

    private func startPollingForNFCTagged() {
        // Cancel any existing task
        pollingTask?.cancel()
        pollingTask = Task {
            await pollLoop()
        }
    }

    private func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }

    private func buildCurrentDataURL() -> URL? {
        var comps = URLComponents(url: supabaseBaseURL.appendingPathComponent("rest/v1/currentdata"), resolvingAgainstBaseURL: false)
        comps?.queryItems = [
            URLQueryItem(name: "select", value: "status"),
            URLQueryItem(name: "status", value: "eq.nfctagged"),
            URLQueryItem(name: "limit", value: "1")
        ]
        return comps?.url
    }

    private func pollLoop() async {
        guard let url = buildCurrentDataURL() else {
            log("Failed to build REST URL")
            return
        }
        var request = URLRequest(url: url)
        // Headers for Supabase REST
        request.addValue("application/json", forHTTPHeaderField: "Accept")
        request.addValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.addValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        // Prefer narrow payload (optional)
        request.addValue("count=none", forHTTPHeaderField: "Prefer")

        while !Task.isCancelled {
            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                if let http = response as? HTTPURLResponse {
                    log("Polling status: HTTP \(http.statusCode)")
                }
                let rows = try JSONDecoder().decode([CurrentDataRow].self, from: data)
                if let first = rows.first, (first.status ?? "") == "nfctagged" {
                    log("Detected status == nfctagged via REST polling — transferring to lockeddata and clearing currentdata")
                    await transferNfcTaggedAndClear()
                    await MainActor.run { self.goNext = true }
                    break
                }
            } catch {
                log("Polling error: \(error)")
            }
            // backoff ~1.5s
            try? await Task.sleep(nanoseconds: 1_500_000_000)
        }
    }

    // MARK: - Transfer currentdata (nfctagged) → lockeddata, then clear currentdata
    private func transferNfcTaggedAndClear() async {
        // 1) Fetch rows with status = nfctagged (build ABSOLUTE URL)
        let currentDataBase = supabaseBaseURL.appendingPathComponent("rest/v1/currentdata")
        var comps = URLComponents(url: currentDataBase, resolvingAgainstBaseURL: false)!
        comps.queryItems = [
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "status", value: "eq.nfctagged")
        ]
        let selectURL = comps.url!
        log("Transfer selectURL: \(selectURL.absoluteString)")

        var getReq = URLRequest(url: selectURL)
        getReq.httpMethod = "GET"
        getReq.addValue("application/json", forHTTPHeaderField: "Accept")
        getReq.addValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        getReq.addValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        getReq.addValue("count=none", forHTTPHeaderField: "Prefer")

        do {
            log("Transfer step 1: Fetching nfctagged rows from currentdata")
            let (data, resp) = try await URLSession.shared.data(for: getReq)
            if let http = resp as? HTTPURLResponse { log("GET nfctagged rows: HTTP \(http.statusCode)") }

            // If nothing to move, stop here
            guard let rawArray = try JSONSerialization.jsonObject(with: data) as? [[String: Any]], !rawArray.isEmpty else {
                log("No nfctagged rows to transfer; skip delete/insert")
                return
            }

            // 2) 이미지 업로드 (한 번) 후 lockeddata로 그대로 이관하되 status만 'locked'로 변경
            // currentdata에 image_url이 이미 있더라도, 업로드가 성공하면 새 URL로 덮어씁니다.
            // 업로드 실패 시에는 currentdata의 image_url 값을 유지합니다.
            let uploadedImageURL = await uploadSavedDrawingAndReturnURL()
            if uploadedImageURL == nil { log("[Storage] Proceeding without new image_url (upload failed) — will keep existing image_url if present") }

            // Build payload for lockeddata with only its schema keys (exclude currentdata.updated_at)
            // lockeddata columns: id, nfc_id, image_url, status, meta, created_at
            var filtered: [[String: Any]] = []
            let allowedKeys: Set<String> = ["id", "nfc_id", "image_url", "status", "meta", "created_at"]

            for row in rawArray {
                var m: [String: Any] = [:]

                // id (use current.id if present, otherwise generate)
                if let idVal = row["id"], !(idVal is NSNull) {
                    m["id"] = idVal
                } else {
                    let newID = UUID().uuidString
                    m["id"] = newID
                    log("Row without id — generating new UUID for lockeddata: \(newID)")
                }

                // nfc_id, image_url, meta, created_at (copy if present)
                if let nfc = row["nfc_id"], !(nfc is NSNull) { m["nfc_id"] = nfc }
                if let created = row["created_at"], !(created is NSNull) { m["created_at"] = created }

                // image_url: prefer the newly uploaded URL; otherwise keep original if any
                if let urlStr = uploadedImageURL {
                    m["image_url"] = urlStr
                } else if let img = row["image_url"], !(img is NSNull) {
                    m["image_url"] = img
                }

                // meta: ensure JSON object if it arrived as string
                if let metaVal = row["meta"], !(metaVal is NSNull) {
                    if let metaStr = metaVal as? String, let d = metaStr.data(using: .utf8),
                       let jsonObj = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
                        m["meta"] = jsonObj
                    } else {
                        m["meta"] = metaVal
                    }
                }

                // force status = 'locked'
                m["status"] = "locked"

                // finally, drop any keys not in allowedKeys (defensive)
                m = m.filter { allowedKeys.contains($0.key) }

                filtered.append(m)
            }

            guard !filtered.isEmpty else {
                log("Nothing to insert after copying rows; aborting transfer")
                return
            }
            if let sample = filtered.first {
                log("lockeddata insert sample body: \(sample)")
            }

            // 2) Insert into lockeddata (bulk insert using filtered body)
            let lockedURL = supabaseBaseURL.appendingPathComponent("rest/v1/lockeddata")
            log("Transfer lockedURL: \(lockedURL.absoluteString)")
            log("Transfer step 2: Inserting rows into lockeddata (count=\(filtered.count))")
            var postReq = URLRequest(url: lockedURL)
            postReq.httpMethod = "POST"
            postReq.addValue("application/json", forHTTPHeaderField: "Content-Type")
            postReq.addValue("application/json", forHTTPHeaderField: "Accept")
            postReq.addValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
            postReq.addValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
            postReq.addValue("return=representation", forHTTPHeaderField: "Prefer")
            let bodyData = try JSONSerialization.data(withJSONObject: filtered, options: [])
            postReq.httpBody = bodyData

            let (postData, postResp) = try await URLSession.shared.data(for: postReq)
            // 3) Insert 결과가 성공(2xx)일 때에만 currentdata의 해당 rows 삭제
            var insertSucceeded = false
            if let http = postResp as? HTTPURLResponse {
                log("POST → lockeddata: HTTP \(http.statusCode)")
                if (200...299).contains(http.statusCode) {
                    insertSucceeded = true
                } else {
                    let msg = String(data: postData, encoding: .utf8) ?? "<no response body>"
                    log("lockeddata POST error body: \(msg)")
                }
            }

            if insertSucceeded {
                log("Transfer step 3: Deleting moved nfctagged rows from currentdata")
                await deleteNfcTaggedRows()
            } else {
                log("Insert to lockeddata failed — skipping delete to avoid data loss")
                return
            }
        } catch {
            log("Transfer error: \(error)")
        }
    }

    private func deleteNfcTaggedRows() async {
        let currentDataBase = supabaseBaseURL.appendingPathComponent("rest/v1/currentdata")
        var comps = URLComponents(url: currentDataBase, resolvingAgainstBaseURL: false)!
        comps.queryItems = [ URLQueryItem(name: "status", value: "eq.nfctagged") ]
        var delReq = URLRequest(url: comps.url!)
        log("DELETE nfctagged URL: \(comps.url!.absoluteString)")
        delReq.httpMethod = "DELETE"
        delReq.addValue("application/json", forHTTPHeaderField: "Accept")
        delReq.addValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        delReq.addValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        delReq.addValue("return=minimal", forHTTPHeaderField: "Prefer")
        do {
            let (_, resp) = try await URLSession.shared.data(for: delReq)
            if let http = resp as? HTTPURLResponse { log("DELETE nfctagged: HTTP \(http.statusCode)") }
        } catch { log("DELETE nfctagged error: \(error)") }
    }

    // MARK: - NFC image by nationality
    private func nfcTouchAssetName() -> String {
        switch nationality {
        case .some(.japanese):
            return UIImage(named: "nfctouchj") != nil ? "nfctouchj" : "nfctouch"
        case .some(.foreignResident):
            return UIImage(named: "nfctouchf") != nil ? "nfctouchf" : "nfctouch"
        case .none:
            return "nfctouch"
        }
    }

    var body: some View {
        ZStack(alignment: .top) {
            // Full-screen background color covering safe areas
            Color(red: 255/255, green: 209/255, blue: 141/255)
                .ignoresSafeArea()

            Image("ema2")
                .resizable()
                .scaledToFit()
                .frame(maxHeight: 500)
                .opacity(1)
                .ignoresSafeArea()

            VStack(spacing: 20) {
                // 1) 그림 프리뷰 (디스크에서 로드한 이미지 우선, 없으면 전달된 이미지)
                if let image = loadedImage ?? drawingImage {
                    preview(image)
                        .onAppear {
                            #if DEBUG
                            print("[SavedNextView] Displaying image source: \(loadedImage != nil ? "loadedImage" : "drawingImage")")
                            #endif
                        }
                } else {
                    Text("No saved image available")
                        .foregroundColor(.gray)
                        .appFont(lang, size: 16)
                }

                // 2) 좌측 화살표 + 가운데 텍스트
                ZStack {
                    HStack {
                        Image("direct1")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 100, height: 100)
                            .foregroundColor(.black)
                            .padding(.leading)
                        Spacer()
                    }
                    Text(LocalizedText.place(for: lang))
                        .appSecondaryFont(lang, size: 28)
                        .foregroundColor(.black)
                        .multilineTextAlignment(.center)
                        .lineSpacing(18)
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal)

                // 3) NFC 아이콘
                Image(nfcTouchAssetName())
                    .resizable()
                    .scaledToFit()
                    .frame(width: 350)
                    .foregroundColor(.gray)
                    .padding(.top, 20)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .offset(x: 80)
                    .accessibilityLabel("NFC touch illustration")
            }
            .padding(.top, 120)

            VStack {
                Spacer()
                FooterView()
                    .environment(\.font, FontManager.font(for: lang, size: 14))
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 12)
            }
        }
        .onAppear {
            log("onAppear - starting REST polling")
            loadedImage = loadSavedImage(named: "saved_drawing.png")
            log("Loaded image exists: \((loadedImage != nil) ? "yes" : "no")")
            startPollingForNFCTagged()
        }
        .onChange(of: scenePhase) { newPhase in
            log("scenePhase changed: \(newPhase == .active ? "active" : (newPhase == .inactive ? "inactive" : "background"))")
            // 포그라운드 복귀 시 다시 로드 (시뮬레이터/프리뷰 세션 차이 대응)
            if newPhase == .active {
                loadedImage = loadSavedImage(named: "saved_drawing.png")
                log("Reloaded image exists: \((loadedImage != nil) ? "yes" : "no")")
            }
        }
        .onDisappear {
            log("onDisappear - stopping polling")
            stopPolling()
        }
        .fullScreenCover(isPresented: $goNext) {
            AttachFortuneView(lang: lang, nationality: nationality)
                .interactiveDismissDisabled(true)
        }
    }
    
    struct LocalizedText {
        static func place(for lang: AppLanguage) -> String {
            switch lang {
            case .ko: return "소원 종이를 스마트폰 상단에 터치해주세요"
            case .en: return "Please touch your wish paper on\nthe top of the smartphone"
            case .ja: return "スマートフォンの上に願い紙\nをかざしてください"
            case .zh: return "请触摸手机上端的心愿纸"
            }
        }
    }
    
    private func loadSavedImage(named fileName: String) -> UIImage? {
        print("[SavedNextView] Attempting to load image: \(fileName)")
        let fileManager = FileManager.default
        guard let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else {
            return nil
        }
        let fileURL = documentsURL.appendingPathComponent(fileName)
        print("[SavedNextView] File path: \(fileURL.path)")
        if fileManager.fileExists(atPath: fileURL.path) {
            print("[SavedNextView] File exists ✅")
        } else {
            print("[SavedNextView] File not found ❌")
        }
        let image = UIImage(contentsOfFile: fileURL.path)
        if let image = image {
            print("[SavedNextView] UIImage loaded successfully with size: \(image.size.width)x\(image.size.height)")
        } else {
            print("[SavedNextView] Failed to load UIImage from file")
        }
        return image
    }
    
    // MARK: - View Helpers
    @ViewBuilder
    private func preview(_ image: UIImage) -> some View {
        Image(uiImage: image)
            .resizable()
            .scaledToFit()
            .frame(width: 575, height: 330)
            // Solid white backdrop so transparent canvas / light strokes are visible
            .background(Color.white)
            .overlay(
                Rectangle()
                    .stroke(Color.gray.opacity(0.25), lineWidth: 0)
            )
            .padding(.vertical)
    }
}

#Preview {
    NavigationStack {
        SavedNextView(lang: .en, nationality: .foreignResident ,drawingImage: UIImage(systemName: "pencil"))
    }
}
