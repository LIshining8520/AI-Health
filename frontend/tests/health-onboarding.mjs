import assert from 'node:assert/strict';
import { hasReadableHealthData } from '../src/apple-health.ts';
const empty = { steps:null, sleepHours:null, weightKg:null, heartRate:null, hrv:null, waterMl:null, noise:null, fitness:null, workouts:[], weightHistory:[], hrvHistory:[] };
assert.equal(hasReadableHealthData(empty), false);
assert.equal(hasReadableHealthData({...empty, steps:0}), true);
assert.equal(hasReadableHealthData({...empty, waterMl:0}), true);
assert.equal(hasReadableHealthData({...empty, weightHistory:[{date:'2026-10-29',value:60}]}), true);
assert.equal(hasReadableHealthData({...empty, hrvHistory:[{at:'2026-10-30T08:00:00+08:00',value:45}]}), true);
console.log('Health onboarding data checks passed');
