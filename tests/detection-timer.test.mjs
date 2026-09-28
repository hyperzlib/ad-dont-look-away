import test from 'node:test'
import assert from 'node:assert/strict'
import { DetectionTimer } from '../src/attention/DetectionTimer.ts'

test('全速采样按半秒内的闭眼帧数触发', () => {
  const timer = new DetectionTimer()
  for (let time = 0; time < 480; time += 80) {
    assert.equal(timer.observe(time, true, false), null)
  }
  assert.equal(timer.getFrameStatus().requiredClosedFrames, 7)
  assert.equal(timer.observe(480, true, false), 'eyes-closed')
})

test('低性能设备按实际帧间隔减少所需闭眼帧数', () => {
  const timer = new DetectionTimer()
  assert.equal(timer.observe(0, true, false), null)
  assert.equal(timer.observe(400, true, false), null)
  assert.deepEqual(timer.getFrameStatus(), { closedFrames: 2, requiredClosedFrames: 3, frameIntervalMs: 400 })
  assert.equal(timer.observe(800, true, false), 'eyes-closed')
})

test('低于每秒一帧时仍可完成闭眼判定', () => {
  const timer = new DetectionTimer()
  assert.equal(timer.observe(0, true, false), null)
  assert.equal(timer.observe(1200, true, false), null)
  assert.equal(timer.observe(2400, true, false), 'eyes-closed')
})

test('采样速度变化后自动更新半秒帧数基准', () => {
  const timer = new DetectionTimer()
  for (let time = 0; time <= 800; time += 80) timer.observe(time, false, false)
  assert.equal(timer.getFrameStatus().requiredClosedFrames, 7)
  for (let time = 1050; time <= 3300; time += 250) timer.observe(time, false, false)
  assert.deepEqual(timer.getFrameStatus(), { closedFrames: 0, requiredClosedFrames: 3, frameIntervalMs: 250 })
  assert.equal(timer.observe(3550, true, false), null)
  assert.equal(timer.observe(3800, true, false), null)
  assert.equal(timer.observe(4050, true, false), 'eyes-closed')
})

test('暂停和长时间中断会清空闭眼帧数', () => {
  const timer = new DetectionTimer()
  for (let time = 0; time <= 320; time += 80) timer.observe(time, true, false)
  timer.reset()
  assert.equal(timer.observe(640, true, false), null)
  assert.equal(timer.getFrameStatus().closedFrames, 1)
  assert.equal(timer.observe(6000, true, false), null)
  assert.equal(timer.getFrameStatus().closedFrames, 1)
})

test('睁眼立即清空闭眼帧数', () => {
  const timer = new DetectionTimer()
  for (let time = 0; time <= 320; time += 80) timer.observe(time, true, false)
  assert.equal(timer.observe(400, false, false), null)
  assert.equal(timer.getFrameStatus().closedFrames, 0)
  for (let time = 480; time < 960; time += 80) {
    assert.equal(timer.observe(time, true, false), null)
  }
  assert.equal(timer.observe(960, true, false), 'eyes-closed')
})

test('移开视线仍按原有时间阈值判定', () => {
  const timer = new DetectionTimer()
  for (let time = 0; time < 900; time += 100) {
    assert.equal(timer.observe(time, false, true), null)
  }
  assert.equal(timer.observe(900, false, true), 'look-away')
})
