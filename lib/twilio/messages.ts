// Lines the telephony routes speak themselves with <Say>, in the 14 agent
// languages. Same rules as lib/voice/greetings.ts: polite form of address and
// no first-person gendered grammar (the voice can be feminine or masculine).
// Pure data, safe anywhere.

/** Opening of the fallback when the agent can't run and a team member is dialled instead. */
export const TECHNICAL_TROUBLE: Record<string, string> = {
  en: "Sorry, we're having technical trouble right now.",
  ro: 'Ne pare rău, întâmpinăm o problemă tehnică.',
  es: 'Lo sentimos, estamos teniendo problemas técnicos.',
  fr: 'Toutes nos excuses, nous rencontrons un problème technique.',
  de: 'Entschuldigung, wir haben gerade technische Probleme.',
  it: 'Ci scusi, stiamo riscontrando un problema tecnico.',
  pt: 'Pedimos desculpa, estamos com um problema técnico.',
  pl: 'Przepraszamy, mamy chwilowe problemy techniczne.',
  nl: 'Excuses, we hebben op dit moment een technische storing.',
  ja: '申し訳ございません。ただいまシステムに不具合が発生しております。',
  ko: '죄송합니다. 현재 기술적인 문제가 발생했습니다.',
  zh: '非常抱歉，我们目前遇到了技术问题。',
  ar: 'نعتذر، نواجه مشكلة تقنية حالياً.',
  hi: 'क्षमा करें, अभी तकनीकी समस्या आ रही है।',
}

/** A live transfer rang out: the message was logged for the team. */
export const TRANSFER_UNAVAILABLE: Record<string, string> = {
  en: "Sorry, nobody is available to take the call right now. We've passed your message on to the team, and someone will get back to you as soon as possible.",
  ro: 'Ne pare rău, momentan nu este nimeni disponibil. Am transmis mesajul dumneavoastră echipei și cineva vă va contacta cât mai curând posibil.',
  es: 'Lo sentimos, en este momento no hay nadie disponible. Hemos pasado su mensaje al equipo y alguien se pondrá en contacto con usted lo antes posible.',
  fr: "Toutes nos excuses, personne n'est disponible pour le moment. Nous avons transmis votre message à l'équipe et quelqu'un vous recontactera dès que possible.",
  de: 'Entschuldigung, gerade ist leider niemand erreichbar. Wir haben Ihre Nachricht an das Team weitergegeben, und jemand meldet sich so bald wie möglich bei Ihnen.',
  it: "Ci scusi, al momento non c'è nessuno disponibile. Abbiamo inoltrato il suo messaggio al team e qualcuno la ricontatterà il prima possibile.",
  pt: 'Lamentamos, de momento não está ninguém disponível. Transmitimos a sua mensagem à equipa e alguém entrará em contacto consigo o mais breve possível.',
  pl: 'Przepraszamy, w tej chwili nikt nie jest dostępny. Przekazaliśmy wiadomość zespołowi i ktoś skontaktuje się z Państwem najszybciej, jak to możliwe.',
  nl: 'Excuses, er is op dit moment niemand beschikbaar. We hebben uw bericht aan het team doorgegeven en er neemt zo snel mogelijk iemand contact met u op.',
  ja: '申し訳ございません。ただいま担当者が対応できません。ご用件はチームに申し伝えましたので、改めてご連絡いたします。',
  ko: '죄송합니다. 지금은 연결 가능한 담당자가 없습니다. 팀에 메시지를 전달했으니 최대한 빨리 연락드리겠습니다.',
  zh: '非常抱歉，目前没有人可以接听。我们已将您的留言转达给团队，会尽快与您联系。',
  ar: 'نعتذر، لا يوجد أحد متاح حالياً. لقد أبلغنا الفريق برسالتك، وسيتواصل معك أحد أعضائه في أقرب وقت ممكن.',
  hi: 'क्षमा करें, अभी कोई उपलब्ध नहीं है। हमने आपका संदेश टीम तक पहुँचा दिया है, और जल्द से जल्द कोई आपसे संपर्क करेगा।',
}

/**
 * Generic {name} for TRANSFER_ANNOUNCE (lib/voice/greetings.ts) when the
 * fallback dials the on-call contact; each value fits that template's grammar.
 */
export const TEAM_MEMBER: Record<string, string> = {
  en: 'a member of our team',
  ro: 'un membru al echipei noastre',
  es: 'un miembro de nuestro equipo',
  fr: 'un membre de notre équipe',
  de: 'einem Mitglied unseres Teams',
  it: 'un membro del nostro team',
  pt: 'um membro da nossa equipa',
  pl: 'członek naszego zespołu',
  nl: 'een medewerker van ons team',
  ja: '担当者',
  // The Korean template already ends in "{name} 담당자에게".
  ko: '저희 팀',
  zh: '我们的工作人员',
  ar: 'أحد أعضاء فريقنا',
  hi: 'हमारी टीम के एक सदस्य',
}
