import SwiftUI

enum NationalityOption: String, CaseIterable, Identifiable {
    case japanese
    case foreignResident
    var id: String { rawValue }
}

struct NationalityChooseView: View {
    // 이전 화면에서 전달된 언어 값 (LanguageChooseView에서 넘겨줌)
    let lang: AppLanguage

    @State private var selected: NationalityOption? = nil
    @State private var goNext: Bool = false

    var body: some View {
        VStack(alignment: .center, spacing: 16) {
            // 상단 타이틀
            let title = {
                switch lang {
                case .en: return "Welcome to"
                case .ja: return "ようこそ"
                case .zh: return "欢迎来到"
                case .ko: return "환영합니다"
                }
            }()
            Text(title)
                .appFont(lang, size: 34, weight: .semibold)
                .multilineTextAlignment(.center)
                .padding(.top, 70)
                .padding(.bottom, 40)
            // 이미지 한 개
            Image("intro")
                .resizable()
                .scaledToFit()
                .scaleEffect(1.1)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 4)
                .accessibilityHidden(true)
            // 설명문
            let description = {
                switch lang {
                case .en: return "Here , you can tie a wishing paper anonymously,\nand when someone untie your wishing paper,\nyour wish will be fulfilled."
                case .ja: return "ここでは、匿名で願い紙を結ぶことが\nでき、誰かがその願い紙をほどくと、\nあなたの願いが叶います。"
                case .zh: return "在这里，你可以匿名系上写着自己愿望的卡片\n当下一位解开它的人出现时，\n便象征着你的愿望已经实现。"
                case .ko: return "이곳에서 익명으로 소원을 적은 종이를\n묶을 수 있으며, 누군가가 그 종이를 풀면\n당신의 소원이 이루어집니다."
                }
            }()
            Text(description)
                .appFont(lang, size: 28)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
                .lineSpacing(10)
                .frame(maxWidth: 600)
                .offset(y: -180)
            // 중간 설명문
            let middleDescription = {
                switch lang {
                case .en: return "Please choose your identity"
                case .ja: return "あなたのアイデンティティを選択してください"
                case .zh: return "选择你的身份。"
                case .ko: return "당신의 신분을 선택해주세요"
                }
            }()
            Text(middleDescription)
                .appSecondaryFont(lang, size: 30, weight: .semibold)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
                .offset(y: -60)

            // 선택 버튼 2개 (일본인 / 일본 거주 외국인)
            VStack(spacing: 12) {
                selectButton(.japanese)
                selectButton(.foreignResident)
            }

            // 다음으로 넘어가는 버튼 (선택 이후 활성화)
            Button(action: { if selected != nil { goNext = true } }) {
                let nextButtonLabel = {
                    switch lang {
                    case .en: return selected == nil ? "Select to Continue" : "Next"
                    case .ja: return selected == nil ? "選択して続行" : "次へ"
                    case .zh: return selected == nil ? "选择后继续" : "下一步"
                    case .ko: return selected == nil ? "선택 후 계속" : "다음으로"
                    }
                }()

                // ⬇️ 라벨(내부)에 크기/배경/모양/히트영역을 모두 부여 → 라벨 전체가 터치 영역
                Text(nextButtonLabel)
                    .appFont(lang, size: 18, weight: .semibold)
                    .frame(maxWidth: .infinity, minHeight: 55) // 라벨 자체를 버튼 크기로 확장
                    .padding(.horizontal, 24) // 좌우 여유
                    .background(selected == nil ? Color.gray.opacity(0.3) : Color.accentColor)
                    .foregroundStyle(selected == nil ? Color.primary.opacity(0.6) : Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous)) // 라운드 전체가 히트영역
            }
            .buttonStyle(.plain)
            .frame(maxWidth: 480) // 상위에서 가로 제한만
            .disabled(selected == nil)
            .padding(.top, 20)

            Spacer(minLength: 12)
            FooterView()
        }
        .padding(.horizontal, 20)
        .background(Color(red: 255/255, green: 209/255, blue: 141/255))
        .interactiveDismissDisabled(true)
        .fullScreenCover(isPresented: $goNext) {
            // 다음 화면으로 전환 (필요 시 목적지 수정)
            DrawWishView(lang: lang, nationality: selected)
                .interactiveDismissDisabled(true)
        }
    }

    // MARK: - Components
    @ViewBuilder
    private func selectButton(_ option: NationalityOption) -> some View {
        Button(action: { selected = option }) {
            HStack {
                let label = {
                    switch lang {
                    case .en:
                        return option == .japanese ? "Japanese" : "Foreigner living in Japan"
                    case .ja:
                        return option == .japanese ? "日本人" : "日本に住む外国人"
                    case .zh:
                        return option == .japanese ? "日本人" : "居住在日本的外国人"
                    case .ko:
                        return option == .japanese ? "일본인" : "일본에 사는 외국인"
                    }
                }()
                Text(label)
                    .appFont(lang, size: 17)
                    
                Spacer()
                if selected == option {
                    Image(systemName: "checkmark.circle.fill")
                        .imageScale(.large)
                } else {
                    Image(systemName: "circle")
                        .imageScale(.large)
                }
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .frame(maxWidth: 520)
        .background(
            Group {
                if selected == option {
                    Color.accentColor.opacity(0.15)
                } else {
                    Color.gray.opacity(0.08)
                }
            }
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(selected == option ? Color.accentColor : Color.gray.opacity(0.3), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityLabel(Text(option.rawValue))
        .accessibilityAddTraits(selected == option ? [.isSelected] : [])
    }
}

#Preview {
    NationalityChooseView(lang: .ja)
}
