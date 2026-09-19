import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isBounceGuardedRecipient } from './email'

test('blocks a listed domain', () => {
  assert.equal(isBounceGuardedRecipient('someone@syn-001.school'), true)
})

test('blocks a subdomain of a listed domain', () => {
  assert.equal(isBounceGuardedRecipient('a.hughes@students.omnisdemo.school'), true)
  assert.equal(isBounceGuardedRecipient('l.hughes@parents.omnisdemo.school'), true)
  assert.equal(isBounceGuardedRecipient('someone@students.oakfield.edu'), true)
})

test('blocks a listed exact address', () => {
  assert.equal(isBounceGuardedRecipient('test.beta.e2e@gmail.com'), true)
  assert.equal(isBounceGuardedRecipient('sarah.johnson.test2026@gmail.com'), true)
})

test('does not block a real domain such as me.com', () => {
  assert.equal(isBounceGuardedRecipient('ivanyardley@me.com'), false)
})

test('does not block a lookalike domain such as notomnisdemo.school', () => {
  assert.equal(isBounceGuardedRecipient('someone@notomnisdemo.school'), false)
})

test('normalises casing and whitespace before matching', () => {
  assert.equal(isBounceGuardedRecipient('  SOMEONE@SYN-001.SCHOOL  '), true)
  assert.equal(isBounceGuardedRecipient('  Test.Beta.E2E@Gmail.com  '), true)
  assert.equal(isBounceGuardedRecipient('SOMEONE@ME.COM'), false)
})
