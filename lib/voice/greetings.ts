// Every line the voice pipeline speaks on its own (greetings, disclosure,
// recording notice, fillers, silence and hand-off lines, router messages), in
// the 14 agent languages. Pure data + string helpers, safe for client code.
//
// Two linguistic rules hold everywhere, whatever the tone:
// - The polite form of address (dumneavoastră, usted, vous, Sie, Lei, u, 您,
//   keigo, 존댓말, आप…) — a business answering its own phone never slides into
//   the familiar form because a tone slider moved (see lib/site.ts SETUP_LANGS).
// - No first-person gendered grammar (Polish past tense, Hindi सकता/सकती,
//   French désolé/désolée, Portuguese obrigado/obrigada): the voice can be
//   feminine or masculine, and the text can't know which.
//
// The AI disclosure is non-negotiable (EU AI Act art. 50 transparency applies
// from 2 Aug 2026): every generated greeting already carries it, and
// applyDisclosure adds it to a custom greeting that doesn't.

import type { AgentTone } from '@/types'
import { baseLanguage } from '@/lib/voice/languages'
import { normalizeTone } from '@/lib/voice/tone'

/** Spoken right after the greeting's opening when a custom greeting doesn't disclose. */
export const AI_DISCLOSURE: Record<string, string> = {
  en: "Just so you know, I'm an AI assistant.",
  ro: 'Vă informez că sunt un asistent virtual cu inteligență artificială.',
  es: 'Le informo de que soy un asistente virtual con inteligencia artificial.',
  fr: "Pour information, je suis un assistant virtuel basé sur l'intelligence artificielle.",
  de: 'Zu Ihrer Information: Ich bin ein virtueller Assistent mit künstlicher Intelligenz.',
  it: "La informo che sono un assistente virtuale basato sull'intelligenza artificiale.",
  pt: 'Informo que sou um assistente virtual com inteligência artificial.',
  pl: 'Informuję, że rozmowę prowadzi wirtualny asystent oparty na sztucznej inteligencji.',
  nl: 'Even ter informatie: u spreekt met een virtuele assistent met kunstmatige intelligentie.',
  ja: 'なお、このお電話はAIアシスタントが対応しております。',
  ko: '참고로 저는 AI 음성 비서입니다.',
  zh: '温馨提示：我是AI智能助理。',
  ar: 'للعلم، أنا مساعد افتراضي يعمل بالذكاء الاصطناعي.',
  hi: 'आपकी जानकारी के लिए, मैं एक एआई असिस्टेंट हूँ।',
}

export const RECORDING_NOTICE: Record<string, string> = {
  en: 'This call may be recorded for quality purposes.',
  ro: 'Convorbirea poate fi înregistrată în scopul asigurării calității.',
  es: 'Esta llamada puede ser grabada con fines de calidad.',
  fr: 'Cet appel peut être enregistré à des fins de qualité.',
  de: 'Dieses Gespräch kann zu Qualitätszwecken aufgezeichnet werden.',
  it: 'La chiamata potrebbe essere registrata per migliorare la qualità del servizio.',
  pt: 'Esta chamada pode ser gravada para efeitos de qualidade.',
  pl: 'Rozmowa może być nagrywana w celu zapewnienia jakości obsługi.',
  nl: 'Dit gesprek kan worden opgenomen voor kwaliteitsdoeleinden.',
  ja: '品質向上のため、この通話は録音させていただく場合がございます。',
  ko: '서비스 품질 향상을 위해 통화 내용이 녹음될 수 있습니다.',
  zh: '为保证服务质量，本次通话可能会被录音。',
  ar: 'قد يتم تسجيل هذه المكالمة لأغراض ضمان الجودة.',
  hi: 'गुणवत्ता सुनिश्चित करने के लिए यह कॉल रिकॉर्ड की जा सकती है।',
}

/** The gateway gave up (every provider failed). */
export const APOLOGY_MESSAGE: Record<string, string> = {
  en: "Sorry, we're having technical trouble right now. Please call again in a few minutes.",
  ro: 'Ne pare rău, întâmpinăm o problemă tehnică. Vă rugăm să reveniți cu un apel în câteva minute.',
  es: 'Lo sentimos, estamos teniendo problemas técnicos. Por favor, vuelva a llamar en unos minutos.',
  fr: 'Toutes nos excuses, nous rencontrons un problème technique. Merci de rappeler dans quelques minutes.',
  de: 'Entschuldigung, wir haben gerade technische Probleme. Bitte rufen Sie in ein paar Minuten erneut an.',
  it: 'Ci scusi, stiamo riscontrando un problema tecnico. La preghiamo di richiamare tra qualche minuto.',
  pt: 'Pedimos desculpa, estamos com um problema técnico. Por favor, volte a ligar dentro de alguns minutos.',
  pl: 'Przepraszamy, mamy chwilowe problemy techniczne. Prosimy zadzwonić ponownie za kilka minut.',
  nl: 'Excuses, we hebben op dit moment een technische storing. Wilt u over een paar minuten opnieuw bellen?',
  ja: '申し訳ございません。ただいまシステムに不具合が発生しております。しばらくしてからおかけ直しください。',
  ko: '죄송합니다. 현재 기술적인 문제가 발생했습니다. 잠시 후 다시 전화해 주세요.',
  zh: '非常抱歉，我们目前遇到了技术问题。请稍后再拨打。',
  ar: 'نعتذر، نواجه مشكلة تقنية حالياً. يرجى معاودة الاتصال بعد بضع دقائق.',
  hi: 'क्षमा करें, अभी तकनीकी समस्या आ रही है। कृपया कुछ मिनट बाद फिर से कॉल करें।',
}

/** The router refused the call (agent paused, trial over, minutes used up). */
export const UNAVAILABLE_MESSAGE: Record<string, string> = {
  en: "Sorry, we can't take your call right now. Please try again later.",
  ro: 'Ne pare rău, momentan nu putem prelua apelul dumneavoastră. Vă rugăm să reveniți mai târziu.',
  es: 'Lo sentimos, en este momento no podemos atender su llamada. Por favor, inténtelo más tarde.',
  fr: 'Toutes nos excuses, nous ne pouvons pas prendre votre appel pour le moment. Merci de réessayer plus tard.',
  de: 'Entschuldigung, wir können Ihren Anruf gerade nicht entgegennehmen. Bitte versuchen Sie es später noch einmal.',
  it: 'Ci scusi, al momento non possiamo rispondere alla sua chiamata. La preghiamo di riprovare più tardi.',
  pt: 'Lamentamos, de momento não conseguimos atender a sua chamada. Por favor, tente mais tarde.',
  pl: 'Przepraszamy, w tej chwili nie możemy odebrać połączenia. Prosimy spróbować później.',
  nl: 'Excuses, we kunnen uw oproep op dit moment niet aannemen. Probeert u het later nog eens.',
  ja: '申し訳ございません。ただいまお電話に出ることができません。時間をおいておかけ直しください。',
  ko: '죄송합니다. 지금은 전화를 받을 수 없습니다. 나중에 다시 걸어 주세요.',
  zh: '非常抱歉，我们现在无法接听您的电话。请稍后再试。',
  ar: 'نعتذر، لا يمكننا استقبال مكالمتك الآن. يرجى المحاولة لاحقاً.',
  hi: 'क्षमा करें, अभी आपकी कॉल नहीं ली जा सकती। कृपया बाद में फिर से कोशिश करें।',
}

/** Spoken before a live transfer. `{name}` is the contact's name or role. */
export const TRANSFER_ANNOUNCE: Record<string, string> = {
  en: 'Please hold while I connect you to {name}.',
  ro: 'Vă rog să rămâneți la telefon, vă fac legătura cu {name}.',
  es: 'Un momento, por favor, le paso con {name}.',
  fr: 'Merci de patienter, je vous mets en relation avec {name}.',
  de: 'Einen Moment bitte, ich verbinde Sie mit {name}.',
  it: 'Resti in linea, la metto in contatto con {name}.',
  pt: 'Aguarde um momento, vou transferir a chamada para {name}.',
  // Nominative on purpose: "łączę z {name}" would need the instrumental case.
  pl: 'Proszę chwilę poczekać, już przełączam. Rozmowę przejmie {name}.',
  nl: 'Een moment alstublieft, ik verbind u door met {name}.',
  ja: '{name}におつなぎいたしますので、少々お待ちください。',
  ko: '{name} 담당자에게 연결해 드리겠습니다. 잠시만 기다려 주세요.',
  zh: '请稍候，正在为您转接{name}。',
  ar: 'يرجى الانتظار قليلاً، سيتم تحويل مكالمتك إلى {name}.',
  hi: 'कृपया लाइन पर बने रहें, आपकी कॉल {name} को ट्रांसफ़र की जा रही है।',
}

/** First line after a mid-call switch to the fallback provider. */
export const RESUME_AFTER_HANDOFF: Record<string, string> = {
  en: "Sorry about that, I'm back. Could you repeat the last thing you said?",
  ro: 'Îmi cer scuze pentru întrerupere, am revenit. Puteți repeta ultima parte, vă rog?',
  es: 'Disculpe la interrupción, ya estoy de vuelta. ¿Podría repetirme lo último que dijo?',
  fr: 'Excusez-moi pour cette coupure, je suis de retour. Pourriez-vous répéter la dernière chose que vous avez dite ?',
  de: 'Entschuldigung für die Unterbrechung, ich bin wieder da. Könnten Sie das Letzte bitte noch einmal sagen?',
  it: "Mi scusi per l'interruzione, sono di nuovo qui. Può ripetere l'ultima cosa che ha detto?",
  pt: 'Peço desculpa pela interrupção, já estou de volta. Pode repetir o que estava a dizer?',
  pl: 'Przepraszam za przerwę, już jestem. Czy mogę prosić o powtórzenie ostatniej części?',
  nl: 'Excuses voor de onderbreking, ik ben er weer. Kunt u het laatste nog even herhalen?',
  ja: '大変失礼いたしました。恐れ入りますが、最後の部分をもう一度おっしゃっていただけますか？',
  ko: '죄송합니다, 잠시 연결이 끊겼습니다. 마지막에 하신 말씀을 다시 한번 해 주시겠어요?',
  zh: '抱歉，刚才出了点问题，我回来了。麻烦您把最后说的内容再说一遍好吗？',
  ar: 'عذراً على الانقطاع، أنا معك مجدداً. هل يمكنك تكرار آخر ما قلته؟',
  hi: 'रुकावट के लिए क्षमा करें, मैं फिर से आपके साथ हूँ। क्या आप अपनी आख़िरी बात दोहरा सकते हैं?',
}

/** Caller silent after the agent finished speaking. */
export const STILL_THERE: Record<string, string> = {
  en: 'Are you still there?',
  ro: 'Mai sunteți la telefon?',
  es: '¿Sigue ahí?',
  fr: 'Êtes-vous toujours là ?',
  de: 'Sind Sie noch da?',
  it: 'È ancora in linea?',
  pt: 'Ainda está aí?',
  pl: 'Halo, czy nadal mnie słychać?',
  nl: 'Bent u er nog?',
  ja: 'もしもし、お電話はつながっておりますでしょうか？',
  ko: '여보세요, 아직 통화 중이신가요?',
  zh: '您好，请问您还在吗？',
  ar: 'هل ما زلت على الخط؟',
  hi: 'क्या आप अभी भी लाइन पर हैं?',
}

/** Caller still silent after STILL_THERE; the call ends right after. */
export const GOODBYE_SILENCE: Record<string, string> = {
  en: "I haven't heard anything for a while, so I'll end the call now. Feel free to call back anytime. Goodbye.",
  ro: 'Nu vă mai aud, așa că voi încheia apelul acum. Ne puteți suna oricând. La revedere!',
  es: 'Como no le escucho, voy a finalizar la llamada. Puede volver a llamarnos cuando quiera. Adiós.',
  fr: "Je ne vous entends plus, je vais donc raccrocher. N'hésitez pas à rappeler quand vous voulez. Au revoir.",
  de: 'Ich höre leider nichts mehr, daher beende ich jetzt das Gespräch. Rufen Sie gern jederzeit wieder an. Auf Wiederhören.',
  it: 'Non la sento più, quindi chiudo la chiamata. Può richiamarci quando vuole. Arrivederci.',
  pt: 'Como não estou a ouvir nada, vou terminar a chamada. Pode voltar a ligar quando quiser. Adeus.',
  pl: 'Nic nie słychać, więc zakończę teraz rozmowę. Zapraszamy do ponownego kontaktu w dowolnej chwili. Do widzenia.',
  nl: 'Ik hoor niets meer, dus ik beëindig het gesprek. U kunt ons altijd opnieuw bellen. Tot ziens.',
  ja: 'お声が確認できないため、いったんお電話を失礼いたします。またいつでもおかけください。',
  ko: '말씀이 들리지 않아 통화를 종료하겠습니다. 언제든지 다시 전화해 주세요. 감사합니다.',
  zh: '由于一直没有听到您的声音，我先挂断电话了。欢迎随时再来电，再见。',
  ar: 'لم أعد أسمع صوتك، لذا سأنهي المكالمة الآن. يمكنك معاودة الاتصال في أي وقت. مع السلامة.',
  hi: 'आपकी आवाज़ नहीं आ रही है, इसलिए यह कॉल अब समाप्त की जा रही है। आप कभी भी दोबारा कॉल कर सकते हैं। धन्यवाद।',
}

/** 30 seconds before the call's maximum duration. */
export const WRAP_UP: Record<string, string> = {
  en: "Just so you know, we're nearly at the time limit for this call, so we'll need to wrap up shortly.",
  ro: 'Vă informez că ne apropiem de limita de timp a acestui apel, așa că va trebui să încheiem în curând.',
  es: 'Le aviso de que estamos llegando al límite de tiempo de esta llamada, así que tendremos que terminar en breve.',
  fr: 'Je vous informe que nous approchons de la durée maximale de cet appel, nous allons devoir conclure rapidement.',
  de: 'Kurzer Hinweis: Wir erreichen gleich die maximale Gesprächsdauer, daher müssen wir in Kürze zum Ende kommen.',
  it: 'La avviso che stiamo per raggiungere il limite di tempo della chiamata, quindi dovremo concludere a breve.',
  pt: 'Informo que estamos a chegar ao limite de tempo desta chamada, por isso teremos de terminar em breve.',
  pl: 'Informuję, że zbliża się limit czasu tej rozmowy, więc wkrótce trzeba będzie ją zakończyć.',
  nl: 'Even ter informatie: we naderen de maximale gespreksduur, dus we moeten zo afronden.',
  ja: '恐れ入りますが、まもなく通話時間の上限となりますので、そろそろお話をまとめさせていただきます。',
  ko: '통화 가능 시간이 거의 끝나 가고 있어 곧 통화를 마무리해야 합니다.',
  zh: '提醒您，本次通话即将达到时长上限，我们需要尽快结束通话。',
  ar: 'للعلم، نقترب من الحد الأقصى لمدة هذه المكالمة، لذا سنحتاج إلى إنهائها قريباً.',
  hi: 'आपकी जानकारी के लिए, इस कॉल की समय सीमा लगभग पूरी होने वाली है, इसलिए जल्द ही बात समाप्त करनी होगी।',
}

/** Short fillers spoken before a slow tool runs. */
export const FILLER_PHRASES: Record<string, string[]> = {
  en: ['One moment, let me check.', 'Let me look that up for you.', 'Just a second.'],
  ro: ['Un moment, vă rog, verific.', 'Imediat, mă uit acum.', 'O clipă, vă rog.'],
  es: ['Un momento, lo compruebo.', 'Permítame consultarlo.', 'Un segundo, por favor.'],
  fr: ['Un instant, je vérifie.', 'Je regarde cela tout de suite.', "Une seconde, s'il vous plaît."],
  de: ['Einen Moment, ich sehe kurz nach.', 'Ich prüfe das gleich für Sie.', 'Eine Sekunde bitte.'],
  it: ['Un attimo, controllo subito.', 'Verifico per lei.', 'Un secondo, per favore.'],
  pt: ['Um momento, vou verificar.', 'Deixe-me confirmar.', 'Só um segundo, por favor.'],
  pl: ['Chwileczkę, już sprawdzam.', 'Moment, zaraz to sprawdzę.', 'Sekundkę, proszę.'],
  nl: ['Een momentje, ik kijk het even na.', 'Ik zoek het even voor u op.', 'Een ogenblik alstublieft.'],
  ja: ['少々お待ちください。確認いたします。', 'ただいまお調べいたします。', '確認しますので、少々お待ちください。'],
  ko: ['잠시만요, 확인해 보겠습니다.', '바로 확인해 드리겠습니다.', '잠시만 기다려 주세요.'],
  zh: ['请稍等，我查一下。', '我马上为您确认。', '稍等一下。'],
  ar: ['لحظة من فضلك، سأتحقق من ذلك.', 'سأتحقق من ذلك الآن.', 'ثانية واحدة من فضلك.'],
  hi: ['एक पल रुकिए, अभी चेक करते हैं।', 'बस एक सेकंड, जानकारी देख रहे हैं।', 'कृपया एक क्षण रुकिए।'],
}

// ─── Greetings ────────────────────────────────────────────────────────────────

type Register = 'formal' | 'neutral' | 'casual'

/** Six tones collapse to three registers; the prompt's style block does the rest. */
const REGISTER_FOR_TONE: Record<AgentTone, Register> = {
  formal: 'formal',
  professional: 'neutral',
  empathetic: 'neutral',
  casual: 'casual',
  friendly: 'casual',
  energetic: 'casual',
}

interface GreetingParts {
  /** Mentions `{company}`. */
  open: string
  /** Names `{agent}` and says it is an AI assistant. */
  intro: string
  offer: string
}

interface GreetingSet {
  formal: GreetingParts
  neutral: GreetingParts
  casual: GreetingParts
  /** Opening when the business has no name yet. */
  openPlain: string
  /** Intro when the agent has no name. Still discloses. */
  introPlain: string
}

// Time-of-day salutations are avoided where they'd sound wrong after hours
// (Buenos días, Buongiorno); "Bună ziua", "Guten Tag", "Dzień dobry" are the
// standard all-day business openers in their languages.
const GREETINGS: Record<string, GreetingSet> = {
  en: {
    formal: {
      open: 'Good day, and thank you for calling {company}.',
      intro: 'My name is {agent}, and I am an AI assistant.',
      offer: 'How may I help you today?',
    },
    neutral: {
      open: 'Thank you for calling {company}.',
      intro: 'This is {agent}, an AI assistant.',
      offer: 'How can I help you today?',
    },
    casual: {
      open: 'Hi, thanks for calling {company}!',
      intro: "I'm {agent}, the AI assistant here.",
      offer: 'What can I do for you?',
    },
    openPlain: 'Thank you for calling.',
    introPlain: "I'm an AI assistant.",
  },
  ro: {
    formal: {
      open: 'Vă mulțumim că ați sunat la {company}.',
      intro: 'Numele meu este {agent} și sunt asistent virtual cu inteligență artificială.',
      offer: 'Cu ce vă pot fi de folos?',
    },
    neutral: {
      open: 'Bună ziua, ați sunat la {company}.',
      intro: 'Sunt {agent}, asistentul virtual cu inteligență artificială.',
      offer: 'Cu ce vă pot ajuta astăzi?',
    },
    casual: {
      open: 'Bună ziua și mulțumim că ați sunat la {company}!',
      intro: 'Eu sunt {agent}, asistentul virtual cu inteligență artificială.',
      offer: 'Spuneți-mi, cu ce vă pot ajuta?',
    },
    openPlain: 'Vă mulțumim pentru apel.',
    introPlain: 'Sunt asistentul virtual cu inteligență artificială.',
  },
  es: {
    formal: {
      open: '{company}, gracias por su llamada.',
      intro: 'Le atiende {agent}, asistente virtual con inteligencia artificial.',
      offer: '¿En qué puedo servirle?',
    },
    neutral: {
      open: 'Gracias por llamar a {company}.',
      intro: 'Soy {agent}, el asistente virtual con inteligencia artificial.',
      offer: '¿En qué puedo ayudarle hoy?',
    },
    casual: {
      open: '¡Hola! Ha llamado a {company}.',
      intro: 'Soy {agent}, el asistente virtual con inteligencia artificial.',
      offer: 'Cuénteme, ¿en qué puedo ayudarle?',
    },
    openPlain: 'Gracias por su llamada.',
    introPlain: 'Soy el asistente virtual con inteligencia artificial.',
  },
  fr: {
    formal: {
      open: "Merci d'avoir appelé {company}.",
      intro: "Je suis {agent}, assistant virtuel basé sur l'intelligence artificielle.",
      offer: 'En quoi puis-je vous être utile ?',
    },
    neutral: {
      open: "Merci d'appeler {company}.",
      intro: "Ici {agent}, l'assistant virtuel basé sur l'intelligence artificielle.",
      offer: "Comment puis-je vous aider aujourd'hui ?",
    },
    casual: {
      open: "Bonjour et merci d'appeler {company} !",
      intro: "Moi, c'est {agent}, l'assistant virtuel basé sur l'intelligence artificielle.",
      offer: 'Dites-moi, comment puis-je vous aider ?',
    },
    openPlain: 'Merci de votre appel.',
    introPlain: "Je suis l'assistant virtuel basé sur l'intelligence artificielle.",
  },
  de: {
    formal: {
      open: 'Vielen Dank für Ihren Anruf bei {company}.',
      intro: 'Mein Name ist {agent}, ich bin ein virtueller Assistent mit künstlicher Intelligenz.',
      offer: 'Wie kann ich Ihnen behilflich sein?',
    },
    neutral: {
      open: 'Guten Tag, hier ist {company}.',
      intro: 'Sie sprechen mit {agent}, dem KI-Assistenten.',
      offer: 'Wie kann ich Ihnen helfen?',
    },
    casual: {
      open: 'Hallo und danke für Ihren Anruf bei {company}!',
      intro: 'Ich bin {agent}, der KI-Assistent.',
      offer: 'Was kann ich für Sie tun?',
    },
    openPlain: 'Vielen Dank für Ihren Anruf.',
    introPlain: 'Sie sprechen mit dem KI-Assistenten.',
  },
  it: {
    formal: {
      open: 'Grazie per aver chiamato {company}.',
      intro: "Sono {agent}, assistente virtuale basato sull'intelligenza artificiale.",
      offer: 'Come posso esserle utile?',
    },
    neutral: {
      open: 'Salve, ha chiamato {company}.',
      intro: "Sono {agent}, l'assistente virtuale con intelligenza artificiale.",
      offer: 'Come posso aiutarla oggi?',
    },
    casual: {
      open: 'Salve e grazie per aver chiamato {company}!',
      intro: "Sono {agent}, l'assistente virtuale con intelligenza artificiale.",
      offer: 'Mi dica pure, come posso aiutarla?',
    },
    openPlain: 'Grazie per la chiamata.',
    introPlain: "Sono l'assistente virtuale con intelligenza artificiale.",
  },
  pt: {
    formal: {
      open: 'Agradecemos a sua chamada para {company}.',
      intro: 'O meu nome é {agent}, assistente virtual com inteligência artificial.',
      offer: 'Em que posso ser útil?',
    },
    neutral: {
      open: 'Ligou para {company}.',
      intro: 'Fala {agent}, o assistente virtual com inteligência artificial.',
      offer: 'Como posso ajudar hoje?',
    },
    casual: {
      open: 'Olá! Ligou para {company}.',
      intro: 'Sou {agent}, o assistente virtual com inteligência artificial.',
      offer: 'Diga-me, em que posso ajudar?',
    },
    openPlain: 'Agradecemos a sua chamada.',
    introPlain: 'Sou o assistente virtual com inteligência artificial.',
  },
  pl: {
    formal: {
      open: 'Dziękujemy za telefon do firmy {company}.',
      intro: 'Z tej strony {agent}, wirtualny asystent oparty na sztucznej inteligencji.',
      offer: 'Czym mogę służyć?',
    },
    neutral: {
      open: 'Dzień dobry, firma {company}.',
      intro: 'Z tej strony {agent}, wirtualny asystent oparty na sztucznej inteligencji.',
      offer: 'W czym mogę dziś pomóc?',
    },
    casual: {
      open: 'Dzień dobry, tu {company}!',
      intro: 'Mówi {agent}, wirtualny asystent oparty na sztucznej inteligencji.',
      offer: 'Proszę powiedzieć, w czym mogę pomóc?',
    },
    openPlain: 'Dziękujemy za telefon.',
    introPlain: 'Z tej strony wirtualny asystent oparty na sztucznej inteligencji.',
  },
  nl: {
    formal: {
      open: 'Hartelijk dank voor uw telefoontje naar {company}.',
      intro: 'U spreekt met {agent}, een virtuele assistent op basis van kunstmatige intelligentie.',
      offer: 'Waarmee kan ik u van dienst zijn?',
    },
    neutral: {
      open: 'Welkom bij {company}.',
      intro: 'U spreekt met {agent}, de virtuele assistent met kunstmatige intelligentie.',
      offer: 'Waarmee kan ik u helpen?',
    },
    casual: {
      open: 'Hallo, fijn dat u belt met {company}!',
      intro: 'Ik ben {agent}, de virtuele assistent met kunstmatige intelligentie.',
      offer: 'Waar kan ik u mee helpen?',
    },
    openPlain: 'Bedankt voor uw telefoontje.',
    introPlain: 'U spreekt met de virtuele assistent met kunstmatige intelligentie.',
  },
  ja: {
    formal: {
      open: 'お電話ありがとうございます。{company}でございます。',
      intro: 'AIアシスタントの{agent}が承ります。',
      offer: 'ご用件をお伺いいたします。',
    },
    neutral: {
      open: 'お電話ありがとうございます。{company}です。',
      intro: 'AIアシスタントの{agent}と申します。',
      offer: '本日はどのようなご用件でしょうか？',
    },
    casual: {
      open: 'お電話ありがとうございます！{company}です。',
      intro: 'AIアシスタントの{agent}です。',
      offer: 'どういったご用件でしょうか？',
    },
    openPlain: 'お電話ありがとうございます。',
    introPlain: 'AIアシスタントが承ります。',
  },
  ko: {
    formal: {
      open: '감사합니다, {company}입니다.',
      intro: '저는 인공지능 상담원 {agent}입니다.',
      offer: '무엇을 도와드릴까요?',
    },
    neutral: {
      open: '안녕하세요, {company}입니다.',
      intro: '저는 AI 비서 {agent}입니다.',
      offer: '오늘 무엇을 도와드릴까요?',
    },
    casual: {
      open: '안녕하세요! {company}에 전화 주셔서 감사해요.',
      intro: 'AI 비서 {agent}입니다.',
      offer: '어떤 도움이 필요하세요?',
    },
    openPlain: '전화 주셔서 감사합니다.',
    introPlain: '저는 AI 비서입니다.',
  },
  zh: {
    formal: {
      open: '您好，感谢致电{company}。',
      intro: '我是AI智能助理{agent}。',
      offer: '请问有什么可以为您效劳？',
    },
    neutral: {
      open: '您好，这里是{company}。',
      intro: '我是AI助理{agent}。',
      offer: '请问有什么可以帮您？',
    },
    casual: {
      open: '您好！欢迎致电{company}！',
      intro: '我是AI助理{agent}。',
      offer: '有什么可以帮您的吗？',
    },
    openPlain: '您好，感谢您的来电。',
    introPlain: '我是AI助理。',
  },
  ar: {
    formal: {
      open: 'شكراً لاتصالكم بـ {company}.',
      intro: 'معكم {agent}، المساعد الافتراضي المدعوم بالذكاء الاصطناعي.',
      offer: 'كيف يمكنني خدمتكم؟',
    },
    neutral: {
      open: 'مرحباً بكم في {company}.',
      intro: 'أنا {agent}، المساعد الافتراضي بالذكاء الاصطناعي.',
      offer: 'كيف يمكنني مساعدتكم اليوم؟',
    },
    casual: {
      open: 'أهلاً وسهلاً بكم في {company}!',
      intro: 'معكم {agent}، المساعد الافتراضي بالذكاء الاصطناعي.',
      offer: 'بماذا يمكنني مساعدتكم؟',
    },
    openPlain: 'شكراً لاتصالكم.',
    introPlain: 'معكم المساعد الافتراضي المدعوم بالذكاء الاصطناعي.',
  },
  hi: {
    formal: {
      open: 'नमस्कार, {company} को कॉल करने के लिए धन्यवाद।',
      intro: 'मैं {agent} हूँ, एक एआई असिस्टेंट।',
      offer: 'बताइए, मैं आपकी क्या सहायता करूँ?',
    },
    neutral: {
      open: 'नमस्ते, {company} में आपका स्वागत है।',
      intro: 'मैं {agent} हूँ, एक एआई असिस्टेंट।',
      offer: 'आज मैं आपकी क्या मदद करूँ?',
    },
    casual: {
      open: 'नमस्ते! {company} को कॉल करने के लिए शुक्रिया।',
      intro: 'मैं {agent} हूँ, एक एआई असिस्टेंट।',
      offer: 'बताइए, क्या मदद करूँ?',
    },
    openPlain: 'कॉल करने के लिए धन्यवाद।',
    introPlain: 'मैं एक एआई असिस्टेंट हूँ।',
  },
}

interface OutboundParts {
  /** Names `{agent}` and discloses. */
  open: string
  /** Mentions `{company}`. */
  onBehalf: string
  ask: string
}

const OUTBOUND: Record<string, OutboundParts> = {
  en: { open: 'Hello, this is {agent}, an AI assistant.', onBehalf: "I'm calling on behalf of {company}.", ask: 'Is now a good time to talk?' },
  ro: { open: 'Bună ziua, sunt {agent}, asistent virtual cu inteligență artificială.', onBehalf: 'Vă sun din partea companiei {company}.', ask: 'Aveți un moment să vorbim?' },
  es: { open: 'Hola, soy {agent}, asistente virtual con inteligencia artificial.', onBehalf: 'Le llamo de parte de {company}.', ask: '¿Tiene un momento para hablar?' },
  fr: { open: "Bonjour, je suis {agent}, assistant virtuel basé sur l'intelligence artificielle.", onBehalf: 'Je vous appelle de la part de {company}.', ask: "Avez-vous un moment à m'accorder ?" },
  de: { open: 'Guten Tag, hier ist {agent}, ein KI-Assistent.', onBehalf: 'Ich rufe im Auftrag von {company} an.', ask: 'Passt es Ihnen gerade?' },
  it: { open: 'Salve, sono {agent}, assistente virtuale con intelligenza artificiale.', onBehalf: 'La chiamo per conto di {company}.', ask: 'Ha un momento per parlare?' },
  pt: { open: 'Olá, fala {agent}, assistente virtual com inteligência artificial.', onBehalf: 'Estou a ligar em nome de {company}.', ask: 'Tem um momento para falar?' },
  pl: { open: 'Dzień dobry, z tej strony {agent}, wirtualny asystent oparty na sztucznej inteligencji.', onBehalf: 'Dzwonię w imieniu firmy {company}.', ask: 'Czy to dobry moment na rozmowę?' },
  nl: { open: 'Goedendag, u spreekt met {agent}, een virtuele assistent met kunstmatige intelligentie.', onBehalf: 'Ik bel namens {company}.', ask: 'Komt het nu even uit?' },
  ja: { open: 'お忙しいところ失礼いたします。AIアシスタントの{agent}と申します。', onBehalf: '{company}よりお電話いたしました。', ask: '今、少しお時間よろしいでしょうか？' },
  ko: { open: '안녕하세요, 저는 AI 비서 {agent}입니다.', onBehalf: '{company} 측에서 연락드렸습니다.', ask: '잠시 통화 괜찮으신가요?' },
  zh: { open: '您好，我是AI助理{agent}。', onBehalf: '我代表{company}给您来电。', ask: '请问现在方便通话吗？' },
  ar: { open: 'مرحباً، معك {agent}، المساعد الافتراضي بالذكاء الاصطناعي.', onBehalf: 'أتصل بك نيابةً عن {company}.', ask: 'هل هذا وقت مناسب للحديث؟' },
  hi: { open: 'नमस्ते, मैं {agent} हूँ, एक एआई असिस्टेंट।', onBehalf: 'यह कॉल {company} की ओर से है।', ask: 'क्या अभी बात करने का सही समय है?' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fill(template: string, vars?: Record<string, string>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match
  )
}

/** The line for a language (region tags accepted), falling back to English. */
export function localized(map: Record<string, string>, language: string, vars?: Record<string, string>): string {
  const template = map[baseLanguage(language)] ?? map.en ?? ''
  return fill(template, vars)
}

export function localizedList(map: Record<string, string[]>, language: string): string[] {
  return map[baseLanguage(language)] ?? map.en ?? []
}

const CJK_TERMINATOR = /[。！？]$/
const ANY_TERMINATOR = /[.!?。！？؟।]["'”’»)]*$/

function fullStopFor(language: string): string {
  const lang = baseLanguage(language)
  if (lang === 'ja' || lang === 'zh') return '。'
  if (lang === 'hi') return '।'
  return '.'
}

/** Joins sentences with a space, or nothing after CJK punctuation; closes unterminated ones. */
function joinSentences(parts: string[], language: string): string {
  let out = ''
  for (const raw of parts) {
    const part = raw.trim()
    if (!part) continue
    if (!out) {
      out = part
      continue
    }
    if (!ANY_TERMINATOR.test(out)) out += fullStopFor(language)
    out += CJK_TERMINATOR.test(out) ? part : ` ${part}`
  }
  return out
}

/**
 * Splits off a trailing question ("How can I help?") so the disclosure lands
 * before it: a caller who hears a question answers it and talks over whatever
 * comes next. A `.` only ends a sentence when whitespace follows, so decimals
 * and times ("9.30") don't split.
 */
function splitTrailingQuestion(text: string): [head: string, question: string] {
  const closing = /[?？؟]["'”’»)]*$/.exec(text)
  if (!closing) return [text, '']
  const body = text.slice(0, closing.index)
  for (let i = body.length - 1; i >= 0; i--) {
    const ch = body[i]
    const next = body[i + 1] ?? ''
    if ('。！？'.includes(ch) || ('.!?؟।'.includes(ch) && /\s/.test(next))) {
      return [text.slice(0, i + 1).trim(), text.slice(i + 1).trim()]
    }
  }
  return ['', text]
}

// Words that already tell the caller they're talking to an AI / virtual
// assistant. Every language's patterns are checked (a custom greeting isn't
// always written in the agent's language); acronyms stay case-sensitive so
// Romanian "ia" or Spanish "si" never count.
const DISCLOSURE_PATTERNS: RegExp[] = [
  /\bA\.?I\.?(?![A-Za-z0-9])/,
  /\bartificial[- ]intelligence\b/i,
  /\b(virtual|digital|automated|ai)\s+(assistant|receptionist|agent)\b/i,
  /\bIA\b/,
  /\bKI\b/,
  /\bSI\b/,
  // ro inteligență artificială, es/pt inteligencia/inteligência artificial,
  // fr intelligence artificielle, it intelligenza artificiale
  /intel+ig\S*\s+artifici/i,
  /asistent\S*\s+virtual/i,
  /asistente\s+(virtual|digital)/i,
  /assistant\S*\s+(virtuel|numérique|numerique)/i,
  /(virtuelle|digitale)\S*\s+Assistent/i,
  /(künstlich|kuenstlich)\S*\s+Intelligenz/i,
  /assistente\s+(virtuale|digitale|virtual|digital)/i,
  /(wirtualn|cyfrow)\S*\s+asystent/i,
  /sztuczn\S*\s+inteligencj/i,
  /(virtuele|digitale)\s+assistent/i,
  /kunstmatige\s+intelligentie/i,
  /ＡＩ|エーアイ|人工知能|バーチャルアシスタント|自動音声/,
  /인공지능|에이아이|가상\s*(비서|어시스턴트|상담원)/,
  /人工智能|人工智慧|智能助[理手]|虚拟助[理手]|虛擬助[理手]/,
  /الذكاء\s+الاصطناعي|المساعد\s+الافتراضي|مساعد\s+افتراضي/,
  /एआई|कृत्रिम\s*बुद्धि|आर्टिफ़िशियल|आर्टिफिशियल|वर्चुअल\s*असिस्टेंट|आभासी\s*सहायक/,
]

const RECORDING_PATTERNS: RegExp[] = [
  /\brecord(ed|ing)?\b/i,
  /[îi]nregistr/i,
  /grabad[ao]|grabaci[óo]n/i,
  /enregistr/i,
  /aufgezeichnet|aufzeichn/i,
  /registrat[ao]|registrazion/i,
  /gravad[ao]|grava[çc][ãa]o/i,
  /nagryw|nagran/i,
  /opgenomen|opname/i,
  /録音/,
  /녹음/,
  /录音|錄音/,
  /تسجيل|مسجلة/,
  /रिकॉर्ड|रिकार्ड/,
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Removes the business name so "Acme AI Labs" or "Virtual Assistant Co" can't pass as a disclosure. */
function withoutBusinessName(text: string, businessName: string): string {
  const name = businessName.trim()
  if (name.length < 3) return text
  return text.replace(new RegExp(escapeRegExp(name), 'gi'), ' ')
}

export function mentionsAiDisclosure(text: string, businessName = ''): boolean {
  const probe = withoutBusinessName(text, businessName)
  return DISCLOSURE_PATTERNS.some((re) => re.test(probe))
}

export function mentionsRecordingNotice(text: string, businessName = ''): boolean {
  const probe = withoutBusinessName(text, businessName)
  return RECORDING_PATTERNS.some((re) => re.test(probe))
}

/**
 * Generated inbound greeting: opening with the business, the agent's name
 * with the AI disclosure, and an offer to help, in the register the tone
 * implies.
 */
export function greetingFor(input: { language: string; tone: AgentTone; company: string; agentName: string }): string {
  const lang = baseLanguage(input.language)
  const set = GREETINGS[lang] ?? GREETINGS.en
  const parts = set[REGISTER_FOR_TONE[normalizeTone(input.tone)]]
  const company = input.company.trim()
  const agentName = input.agentName.trim()
  return joinSentences(
    [
      company ? fill(parts.open, { company }) : set.openPlain,
      agentName ? fill(parts.intro, { agent: agentName }) : set.introPlain,
      parts.offer,
    ],
    lang
  )
}

/** Short opener for calls the agent places (reminders, follow-ups, test calls to the owner). */
export function outboundGreetingFor(input: { language: string; company: string; agentName: string }): string {
  const lang = baseLanguage(input.language)
  const parts = OUTBOUND[lang] ?? OUTBOUND.en
  const set = GREETINGS[lang] ?? GREETINGS.en
  const company = input.company.trim()
  const agentName = input.agentName.trim()
  return joinSentences(
    [
      agentName ? fill(parts.open, { agent: agentName }) : set.introPlain,
      company ? fill(parts.onBehalf, { company }) : '',
      parts.ask,
    ],
    lang
  )
}

/**
 * Makes sure the first thing a caller hears says it's an AI (and, when asked,
 * that the call may be recorded). Idempotent: a greeting that already says so
 * in any supported language is returned unchanged, so running it on stored or
 * already-processed text never stacks disclosures. A null/empty greeting gets
 * a minimal neutral one.
 */
export function applyDisclosure(
  greeting: string | null,
  input: { language: string; businessName: string; recordingNotice: boolean }
): string {
  const lang = baseLanguage(input.language)
  const business = input.businessName.trim()
  let text = (greeting ?? '').trim()
  if (!text) {
    const set = GREETINGS[lang] ?? GREETINGS.en
    text = joinSentences([business ? fill(set.neutral.open, { company: business }) : set.openPlain, set.neutral.offer], lang)
  }

  const additions: string[] = []
  if (!mentionsAiDisclosure(text, business)) additions.push(localized(AI_DISCLOSURE, lang))
  if (input.recordingNotice && !mentionsRecordingNotice(text, business)) additions.push(localized(RECORDING_NOTICE, lang))
  if (additions.length === 0) return text

  const [head, question] = splitTrailingQuestion(text)
  return joinSentences([head, ...additions, question], lang)
}
