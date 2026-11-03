import type { AppLanguage, Localized } from './types';

/**
 * 원본 SwiftUI 각 View 의 LocalizedText / L() 문자열을 그대로 옮겼습니다.
 * (화면별로 묶음)
 */
export const strings = {
  language: {
    infoTop: {
      ko: '인도의 일부 지역에서는 소원을 빌며 \n종교 시설에서 매듭을 묶습니다.\n소원이 이루어지면 다시 찾아가 그 매듭을 풉니다.',
      en: 'In some places of India,\npeople tie knot in religious places wishing something.\nWhen the wish gets fulfilled they go back to the place\nand untie one knot from the existing knots.',
      ja: 'インドの一部の地域では、願い事を込めて聖地で\n紐に結び目を作ります。願いが叶うと、\nその場所に戻って結び目をほどきます。',
      zh: '在印度的一些地区，\n人们会把写有愿望的纸条系在寺庙的树上。\n当愿望实现后,他们会再回到寺庙,将那张纸条解下。',
    },
    infoBottom: {
      ko: '당신도 매듭을 묶어 소원을 이루고 싶나요?',
      en: 'Do you want to fulfill your wish by tying a knot ?',
      ja: 'あなたも結び目を結んで、願いを叶えてみませんか？',
      zh: '想要系上实现愿望的结吗？',
    },
    start: {
      ko: '네! 시작할게요',
      en: 'Yes! Let’s start',
      ja: 'さぁ、はじめましょう',
      zh: '好的！开始吧',
    },
  },

  nationality: {
    title: { en: 'Welcome to', ja: 'ようこそ', zh: '欢迎来到', ko: '환영합니다' },
    description: {
      en: 'Here , you can tie a wishing paper anonymously,\nand when someone untie your wishing paper,\nyour wish will be fulfilled.',
      ja: 'ここでは、匿名で願い紙を結ぶことが\nでき、誰かがその願い紙をほどくと、\nあなたの願いが叶います。',
      zh: '在这里，你可以匿名系上写着自己愿望的卡片\n当下一位解开它的人出现时，\n便象征着你的愿望已经实现。',
      ko: '이곳에서 익명으로 소원을 적은 종이를\n묶을 수 있으며, 누군가가 그 종이를 풀면\n당신의 소원이 이루어집니다.',
    },
    choose: {
      en: 'Please choose your identity',
      ja: 'あなたのアイデンティティを選択してください',
      zh: '选择你的身份。',
      ko: '당신의 신분을 선택해주세요',
    },
    japanese: { en: 'Japanese', ja: '日本人', zh: '日本人', ko: '일본인' },
    foreignResident: {
      en: 'Foreigner living in Japan',
      ja: '日本に住む外国人',
      zh: '居住在日本的外国人',
      ko: '일본에 사는 외국인',
    },
    selectToContinue: {
      en: 'Select to Continue',
      ja: '選択して続行',
      zh: '选择后继续',
      ko: '선택 후 계속',
    },
    next: { en: 'Next', ja: '次へ', zh: '下一步', ko: '다음으로' },
  },

  draw: {
    longDesc: {
      ko: '일본에 사는 외국인으로서, \n일어나지 않길 바라는 불편한 경험에 대해서 이야기 해주세요',
      en: 'Tell one an uncomfortable experience with you in Japan\nfor being a foreigner\nwhich you wish not happen',
      ja: '日本人として、外国の方に\n『こういうことをもっと分かってほしい』と思うことはありますか？',
      zh: '作为居住在日本的外国人，\n您希望日本人能理解您哪些感受？\n',
    },
    usePen: {
      ko: '이 펜을 사용하여\n당신의 소원을 여기에 적어주세요',
      en: 'Please use this pen\nto write your wish here',
      ja: '右のペンを使って、\nここにあなたの願いを書いてください',
      zh: '请用这支笔在这里写下您的心愿',
    },
    message: {
      ko: '이제 아래에서 소원 종이를 하나 고르세요',
      en: 'Now, pick this wish paper\nfrom the box below',
      ja: '下にあるカードから一つ選んでください',
      zh: '现在请从下方的盒子中抽取一张愿望卡片',
    },
    erase: { ko: '지우기', en: 'Erase', ja: '消去', zh: '清除' },
    undo: { ko: '되돌리기', en: 'Undo', ja: '元に戻す', zh: '撤销' },
    pen: { ko: '펜', en: 'Pen', ja: 'ペン', zh: '笔' },
    eraser: { ko: '지우개', en: 'Eraser', ja: '消しゴム', zh: '橡皮' },
    sending: { ko: '저장 중…', en: 'Saving…', ja: '保存中…', zh: '保存中…' },
  },

  savedNext: {
    place: {
      ko: '소원 종이를 스마트폰 상단에 터치해주세요',
      en: 'Please touch your wish paper on\nthe top of the smartphone',
      ja: 'スマートフォンの上に願い紙\nをかざしてください',
      zh: '请触摸手机上端的心愿纸',
    },
    noImage: {
      ko: '저장된 그림이 없습니다',
      en: 'No saved image available',
      ja: '保存された画像がありません',
      zh: '没有已保存的图片',
    },
  },

  attach: {
    description: {
      ko: '당신 앞의 끈에 오미쿠지를 붙여주세요.',
      en: 'Attach your fortune paper\nto the string before you',
      ja: '前にある紐に願い紙を結んでください。',
      zh: '请将您的签纸系在您面前的绳子上。',
    },
    next: { ko: '다음', en: 'Next', ja: '次へ', zh: '下一步' },
  },

  wishSaved: {
    message: {
      ko: '당신의 소원이 저장되었습니다. 이제 누군가가 그 소원을 이루어줄 것입니다.',
      en: 'Your wish has been saved,\nSomeone else will fulfill it next',
      ja: 'あなたの願いは保存されました。\n次は誰かがその願いを叶えてくれます。',
      zh: '您的愿望已保存，接下来会有人帮您实现它。',
    },
    continue: { ko: '다음으로', en: 'Tap to Continue', ja: '次へ進む', zh: '继续' },
  },

  removeTouch: {
    message: {
      ko: '당신의 것과 색이 다른 소원 종이를 고르고, \n실에서 떼어내세요',
      en: 'To continue the wishes,\npick an wish paper\n of a different color from yours,\nremove it from the string',
      ja: 'あなたのものと色の違う願い紙を選び、\n糸からはがします。',
      zh: '请选择与您对应颜色不同的签纸，\n并轻轻从绳子上解下 。',
    },
  },

  unlocked: {
    message: {
      ko: '이제 누군가의 소원이 열렸습니다.\n\n에마에서 적힌 소원을 읽을 수 있습니다.',
      en: "Now you have unlocked\nsomeone's wish.\n\nYou can read the wish\non the ema.",
      ja: '誰かの願いがほどかれました。\n\n絵馬に書かれた願いを読むこと\nができます。',
      zh: '您已解开他人的愿望。\n\n您可以阅读绘马上写下的愿望。',
    },
  },

  thank: {
    description: {
      ko: '당신의 소원이 누군가의 이해와\n누군가의 친절이 되길 바랍니다.',
      en: "May your wish become\nsomeone's understanding\nsomeone's kindness",
      ja: 'あなたの願いが誰かの理解と、\n優しさに繋がりますように。',
      zh: '愿你的愿望，\n成为他人的多一分理解，\n也成为世界的多一点善意。',
    },
    thankYou: { ko: '감사합니다', en: 'Thank You', ja: 'ありがとうございました', zh: '谢谢您' },
  },
} satisfies Record<string, Record<string, Localized>>;

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
