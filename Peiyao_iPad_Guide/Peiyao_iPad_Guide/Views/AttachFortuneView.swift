//
//  AttachFortuneView.swift
//  Peiyao_iPad_Guide
//
//  Created by 이서정 on 10/29/25.
//

import SwiftUI

struct AttachFortuneView: View {
    let lang: AppLanguage
    let nationality: NationalityOption?
    @State private var showNext = false
    var body: some View {
        ZStack {
            Color(red: 255/255, green: 209/255, blue: 141/255)
                .ignoresSafeArea()
            VStack(spacing: 40) {
                // Large image placeholder
                Spacer().frame(height: 160)
                Image("string")
                    .resizable()
                    .scaledToFit()
                    .scaleEffect(1.5)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                // Description text
                Text(LocalizedText.description(for: lang))
                    .appSecondaryFont(lang, size: 30)
                    .multilineTextAlignment(.center)
                    .foregroundColor(.black.opacity(0.8))
                    .lineSpacing(18)
                    .padding(.horizontal, 40)
                    .padding(.top, 80)
                Spacer()
                // Next button
                Button(action: {
                    showNext = true
                }) {
                    Text(LocalizedText.next(for: lang))
                        .appFont(lang, size: 28)
                        .frame(width: 200, height: 80)
                        .background(Color.gray)
                        .foregroundColor(.white)
                        .cornerRadius(40)
                }
                .padding(.bottom, 40)

            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .fullScreenCover(isPresented: $showNext) {
                WishSavedView(lang: lang, nationality: nationality)
                    .interactiveDismissDisabled(true)
            }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            VStack {
                Spacer()
                FooterView()
                    .environment(\.font, FontManager.font(for: lang, size: 14))
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 12)
            }
        }
    }
}

struct LocalizedText {
    static func description(for lang: AppLanguage) -> String {
        switch lang {
        case .ko:
            return "당신 앞의 끈에 오미쿠지를 붙여주세요."
        case .en:
            return "Attach your fortune paper\nto the string before you"
        case .ja:
            return "前にある紐に願い紙を結んでください。"
        case .zh:
            return "请将您的签纸系在您面前的绳子上。"
        }
    }
    static func next(for lang: AppLanguage) -> String {
        switch lang {
        case .ko:
            return "다음"
        case .en:
            return "Next"
        case .ja:
            return "次へ"
        case .zh:
            return "下一步"
        }
    }
}

#Preview {
    AttachFortuneView(lang: .en, nationality: .japanese)
}
