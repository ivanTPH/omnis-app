import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractJsonObject, isUsable, minQuestionsFor, validateHomework } from './schema'

const mcq = (over: Record<string, unknown> = {}) => ({
  q: 'Which gas do plants take in for photosynthesis?',
  options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'],
  correct: 1,
  explanation: 'Plants take in carbon dioxide.',
  ...over,
})

test('valid MCQs pass through unchanged', () => {
  const v = validateHomework({ instructions: 'Quiz', questionsJson: { questions: [mcq(), mcq({ q: 'Q2' })] } }, 'MCQ_QUIZ')
  assert.equal(v.questions.length, 2)
  assert.equal(v.droppedQuestions, 0)
  assert.deepEqual(v.questions[0], mcq())
})

test('MCQ correct answer given as a letter or numeric string is normalised to an index', () => {
  const v = validateHomework({ questionsJson: { questions: [mcq({ correct: 'B' }), mcq({ correct: '2' })] } }, 'MCQ_QUIZ')
  assert.deepEqual(v.questions.map(q => (q as { correct: number }).correct), [1, 2])
})

test('MCQ option labels like "A." are stripped', () => {
  const v = validateHomework({ questionsJson: { questions: [mcq({ options: ['A. Oxygen', 'B. Carbon dioxide', 'C) Nitrogen', 'D. Hydrogen'] })] } }, 'MCQ_QUIZ')
  assert.deepEqual((v.questions[0] as { options: string[] }).options, ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'])
})

test('malformed MCQs are dropped and counted, not passed to teachers', () => {
  const bad = [
    mcq({ options: ['a', 'b', 'c'] }),               // three options
    mcq({ correct: 4 }),                              // index out of range
    mcq({ options: ['Same', 'same', 'Other', 'X'] }), // duplicate options
    mcq({ q: '' }),                                   // no question
    'not an object',
  ]
  const v = validateHomework({ questionsJson: { questions: [mcq(), ...bad] } }, 'MCQ_QUIZ')
  assert.equal(v.questions.length, 1)
  assert.equal(v.droppedQuestions, bad.length)
})

test('questions returned at the root instead of under questionsJson are accepted', () => {
  const v = validateHomework({ questions: [mcq(), mcq({ q: 'Q2' })] }, 'MCQ_QUIZ')
  assert.equal(v.questions.length, 2)
})

test('short-answer aliases (question/answer) and vocab strings are normalised', () => {
  const v = validateHomework({
    questionsJson: { questions: [
      { question: 'Explain osmosis.', answer: 'Water moves…', marks: '4', vocab_support: ['osmosis: movement of water', { term: 'membrane', definition: 'a barrier' }, 42] },
    ] },
  }, 'SHORT_ANSWER')
  assert.equal(v.questions.length, 1)
  assert.deepEqual(v.questions[0], {
    q: 'Explain osmosis.', modelAnswer: 'Water moves…', marks: 4,
    vocab_support: [{ term: 'osmosis', definition: 'movement of water' }, { term: 'membrane', definition: 'a barrier' }],
  })
})

test('a short-answer question without a model answer is dropped', () => {
  const v = validateHomework({ questionsJson: { questions: [{ q: 'Explain osmosis.' }] } }, 'SHORT_ANSWER')
  assert.equal(v.questions.length, 0)
  assert.equal(v.droppedQuestions, 1)
})

test('envelope fields default safely when missing or the wrong type', () => {
  const v = validateHomework({ instructions: 5, gradingBands: 'x', targetWordCount: 'abc' }, 'EXTENDED_WRITING')
  assert.equal(v.instructions, '')
  assert.deepEqual(v.gradingBands, {})
  assert.equal(v.targetWordCount, undefined)
})

test('isUsable uses the per-type minimum, which stays below what the prompt asks for', () => {
  // buildTypePrompt asks for 10 MCQs and exactly 4 short-answer questions.
  assert.ok(minQuestionsFor('MCQ_QUIZ') < 10)
  assert.ok(minQuestionsFor('SHORT_ANSWER') <= 4)
  const four = validateHomework({ questionsJson: { questions: Array.from({ length: 4 }, (_, i) => ({ q: `Q${i}`, modelAnswer: 'A' })) } }, 'SHORT_ANSWER')
  assert.equal(isUsable(four, 'SHORT_ANSWER'), true)
  assert.equal(isUsable(validateHomework({ instructions: 'Write an essay' }, 'EXTENDED_WRITING'), 'EXTENDED_WRITING'), true)
  assert.equal(isUsable(validateHomework({ instructions: '  ' }, 'EXTENDED_WRITING'), 'EXTENDED_WRITING'), false)
})

test('extractJsonObject recovers JSON from fences, prose and raw newlines in strings', () => {
  assert.deepEqual(extractJsonObject('```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(extractJsonObject('Here you go: {"a":1} hope that helps'), { a: 1 })
  assert.deepEqual(extractJsonObject('{"a":"line1\nline2"}'), { a: 'line1\nline2' })
  assert.throws(() => extractJsonObject('no json here'))
})
