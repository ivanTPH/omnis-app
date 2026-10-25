import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDataUrl, photoProxyUrl } from './user-photo-url'

test('parses a base64 data URL', () => {
  const r = parseDataUrl('data:image/png;base64,' + Buffer.from('hi').toString('base64'))
  assert.equal(r?.contentType, 'image/png')
  assert.equal(r?.bytes.toString(), 'hi')
})
test('rejects non-base64 and non-data URLs', () => {
  assert.equal(parseDataUrl('data:text/plain,hello'), null)
  assert.equal(parseDataUrl('https://example.com/a.png'), null)
})
test('proxy url', () => assert.equal(photoProxyUrl('u1'), '/api/student-photo/u1'))
