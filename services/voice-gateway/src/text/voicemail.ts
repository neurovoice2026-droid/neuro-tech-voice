// Outbound calls only: does the first thing we hear sound like a voicemail
// greeting? Two signals, either is enough: typical greeting wording in the
// agent languages, or a long uninterrupted monologue (people answer with a
// short "Hello?"; greeting machines talk for several seconds).
//
// A person who picks up for someone else says "she's not available" too, and
// hanging up on them is worse than a missed voicemail. So "not available"
// wording only counts together with carrier or retry wording ("the number you
// called", "please try again later"); unambiguous machine phrases ("leave a
// message after the tone", "voicemail") count on their own.

const MACHINE_PHRASES: RegExp[] = [
  // en
  /\b(leave (a|your) (message|name)|after the (tone|beep)|at the (tone|beep)|can'?t (take|answer) (the|your) (call|phone)|voice ?mail|mailbox|record your message)\b/i,
  // ro
  /(lăsați|lasati|lăsaţi) (un )?mesaj|după (semnalul|tonul) (sonor)?|dupa (semnalul|tonul)|mesageri[ae] vocal[ăa]|căsuța vocală|casuta vocala|abonatul apelat/i,
  // es
  /(deje|dejar) (su|un) mensaje|buzón de voz|buzon de voz|después de la señal|despues de la señal/i,
  // fr
  /laissez(-moi)? (un|votre) message|messagerie vocale|après le (bip|signal)|répondeur/i,
  // de
  /(hinterlassen sie|hinterlasse) (eine|ihre) nachricht|nach dem (signalton|piepton|ton)|mailbox|anrufbeantworter/i,
  // it
  /lasci(ate)? un messaggio|segreteria telefonica|dopo il segnale/i,
  // pt
  /deixe (a sua|uma|sua) mensagem|caixa de correio|correio de voz|após o sinal|apos o sinal/i,
  // pl
  /(zostaw|pozostaw|nagraj)(cie)? wiadomość|poczta głosowa|po sygnale|abonent jest (niedostępny|czasowo niedostępny)/i,
  // nl
  /(laat|spreek) (een|uw) (bericht|boodschap)|na de (piep|toon)|voicemail|ingesproken/i,
]

/** "Not available / not reachable": a person can say this too. */
const UNAVAILABLE =
  /\b(is not available|isn'?t available|can'?t come to the phone|is unavailable)\b|nu (este|poate fi) (disponibil|contactat)|no está disponible|no esta disponible|n'est pas disponible|nicht erreichbar|non è raggiungibile|non e raggiungibile|não está disponível|nao esta disponivel|niedostępny|niet bereikbaar/i

/** Wording only a recording uses around "not available". */
const RECORDING_CONTEXT =
  /\b(the (number|person|subscriber|customer) you (have )?(called|dialed|dialled|are calling)|please (try|call) (again )?later|try (your call )?again later)\b|numărul (format|apelat)|numarul (format|apelat)|mai târziu|mai tarziu|el número (marcado|que ha marcado)|más tarde|mas tarde|le numéro (demandé|composé)|plus tard|teilnehmer|später|spaeter|da lei chiamato|più tardi|piu tardi|o número (marcado|que marcou)|mais tarde|wybrany numer|później|pozniej|het (gekozen|door u gekozen) nummer|probeer (het )?later/i

export function looksLikeVoicemail(transcript: string): boolean {
  const text = transcript.trim()
  if (!text) return false
  if (MACHINE_PHRASES.some((p) => p.test(text))) return true
  return UNAVAILABLE.test(text) && RECORDING_CONTEXT.test(text)
}
