//
//  footerView.swift
//  Peiyao_iPad_Guide
//
//  Created by 이서정 on 10/31/25.
//

import SwiftUI

struct FooterView: View {
    var body: some View {
        VStack {
            Spacer()
            Image("footer")
                .frame(maxWidth: .infinity)
//            Text("make a wish")
//                .font(.custom("Chalkduster", size: 38))
//                .frame(maxWidth: .infinity)
//                .multilineTextAlignment(.center)
        }
        .frame(height: 40)
        .background(Color(red: 255/255, green: 209/255, blue: 141/255))
    }
}
#Preview {
    FooterView()
}
