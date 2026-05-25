//
//  DrawWishView.swift
//  Peiyao_iPad_Guide
//
//  Created by 이서정 on 10/28/25.
//
import SwiftUI
import PencilKit
import Supabase

// MARK: - Temporary Supabase Client (replace with your project URL/Anon Key or central service)
private let supabaseClient: SupabaseClient = {
    let url = URL(string: "https://vopzwwcdiqdteivkuyqr.supabase.co")!
    let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcHp3d2NkaXFkdGVpdmt1eXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTIxMzcsImV4cCI6MjA3NzE4ODEzN30.Jq4LiaOfpUHZszSPV0UzNI6SI4ea6bagRTsMXb8eMCw"
    return SupabaseClient(supabaseURL: url, supabaseKey: anonKey)
}()

struct DrawWishView: View {
    let lang: AppLanguage
    let nationality: NationalityOption?
    @State private var drawing = PKDrawing()
    @State private var goNext: Bool = false
    @State private var canvasSize: CGSize = .zero
    @State private var savedImage: UIImage? = nil
    @State private var showSaveAlert: Bool = false
    @State private var saveAlertMessage: String = ""

    // MARK: - Drawing tool states
    @State private var inkColorSwiftUI: Color = .black
    @State private var inkColor: UIColor = .black
    @State private var inkWidth: CGFloat = 6
    @State private var toolKind: PencilCanvasView.ToolKind = .pen
    
    // MARK: - Language-based spacing
    private func bottomPaddingForLang() -> CGFloat {
        switch lang {
        case .ko: return 57   // 한국어
        case .ja: return 28   // 일본어
        case .en: return 33   // 영어
        case .zh: return 93   // 중국어
        }
    }

    // MARK: - Next Illustration (Nationality-only)
    private func nextIllustrationName() -> String {
        switch nationality {
        case .some(.japanese):
            return UIImage(named: "drawnext1") != nil ? "drawnext1" : "makeawish"
        case .some(.foreignResident):
            return UIImage(named: "drawnext2") != nil ? "drawnext2" : "makeawish"
        case .none:
            return "drawnext_default"
        }
    }

    var body: some View {
        ScrollView(.vertical) {
            ZStack(alignment: .top) {
                Image("newema")
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 1100)
                    .offset(x: 20)
                    .opacity(1)
                    .ignoresSafeArea()
                VStack(spacing: 20) {
            Text(LocalizedText.longDesc(for: lang))
                .appFont(lang, size: 28)
                .foregroundColor(.black)
                .multilineTextAlignment(.leading)
                .lineSpacing(14)
                .frame(maxWidth: 650, alignment: .leading)
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.white.opacity(0.7))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.black.opacity(0.2), lineWidth: 1)
                )
                .padding(.horizontal)
                .padding(.top, 40)
                .onAppear {
                    if let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
                        print("[DrawWishView] Documents dir: \(docs.path)")
                    }
                }
            ZStack {
                Text(LocalizedText.usePen(for: lang))
                    .appSecondaryFont(lang, size: 28)
                    .bold()
                    .lineSpacing(18)
                    .multilineTextAlignment(.center)
            }
            .overlay(alignment: .trailing) {
                Image("direct")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 120, height: 120)
                    .accessibilityHidden(true)
                    .offset(x: 180)
                    .opacity(0.3)
//                    .offset(x: 350)
//                Image("pencil")
//                    .resizable()
//                    .scaledToFit()
//                    .frame(width: 600, height: 600)
//                    .accessibilityHidden(true)
//                    .offset(x: 525)
//                    .offset(y: 100)
            }
            .frame(maxWidth: 600, alignment: .center)
            .padding(.top, 30)
            .padding(.bottom, bottomPaddingForLang())
            // MARK: - Simple Tool Bar (Color / Pen / Eraser / Width)
            HStack(spacing: 12) {
                // Color picker (SwiftUI) → UIColor bridge
                ColorPicker("", selection: $inkColorSwiftUI, supportsOpacity: false)
                    .labelsHidden()
                    .onChange(of: inkColorSwiftUI) { newColor in
                        #if canImport(UIKit)
                        if let ui = UIColor.from(newColor) { inkColor = ui }
                        #endif
                    }
                Button(action: { toolKind = .pen }) {
                    Text("✏️").padding(.horizontal, 10).padding(.vertical, 8)
                }
                .buttonStyle(.bordered)
                .tint(toolKind == .pen ? .blue : .gray)

                Button(action: { toolKind = .eraser }) {
                    Text("⏎").padding(.horizontal, 10).padding(.vertical, 8)
                }
                .buttonStyle(.bordered)
                .tint(toolKind == .eraser ? .blue : .gray)

                HStack(spacing: 8) {
                    Slider(value: $inkWidth, in: 1...20, step: 1)
                        .frame(width: 160)
                }
            }
            .frame(maxWidth: 600)
            .padding(.top, 205)
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white.opacity(0.06))
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.gray.opacity(0.8), lineWidth: 0)
                PencilCanvasView(drawing: $drawing,
                                 inkColor: $inkColor,
                                 inkWidth: $inkWidth,
                                 toolKind: $toolKind)
                    .padding(12) // 캔버스 내부 여백 약간 증가
            }
            .frame(width: 680) // ⬅️ 드로잉 영역 가로 크기 확대 (기존 580)
            .frame(minHeight: 415) // ⬅️ 세로 최소 높이 확대 (기존 345)
            .offset(y: -8)
            .background(
                GeometryReader { geo in
                    Color.clear
                        .onAppear { canvasSize = geo.size }
                        .onChange(of: geo.size) { newSize in
                            canvasSize = newSize
                        }
                }
            )
            .padding(.horizontal)
//            Button {
//                drawing = PKDrawing() // 지우기
//            } label: {
//                Text(LocalizedText.erase(for: lang))
//                .frame(maxWidth: .infinity)
//            }
//            .buttonStyle(.bordered)
//            .frame(maxWidth: 600)
//            .tint(.gray)
            Image("scroll")
                        .offset(y: -20)
            Text(LocalizedText.message(for: lang))
                .appSecondaryFont(lang, size: 30)
                .bold()
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.vertical, 20)
            Button {
                // 현재 드로잉을 UIImage로 렌더링
                let fallbackSize = canvasSize == .zero ? CGSize(width: 1024, height: 768) : canvasSize
                let scale = UIScreen.main.scale
                let bounds = drawing.bounds.integral
                print("[DrawWishView] drawing.bounds=\(bounds), canvasSize=\(canvasSize), scale=\(scale)")

                let rectToRender: CGRect
                if bounds.isEmpty {
                    rectToRender = CGRect(origin: .zero, size: fallbackSize)
                    print("[DrawWishView] Using fallback rect: \(rectToRender)")
                } else {
                    rectToRender = bounds.insetBy(dx: -8, dy: -8)
                    print("[DrawWishView] Using content rect with padding: \(rectToRender)")
                }

                let rawImage = drawing.image(from: rectToRender, scale: scale)
                let rendererFormat = UIGraphicsImageRendererFormat.default()
                rendererFormat.opaque = true
                rendererFormat.scale = scale
                let renderer = UIGraphicsImageRenderer(size: rectToRender.size, format: rendererFormat)
                let image = renderer.image { ctx in
                    UIColor.white.setFill()
                    ctx.fill(CGRect(origin: .zero, size: rectToRender.size))
                    rawImage.draw(in: CGRect(origin: .zero, size: rectToRender.size))
                }

                savedImage = image
                print("[DrawWishView] Composited image: size=\(image.size), px=\(Int(image.size.width*scale))x\(Int(image.size.height*scale))")

                let fileName = "saved_drawing.png"
                let saved = saveImageToDocuments(image, fileName: fileName)

                var filePath: String = ""
                if let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
                    let url = docs.appendingPathComponent(fileName)
                    filePath = url.path
                    let exists = FileManager.default.fileExists(atPath: url.path)
                    var fileSize: UInt64 = 0
                    if exists, let attrs = try? FileManager.default.attributesOfItem(atPath: url.path), let sz = attrs[.size] as? UInt64 {
                        fileSize = sz
                    }
                    print("[DrawWishView] Save attempted: \(saved), exists=\(exists), path=\(url.path), fileSize=\(fileSize) bytes")
                }

                if !filePath.isEmpty {
                    let reloaded = UIImage(contentsOfFile: filePath)
                    if let reloaded {
                        print("[DrawWishView] Reloaded image OK: size=\(reloaded.size)")
                    } else {
                        print("[DrawWishView] Reloaded image FAILED from path: \(filePath)")
                    }
                }

                Task {
                    let payload = CurrentInsert(status: "waiting")
                    do {
                        let result = try await supabaseClient
                            .from("currentdata")
                            .insert(payload)
                            .execute()
                        #if DEBUG
                        print("[DrawWishView] Supabase insert result: \(result)")
                        #endif
                    } catch {
                        #if DEBUG
                        print("[DrawWishView] Insert failed: \(error)")
                        #endif
                    }

                    if saved {
                        DispatchQueue.main.async { goNext = true }
                    } else {
                        saveAlertMessage = "이미지 저장 실패 (경로: \(filePath))"
                        showSaveAlert = true
                        DispatchQueue.main.async { goNext = true }
                    }
                }
            } label: {
                ZStack {
                    Image(nextIllustrationName())
                        .resizable()
                        .scaledToFit()
                        .frame(height: 400)
                        .padding(.horizontal)
                        .accessibilityLabel("Next step illustration")
                        
                }
            }
            // Image를 버튼으로 쓰므로 기본 테두리는 제거
            .buttonStyle(.plain)
            // 접근성: 힌트 제공
            .accessibilityHint(Text("Tap to finish and proceed"))
            }
                .padding(.horizontal)
                .padding(.bottom, 16)
            }
            .background(Color(red: 255/255, green: 209/255, blue: 141/255))
            FooterView()
        }
        .scrollIndicators(.hidden)
        .background(Color(red: 255/255, green: 209/255, blue: 141/255))
        .ignoresSafeArea()
        .alert("저장 오류", isPresented: $showSaveAlert) {
            Button("확인", role: .cancel) { }
        } message: {
            Text(saveAlertMessage)
        }
        .fullScreenCover(isPresented: $goNext) {
            SavedNextView(lang: lang, nationality: nationality, drawingImage: savedImage)
                .interactiveDismissDisabled(true)
        }
        .onAppear {
            if let ui = UIColor.from(inkColorSwiftUI) { inkColor = ui }
        }
    }
    
    struct LocalizedText {
        static func usePen(for lang: AppLanguage) -> String {
            switch lang {
            case .ko: return "이 펜을 사용하여\n당신의 소원을 여기에 적어주세요"
            case .en: return "Please use this pen\nto write your wish here"
            case .ja: return "右のペンを使って、\nここにあなたの願いを書いてください"
            case .zh: return "请用这支笔在这里写下您的心愿"
            }
        }

        static func subtitle(for lang: AppLanguage) -> String {
            switch lang {
            case .ko: return "선택한 상황에 맞춰 자유롭게 그림이나 글을 남겨주세요."
            case .en: return "Based on the situation you chose, feel free to draw or write your thoughts."
            case .ja: return "選んだ状況に合わせて、自由に絵やメモを残してください。"
            case .zh: return "根据你选择的情境，自由地绘画或写下想法。"
            }
        }

        static func longDesc(for lang: AppLanguage) -> String {
            switch lang {
            case .ko: return "일본에 사는 외국인으로서, \n일어나지 않길 바라는 불편한 경험에 대해서 이야기 해주세요"
            case .en: return "Tell one an uncomfortable experience with you in Japan\nfor being a foreigner\nwhich you wish not happen"
            case .ja: return "日本人として、外国の方に\n『こういうことをもっと分かってほしい』と思うことはありますか？"
            case .zh: return "作为居住在日本的外国人，\n您希望日本人能理解您哪些感受？\n"
            }
        }

        static func message(for lang: AppLanguage) -> String {
            switch lang {
            case .ko: return "이제 아래에서 소원 종이를 하나 고르세요"
            case .en: return "Now, pick this wish paper\nfrom the box below"
            case .ja: return "下にあるカードから一つ選んでください"
            case .zh: return "现在请从下方的盒子中抽取一张愿望卡片"
            }
        }

        static func finish(for lang: AppLanguage) -> String {
            switch lang {
            case .ko: return "완료"
            case .en: return "Finish"
            case .ja: return "完了"
            case .zh: return "完成"
            }
        }
        
        static func erase(for lang: AppLanguage) -> String {
            switch lang {
            case .ko: return "지우기"
            case .en: return "Erase"
            case .ja: return "消去"
            case .zh: return "清除"
            }
        }
    }

    struct PencilCanvasView: UIViewRepresentable {
        @Binding var drawing: PKDrawing
        @Binding var inkColor: UIColor
        @Binding var inkWidth: CGFloat
        @Binding var toolKind: ToolKind

        enum ToolKind { case pen, eraser }

        class Coordinator: NSObject, PKCanvasViewDelegate {
            var toolPickerShown = false
            var parent: PencilCanvasView
            init(parent: PencilCanvasView) { self.parent = parent }

            func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
                let newDrawing = canvasView.drawing
                let b = newDrawing.bounds.integral
                print("[PencilCanvasView] canvas changed, bounds=\(b)")
                // Directly push canvas → SwiftUI binding
                if self.parent.drawing.dataRepresentation() != newDrawing.dataRepresentation() {
                    self.parent.drawing = newDrawing
                    print("[PencilCanvasView] canvas→state applied, bounds=\(b)")
                }
            }
        }

        func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

        func makeUIView(context: Context) -> PKCanvasView {
            let canvas = PKCanvasView()
            canvas.drawing = drawing
            canvas.drawingPolicy = .anyInput  // Apple Pencil + finger
            canvas.allowsFingerDrawing = true // 손가락 허용
            canvas.backgroundColor = .clear
            canvas.isOpaque = false
            canvas.delegate = context.coordinator
            // 초기 도구 반영
            canvas.tool = PKInkingTool(.pen, color: inkColor, width: inkWidth)
            return canvas
        }

        func updateUIView(_ uiView: PKCanvasView, context: Context) {
            // Sync drawing state
            let stateData = drawing.dataRepresentation()
            let uiData = uiView.drawing.dataRepresentation()
            if stateData != uiData {
                uiView.drawing = drawing
                let b = uiView.drawing.bounds.integral
                print("[PencilCanvasView] state→canvas applied, bounds=\(b)")
            }

            // Apply current tool selection
            switch toolKind {
            case .pen:
                uiView.tool = PKInkingTool(.pen, color: inkColor, width: inkWidth)
            case .eraser:
                uiView.tool = PKEraserTool(.vector)
            }

            // Avoid tool picker in SwiftUI Previews to prevent PreviewShell crashes
            let isPreview = ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1"
            guard !isPreview else { return }

            // Show the system tool picker (also lets users pick eraser/colors)
            if let window = uiView.window, context.coordinator.toolPickerShown == false {
                if let toolPicker = PKToolPicker.shared(for: window) {
                    toolPicker.setVisible(true, forFirstResponder: uiView)
                    uiView.becomeFirstResponder()
                    context.coordinator.toolPickerShown = true
                }
            }
        }
    }

    // MARK: - Supabase Insert Payload
    private struct CurrentInsert: Encodable {
        let status: String
        // 다른 컬럼은 옵셔널로 비워둠 (요구사항: nfc_id, image_url 없어도 OK)
        let nfc_id: String? = nil
        let image_url: String? = nil
        let meta: [String: String]? = nil
    }

    // MARK: - File Save Helper
    private func saveImageToDocuments(_ image: UIImage, fileName: String) -> Bool {
        guard let data = image.pngData() else { return false }
        let fm = FileManager.default
        guard let docs = fm.urls(for: .documentDirectory, in: .userDomainMask).first else { return false }
        let url = docs.appendingPathComponent(fileName)
        do {
            try data.write(to: url, options: .atomic)
            return true
        } catch {
            print("[DrawWishView] Save failed: \(error)")
            return false
        }
    }
}

#Preview {
    NavigationStack {
        //DrawWishView(lang: .zh, nationality: .japanese)
        DrawWishView(lang: .ja, nationality: .foreignResident)
    }
}

// MARK: - UIColor <-> Color bridge (for SwiftUI <-> UIKit)
extension UIColor {
    /// Safe helper to convert SwiftUI.Color to UIColor without redefining the UIKit initializer.
    /// - Important: Do NOT implement `convenience init(_ color: Color)` here; it will shadow Apple's and recurse.
    static func from(_ color: Color) -> UIColor? {
        #if canImport(UIKit)
        if #available(iOS 14.0, *) {
            // This calls Apple's built-in `UIColor.init(_ color: SwiftUI.Color)`
            return UIColor(color)
        } else {
            // Best-effort fallback for older iOS: return white
            return UIColor(white: 1.0, alpha: 1.0)
        }
        #else
        return nil
        #endif
    }
}
