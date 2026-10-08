import { Onest } from 'next/font/google'

/** App display face. Declared on <html> by the root layout so --font-app-display reaches
 *  portals (dialogs, sheets, menus). preload:false keeps "/" (which uses Instrument Sans)
 *  and the other marketing pages from downloading it; the browser fetches it only where
 *  text actually uses font-heading (the app). */
export const appDisplay = Onest({
  variable: '--font-app-display',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
})
