//
//  Peiyao_iPad_GuideApp.swift
//  Peiyao_iPad_Guide
//
//  Created by 이서정 on 10/28/25.
//

import SwiftUI

@main
struct Peiyao_iPad_GuideApp: App {
    var body: some Scene {
        WindowGroup {
            LanguageChooseView()
                .preferredColorScheme(.light)
        }
    }
}
