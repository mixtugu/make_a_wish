//
//  ThankView.swift
//  Peiyao_iPad_Guide
//
//  Created by 이서정 on 10/29/25.
//

import SwiftUI
import Supabase

struct ThankView: View {
    let lang: AppLanguage
    @State private var goToLanguageChoose = false
    let supabaseClient: SupabaseClient = {
        let url = URL(string: "https://vopzwwcdiqdteivkuyqr.supabase.co")!
        let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcHp3d2NkaXFkdGVpdmt1eXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTIxMzcsImV4cCI6MjA3NzE4ODEzN30.Jq4LiaOfpUHZszSPV0UzNI6SI4ea6bagRTsMXb8eMCw"
        return SupabaseClient(supabaseURL: url, supabaseKey: anonKey)
    }()

    var body: some View {
        ZStack {
            if goToLanguageChoose {
                LanguageChooseView()
                    .transition(.opacity)
            } else {
                VStack(spacing: 32) {
                    Text(LocalizedText.description(for: lang))
                        .appSecondaryFont(lang, size: 48)
                        .multilineTextAlignment(.center)
                        .lineSpacing(18)
                        .padding(.horizontal, 40)

                    Image("wishs")
                        .resizable()
                        .scaledToFit()
                        .frame(height: 300)

                    Text(LocalizedText.thankYou(for: lang))
                        .appSecondaryFont(lang, size: 48)
                        .multilineTextAlignment(.center)
                        .foregroundColor(.black)
                }
                .task {
                    do {
                        _ = try await supabaseClient
                            .from("currentdata")
                            .delete()
                            .execute()
                        print("[ThankView] All rows deleted from currentdata")
                    } catch {
                        print("[ThankView] Failed to delete currentdata rows: \(error)")
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(red: 255/255, green: 209/255, blue: 141/255).ignoresSafeArea())
                .contentShape(Rectangle())
                .onTapGesture {
                    withAnimation {
                        goToLanguageChoose = true
                    }
                }
            }
        }
    }
    struct LocalizedText {
        static func description(for lang: AppLanguage) -> String {
            switch lang {
            case .ko:
                return "당신의 소원이 누군가의 이해와\n누군가의 친절이 되길 바랍니다."
            case .en:
                return "May your wish become\nsomeone's understanding\nsomeone's kindness"
            case .ja:
                return "あなたの願いが誰かの理解と、\n優しさに繋がりますように。"
            case .zh:
                return "愿你的愿望，\n成为他人的多一分理解，\n也成为世界的多一点善意。"
            }
        }

        static func thankYou(for lang: AppLanguage) -> String {
            switch lang {
            case .ko:
                return "감사합니다"
            case .en:
                return "Thank You"
            case .ja:
                return "ありがとうございました"
            case .zh:
                return "谢谢您"
            }
        }
    }
}

#Preview {
    ThankView(lang: .ko)
}
