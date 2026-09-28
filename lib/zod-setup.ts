import { z } from 'zod'

// Imported first by every module that builds zod object schemas and can end up
// in the browser. Zod's JIT object parser probes `new Function("")` when the
// first object schema is built; under our Content-Security-Policy (no
// 'unsafe-eval') zod catches the failure but the browser still reports a CSP
// violation. Validation is identical without the JIT, and our payloads are
// small, so it's off everywhere these schemas load.
z.config({ jitless: true })
