// Text messages the platform sends on its own: booking confirmations,
// changes, cancellations, reminders, waitlist offers and team notifications,
// in the 14 agent languages. Pure and client-safe.
//
// Rules for every template:
// - starts with (or names) the business, so the recipient knows who it is from
// - date and time are formatted by Intl in the business time zone, in the
//   recipient's language, with Gregorian calendar and Latin digits
// - at most SMS_MAX_LENGTH characters: long variable parts are shortened first
// - no links (carriers filter them and callers can't verify them), and links
//   inside variables are removed
// - the polite form of address, as on the phone (lib/voice/greetings.ts)

import { baseLanguage } from '@/lib/voice/languages'
import { safeTimeZone } from '@/lib/scheduling/time'
import type { MessageUrgency } from '@/types'

export const SMS_MAX_LENGTH = 320

export const SMS_LANGUAGES = ['en', 'ro', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'nl', 'ja', 'ko', 'zh', 'ar', 'hi'] as const
export type SmsLanguage = (typeof SMS_LANGUAGES)[number]

type Catalog = Record<SmsLanguage, string>

function lang(language: string | null | undefined): SmsLanguage {
  const base = baseLanguage(language)
  return (SMS_LANGUAGES as readonly string[]).includes(base) ? (base as SmsLanguage) : 'en'
}

// ─── Catalogs ─────────────────────────────────────────────────────────────────
// {business} {when} {service}: {service} is the whole optional service
// sentence (SERVICE_LINE) or empty.

const CONFIRMATION: Catalog = {
  en: '{business}: your appointment on {when} is confirmed.{service} To change or cancel it, just call us.',
  ro: '{business}: programarea dumneavoastră pentru {when} este confirmată.{service} Pentru modificări sau anulare, vă rugăm să ne sunați.',
  es: '{business}: su cita para el {when} está confirmada.{service} Para cambiarla o cancelarla, llámenos.',
  fr: '{business} : votre rendez-vous du {when} est confirmé.{service} Pour le modifier ou l’annuler, appelez-nous.',
  de: '{business}: Ihr Termin am {when} ist bestätigt.{service} Für Änderungen oder eine Absage rufen Sie uns einfach an.',
  it: '{business}: il Suo appuntamento per {when} è confermato.{service} Per modificarlo o annullarlo, ci chiami.',
  pt: '{business}: a sua marcação para {when} está confirmada.{service} Para alterar ou cancelar, ligue-nos.',
  pl: '{business}: potwierdzamy wizytę – {when}.{service} Aby zmienić lub odwołać termin, prosimy o telefon.',
  nl: '{business}: uw afspraak op {when} is bevestigd.{service} Wilt u iets wijzigen of annuleren? Bel ons gerust.',
  ja: '{business}：{when}のご予約を承りました。{service}変更・キャンセルはお電話でご連絡ください。',
  ko: '{business}: {when} 예약이 확정되었습니다.{service} 변경이나 취소는 전화로 연락해 주세요.',
  zh: '{business}：您{when}的预约已确认。{service}如需更改或取消，请致电我们。',
  ar: '{business}: تم تأكيد موعدكم يوم {when}.{service} لتغيير الموعد أو إلغائه، يُرجى الاتصال بنا.',
  hi: '{business}: आपकी अपॉइंटमेंट कन्फ़र्म हो गई है – {when}।{service} बदलने या रद्द करने के लिए कृपया हमें कॉल करें।',
}

const RESCHEDULED: Catalog = {
  en: '{business}: your appointment has been moved to {when}.{service} To change it again, just call us.',
  ro: '{business}: programarea dumneavoastră a fost mutată pe {when}.{service} Pentru alte modificări, vă rugăm să ne sunați.',
  es: '{business}: su cita se ha cambiado al {when}.{service} Si necesita otro cambio, llámenos.',
  fr: '{business} : votre rendez-vous a été déplacé au {when}.{service} Pour tout autre changement, appelez-nous.',
  de: '{business}: Ihr Termin wurde auf {when} verschoben.{service} Für weitere Änderungen rufen Sie uns einfach an.',
  it: '{business}: il Suo appuntamento è stato spostato a {when}.{service} Per altre modifiche, ci chiami.',
  pt: '{business}: a sua marcação foi alterada para {when}.{service} Para outra alteração, ligue-nos.',
  pl: '{business}: zmieniliśmy termin wizyty. Nowy termin: {when}.{service} W razie kolejnych zmian prosimy o telefon.',
  nl: '{business}: uw afspraak is verplaatst naar {when}.{service} Nog iets wijzigen? Bel ons gerust.',
  ja: '{business}：ご予約を{when}に変更いたしました。{service}再度の変更はお電話でご連絡ください。',
  ko: '{business}: 예약이 변경되었습니다. 새 예약 시간: {when}.{service} 추가 변경은 전화로 연락해 주세요.',
  zh: '{business}：您的预约已改至{when}。{service}如需再次更改，请致电我们。',
  ar: '{business}: تم تغيير موعدكم إلى {when}.{service} لأي تغيير آخر، يُرجى الاتصال بنا.',
  hi: '{business}: आपकी अपॉइंटमेंट का समय बदल दिया गया है। नया समय: {when}।{service} फिर से बदलने के लिए कृपया हमें कॉल करें।',
}

const CANCELLED: Catalog = {
  en: '{business}: your appointment on {when} has been cancelled. To book a new time, just call us.',
  ro: '{business}: programarea dumneavoastră pentru {when} a fost anulată. Pentru o nouă programare, vă rugăm să ne sunați.',
  es: '{business}: su cita del {when} ha sido cancelada. Para reservar otra, llámenos.',
  fr: '{business} : votre rendez-vous du {when} a été annulé. Pour en prendre un nouveau, appelez-nous.',
  de: '{business}: Ihr Termin am {when} wurde abgesagt. Für einen neuen Termin rufen Sie uns einfach an.',
  it: '{business}: il Suo appuntamento per {when} è stato annullato. Per fissarne uno nuovo, ci chiami.',
  pt: '{business}: a sua marcação para {when} foi cancelada. Para marcar outra, ligue-nos.',
  pl: '{business}: odwołaliśmy wizytę – {when}. Aby umówić nowy termin, prosimy o telefon.',
  nl: '{business}: uw afspraak op {when} is geannuleerd. Wilt u een nieuwe afspraak maken? Bel ons gerust.',
  ja: '{business}：{when}のご予約をキャンセルいたしました。新たなご予約はお電話で承ります。',
  ko: '{business}: {when} 예약이 취소되었습니다. 새로 예약하시려면 전화해 주세요.',
  zh: '{business}：您{when}的预约已取消。如需重新预约，请致电我们。',
  ar: '{business}: تم إلغاء موعدكم يوم {when}. لحجز موعد جديد، يُرجى الاتصال بنا.',
  hi: '{business}: आपकी अपॉइंटमेंट रद्द कर दी गई है – {when}। नई अपॉइंटमेंट के लिए कृपया हमें कॉल करें।',
}

const REMINDER: Catalog = {
  en: 'Reminder from {business}: your appointment is on {when}.{service} Need to change it? Just call us. Reply STOP to opt out.',
  ro: 'Memento de la {business}: aveți programare {when}.{service} Pentru modificări, vă rugăm să ne sunați. Răspundeți STOP pentru dezabonare.',
  es: 'Recordatorio de {business}: tiene cita el {when}.{service} Si necesita cambiarla, llámenos. Responda STOP para darse de baja.',
  fr: 'Rappel de {business} : vous avez rendez-vous le {when}.{service} Pour le modifier, appelez-nous. Répondez STOP pour vous désabonner.',
  de: 'Erinnerung von {business}: Ihr Termin ist am {when}.{service} Änderungen? Rufen Sie uns einfach an. Antworten Sie STOP zum Abmelden.',
  it: 'Promemoria da {business}: ha un appuntamento {when}.{service} Per modificarlo, ci chiami. Risponda STOP per non ricevere altri SMS.',
  pt: 'Lembrete de {business}: tem marcação para {when}.{service} Para alterar, ligue-nos. Responda STOP para deixar de receber SMS.',
  pl: 'Przypomnienie od {business}: termin wizyty – {when}.{service} W razie zmian prosimy o telefon. Wiadomość STOP wyłącza powiadomienia.',
  nl: 'Herinnering van {business}: uw afspraak is op {when}.{service} Iets wijzigen? Bel ons gerust. Antwoord STOP om u af te melden.',
  ja: '{business}からのお知らせ：{when}にご予約がございます。{service}変更はお電話でご連絡ください。配信停止はSTOPと返信してください。',
  ko: '{business} 알림: {when}에 예약이 있습니다.{service} 변경은 전화로 연락해 주세요. 수신 거부는 STOP으로 답장해 주세요.',
  zh: '{business}提醒：您的预约时间为{when}。{service}如需更改，请致电我们。回复STOP退订。',
  ar: 'تذكير من {business}: موعدكم يوم {when}.{service} للتغيير، يُرجى الاتصال بنا. أرسلوا STOP لإيقاف الرسائل.',
  hi: '{business} की ओर से रिमाइंडर: आपकी अपॉइंटमेंट का समय – {when}।{service} बदलने के लिए कृपया हमें कॉल करें। मैसेज बंद करने के लिए STOP भेजें।',
}

const WAITLIST_OFFER: Catalog = {
  en: 'Good news from {business}: a time has opened up on {when}.{service} Call us to book it; first come, first served. Reply STOP to opt out.',
  ro: 'Vești bune de la {business}: s-a eliberat un loc {when}.{service} Sunați-ne pentru a-l rezerva, în ordinea solicitărilor. Răspundeți STOP pentru dezabonare.',
  es: 'Buenas noticias de {business}: ha quedado un hueco libre el {when}.{service} Llámenos para reservarlo; se asigna por orden de llamada. Responda STOP para darse de baja.',
  fr: 'Bonne nouvelle de {business} : un créneau s’est libéré le {when}.{service} Appelez-nous pour le réserver, premier arrivé, premier servi. Répondez STOP pour vous désabonner.',
  de: 'Gute Nachricht von {business}: Am {when} ist ein Termin frei geworden.{service} Rufen Sie uns zum Buchen an; wer zuerst anruft, bekommt ihn. Antworten Sie STOP zum Abmelden.',
  it: 'Buone notizie da {business}: si è liberato un posto {when}.{service} Ci chiami per prenotarlo, vale l’ordine di chiamata. Risponda STOP per non ricevere altri SMS.',
  pt: 'Boas notícias de {business}: ficou disponível uma vaga para {when}.{service} Ligue-nos para a reservar; é por ordem de contacto. Responda STOP para deixar de receber SMS.',
  pl: 'Dobra wiadomość od {business}: zwolnił się termin – {when}.{service} Aby go zarezerwować, prosimy o telefon; decyduje kolejność zgłoszeń. Wiadomość STOP wyłącza powiadomienia.',
  nl: 'Goed nieuws van {business}: er is een plek vrijgekomen op {when}.{service} Bel ons om te boeken; wie het eerst belt, krijgt de plek. Antwoord STOP om u af te melden.',
  ja: '{business}より：{when}に空きが出ました。{service}ご予約はお電話にて先着順で承ります。配信停止はSTOPと返信してください。',
  ko: '{business} 안내: {when}에 예약 자리가 났습니다.{service} 선착순이니 전화로 예약해 주세요. 수신 거부는 STOP으로 답장해 주세요.',
  zh: '{business}好消息：{when}有空位了。{service}请致电预约，先到先得。回复STOP退订。',
  ar: 'خبر سار من {business}: أصبح هناك موعد متاح يوم {when}.{service} اتصلوا بنا لحجزه، والأولوية لمن يتصل أولاً. أرسلوا STOP لإيقاف الرسائل.',
  hi: '{business} की ओर से अच्छी खबर: एक समय खाली हुआ है – {when}।{service} बुक करने के लिए हमें कॉल करें, जो पहले कॉल करेगा उसे मिलेगा। मैसेज बंद करने के लिए STOP भेजें।',
}

const SERVICE_LINE: Catalog = {
  en: ' Service: {name}.',
  ro: ' Serviciu: {name}.',
  es: ' Servicio: {name}.',
  fr: ' Prestation : {name}.',
  de: ' Leistung: {name}.',
  it: ' Servizio: {name}.',
  pt: ' Serviço: {name}.',
  pl: ' Usługa: {name}.',
  nl: ' Dienst: {name}.',
  ja: '内容：{name}。',
  ko: ' 서비스: {name}.',
  zh: '服务：{name}。',
  ar: ' الخدمة: {name}.',
  hi: ' सेवा: {name}।',
}

/** Sender label when an organisation has no name yet. */
const BUSINESS_FALLBACK: Catalog = {
  en: 'Bookings',
  ro: 'Programări',
  es: 'Reservas',
  fr: 'Rendez-vous',
  de: 'Terminservice',
  it: 'Prenotazioni',
  pt: 'Marcações',
  pl: 'Rezerwacje',
  nl: 'Afspraken',
  ja: '予約窓口',
  ko: '예약 안내',
  zh: '预约服务',
  ar: 'الحجوزات',
  hi: 'बुकिंग',
}

// Team notifications: {urgent}{business}: {headline}. {callbackLabel}: {callback}. {messageLabel}: {message}

interface TeamWords {
  urgent: string
  newMessage: string
  unknownCaller: string
  callback: string
  message: string
  alert: string
  caller: string
  colon: string
  stop: string
}

const TEAM_WORDS: Record<SmsLanguage, TeamWords> = {
  en: { urgent: 'URGENT ', newMessage: 'new message from {caller}', unknownCaller: 'an unknown caller', callback: 'Call back', message: 'Message', alert: 'alert from your AI assistant', caller: 'Caller', colon: ': ', stop: '. ' },
  ro: { urgent: 'URGENT ', newMessage: 'mesaj nou de la {caller}', unknownCaller: 'un apelant necunoscut', callback: 'Număr de contact', message: 'Mesaj', alert: 'alertă de la asistentul AI', caller: 'Apelant', colon: ': ', stop: '. ' },
  es: { urgent: 'URGENTE ', newMessage: 'nuevo mensaje de {caller}', unknownCaller: 'una persona desconocida', callback: 'Número de contacto', message: 'Mensaje', alert: 'aviso de su asistente de IA', caller: 'Llamante', colon: ': ', stop: '. ' },
  fr: { urgent: 'URGENT ', newMessage: 'nouveau message de {caller}', unknownCaller: 'un appelant inconnu', callback: 'Numéro à rappeler', message: 'Message', alert: 'alerte de votre assistant IA', caller: 'Appelant', colon: ' : ', stop: '. ' },
  de: { urgent: 'DRINGEND ', newMessage: 'neue Nachricht von {caller}', unknownCaller: 'einem unbekannten Anrufer', callback: 'Rückrufnummer', message: 'Nachricht', alert: 'Hinweis Ihres KI-Assistenten', caller: 'Anrufer', colon: ': ', stop: '. ' },
  it: { urgent: 'URGENTE ', newMessage: 'nuovo messaggio da {caller}', unknownCaller: 'un chiamante sconosciuto', callback: 'Numero da richiamare', message: 'Messaggio', alert: 'avviso dal Suo assistente IA', caller: 'Chiamante', colon: ': ', stop: '. ' },
  pt: { urgent: 'URGENTE ', newMessage: 'nova mensagem de {caller}', unknownCaller: 'uma pessoa não identificada', callback: 'Número de contacto', message: 'Mensagem', alert: 'alerta do seu assistente de IA', caller: 'Chamada de', colon: ': ', stop: '. ' },
  pl: { urgent: 'PILNE ', newMessage: 'nowa wiadomość od: {caller}', unknownCaller: 'nieznany rozmówca', callback: 'Numer do oddzwonienia', message: 'Treść', alert: 'alert od asystenta AI', caller: 'Dzwoniący', colon: ': ', stop: '. ' },
  nl: { urgent: 'DRINGEND ', newMessage: 'nieuw bericht van {caller}', unknownCaller: 'een onbekende beller', callback: 'Terugbelnummer', message: 'Bericht', alert: 'melding van uw AI-assistent', caller: 'Beller', colon: ': ', stop: '. ' },
  ja: { urgent: '【至急】', newMessage: '新しい伝言（{caller}）', unknownCaller: '発信者不明', callback: '折り返し先', message: '内容', alert: 'AIアシスタントからの通知', caller: '発信者', colon: '：', stop: '。' },
  ko: { urgent: '[긴급] ', newMessage: '새 메시지({caller})', unknownCaller: '발신자 미상', callback: '회신 번호', message: '내용', alert: 'AI 비서 알림', caller: '발신자', colon: ': ', stop: '. ' },
  zh: { urgent: '【紧急】', newMessage: '新留言（{caller}）', unknownCaller: '未知来电者', callback: '回电号码', message: '内容', alert: 'AI助理提醒', caller: '来电者', colon: '：', stop: '。' },
  ar: { urgent: 'عاجل: ', newMessage: 'رسالة جديدة من {caller}', unknownCaller: 'متصل غير معروف', callback: 'رقم معاودة الاتصال', message: 'الرسالة', alert: 'تنبيه من مساعد الذكاء الاصطناعي', caller: 'المتصل', colon: ': ', stop: '. ' },
  hi: { urgent: 'अत्यावश्यक: ', newMessage: '{caller} का नया संदेश', unknownCaller: 'अज्ञात कॉलर', callback: 'कॉलबैक नंबर', message: 'संदेश', alert: 'आपके एआई असिस्टेंट की सूचना', caller: 'कॉलर', colon: ': ', stop: '। ' },
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

const INTL_LOCALE: Record<SmsLanguage, string> = {
  en: 'en-GB',
  ro: 'ro-RO',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
  pl: 'pl-PL',
  nl: 'nl-NL',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'zh-CN',
  ar: 'ar',
  hi: 'hi-IN',
}

/** en-US date order and 12-hour clock for businesses in the Americas, en-GB elsewhere. */
function intlLocale(language: SmsLanguage, timezone: string): string {
  if (language === 'en' && timezone.startsWith('America/')) return 'en-US'
  return INTL_LOCALE[language]
}

/** "Wednesday 18 March at 14:30" in the recipient's language and the business zone. */
export function formatSmsDateTime(startsAt: string | Date, timezone: string, language: string): string {
  const tz = safeTimeZone(timezone)
  const l = lang(language)
  const date = startsAt instanceof Date ? startsAt : new Date(startsAt)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat(intlLocale(l, tz), {
    timeZone: tz,
    calendar: 'gregory',
    numberingSystem: 'latn',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

/** One line of plain text: no control characters, collapsed spaces and, unless kept, no links. */
export function sanitizeSmsText(value: string | null | undefined, opts: { keepLinks?: boolean } = {}): string {
  if (typeof value !== 'string') return ''
  let text = value.replace(/\p{Cc}+/gu, ' ')
  if (!opts.keepLinks) text = text.replace(/\b(?:https?:\/\/|www\.)\S+/gi, '')
  return text.replace(/\s+/g, ' ').trim()
}

export function smsLength(text: string): number {
  return Array.from(text).length
}

function truncate(text: string, maxChars: number): string {
  const chars = Array.from(text)
  if (chars.length <= maxChars) return text
  if (maxChars <= 1) return chars.slice(0, Math.max(0, maxChars)).join('')
  return `${chars.slice(0, maxChars - 1).join('').trimEnd()}…`
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match
  )
}

/**
 * Renders and, while the text is too long, shortens the variables named in
 * `shrink` (in order) down to `minChars` each. Last resort: cut the text.
 */
function fitToLength(
  render: (vars: Record<string, string>) => string,
  vars: Record<string, string>,
  shrink: { key: string; minChars: number }[],
  max = SMS_MAX_LENGTH
): string {
  const current = { ...vars }
  let text = render(current)
  for (const { key, minChars } of shrink) {
    const overflow = smsLength(text) - max
    if (overflow <= 0) break
    const value = current[key] ?? ''
    const target = Math.max(minChars, smsLength(value) - overflow)
    if (target < smsLength(value)) {
      current[key] = truncate(value, target)
      text = render(current)
    }
  }
  return smsLength(text) > max ? truncate(text, max) : text
}

// ─── Caller-facing booking texts ──────────────────────────────────────────────

export interface BookingSmsInput {
  language: string
  businessName: string | null
  startsAt: string | Date
  timezone: string
  service?: string | null
}

function bookingText(catalog: Catalog, input: BookingSmsInput, withService: boolean): string {
  const l = lang(input.language)
  const business = sanitizeSmsText(input.businessName) || BUSINESS_FALLBACK[l]
  const service = withService ? sanitizeSmsText(input.service) : ''
  const vars = {
    business: truncate(business, 60),
    when: formatSmsDateTime(input.startsAt, input.timezone, l),
    serviceName: truncate(service, 60),
  }
  const render = (v: Record<string, string>) =>
    fill(catalog[l], {
      business: v.business,
      when: v.when,
      service: v.serviceName ? fill(SERVICE_LINE[l], { name: v.serviceName }) : '',
    })
  return fitToLength(render, vars, [
    { key: 'serviceName', minChars: 12 },
    { key: 'business', minChars: 16 },
  ])
}

export function bookingConfirmationSms(input: BookingSmsInput): string {
  return bookingText(CONFIRMATION, input, true)
}

export function bookingRescheduledSms(input: BookingSmsInput): string {
  return bookingText(RESCHEDULED, input, true)
}

export function bookingCancelledSms(input: BookingSmsInput): string {
  return bookingText(CANCELLED, input, false)
}

export function bookingReminderSms(input: BookingSmsInput): string {
  return bookingText(REMINDER, input, true)
}

export function waitlistOfferSms(input: BookingSmsInput): string {
  return bookingText(WAITLIST_OFFER, input, true)
}

// ─── Team-facing texts ────────────────────────────────────────────────────────

export interface MessageReceivedSmsInput {
  language: string
  businessName: string | null
  callerName: string | null
  callbackNumber: string | null
  message: string
  urgency: MessageUrgency
}

/** "URGENT Acme: new message from Ana Pop. Call back: +40712345678. Message: …" */
export function messageReceivedSms(input: MessageReceivedSmsInput): string {
  const l = lang(input.language)
  const words = TEAM_WORDS[l]
  const vars = {
    business: truncate(sanitizeSmsText(input.businessName) || BUSINESS_FALLBACK[l], 40),
    caller: truncate(sanitizeSmsText(input.callerName) || words.unknownCaller, 60),
    callback: truncate(sanitizeSmsText(input.callbackNumber), 32),
    message: sanitizeSmsText(input.message),
  }
  const render = (v: Record<string, string>) => {
    const parts = [
      `${input.urgency === 'urgent' ? words.urgent : ''}${v.business}${words.colon}${fill(words.newMessage, { caller: v.caller })}`,
    ]
    if (v.callback) parts.push(`${words.callback}${words.colon}${v.callback}`)
    parts.push(`${words.message}${words.colon}${v.message}`)
    return parts.join(words.stop).trim()
  }
  return fitToLength(render, vars, [
    { key: 'message', minChars: 40 },
    { key: 'caller', minChars: 16 },
    { key: 'business', minChars: 12 },
  ])
}

export interface TeamAlertSmsInput {
  language: string
  businessName: string | null
  summary: string
  callerNumber: string | null
  urgency: MessageUrgency
}

/** "URGENT Acme: alert from your AI assistant. Caller: +40…. Message: …" */
export function teamAlertSms(input: TeamAlertSmsInput): string {
  const l = lang(input.language)
  const words = TEAM_WORDS[l]
  const vars = {
    business: truncate(sanitizeSmsText(input.businessName) || BUSINESS_FALLBACK[l], 40),
    caller: truncate(sanitizeSmsText(input.callerNumber), 32),
    summary: sanitizeSmsText(input.summary),
  }
  const render = (v: Record<string, string>) => {
    const parts = [`${input.urgency === 'urgent' ? words.urgent : ''}${v.business}${words.colon}${words.alert}`]
    if (v.caller) parts.push(`${words.caller}${words.colon}${v.caller}`)
    parts.push(`${words.message}${words.colon}${v.summary}`)
    return parts.join(words.stop).trim()
  }
  return fitToLength(render, vars, [
    { key: 'summary', minChars: 40 },
    { key: 'business', minChars: 12 },
  ])
}

/**
 * A free-form text the agent sends the caller (send_sms tool), signed with the
 * business name when the message doesn't already mention it. Links stay: the
 * business instructions may give the agent one to share.
 */
export function callerMessageSms(input: { businessName: string | null; message: string }): string {
  const message = sanitizeSmsText(input.message, { keepLinks: true })
  const business = sanitizeSmsText(input.businessName)
  // A mention inside a link (acme.com/...) doesn't tell the reader who is texting.
  const mentioned = business && sanitizeSmsText(message).toLowerCase().includes(business.toLowerCase())
  const signed = business && !mentioned ? `${truncate(business, 40)}: ${message}` : message
  return truncate(signed, SMS_MAX_LENGTH)
}
