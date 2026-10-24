// Rend les propositions de logos (propositions/*.svg) en PNG et en une planche : propositions/planche.png
//   NODE_PATH=$(npm root -g) node design/logo/propositions.cjs
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const DIR = path.join(__dirname, 'propositions')
const liste = JSON.parse(fs.readFileSync(path.join(DIR, 'liste.json'), 'utf8'))

;(async () => {
  const navigateur = await chromium.launch()
  const page = await navigateur.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  const cases = liste
    .map(([fichier, nom], i) => {
      const svg = fs.readFileSync(path.join(DIR, fichier), 'utf8').replace('<svg ', '<svg width="230" height="230" ')
      return `<figure>${svg}<figcaption><b>${i + 1}</b> ${nom}</figcaption></figure>`
    })
    .join('')
  await page.setContent(`<style>
    body{margin:0;padding:24px;background:#faf7ef;font:600 20px system-ui,sans-serif;color:#2e3644}
    .grille{display:grid;grid-template-columns:repeat(6,230px);gap:28px 30px;justify-content:center}
    figure{margin:0;text-align:center}svg{display:block;filter:drop-shadow(0 3px 6px rgba(0,0,0,.18))}
    figcaption{margin-top:10px}b{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#2e3644;color:#fff;margin-right:6px}
  </style><div class="grille">${cases}</div>`)
  await page.screenshot({ path: path.join(DIR, 'planche.png'), fullPage: true })
  console.log('planche.png')
  // Un PNG par proposition (512 px), pour les voir en grand.
  const p2 = await navigateur.newPage({ viewport: { width: 512, height: 512 } })
  for (const [fichier] of liste) {
    const svg = fs.readFileSync(path.join(DIR, fichier), 'utf8').replace('<svg ', '<svg width="512" height="512" ')
    await p2.setContent(`<style>html,body{margin:0}svg{display:block}</style>${svg}`)
    await p2.screenshot({ path: path.join(DIR, fichier.replace('.svg', '.png')) })
  }
  await navigateur.close()
})()
