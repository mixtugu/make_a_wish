//
//  UnlockedView.swift
//  Peiyao_iPad_Guide
//
//  Created by 이서정 on 10/29/25.
//

import SwiftUI

struct UnlockedView: View {
    let lang: AppLanguage
    @State private var goNext = false

    var body: some View {
        ZStack {
            // Tap anywhere area
            Color(red: 255/255, green: 209/255, blue: 141/255)
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture {
                    goNext = true
                }

            // Centered big text
            ZStack {
                Image("ema3")
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 550)
                    .allowsHitTesting(false)
                    .offset(y: -80)
                Text(LocalizedText.message(for: lang))
                    .appSecondaryFont(lang, size: 44)
                    .multilineTextAlignment(.center)
                    .foregroundColor(.black)
                    .padding(.horizontal, 32)
                    .padding(.vertical, 24)
            }
        }
        .navigationBarBackButtonHidden(true)
        .fullScreenCover(isPresented: $goNext) {
            ThankView(lang: lang)
                .interactiveDismissDisabled(true)
        }
    }
    struct LocalizedText {
        static func message(for lang: AppLanguage) -> String {
            switch lang {
            case .ko:
                return "이제 누군가의 소원이 열렸습니다.\n\n에마에서 적힌 소원을 읽을 수 있습니다."
            case .en:
                return "Now you have unlocked\nsomeone's wish.\n\nYou can read the wish\non the ema."
            case .ja:
                return "誰かの願いがほどかれました。\n\n絵馬に書かれた願いを読むこと\nができます。"
            case .zh:
                return "您已解开他人的愿望。\n\n您可以阅读绘马上写下的愿望。"
            }
        }
    }
}

#Preview {
    NavigationStack {
        UnlockedView(lang: .en)
    }
}
