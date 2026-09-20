import { CheckCircle2, PhoneCall } from 'lucide-react'

const features = [
  'Set up in under 5 minutes',
  '100+ natural voices',
  'Integrates with Google Workspace',
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen auth-gradient lg:grid lg:grid-cols-2">
      {/* ── Left branding panel (desktop only) ───────────────────────────── */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between bg-gradient-to-br from-purple-700 via-purple-800 to-purple-950 p-12">
        {/* Subtle dot-grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Middle: Tagline + features */}
        <div className="relative z-10 space-y-10">
          <div className="space-y-3">
            <h2 className="text-4xl font-bold leading-tight text-white">
              Your AI voice agent,
              <br />
              working 24/7
            </h2>
            <p className="text-lg text-purple-200">
              Set up in minutes. Handle every call automatically.
            </p>
          </div>

          <ul className="space-y-4">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-white">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/15">
                  <CheckCircle2 className="h-4 w-4 text-purple-200" aria-hidden="true" />
                </span>
                <span className="text-base">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: what the agent does, not a made-up number */}
        <div className="relative z-10">
          <div className="glass-card inline-flex max-w-sm items-center gap-4 rounded-2xl px-6 py-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/20">
              <PhoneCall className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Every call answered</p>
              <p className="text-xs text-muted-foreground">
                Books appointments, answers questions and takes messages, day and night.
              </p>
            </div>
          </div>
        </div>

        {/* Decorative wave bottom */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 800 120"
            preserveAspectRatio="none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0,70 C180,0 360,120 540,55 S720,0 800,50 L800,120 L0,120 Z"
              fill="rgba(255,255,255,0.04)"
            />
            <path
              d="M0,95 C120,35 280,115 440,75 S640,20 800,70 L800,120 L0,120 Z"
              fill="rgba(255,255,255,0.03)"
            />
          </svg>
        </div>
      </div>

      {/* ── Right: form column ────────────────────────────────────────────── */}
      <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:p-8 lg:p-12">
        <div className="w-full max-w-[440px]">{children}</div>
      </div>
    </div>
  )
}
