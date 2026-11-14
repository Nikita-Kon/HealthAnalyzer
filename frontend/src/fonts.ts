// Latin-only variable fonts, bundled (no Google Fonts). Loaded via FontFace so only the needed subsets ship.
import geologica from '@fontsource-variable/geologica/files/geologica-latin-wght-normal.woff2?url'
import onest from '@fontsource-variable/onest/files/onest-latin-wght-normal.woff2?url'
import mono from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url'

const faces: [string, string][] = [
  ['Geologica Variable', geologica],
  ['Onest Variable', onest],
  ['JetBrains Mono Variable', mono],
]
for (const [family, url] of faces) {
  const f = new FontFace(family, `url(${url}) format('woff2')`, { weight: '100 900', display: 'swap' })
  document.fonts.add(f)
  f.load().catch(() => {})
}
