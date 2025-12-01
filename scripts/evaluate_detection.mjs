#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const labelsPath = path.join(process.cwd(), 'data', 'mock', 'detection_labels.json')
const predictionsPath = path.join(process.cwd(), 'data', 'mock', 'detection_predictions.json')

const labels = JSON.parse(fs.readFileSync(labelsPath, 'utf-8'))
const predictions = JSON.parse(fs.readFileSync(predictionsPath, 'utf-8'))

let tp = 0
let fp = 0
let fn = 0

Object.entries(labels).forEach(([alertId, label]) => {
  const predicted = predictions[alertId]
  if (label.should_detect) {
    if (predicted === label.rule_type) {
      tp += 1
    } else {
      fn += 1
    }
  } else if (predicted === label.rule_type) {
    fp += 1
  }
})

const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
const recall = tp + fn === 0 ? 0 : tp / (tp + fn)
const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)

console.log('=== Detection Evaluation (Mock Data) ===')
console.table([
  {
    tp,
    fp,
    fn,
    precision: precision.toFixed(2),
    recall: recall.toFixed(2),
    f1: f1.toFixed(2),
  },
])
console.log(`Labels evaluated: ${Object.keys(labels).length}`)

if (process.argv.includes('--details')) {
  Object.entries(labels).forEach(([alertId, label]) => {
    const predicted = predictions[alertId]
    console.log(
      alertId.padEnd(20),
      'expected:',
      label.rule_type.padEnd(28),
      'detected:',
      (predicted ?? 'none').padEnd(28),
      label.should_detect ? '(必須)' : '(任意)'
    )
  })
}
