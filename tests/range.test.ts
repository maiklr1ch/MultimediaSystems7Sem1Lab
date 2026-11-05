// Unit-тести розбору HTTP Range. Запуск: npm run test:unit (Node.js ≥ 22.18 виконує .ts напряму).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseRange } from '../src/main/range.ts'

const SIZE = 1000

test('без заголовка — весь файл', () => {
  assert.equal(parseRange(null, SIZE), null)
  assert.equal(parseRange('', SIZE), null)
})

test('відкритий діапазон bytes=N- (так перемотує Chromium)', () => {
  assert.deepEqual(parseRange('bytes=0-', SIZE), { start: 0, end: 999 })
  assert.deepEqual(parseRange('bytes=500-', SIZE), { start: 500, end: 999 })
})

test('закритий діапазон', () => {
  assert.deepEqual(parseRange('bytes=100-199', SIZE), { start: 100, end: 199 })
})

test('кінець за межами файлу обрізається', () => {
  assert.deepEqual(parseRange('bytes=900-5000', SIZE), { start: 900, end: 999 })
})

test('суфіксна форма bytes=-N', () => {
  assert.deepEqual(parseRange('bytes=-100', SIZE), { start: 900, end: 999 })
  assert.deepEqual(parseRange('bytes=-5000', SIZE), { start: 0, end: 999 })
})

test('незадовольнимі діапазони → 416', () => {
  assert.equal(parseRange('bytes=1000-', SIZE), 'unsatisfiable')
  assert.equal(parseRange('bytes=500-100', SIZE), 'unsatisfiable')
  assert.equal(parseRange('bytes=-0', SIZE), 'unsatisfiable')
  assert.equal(parseRange('bytes=0-', 0), 'unsatisfiable')
})

test('нерозпізнаний заголовок ігнорується (віддаємо весь файл)', () => {
  assert.equal(parseRange('items=0-10', SIZE), null)
  assert.equal(parseRange('bytes=0-10,20-30', SIZE), null)
  assert.equal(parseRange('bytes=-', SIZE), null)
})
