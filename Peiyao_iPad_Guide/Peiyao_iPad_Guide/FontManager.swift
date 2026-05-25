//
//  FontManager.swift
//  Peiyao_iPad_Guide
//
//  Created by 이서정 on 11/11/25.
//

import SwiftUI
import UIKit

/// 전역 폰트 매니저
/// - 한국어/영어/일본어/중국어별로 **primary/secondary** 2종 폰트를 관리합니다.
/// - `Info.plist`의 **UIAppFonts**(Fonts provided by application)에 TTF/OTF를 반드시 등록하세요.
/// - 사용 예) `.font(FontManager.font(for: lang, size: 24))`
///         `.appFont(lang, size: 24)`
enum FontManager {
    /// 언어별 기본 폰트 세트 (primary, secondary)
    /// 실제 프로젝트에 포함된 폰트 이름(파일명 아님)을 써야 합니다.
    static let fonts: [AppLanguage: (primary: String, secondary: String)] = [
        .ko: ("AppleSDGothicNeo-Regular", "KyoboHandwriting2024psw"),
        .en: ("Afacad-Regular", "Chalkduster"),
        .ja: ("ZenKakuGothicNew-Regular", "YujiSyuku-Regular"),
        .zh: ("NotoSansSC-Thin_Regular", "MaShanZheng-Regular")
    ]

    /// 폴백 폰트 (언어 매핑이 없거나 미설치 시 사용)
    static let fallback: (primary: String, secondary: String) = ("Afacad", "HelveticaNeue")

    /// 파일 확장자 제거 + 공백 트림
    private static func normalizeFontName(_ name: String) -> String {
        var s = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = s.lowercased()
        if lower.hasSuffix(".ttf") || lower.hasSuffix(".otf") { s = String(s.dropLast(4)) }
        return s
    }

    /// 설치 여부 확인 후보군에서 첫 일치 반환
    private static func firstInstalledName(from candidates: [String]) -> String? {
        for n in candidates {
            if UIFont(name: n, size: 12) != nil { return n }
        }
        return nil
    }

    /// 디버그: 최초 1회만 누락 경고 출력
    private static var didWarnMissing = false
    private static func warnMissingFont(_ wanted: String, for lang: AppLanguage) {
        guard !didWarnMissing else { return }
        didWarnMissing = true
        print("[FontManager] Font not found: \(wanted) for lang=\(lang). Check UIAppFonts and PostScript name. Using fallback.")
    }

    /// 설치된 폰트 이름 중 prefix를 포함하고, 가능하면 "Regular"를 포함한 이름을 우선 반환
    private static func autoResolveFontName(prefix: String) -> String? {
        let families = UIFont.familyNames
        for fam in families {
            let names = UIFont.fontNames(forFamilyName: fam)
            let hits = names.filter { $0.localizedCaseInsensitiveContains(prefix) }
            if hits.isEmpty { continue }
            if let reg = hits.first(where: { $0.localizedCaseInsensitiveContains("regular") }) {
                return reg
            }
            return hits.first
        }
        return nil
    }

    /// 언어별 폰트 이름 반환 (설치 여부 확인 후 폴백 처리)
    static func fontName(for lang: AppLanguage, secondary: Bool = false) -> String {
        let pair = fonts[lang] ?? fallback
        let primary = secondary ? pair.secondary : pair.primary
        let alt = secondary ? pair.primary : pair.secondary

        func candidates(_ s: String) -> [String] {
            let norm = normalizeFontName(s)
            var arr = [s, norm]
            if norm.contains("-") { arr.append(norm.replacingOccurrences(of: "-", with: " ")) }
            return Array(Set(arr))
        }

        if let ok = firstInstalledName(from: candidates(primary)) {
            print("[FontManager] ✅ Loaded font: \(ok) for lang=\(lang) (secondary=\(secondary))")
            return ok
        }
        warnMissingFont(primary, for: lang)
        if let ok = firstInstalledName(from: candidates(alt)) {
            print("[FontManager] ⚠️ Fallback to alt font: \(ok) for lang=\(lang)")
            return ok
        }
        if let ok = firstInstalledName(from: candidates(fallback.primary)) {
            print("[FontManager] ⚠️ Fallback to global primary font: \(ok) for lang=\(lang)")
            return ok
        }
        // 마지막 시도: 번들/시스템에 설치된 이름을 접두사로 자동 탐색
        switch lang {
        case .en:
            if let auto = autoResolveFontName(prefix: "Afacad") {
                print("[FontManager] 🔍 Auto-resolved: \(auto) for lang=\(lang)")
                return auto
            }
        case .zh:
            print("[FontManager] 🔎 Missed primary=\(primary), alt=\(alt) for lang=\(lang). Trying auto-resolve…")
            if let auto = firstInstalledName(from: ["NotoSansSC-VariableFont_wght"]) {
                print("[FontManager] 🔍 Direct match: NotoSansSC-VariableFont_wght for lang=zh")
                return auto
            }
            // Try multiple common internal-name variants for Noto Sans SC
            if let auto = autoResolveFontName(prefix: "NotoSansSC") {
                print("[FontManager] 🔍 Auto-resolved: \(auto) for lang=\(lang)")
                return auto
            }
            if let auto = autoResolveFontName(prefix: "Noto Sans SC") {
                print("[FontManager] 🔍 Auto-resolved (spaced): \(auto) for lang=\(lang)")
                return auto
            }
            if let auto = autoResolveFontName(prefix: "NotoSansCJKSC") {
                print("[FontManager] 🔍 Auto-resolved (CJK variant): \(auto) for lang=\(lang)")
                return auto
            }
        default:
            break
        }
        let fb = normalizeFontName(fallback.secondary)
        print("[FontManager] ❌ No font found for lang=\(lang), using fallback secondary: \(fb)")
        return fb
    }

    /// SwiftUI Font 빌더
    static func font(for lang: AppLanguage,
                     size: CGFloat,
                     weight: Font.Weight = .regular,
                     secondary: Bool = false) -> Font {
        let name = fontName(for: lang, secondary: secondary)
        if name.isEmpty { return .system(size: size, weight: weight) }
        return Font.custom(name, size: size).weight(weight)
    }

    /// UIKit UIFont 빌더 (필요 시)
    static func uiFont(for lang: AppLanguage,
                       size: CGFloat,
                       weight: UIFont.Weight = .regular,
                       secondary: Bool = false) -> UIFont {
        let name = fontName(for: lang, secondary: secondary)
        // UIFont는 weight를 적용하려면 시스템 폰트가 일반적이지만, 커스텀 이름에는 그대로 반환
        if let f = UIFont(name: name, size: size) {
            return f
        }
        return .systemFont(ofSize: size, weight: weight)
    }
}

// MARK: - SwiftUI 편의 확장
extension View {
    /// 언어별 기본(Primary) 폰트 적용
    func appFont(_ lang: AppLanguage, size: CGFloat, weight: Font.Weight = .regular) -> some View {
        self.font(FontManager.font(for: lang, size: size, weight: weight, secondary: false))
    }

    /// 언어별 보조(Secondary) 폰트 적용
    func appSecondaryFont(_ lang: AppLanguage, size: CGFloat, weight: Font.Weight = .regular) -> some View {
        self.font(FontManager.font(for: lang, size: size, weight: weight, secondary: true))
    }
}
