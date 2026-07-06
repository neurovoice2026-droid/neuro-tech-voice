// Composes the final instruction set actually sent to ElevenLabs. The dashboard
// only lets Customers edit the base system_prompt and fallback_message, but the
// language-behavior rules below are enforced here, server-side, on every
// create/update, so they can never be silently dropped or left in the wrong
// language. This is also where fallback_message actually reaches the agent:
// ElevenLabs has no native "fallback message" field, so it must be folded into
// the prompt as an explicit instruction.

const DEFAULT_FALLBACK_MESSAGES: Record<string, string> = {
  en: "I'm sorry, I didn't quite catch that. Could you please repeat?",
  ro: 'Îmi pare rău, nu am înțeles exact. Puteți repeta, vă rog?',
  es: 'Lo siento, no entendí bien eso. ¿Podría repetirlo, por favor?',
  fr: "Désolé, je n'ai pas bien compris. Pourriez-vous répéter, s'il vous plaît ?",
  de: 'Entschuldigung, das habe ich nicht ganz verstanden. Könnten Sie das bitte wiederholen?',
  it: 'Mi scusi, non ho capito bene. Potrebbe ripetere, per favore?',
  pt: 'Desculpe, não entendi bem. Podia repetir, por favor?',
  pl: 'Przepraszam, nie zrozumiałem tego dokładnie. Czy mógłby Pan/Pani powtórzyć?',
  nl: 'Sorry, dat heb ik niet helemaal begrepen. Kunt u dat herhalen?',
  ja: '申し訳ございません、うまく聞き取れませんでした。もう一度おっしゃっていただけますか?',
  ko: '죄송합니다, 잘 이해하지 못했습니다. 다시 한 번 말씀해 주시겠어요?',
  zh: '抱歉,我没有听清楚。您能再说一遍吗?',
  ar: 'عذرًا، لم أفهم ذلك تمامًا. هل يمكنك التكرار من فضلك؟',
  hi: 'क्षमा करें, मुझे यह ठीक से समझ नहीं आया। क्या आप कृपया दोहरा सकते हैं?',
}

/** The fallback phrase to use when the Customer hasn't set a custom one, matched to the agent's language. */
export function defaultFallbackMessage(language?: string | null): string {
  return DEFAULT_FALLBACK_MESSAGES[language ?? 'en'] ?? DEFAULT_FALLBACK_MESSAGES.en
}

interface ComposePromptInput {
  system_prompt?: string | null
  language?: string | null
  fallback_message?: string | null
}

export function composeSystemPrompt({
  system_prompt,
  language,
  fallback_message,
}: ComposePromptInput): string {
  const base = system_prompt?.trim() || 'You are a helpful assistant.'
  const lang = language ?? 'en'
  const fallback = fallback_message?.trim() || defaultFallbackMessage(lang)

  const rules: string[] = []

  if (lang === 'ro') {
    rules.push(
      'You must always write and speak in Romanian using correct diacritics (ă, â, î, ș, ț) - for example "vă mulțumesc" not "va multumesc". Never drop the diacritics, even if information you receive from tools, documents, or the caller omits them.'
    )
  }

  rules.push(
    `If you do not understand the caller or cannot help with their request, respond with exactly: "${fallback}"`
  )

  return [base, ...rules].join('\n\n')
}
