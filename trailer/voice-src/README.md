# Voices for the trailer

Drop one audio file per line here — `wav`, `mp3`, `m4a`, `ogg`, `flac` or
`webm` — named exactly like the **file** column (e.g. `call-1.mp3`). Then:

```bash
npm run voice      # sees the complete set here and uses it
```

Every line is trimmed, levelled (-5 dBFS peak), the callers get a phone-line
EQ, and the timeline re-times itself to the real length of each line (turns
land on the 120 BPM grid, captions follow the spoken words, the orb and
waveform follow the real loudness). Keep the lines roughly as long as a
natural read so the film stays under 60 s.

Generate them anywhere (fish.audio, ElevenLabs, a real voice actor). Use the
same voice for every Ava line. Make sure the voice's licence allows
commercial use (no clones of real people).

| file | who | text | direction |
|---|---|---|---|
| `call-1` | Ava — the AI agent (female) | Thank you for calling Northside Studio. This is Ava, an AI assistant. How can I help you today? | Ava, answering at 3 a.m. and still bright: warm, smiling, calm and professional; a soft, friendly lift on "How can I help you today?" |
| `call-2` | Caller (male), heard on the phone | Hi! Could I come in on Wednesday afternoon? | Caller (on the phone): a little tentative and hopeful, slightly hushed — it's the middle of the night; relaxed, natural. |
| `call-3` | Ava — the AI agent (female) | Of course. I have three p.m., or four thirty. Which suits you better? | Ava: helpful and bright; a tiny beat after "Of course."; offers the two times naturally, a light upturn on "Which suits you better?" |
| `call-4` | Caller (male), heard on the phone | Three o'clock is perfect. | Caller: pleased and relieved, a small smile in the voice. |
| `call-5` | Ava — the AI agent (female) | Lovely. You're booked for Wednesday at three p.m. | Ava: warm, satisfied, reassuring — the payoff. A gentle smile on "Lovely." |
| `kb-1` | Second caller (female), heard on the phone | Do you do home visits? | Second caller (on the phone): curious, casual, friendly. |
| `kb-2` | Ava — the AI agent (female) | I don't have an answer for that, and I don't want to guess. I'll ask the team to call you back today. | Ava: honest and empathetic, never robotic — a hint of apology on "I don't want to guess", then confident and kind on "I'll ask the team to call you back today." |
| `cta-1` | Ava — the AI agent (female) | AI voice agents that book your customers. Twenty four seven. | Ava as the trailer voice-over (not on a phone): intimate, confident, cinematic, a little slower; a deliberate pause before "Twenty four seven." |
| `cta-2` | Ava — the AI agent (female) | Neuro Tech Voice. | Ava voice-over: calm, proud brand sign-off. |

Times are spoken the English way ("three p.m."); the captions show them as
15:00 / 16:30, as on the site.
