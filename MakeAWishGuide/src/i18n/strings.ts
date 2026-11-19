import type { AppLanguage, Localized, Nationality } from './types';

/**
 * 원본 SwiftUI 각 View 의 LocalizedText / L() 문자열 (일본어·영어).
 * (화면별로 묶음)
 */
export const strings = {
  language: {
    infoTop: {
      en: 'In some places of India,\npeople tie knot in religious places wishing something.\nWhen the wish gets fulfilled they go back to the place\nand untie one knot from the existing knots.',
      ja: 'インドの一部の地域では、願い事を込めて聖地で\n紐に結び目を作ります。願いが叶うと、\nその場所に戻って結び目をほどきます。',
    },
    infoBottom: {
      en: 'Do you want to fulfill your wish by tying a knot ?',
      ja: 'あなたも結び目を結んで、願いを叶えてみませんか？',
    },
    start: {
      en: 'Yes! Let’s start',
      ja: 'さぁ、はじめましょう',
    },
    switchLanguage: { en: 'Language', ja: '言語' },
  },

  nationality: {
    title: { en: 'Welcome to', ja: 'ようこそ' },
    description: {
      en: 'Here , you can tie a wishing paper anonymously,\nand when someone untie your wishing paper,\nyour wish will be fulfilled.',
      ja: 'ここでは、匿名で願い紙を結ぶことが\nでき、誰かがその願い紙をほどくと、\nあなたの願いが叶います。',
    },
    choose: {
      en: 'Please choose your identity',
      ja: 'あなたのアイデンティティを選択してください',
    },
    japanese: { en: 'Japanese', ja: '日本人' },
    foreignResident: {
      en: 'Foreigner living in Japan',
      ja: '日本に住む外国人',
    },
    selectToContinue: {
      en: 'Select to Continue',
      ja: '選択して続行',
    },
    next: { en: 'Next', ja: '次へ' },
  },

  draw: {
    usePen: {
      en: 'Please use this pen\nto write your wish here',
      ja: '右のペンを使って、\nここにあなたの願いを書いてください',
    },
    erase: { en: 'Erase', ja: '消去' },
    undo: { en: 'Undo', ja: '元に戻す' },
    pen: { en: 'Pen', ja: 'ペン' },
    eraser: { en: 'Eraser', ja: '消しゴム' },
    sending: { en: 'Saving…', ja: '保存中…' },
  },

  savedNext: {
    place: {
      en: 'Please touch your wish paper on\nthe top of the smartphone',
      ja: 'スマートフォンの上に願い紙\nをかざしてください',
    },
    noImage: {
      en: 'No saved image available',
      ja: '保存された画像がありません',
    },
  },

  attach: {
    description: {
      en: 'Attach your fortune paper\nto the string before you',
      ja: '前にある紐に願い紙を結んでください。',
    },
    next: { en: 'Next', ja: '次へ' },
  },

  wishSaved: {
    message: {
      en: 'Your wish has been saved,\nSomeone else will fulfill it next',
      ja: 'あなたの願いは保存されました。\n次は誰かがその願いを叶えてくれます。',
    },
    continue: { en: 'Tap to Continue', ja: '次へ進む' },
  },

  unlocked: {
    message: {
      en: "Now you have unlocked\nsomeone's wish.\n\nYou can read the wish\non the ema.",
      ja: '誰かの願いがほどかれました。\n\n絵馬に書かれた願いを読むこと\nができます。',
    },
  },

  thank: {
    description: {
      en: "May your wish become\nsomeone's understanding\nsomeone's kindness",
      ja: 'あなたの願いが誰かの理解と、\n優しさに繋がりますように。',
    },
    thankYou: { en: 'Thank You', ja: 'ありがとうございました' },
  },
} satisfies Record<string, Record<string, Localized>>;

/**
 * 사용자 유형(일본인 / 외국인)에 따라 달라지는 문구.
 * 카드 색: 일본인은 노란 카드에 기록하고 빨간 카드를 해제, 외국인은 빨간 카드에 기록하고 노란 카드를 해제
 * (서로 상대의 소원을 푸는 "願いの交換". 기존 카드 그림과 같은 규칙)
 * 일본인은 항상 일본어로 표시되지만 형식상 영어 문구도 둡니다.
 */
export const flowStrings = {
  /** 소원을 쓸 때의 질문 */
  question: {
    japanese: {
      ja: '日本人として、外国人にもっと理解してほしいことは何ですか？',
      en: 'As a Japanese person, what is something you wish foreigners understood better about you?',
    },
    foreignResident: {
      ja: '外国人として、日本人にもっと理解してほしいことは何ですか？',
      en: 'As a foreigner, what is something you wish Japanese people understood better about you?',
    },
  },
  /** 소원을 다 쓴 뒤 기록할 카드 고르기 */
  pickRecordCard: {
    japanese: {
      ja: '下の箱から黄色い願い紙を\n1枚選んでください',
      en: 'Now, pick one yellow wish paper\nfrom the box below',
    },
    foreignResident: {
      ja: '下の箱から赤い願い紙を\n1枚選んでください',
      en: 'Now, pick one red wish paper\nfrom the box below',
    },
  },
  /** 해제할 카드를 끈에서 떼어 스마트폰에 대기 */
  pickReleaseCard: {
    japanese: {
      ja: '糸に結ばれた赤い願い紙を1枚選んではずし、\nスマートフォンにかざしてください',
      en: 'Pick one red wish paper from the string,\nremove it and touch it on the smartphone',
    },
    foreignResident: {
      ja: '糸に結ばれた黄色い願い紙を1枚選んではずし、\nスマートフォンにかざしてください',
      en: 'Pick one yellow wish paper from the string,\nremove it and touch it on the smartphone',
    },
  },
} satisfies Record<string, Record<Nationality, Localized>>;

/** iPhone 가이드 문구 (원본 NFCView / MainView) */
export const iphoneStrings = {
  idleTitle: 'Make a Wish',
  circleTitle: 'make a wish',
  waiting: 'make\na\nwish',
  // 원본의 "somepne's" 오타 수정
  unlockWaiting: "fulfill\nsomeone's\nwish",
};

export function t(entry: Localized, lang: AppLanguage): string {
  return entry[lang];
}
