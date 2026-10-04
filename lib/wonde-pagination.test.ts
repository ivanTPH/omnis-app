import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextPageUrl } from './wonde-client'

const meta = (p: Record<string, unknown>) => ({ meta: { pagination: { total: 0, count: 0, per_page: 200, current_page: 1, ...p } }, data: [1] })

test('follows meta.pagination.next (Wonde format)', () => {
  assert.equal(nextPageUrl('/schools/A/students?per_page=200', meta({ next: 'https://api.wonde.com/v1.0/schools/A/students?page=2' })), 'https://api.wonde.com/v1.0/schools/A/students?page=2')
})
test('falls back to links.next', () => {
  assert.equal(nextPageUrl('/x', meta({ links: { next: 'https://n' } })), 'https://n')
})
test('builds the next page when only more:true is given', () => {
  assert.equal(nextPageUrl('/schools/A/students?per_page=200', meta({ more: true, current_page: 1 })), '/schools/A/students?per_page=200&page=2')
})
test('stops on the last page', () => {
  assert.equal(nextPageUrl('/x', meta({ next: null, more: false })), null)
})
