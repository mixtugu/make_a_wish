//
//  LanguageChooseView.swift
//  Peiyao_iPad_Guide
//
//  Created by 이서정 on 10/28/25.
//

import SwiftUI

// MARK: - Lightweight Localization
enum LKey {
    case headerTitle
    case headerSubtitle
    case userTypeTitle
    case userTypeSubtitle
    case btnNext
    case btnSelectToContinue
    case userTypeJapanese
    case userTypeForeigner
    case userTypeJapaneseSub
    case userTypeForeignerSub
    case infoTop
    case infoBottom
}

func L(_ key: LKey, _ lang: AppLanguage) -> String {
    switch key {
    case .headerTitle:
        switch lang {
        case .ko: return "언어 선택";
        case .en: return "Choose Language";
        case .ja: return "言語を選択";
        case .zh: return "选择语言"
        }
    case .headerSubtitle:
        switch lang {
            case .ko: return "원하는 언어와 사용자 유형을 선택하세요";
            case .en: return "Choose your language and user type";
            case .ja: return "言語と利用者区分を選択してください";
            case .zh: return "请选择语言和用户类型"
        }
    case .userTypeSubtitle:
        switch lang {
        case .ko: return "신분을 선택하세요"
        case .en: return "Choose your identity"
        case .ja: return "身分を選択してください"
        case .zh: return "选择您的身份"
        }
    case .userTypeTitle:
        switch lang {
        case .ko: return "신분을 선택"
        case .en: return "Choose Identity"
        case .ja: return "身分を選択"
        case .zh: return "选择您的身份"
        }
    case .btnNext:
        switch lang {
            case .ko: return "네! 시작할게요";
            case .en: return "Yes! Let’s start";
            case .ja: return "さぁ、はじめましょう";
            case .zh: return "好的！开始吧"
        }
    case .btnSelectToContinue:
        switch lang {
        case .ko: return "선택 후 계속";
        case .en: return "Select to continue";
        case .ja: return "選択して続行";
        case .zh: return "选择后继续"
        }
    case .userTypeJapanese:
        switch lang {
            case .ko: return "일본인";
            case .en: return "Japanese";
            case .ja: return "日本人";
            case .zh: return "日本人"
        }
    case .userTypeForeigner:
        switch lang {
        case .ko: return "외국인";
        case .en: return "Foreigner";
        case .ja: return "外国人";
        case .zh: return "外国人"
        }
    case .userTypeJapaneseSub:
        switch lang {
        case .ko: return "일본 국적";
        case .en: return "Japanese nationality";
        case .ja: return "日本国籍";
        case .zh: return "日本国籍"
        }
    case .userTypeForeignerSub:
        switch lang {
            case .ko: return "일본에 사는 외국인";
            case .en: return "Foreigner living in Japan";
            case .ja: return "日本に住む外国人";
            case .zh: return "居住在日本的外国人"
        }
    case .infoTop:
        switch lang {
        case .ko: return "인도의 일부 지역에서는 소원을 빌며 \n종교 시설에서 매듭을 묶습니다.\n소원이 이루어지면 다시 찾아가 그 매듭을 풉니다.";
        case .en: return "In some places of India,\npeople tie knot in religious places wishing something.\nWhen the wish gets fulfilled they go back to the place\nand untie one knot from the existing knots.";
        case .ja: return "インドの一部の地域では、願い事を込めて聖地で\n紐に結び目を作ります。願いが叶うと、\nその場所に戻って結び目をほどきます。";
        case .zh: return "在印度的一些地区，\n人们会把写有愿望的纸条系在寺庙的树上。\n当愿望实现后,他们会再回到寺庙,将那张纸条解下。"
        }
    case .infoBottom:
        switch lang {
        case .ko: return "당신도 매듭을 묶어 소원을 이루고 싶나요?";
        case .en: return "Do you want to fulfill your wish by tying a knot ?";
        case .ja: return "あなたも結び目を結んで、願いを叶えてみませんか？";
        case .zh: return "想要系上实现愿望的结吗？"
        }
    }
}

// 앱에서 사용할 언어 옵션
enum AppLanguage: String, CaseIterable, Identifiable {
    case ja = "ja"
    case en = "en"
    case ko = "ko"
    case zh = "zh"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .en: return "English"
        case .ja: return "日本語"
        case .ko: return "한국어"
        case .zh: return "中文"
        }
    }

    var subtitle: String {
        switch self {
        case .ko: return "앱에 사용할 기본 언어"
        case .en: return "Default language for the app"
        case .ja: return "アプリの基本言語"
        case .zh: return "应用的默认语言"
        }
    }

    var flag: String {
        switch self {
        case .ko: return "한"
        case .en: return "EN" // 필요 시 🇬🇧 로 교체
        case .ja: return "日"
        case .zh: return "中"
        }
    }
}

struct LanguageChooseView: View {
    // 선택된 언어는 AppStorage에 보관하여 앱 재실행 시에도 유지
    @AppStorage("appLanguage") private var appLanguage: String = ""

    @State private var selection: AppLanguage? = nil
    @State private var goNext: Bool = false

    // 현재 적용할 언어(선택값 우선 → 저장값 → 기본 ko)
    private var effectiveLang: AppLanguage {
        selection ?? (AppLanguage(rawValue: appLanguage) ?? .ja)
    }

    var body: some View {
        VStack(spacing: 24) {
            VStack {
                Spacer()
                HStack(alignment: .center, spacing: 32) {
                    languageSection
                    infoSection
                }
                .padding(.bottom, 50)
            }
            Button(action: onContinue) {
                Text(primaryButtonTitle)
                    .appFont(effectiveLang, size: 20, weight: .semibold)
                    .frame(width: 240, height: 50)
                    .foregroundColor(.white)
                    .background(Color(red: 124/255, green: 102/255, blue: 66/255))
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .disabled(!canContinue)
            FooterView()
                .padding(.top, 80)
        }
        .padding(.top, 16)
        .background(Color(red: 255/255, green: 209/255, blue: 141/255))
        .onAppear { restoreLanguageIfAny() }
        .fullScreenCover(isPresented: $goNext) {
            NationalityChooseView(lang: effectiveLang)
                .interactiveDismissDisabled(true)
        }
    }

//    private var header: some View {
//        VStack(spacing: 8) {
//            Text(L(.headerTitle, effectiveLang))
//                .font(.largeTitle).bold()
//                .multilineTextAlignment(.center)
//            Text(L(.headerSubtitle, effectiveLang))
//                .foregroundStyle(.secondary)
//        }
//        .padding(.horizontal)
//    }

    private var languageSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(AppLanguage.allCases) { lang in
                    LanguageRow(lang: lang, isSelected: selection == lang)
                        .onTapGesture { withAnimation(.easeInOut) { selection = lang } }
                }
            }
        }
        .padding(.horizontal)
    }

    private var infoSection: some View {
        HStack {
            Spacer()
            VStack(alignment: .center, spacing: 16) {
                Text(L(.infoTop, effectiveLang))
                    .appFont(effectiveLang, size: 28, weight: .bold)
                    .lineSpacing(10)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity, alignment: .center)

                Image("first")
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 480)
                    .padding(16)
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                Text(L(.infoBottom, effectiveLang))
                    .appSecondaryFont(effectiveLang, size: 22)
                    .multilineTextAlignment(.center)
                    .padding(.top, 30)
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.horizontal)
        .offset(x:-70)
    }

    // MARK: - Actions
    private var canContinue: Bool { true }

    private var primaryButtonTitle: String {
        L(.btnNext, effectiveLang)
    }

    private func restoreLanguageIfAny() {
        if let saved = AppLanguage(rawValue: appLanguage), selection == nil {
            selection = saved
        }
    }

    private func onContinue() {
        let sel = selection ?? .ja
        appLanguage = sel.rawValue
        withAnimation(.spring) { goNext = true }
    }
}

private struct LanguageRow: View {
    let lang: AppLanguage
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 16) {
            Text(lang.flag).font(.largeTitle)
        }
        .padding(16)
        .frame(width: 80)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(isSelected ? Color.accentColor : Color.secondary.opacity(0.35), lineWidth: 1)
        )
    }
}

#Preview {
    LanguageChooseView()
}

typealias ContentView = LanguageChooseView
