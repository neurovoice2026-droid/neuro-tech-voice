// Minimal, strict XML parser for asserting on TwiML in tests. It accepts only
// what a well-formed document may contain (one root, balanced tags, quoted
// attributes, escaped & and <) and throws otherwise, so "parses" doubles as a
// well-formedness check. Entities are decoded so attribute/text assertions
// compare the values Twilio will actually see.

export interface XmlNode {
  name: string
  attrs: Record<string, string>
  children: XmlNode[]
  text: string
}

const ENTITY = /&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g
const BARE_AMP = /&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/

function decode(s: string): string {
  if (BARE_AMP.test(s)) throw new Error(`Unescaped & in ${JSON.stringify(s)}`)
  return s.replace(ENTITY, (_m, e: string) => {
    if (e === 'amp') return '&'
    if (e === 'lt') return '<'
    if (e === 'gt') return '>'
    if (e === 'quot') return '"'
    if (e === 'apos') return "'"
    return String.fromCodePoint(e.startsWith('#x') ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
  })
}

const TAG = /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[A-Za-z_][\w.:-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>/y
const ATTR = /([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/g

export function parseXml(xml: string): XmlNode {
  let src = xml
  const decl = /^<\?xml\s[^?]*\?>/.exec(src)
  if (decl) src = src.slice(decl[0].length)
  else if (src.startsWith('<?')) throw new Error('Malformed XML declaration')

  const root: XmlNode = { name: '#document', attrs: {}, children: [], text: '' }
  const stack: XmlNode[] = [root]
  let i = 0
  while (i < src.length) {
    const lt = src.indexOf('<', i)
    const textEnd = lt === -1 ? src.length : lt
    const text = src.slice(i, textEnd)
    if (text) {
      if (text.includes('>') && stack.length === 1) throw new Error('Stray > outside the root element')
      const top = stack[stack.length - 1]
      if (top === root) {
        if (text.trim()) throw new Error(`Text outside the root element: ${JSON.stringify(text)}`)
      } else {
        top.text += decode(text)
      }
    }
    if (lt === -1) break
    TAG.lastIndex = lt
    const m = TAG.exec(src)
    if (!m) throw new Error(`Malformed tag at offset ${lt}: ${JSON.stringify(src.slice(lt, lt + 40))}`)
    const [whole, closing, name, rawAttrs, selfClosing] = m
    if (closing) {
      if (rawAttrs.trim() || selfClosing) throw new Error(`Malformed closing tag </${name}>`)
      const open = stack.pop()
      if (!open || open === root || open.name !== name) throw new Error(`Unbalanced </${name}>`)
    } else {
      const attrs: Record<string, string> = {}
      for (const a of rawAttrs.matchAll(ATTR)) {
        if (a[1] in attrs) throw new Error(`Duplicate attribute ${a[1]}`)
        attrs[a[1]] = decode(a[2] ?? a[3] ?? '')
      }
      const node: XmlNode = { name, attrs, children: [], text: '' }
      const parent = stack[stack.length - 1]
      if (parent === root && root.children.length > 0) throw new Error('More than one root element')
      parent.children.push(node)
      if (!selfClosing) stack.push(node)
    }
    i = lt + whole.length
  }
  if (stack.length !== 1) throw new Error(`Unclosed <${stack[stack.length - 1].name}>`)
  if (root.children.length !== 1) throw new Error('Expected exactly one root element')
  return root.children[0]
}

/** Depth-first search for every element named `name`. */
export function findAll(node: XmlNode, name: string): XmlNode[] {
  const out: XmlNode[] = []
  const walk = (n: XmlNode) => {
    if (n.name === name) out.push(n)
    n.children.forEach(walk)
  }
  walk(node)
  return out
}

/** The single element named `name`; throws when absent or ambiguous. */
export function findOne(node: XmlNode, name: string): XmlNode {
  const all = findAll(node, name)
  if (all.length !== 1) throw new Error(`Expected exactly one <${name}>, found ${all.length}`)
  return all[0]
}
