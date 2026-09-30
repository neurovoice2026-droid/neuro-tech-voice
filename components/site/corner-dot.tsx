/**
 * Filled disc with a rounded-square bite out of it.
 *
 * The cover's punctuation mark: it corners the primary button and divides
 * the colophon strip. Shared so anything continuing the cover downward
 * carries the same mark rather than an approximation of it.
 *
 * Its own module, and not a client one. It used to live in ./ui, which is
 * "use client" and pulls in framer-motion for its reveals — so every page
 * that printed this 6px mark in an eyebrow or the footer shipped the whole
 * motion library to draw it.
 */
export function CornerDot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 6 6" fill="none" aria-hidden className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 0a3 3 0 110 6 3 3 0 010-6ZM1.493 1.167a.326.326 0 00-.326.326v3.014c0 .18.146.326.326.326h3.014a.326.326 0 00.326-.326V1.493a.326.326 0 00-.326-.326H1.493Z"
        fill="currentColor"
      />
    </svg>
  );
}
