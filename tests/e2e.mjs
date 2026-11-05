// E2E-перевірка всіх вимог лабораторної на справжньому Electron (через Playwright).
// Запуск: npm run test:e2e   (на Linux без дисплея: xvfb-run -a npm run test:e2e)
//
// Нативний діалог відкриття файлу підміняється в main-процесі, щоб тест міг "обрати" файл.
// URL та HLS віддає локальний HTTP-сервер з підтримкою Range — інтернет не потрібен.

import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'
import { FIXTURES, startFixturesServer } from './fixtures-server.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHOTS = join(ROOT, 'tests/screenshots')
mkdirSync(SHOTS, { recursive: true })

const { server, baseUrl: BASE, rangeRequests } = await startFixturesServer()

// ---------- запуск застосунку ----------
const args = [ROOT]
if (process.platform === 'linux' && process.getuid?.() === 0) args.unshift('--no-sandbox')
const app = await electron.launch({ args })
const page = await app.firstWindow()
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1120, 740))

const consoleErrors = []
page.on('console', (msg) => msg.type() === 'error' && consoleErrors.push(msg.text()))
page.on('pageerror', (err) => consoleErrors.push(err.message))

let passed = 0
async function step(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (error) {
    console.log(`  ✗ ${name}`)
    await page.screenshot({ path: join(SHOTS, 'failure.png') }).catch(() => {})
    await app.close().catch(() => {})
    server.close()
    throw error
  }
}

// ---------- хелпери ----------
const media = () =>
  page.evaluate(() => {
    const v = document.querySelector('[data-testid="media"]')
    return {
      paused: v.paused,
      ended: v.ended,
      currentTime: v.currentTime,
      duration: v.duration,
      videoWidth: v.videoWidth,
      volume: v.volume,
      muted: v.muted,
      src: v.currentSrc,
      error: v.error?.code ?? null
    }
  })

const waitPlaying = (minTime = 0.3) =>
  page.waitForFunction(
    (t) => {
      const v = document.querySelector('[data-testid="media"]')
      return v && !v.paused && v.currentTime > t
    },
    minTime,
    { timeout: 15000 }
  )

const status = () => page.getByTestId('status').textContent()

async function screenshotDark(file) {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(350) // дочекатися CSS-transition кнопок
  await page.screenshot({ path: join(SHOTS, file) })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.waitForTimeout(350)
}

async function openFile(name) {
  const filePath = join(FIXTURES, name)
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
  }, filePath)
  await page.locator('header').getByRole('button', { name: 'Відкрити файл' }).click()
}

async function openUrl(url) {
  const input = page.getByLabel('Посилання на аудіо чи відео')
  await input.fill(url)
  await input.press('Enter')
}

async function clickSlider(name, fraction) {
  const box = await page.getByRole('slider', { name }).boundingBox()
  await page.mouse.click(box.x + box.width * fraction, box.y + box.height / 2)
}

const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: очікувалось ≈${expected}, отримано ${actual}`)

// ---------- сценарії ----------
console.log('\nЗапуск застосунку')

await step('порожній стан: кнопки відтворення неактивні', async () => {
  await page.getByText('Відкрийте аудіо чи відео').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Відтворити' }).last().isDisabled(), true)
  assert.equal(await status(), 'Нічого не відкрито')
  await page.screenshot({ path: join(SHOTS, '01-empty-light.png') })
  await screenshotDark('01-empty-dark.png')
})

console.log('\nЛокальні файли (через діалог і протокол media://)')
const LOCAL = [
  ['sample.mp3', 'audio'],
  ['sample.wav', 'audio'],
  ['sample.ogg', 'audio'],
  ['sample.flac', 'audio'],
  ['sample.m4a', 'audio'],
  ['sample.mp4', 'video'],
  ['sample.webm', 'video'],
  ['sample.mkv', 'video'],
  ['sample.mov', 'video']
]
for (const [file, kind] of LOCAL) {
  await step(`${file}: відтворюється, тривалість 00:10, тип ${kind}`, async () => {
    await openFile(file)
    await waitPlaying()
    const m = await media()
    assert.ok(m.src.startsWith('media://file/'), `src = ${m.src}`)
    near(m.duration, 10, 0.3, 'duration')
    assert.equal(m.videoWidth > 0, kind === 'video', `videoWidth = ${m.videoWidth}`)
    assert.equal(await page.getByTestId('duration').textContent(), '/ 00:10')
  })
}

await step('аудіо: показується картка з назвою файлу', async () => {
  await openFile('sample.mp3')
  await waitPlaying(1)
  await page.getByText('Аудіофайл', { exact: false }).waitFor()
  await page.screenshot({ path: join(SHOTS, '03-audio.png') })
})

console.log('\nКерування відтворенням (sample.mp4)')
await openFile('sample.mp4')
await waitPlaying()

await step('протокол media:// відповідає 206 на Range-запит', async () => {
  const { src } = await media()
  const res = await app.evaluate(async ({ net }, url) => {
    const r = await net.fetch(url, { headers: { Range: 'bytes=100-199' } })
    return { status: r.status, range: r.headers.get('content-range'), length: (await r.arrayBuffer()).byteLength }
  }, src)
  assert.equal(res.status, 206)
  assert.equal(res.length, 100)
  assert.match(res.range, /^bytes 100-199\/\d+$/)
})

await step('progress bar: клік на 70% → позиція ≈ 7 с', async () => {
  await clickSlider('Позиція відтворення', 0.7)
  await page.waitForTimeout(300)
  near((await media()).currentTime, 7, 0.6, 'currentTime')
})

await step('відображення поточного часу', async () => {
  const text = await page.getByTestId('current-time').textContent()
  assert.match(text, /^00:0[6-9]$/)
  await page.screenshot({ path: join(SHOTS, '02-video.png') })
  await screenshotDark('02-video-dark.png')
})

await step('Пробіл: пауза і продовження', async () => {
  await page.keyboard.press('Space')
  await page.waitForTimeout(150)
  assert.equal((await media()).paused, true)
  assert.equal(await status(), 'Пауза')
  await page.keyboard.press('Space')
  await page.waitForTimeout(150)
  assert.equal((await media()).paused, false)
})

await step('кнопка "Назад на 10 с" (від ~7 с → 0)', async () => {
  await page.getByRole('button', { name: 'Назад на 10 с' }).click()
  await page.waitForTimeout(150)
  near((await media()).currentTime, 0, 0.5, 'currentTime')
})

await step('кнопка "Вперед на 10 с" та стрілка ← (−5 с)', async () => {
  await page.keyboard.press('Space') // пауза, щоб час не "біг" між перевірками
  await clickSlider('Позиція відтворення', 0.1)
  await page.getByRole('button', { name: 'Вперед на 10 с' }).click()
  await page.waitForTimeout(150)
  near((await media()).currentTime, 10, 0.3, 'після +10 с (обмежено тривалістю)')
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(150)
  near((await media()).currentTime, 5, 0.3, 'після ←')
})

await step('Stop: зупинка і повернення на початок', async () => {
  await page.getByRole('button', { name: 'Відтворити' }).last().click()
  await waitPlaying(5.2)
  await page.getByRole('button', { name: 'Стоп' }).click()
  await page.waitForTimeout(150)
  const m = await media()
  assert.equal(m.paused, true)
  near(m.currentTime, 0, 0.05, 'currentTime')
  assert.equal(await status(), 'Зупинено')
  assert.equal(await page.getByTestId('current-time').textContent(), '00:00')
})

await step('гучність: слайдер, стрілки ↑/↓, вимкнення звуку', async () => {
  await clickSlider('Гучність', 0.5)
  near((await media()).volume, 0.5, 0.06, 'volume після кліку')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  near((await media()).volume, 0.4, 0.06, 'volume після ↓↓')
  await page.getByRole('button', { name: 'Вимкнути звук' }).click()
  assert.equal((await media()).muted, true)
  await page.keyboard.press('KeyM')
  assert.equal((await media()).muted, false)
})

await step('гучність зберігається між запусками (localStorage)', async () => {
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('player.audio')))
  near(stored.volume, 0.4, 0.06, 'збережена гучність')
})

console.log('\nВідтворення за URL')
await step('WebM за http-посиланням', async () => {
  await openUrl(`${BASE}/sample.webm`)
  await waitPlaying()
  const m = await media()
  assert.ok(m.src.startsWith(BASE))
  assert.ok(m.videoWidth > 0)
})

await step('перемотування URL-джерела використовує Range-запити', async () => {
  rangeRequests.length = 0
  await openUrl(`${BASE}/sample.mp4`)
  await waitPlaying()
  await clickSlider('Позиція відтворення', 0.8)
  await page.waitForTimeout(400)
  near((await media()).currentTime, 8, 0.7, 'currentTime')
  assert.ok(rangeRequests.length > 0, 'сервер не отримав жодного Range-запиту')
})

await step('MP3 за посиланням → аудіо-картка', async () => {
  await openUrl(`${BASE}/sample.mp3`)
  await waitPlaying()
  assert.equal((await media()).videoWidth, 0)
  await page.getByText('Аудіо за посиланням').waitFor()
})

await step('HLS (.m3u8) через hls.js: MSE, тривалість, перемотування', async () => {
  await openUrl(`${BASE}/hls/index.m3u8`)
  await waitPlaying()
  const m = await media()
  assert.ok(m.src.startsWith('blob:'), `очікувався MediaSource blob:, отримано ${m.src}`)
  near(m.duration, 10, 0.5, 'duration')
  assert.ok((await page.getByText('HLS', { exact: true }).count()) > 0)
  await clickSlider('Позиція відтворення', 0.6)
  await page.waitForTimeout(500)
  near((await media()).currentTime, 6, 1, 'currentTime')
})

console.log('\nПомилки та валідація')
await step('неіснуюче посилання → повідомлення про помилку', async () => {
  await openUrl(`${BASE}/missing.mp4`)
  await page.getByTestId('error-message').waitFor({ timeout: 10000 })
  assert.equal(await status(), 'Помилка')
  await page.screenshot({ path: join(SHOTS, '04-error.png') })
})

await step('пошкоджений локальний файл → повідомлення про помилку', async () => {
  await openFile('broken.mp4')
  await page.getByTestId('error-message').waitFor({ timeout: 10000 })
})

await step('неприпустима схема URL', async () => {
  await openUrl('ftp://example.com/video.mp4')
  assert.match(await page.getByTestId('notice').textContent(), /http/)
})

await step('DASH (.mpd) — зрозуміле повідомлення', async () => {
  await openUrl('https://example.com/stream.mpd')
  assert.match(await page.getByTestId('notice').textContent(), /DASH/)
})

console.log('\nДодатково')
await step('drag & drop файлу у вікно (blob: URL)', async () => {
  await page.evaluate(async (url) => {
    const bytes = await (await fetch(url)).arrayBuffer()
    const dt = new DataTransfer()
    dt.items.add(new File([bytes], 'dropped.mp3', { type: 'audio/mpeg' }))
    window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true }))
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
  }, `${BASE}/sample.mp3`)
  await waitPlaying()
  const m = await media()
  assert.ok(m.src.startsWith('blob:'), m.src)
  assert.equal(await page.title(), 'dropped.mp3 — Медіапрогравач')
})

await step('меню "Відкрити посилання" (Ctrl+L) фокусує поле URL', async () => {
  await app.evaluate(({ Menu }) => {
    const file = Menu.getApplicationMenu().items.find((i) => i.label === 'Файл')
    file.submenu.items.find((i) => i.label.startsWith('Відкрити посилання')).click()
  })
  await page.waitForTimeout(150)
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'media-url')
})

await step('у консолі renderer немає помилок (CSP, React)', async () => {
  // Очікувані помилки — від навмисно битих джерел у тестах вище.
  const unexpected = consoleErrors.filter((t) => !/missing\.mp4|404|Failed to load resource/i.test(t))
  assert.deepEqual(unexpected, [])
})

await app.close()
server.close()
console.log(`\nУсі перевірки пройдено: ${passed}\nСкриншоти: ${SHOTS}\n`)
