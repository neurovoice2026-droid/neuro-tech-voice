// Warm-transfer whisper for app-routed transfers: Twilio <Dial><Number url=…>
// fetches /api/telephony/twilio/whisper when the human answers and plays the
// returned TwiML to THEM only, before the caller is bridged in. It announces
// that the AI assistant is transferring a caller and, when the agent gave
// one, the reason, in the agent's language.
//
// The reason is written by the LLM (transfer tool parameter): it is treated as
// untrusted text and reduced to one short spoken line (no control characters,
// markup, URLs or long digit runs such as phone or card numbers). The TwiML
// builder XML-escapes it. Pure.

import { localized } from '@/lib/voice/greetings'

export const WHISPER_ANNOUNCE: Record<string, string> = {
  en: 'You have a call transferred by the AI assistant.',
  ro: 'Aveți un apel transferat de asistentul virtual.',
  es: 'Tiene una llamada transferida por el asistente virtual.',
  fr: "Vous avez un appel transféré par l'assistant virtuel.",
  de: 'Sie erhalten einen Anruf, den der virtuelle Assistent weiterleitet.',
  it: "Ha una chiamata trasferita dall'assistente virtuale.",
  pt: 'Tem uma chamada transferida pelo assistente virtual.',
  pl: 'Połączenie przekazane przez wirtualnego asystenta.',
  nl: 'U krijgt een gesprek doorverbonden door de virtuele assistent.',
  ja: 'AIアシスタントから転送されたお電話です。',
  ko: 'AI 비서가 연결한 전화입니다.',
  zh: '这是AI助理转接的来电。',
  ar: 'لديك مكالمة محوّلة من المساعد الافتراضي.',
  hi: 'यह एआई असिस्टेंट द्वारा ट्रांसफ़र की गई कॉल है।',
}

/** `{reason}` is the sanitized reason. */
export const WHISPER_REASON: Record<string, string> = {
  en: 'Reason: {reason}.',
  ro: 'Motivul: {reason}.',
  es: 'Motivo: {reason}.',
  fr: 'Motif : {reason}.',
  de: 'Grund: {reason}.',
  it: 'Motivo: {reason}.',
  pt: 'Motivo: {reason}.',
  pl: 'Powód: {reason}.',
  nl: 'Reden: {reason}.',
  ja: '用件：{reason}。',
  ko: '용건: {reason}.',
  zh: '来电事由：{reason}。',
  ar: 'السبب: {reason}.',
  hi: 'कारण: {reason}।',
}

export const WHISPER_REASON_MAX = 160

/** One short spoken line from LLM-written text, or null when nothing speakable is left. */
export function speakableReason(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw
    .replace(/\p{Cc}/gu, ' ')
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    // Phone, card or account numbers (and the "[number]" marker the tool route stores).
    .replace(/\[number\]/gi, ' ')
    .replace(/\+?\d[\d\s().-]{3,}\d/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}\s.,;:!?'’"()-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;:!?,\s]+$/u, '')
  if (!/\p{L}/u.test(text)) return null
  if (text.length <= WHISPER_REASON_MAX) return text
  const cut = text.slice(0, WHISPER_REASON_MAX)
  const space = cut.lastIndexOf(' ')
  return (space > WHISPER_REASON_MAX / 2 ? cut.slice(0, space) : cut).trim()
}

/** What the human hears before the caller is connected. */
export function whisperText(language: string, reason: unknown): string {
  const intro = localized(WHISPER_ANNOUNCE, language)
  const spoken = speakableReason(reason)
  return spoken ? `${intro} ${localized(WHISPER_REASON, language, { reason: spoken })}` : intro
}
