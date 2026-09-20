// Sample line spoken by voices that have no preview file on Cartesia (about
// two thirds of the library), and the fallback line for pace previews.
// Synthesised once per voice and cached, so the wording stays neutral: no
// business name, and no phrasing that depends on the speaker's gender (Hindi
// and Portuguese verbs would otherwise change). Pure and client-safe.

export const VOICE_SAMPLE_TEXT: Record<string, string> = {
  en: 'Hi, thanks for calling. I can help you book an appointment or answer any questions you have.',
  ro: 'Bună ziua și vă mulțumim că ați sunat. Vă pot ajuta cu o programare sau cu orice întrebare aveți.',
  es: 'Hola, gracias por llamar. Puedo ayudarle a reservar una cita o responder a cualquier pregunta.',
  fr: 'Bonjour, merci de votre appel. Je peux vous aider à prendre rendez-vous ou répondre à vos questions.',
  de: 'Guten Tag, danke für Ihren Anruf. Ich helfe Ihnen gern bei einem Termin oder beantworte Ihre Fragen.',
  it: 'Buongiorno, grazie per la chiamata. Posso aiutarla a fissare un appuntamento o rispondere alle sue domande.',
  pt: 'Olá, agradecemos a sua chamada. Posso ajudar a marcar uma consulta ou responder às suas perguntas.',
  pl: 'Dzień dobry, dziękujemy za telefon. Mogę pomóc umówić wizytę albo odpowiedzieć na Pana lub Pani pytania.',
  nl: 'Goedendag, bedankt voor uw telefoontje. Ik help u graag met een afspraak of met uw vragen.',
  ja: 'お電話ありがとうございます。ご予約のお手続きや、ご質問へのご案内をいたします。',
  ko: '전화 주셔서 감사합니다. 예약을 도와드리거나 궁금하신 점에 답변해 드리겠습니다.',
  zh: '您好，感谢您的来电。我可以帮您预约，也可以解答您的任何问题。',
  ar: 'مرحباً، شكراً لاتصالك. يسعدني مساعدتك في حجز موعد أو الإجابة عن أسئلتك.',
  hi: 'नमस्ते, कॉल करने के लिए धन्यवाद। मैं अपॉइंटमेंट बुक करने और आपके सवालों के जवाब देने के लिए यहाँ हूँ।',
}

/** Sample language and text for a voice; languages without a sample use English. */
export function sampleFor(language: string | null | undefined): { language: string; text: string } {
  const base = (language ?? '').trim().toLowerCase().split(/[-_]/)[0]
  if (base && Object.prototype.hasOwnProperty.call(VOICE_SAMPLE_TEXT, base)) {
    return { language: base, text: VOICE_SAMPLE_TEXT[base] }
  }
  return { language: 'en', text: VOICE_SAMPLE_TEXT.en }
}
