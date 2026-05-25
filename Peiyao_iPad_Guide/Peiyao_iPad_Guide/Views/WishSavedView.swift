import SwiftUI
import Supabase

private let supabaseClient: SupabaseClient = {
    let url = URL(string: "https://vopzwwcdiqdteivkuyqr.supabase.co")!
    let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcHp3d2NkaXFkdGVpdmt1eXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTIxMzcsImV4cCI6MjA3NzE4ODEzN30.Jq4LiaOfpUHZszSPV0UzNI6SI4ea6bagRTsMXb8eMCw"
    return SupabaseClient(supabaseURL: url, supabaseKey: anonKey)
}()

struct WishSavedView: View {
    let lang: AppLanguage
    let nationality: NationalityOption?
    @State private var goNext = false

    var body: some View {
        VStack(spacing: 60) {
            Spacer()

            // Centered text
            Text(LocalizedText.message(for: lang))
                .appSecondaryFont(lang, size: 38)
                .multilineTextAlignment(.center)
                .foregroundColor(.black)
                .lineSpacing(18)
                .padding(.horizontal, 40)

            // Circular Tap to Continue button
            ZStack {
                Image("touch")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 140, height: 140)
                    .shadow(radius: 6)
                    .zIndex(1)

                Text(LocalizedText.continueText(for: lang))
                    .appFont(lang, size: 40)
                    .foregroundColor(Color.black.opacity(0.7))
                    .kerning(4)
                    .zIndex(0)
            }
            .contentShape(Rectangle()) // 스택 전체가 터치 대상
            .onTapGesture {
                Task {
                    do {
                        let payload = ["status": "unlockwaiting"]
                        _ = try await supabaseClient.from("currentdata").insert(payload).execute()
                        print("[WishSavedView] Inserted lockedwaiting row into currentdata")
                    } catch {
                        print("[WishSavedView] Insert failed: \(error)")
                    }
                    await MainActor.run { goNext = true }
                }
            }
            .offset(y: 400)

            Spacer()
            FooterView()
                .environment(\.font, FontManager.font(for: lang, size: 14))
                .frame(maxWidth: .infinity)
                .padding(.bottom, 12)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 255/255, green: 209/255, blue: 141/255)).ignoresSafeArea()
        .fullScreenCover(isPresented: $goNext) {
            RemoveTouchView(lang: lang, nationality: nationality)
                .interactiveDismissDisabled(true)
        }
    }
    struct LocalizedText {
        static func message(for lang: AppLanguage) -> String {
            switch lang {
            case .ko:
                return "당신의 소원이 저장되었습니다. 이제 누군가가 그 소원을 이루어줄 것입니다."
            case .en:
                return "Your wish has been saved,\nSomeone else will fulfill it next"
            case .ja:
                return "あなたの願いは保存されました。\n次は誰かがその願いを叶えてくれます。"
            case .zh:
                return "您的愿望已保存，接下来会有人帮您实现它。"
            }
        }

        static func continueText(for lang: AppLanguage) -> String {
            switch lang {
            case .ko:
                return "다음으로"
            case .en:
                return "Tap to Continue"
            case .ja:
                return "次へ進む"
            case .zh:
                return "继续"
            }
        }
    }
}

#Preview {
    WishSavedView(lang: .en, nationality: .japanese)
}
