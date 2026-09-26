import { describe, expect, it } from 'vitest'
import { decodeHtmlEntities, extractHtmlTitle, htmlToText } from './html'

describe('decodeHtmlEntities', () => {
  it('decodes named, numeric and hex references', () => {
    expect(decodeHtmlEntities('Fish &amp; chips &ndash; &euro;12&nbsp;only')).toBe('Fish & chips – €12 only')
    expect(decodeHtmlEntities('It&#8217;s &#x219;i &#x21B; &acirc;&icirc;&abreve;')).toBe('It’s și ț âîă')
    expect(decodeHtmlEntities('&lt;b&gt; &quot;x&quot; &apos;y&apos;')).toBe('<b> "x" \'y\'')
  })

  it('maps Windows-1252 references and leaves unknown or unterminated names alone', () => {
    expect(decodeHtmlEntities('&#150; &#147;hi&#148;')).toBe('– “hi”')
    expect(decodeHtmlEntities('a=1&b=2 &unknown; &copy')).toBe('a=1&b=2 &unknown; &copy')
    expect(decodeHtmlEntities('&amp done')).toBe('& done')
    expect(decodeHtmlEntities('&#0; &#x110000;')).toBe('\ufffd \ufffd')
  })

  it('covers the whole Latin-1 range by name', () => {
    expect(decodeHtmlEntities('&iexcl;&yuml;&szlig;&Agrave;&divide;')).toBe('¡ÿßÀ÷')
  })
})

describe('extractHtmlTitle', () => {
  it('reads <title>, falling back to og:title', () => {
    expect(extractHtmlTitle('<html><head><title>  Prices &amp; offers\n</title></head></html>')).toBe('Prices & offers')
    expect(extractHtmlTitle('<meta property="og:title" content="Our menu">')).toBe('Our menu')
    expect(extractHtmlTitle("<meta content='Spring menu' property='og:title'>")).toBe('Spring menu')
    expect(extractHtmlTitle('<head><titlebar>x</titlebar><title lang="en">Hours</title></head>')).toBe('Hours')
    expect(extractHtmlTitle('<p>No title</p>')).toBeNull()
    expect(extractHtmlTitle('<title>Never closed')).toBeNull()
  })
})

describe('htmlToText', () => {
  const page = `<!doctype html>
<html>
<head>
  <title>Northside Studio – Prices</title>
  <style>.x { color: red }</style>
  <script>var html = "<h1>not content</h1>";</script>
</head>
<body>
  <header class="top"><a href="/">Northside</a><nav><ul><li><a href="/">Home</a></li><li>Contact</li></ul></nav></header>
  <div role="navigation">Skip menu</div>
  <main>
    <h1>Prices</h1>
    <p>All prices   include
       VAT.</p>
    <!-- <p>old price list</p> -->
    <h2>Haircuts</h2>
    <ul>
      <li>Women: 45&nbsp;EUR</li>
      <li>Men: <strong>30 EUR</strong></li>
    </ul>
    <table>
      <thead><tr><th>Service</th><th>Duration</th></tr></thead>
      <tbody><tr><td>Colour</td><td>90 min</td></tr></tbody>
    </table>
    <div hidden>Secret draft</div>
    <p style="display:none">Hidden promo</p>
    <p class="hidden md:block">Shown on desktop</p>
    <pre>Mon  9-17
Tue  9-17</pre>
    <button>Book now</button>
  </main>
  <aside>Related posts</aside>
  <footer>© 2026 Northside</footer>
</body>
</html>`

  it('keeps headings, paragraphs, lists and tables as readable text', () => {
    const { title, text } = htmlToText(page)
    expect(title).toBe('Northside Studio – Prices')
    expect(text).toContain('# Prices')
    expect(text).toContain('All prices include VAT.')
    expect(text).toContain('## Haircuts')
    expect(text).toContain('- Women: 45 EUR')
    expect(text).toContain('- Men: 30 EUR')
    expect(text).toContain('Service | Duration')
    expect(text).toContain('Colour | 90 min')
    expect(text).toContain('Mon 9-17\nTue 9-17')
  })

  it('drops scripts, styles, comments, navigation, asides, footers, buttons and hidden elements', () => {
    const { text } = htmlToText(page)
    for (const noise of ['not content', 'color: red', 'old price list', 'Home', 'Skip menu', 'Related posts', '© 2026', 'Book now', 'Secret draft', 'Hidden promo']) {
      expect(text).not.toContain(noise)
    }
    // A CSS class called "hidden" is not the hidden attribute.
    expect(text).toContain('Shown on desktop')
  })

  it('uses the whole body when <main> is missing or nearly empty', () => {
    const { text } = htmlToText('<body><main></main><section><h2>About</h2><p>We fix bikes.</p></section></body>')
    expect(text).toBe('## About\n\nWe fix bikes.')
  })

  it('prefers a single <article> holding the content', () => {
    const body = `<body><div>Cookie banner text that is short</div><article><h1>Opening hours</h1><p>${'We are open every weekday from nine to five. '.repeat(10)}</p></article></body>`
    const { text } = htmlToText(body)
    expect(text.startsWith('# Opening hours')).toBe(true)
    expect(text).not.toContain('Cookie banner')
  })

  it('survives unclosed elements and stray markup', () => {
    const { text } = htmlToText('<body><nav>Menu<p>Real content <b>here</p><div>More < text</body>')
    expect(text).toContain('Real content here')
    expect(text).toContain('More < text')
  })

  it('returns empty text for a script-only page', () => {
    expect(htmlToText('<html><body><div id="root"></div><script>render()</script></body></html>').text).toBe('')
  })

  it('reads comments before scripts, so a commented-out script tag does not swallow the page', () => {
    const { text } = htmlToText('<body><!-- <script src="old.js"> --><p>Open daily</p><script>x()</script><p>Call us</p></body>')
    expect(text).toBe('Open daily\n\nCall us')
  })

  it('keeps table cells on one line and <pre> line breaks, and leaves unclosed ones readable', () => {
    const { text } = htmlToText('<table><tr><td><p>Cut</p></td><td>30</td></tr></table><pre>Mon 9-5\nTue 9-5</pre><td>Loose cell')
    expect(text).toContain('Cut | 30')
    expect(text).toContain('Mon 9-5\nTue 9-5')
    expect(text).toContain('Loose cell')
  })

  it('stays fast on malformed pages with thousands of unclosed tags', () => {
    const pages = [
      `<body><p>Real text</p>${'<nav>x '.repeat(100_000)}`,
      `<body><p>Real text</p>${'<div hidden>x '.repeat(100_000)}`,
      `<p>Real text</p>${'<script>x '.repeat(100_000)}`,
      `<p>Real text</p>${'<!-- x '.repeat(100_000)}`,
      `<p>Real text</p>${'<a '.repeat(300_000)}`,
      `${'<title>'.repeat(100_000)}<p>Real text</p>`,
    ]
    const started = Date.now()
    for (const page of pages) expect(htmlToText(page).text).toContain('Real text')
    // Quadratic scans took minutes on these; linear ones take well under a second.
    expect(Date.now() - started).toBeLessThan(5_000)
  })
})
