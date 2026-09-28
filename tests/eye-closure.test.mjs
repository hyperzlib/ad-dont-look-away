import test from 'node:test'
import assert from 'node:assert/strict'
import { EyeClosure } from '../src/attention/EyeClosure.ts'

test('睁眼分数不会触发闭眼，持续闭眼与睁眼可正确切换', () => {
  const eyes = new EyeClosure()
  assert.equal(eyes.update(true, 0.29, 0.415), false)
  assert.equal(eyes.update(true, 0.47, 0.52), true)
  assert.equal(eyes.update(true, 0.35, 0.38), true)
  assert.equal(eyes.update(true, 0.12, 0.2), false)
})

test('失去人脸后重置闭眼状态', () => {
  const eyes = new EyeClosure()
  assert.equal(eyes.update(true, 0.5, 0.5), true)
  assert.equal(eyes.update(false, 0, 0), false)
  assert.equal(eyes.update(true, 0.3, 0.35), false)
})
