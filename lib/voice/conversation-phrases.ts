// Localized lines and word lists the ElevenLabs agent uses on its own, in the
// 14 agent languages: soft-timeout fillers, the closing line at the maximum
// call duration and the backchannel words that must not interrupt the agent.
// Pure data + helpers, client-safe.
//
// Same rules as lib/voice/greetings.ts: the polite form of address, and no
// first-person gendered grammar (the voice may be feminine or masculine).
//
// Spec limits (TurnConfig / SoftTimeoutConfig, OpenAPI 2026-10): a soft-timeout
// message is 1-200 characters and at most 7 additional messages are allowed;
// interruption_ignore_terms are matched case-insensitively and exactly.

import { baseLanguage } from '@/lib/voice/languages'

/** First soft-timeout filler, then up to three more (said in random order while a reply is slow). */
export const SOFT_TIMEOUT_MESSAGES: Record<string, readonly [string, ...string[]]> = {
  en: ['One moment, please.', 'Let me check that for you.', 'Thank you for waiting.', 'Just a second more, please.'],
  ro: ['Un moment, vă rog.', 'Imediat, verific acum.', 'Vă mulțumesc pentru răbdare.', 'Încă o clipă, vă rog.'],
  es: ['Un momento, por favor.', 'Enseguida lo compruebo.', 'Gracias por esperar.', 'Un segundo más, por favor.'],
  fr: ["Un instant, s'il vous plaît.", 'Je vérifie tout de suite.', 'Merci de patienter.', "Encore une seconde, s'il vous plaît."],
  de: ['Einen Moment, bitte.', 'Ich sehe kurz nach.', 'Danke für Ihre Geduld.', 'Noch einen kleinen Moment, bitte.'],
  it: ['Un momento, per favore.', 'Controllo subito.', "Grazie per l'attesa.", 'Ancora un secondo, per favore.'],
  pt: ['Um momento, por favor.', 'Vou verificar já.', 'Agradeço a sua paciência.', 'Só mais um segundo, por favor.'],
  pl: ['Chwileczkę, proszę.', 'Już sprawdzam.', 'Dziękuję za cierpliwość.', 'Jeszcze sekundkę, proszę.'],
  nl: ['Een moment, alstublieft.', 'Ik kijk het even na.', 'Bedankt voor uw geduld.', 'Nog heel even, alstublieft.'],
  ja: ['少々お待ちください。', 'ただいま確認しております。', 'お待たせしております。', 'もう少々お待ちください。'],
  ko: ['잠시만 기다려 주세요.', '바로 확인하고 있습니다.', '기다려 주셔서 감사합니다.', '조금만 더 기다려 주세요.'],
  zh: ['请稍等。', '正在为您查询。', '感谢您的耐心等待。', '请再稍等一下。'],
  ar: ['لحظة من فضلك.', 'أتحقق من ذلك الآن.', 'شكراً على انتظاركم.', 'ثانية واحدة من فضلك.'],
  hi: ['कृपया एक क्षण रुकिए।', 'बस एक क्षण, जानकारी देखी जा रही है।', 'इंतज़ार के लिए धन्यवाद।', 'बस थोड़ा और रुकिए।'],
}

/** Spoken when the call reaches its maximum duration, right before the platform ends it. */
export const MAX_DURATION_MESSAGES: Record<string, string> = {
  en: "We've reached the time limit for this call, so it has to end now. Thank you for calling, and feel free to call us back anytime. Goodbye.",
  ro: 'Am ajuns la durata maximă a acestui apel, așa că trebuie să îl încheiem acum. Vă mulțumim pentru apel și ne puteți suna din nou oricând. La revedere!',
  es: 'Hemos llegado al límite de tiempo de esta llamada, así que tenemos que terminarla ahora. Gracias por llamar; puede volver a llamarnos cuando quiera. Adiós.',
  fr: "Nous avons atteint la durée maximale de cet appel, nous devons donc y mettre fin. Merci de votre appel, n'hésitez pas à nous rappeler quand vous le souhaitez. Au revoir.",
  de: 'Wir haben die maximale Gesprächsdauer erreicht, daher muss das Gespräch jetzt enden. Vielen Dank für Ihren Anruf, rufen Sie gern jederzeit wieder an. Auf Wiederhören.',
  it: 'Abbiamo raggiunto il limite di tempo di questa chiamata, quindi dobbiamo concluderla. Grazie per aver chiamato, può richiamarci quando vuole. Arrivederci.',
  pt: 'Chegámos ao limite de tempo desta chamada, por isso temos de terminá-la agora. Agradecemos a sua chamada; pode voltar a ligar quando quiser. Adeus.',
  // Impersonal on purpose: "osiągnęliśmy" would be gendered.
  pl: 'Upłynął maksymalny czas tej rozmowy, dlatego musimy ją teraz zakończyć. Dziękujemy za telefon i zapraszamy do ponownego kontaktu w dowolnej chwili. Do widzenia.',
  nl: 'We hebben de maximale gespreksduur bereikt, dus het gesprek moet nu eindigen. Bedankt voor uw telefoontje, u kunt ons altijd opnieuw bellen. Tot ziens.',
  ja: '通話時間の上限に達したため、これで失礼いたします。お電話ありがとうございました。またいつでもおかけください。',
  ko: '통화 가능 시간이 끝나 이만 통화를 종료하겠습니다. 전화해 주셔서 감사합니다. 언제든지 다시 전화해 주세요.',
  zh: '本次通话已达到时长上限，需要结束通话了。感谢您的来电，欢迎随时再次致电。再见。',
  ar: 'لقد وصلنا إلى الحد الأقصى لمدة هذه المكالمة، لذا يجب إنهاؤها الآن. شكراً لاتصالكم، ويمكنكم معاودة الاتصال في أي وقت. مع السلامة.',
  hi: 'इस कॉल की अधिकतम समय सीमा पूरी हो गई है, इसलिए कॉल अब समाप्त की जा रही है। कॉल करने के लिए धन्यवाद, आप कभी भी दोबारा कॉल कर सकते हैं। नमस्ते।',
}

/**
 * Short acknowledgements callers say while the agent talks ("mhm", "da",
 * "ok"). They must not stop the agent mid-sentence. Only whole, short
 * backchannel tokens: never words that start a real interruption ("nu",
 * "stai", "wait", "no").
 */
export const BACKCHANNEL_TERMS: Record<string, readonly string[]> = {
  en: ['yeah', 'uh-huh', 'mhm', 'mm-hmm', 'mm', 'okay', 'ok', 'right', 'sure', 'i see', 'got it', 'alright'],
  ro: ['da', 'aha', 'mhm', 'mm', 'ok', 'okay', 'bine', 'sigur', 'înțeleg', 'așa', 'exact', 'am înțeles'],
  es: ['sí', 'vale', 'ajá', 'mhm', 'claro', 'ok', 'de acuerdo', 'entiendo'],
  fr: ['oui', "d'accord", 'ok', 'mhm', 'ouais', 'je vois', 'entendu', 'ah oui'],
  de: ['ja', 'genau', 'okay', 'ok', 'mhm', 'aha', 'ach so', 'verstehe', 'alles klar'],
  it: ['sì', 'ok', 'va bene', 'certo', 'mhm', 'capisco', "d'accordo", 'esatto'],
  pt: ['sim', 'ok', 'certo', 'pois', 'claro', 'mhm', 'está bem', 'entendo'],
  pl: ['tak', 'aha', 'mhm', 'okej', 'ok', 'dobrze', 'rozumiem', 'jasne'],
  nl: ['ja', 'oké', 'ok', 'mhm', 'precies', 'klopt', 'aha', 'prima'],
  ja: ['はい', 'ええ', 'うん', 'なるほど', 'そうですね'],
  ko: ['네', '예', '응', '아', '그렇군요'],
  zh: ['嗯', '对', '好', '好的', '是的'],
  ar: ['نعم', 'أيوه', 'حسنا', 'تمام', 'أها'],
  hi: ['हाँ', 'हां', 'जी', 'अच्छा', 'ठीक है', 'हम्म'],
}

export function softTimeoutMessages(language: string): readonly [string, ...string[]] {
  return SOFT_TIMEOUT_MESSAGES[baseLanguage(language)] ?? SOFT_TIMEOUT_MESSAGES.en
}

export function maxDurationMessage(language: string): string {
  return MAX_DURATION_MESSAGES[baseLanguage(language)] ?? MAX_DURATION_MESSAGES.en
}

export function backchannelTerms(language: string): readonly string[] {
  return BACKCHANNEL_TERMS[baseLanguage(language)] ?? BACKCHANNEL_TERMS.en
}
