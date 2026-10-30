import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

// Exercise the real JS bridge wrapper without writing test data to Apple Health.
const source = (await readFile(new URL('../src/apple-health.ts', import.meta.url), 'utf8'))
  .replace('import { Capacitor, registerPlugin } from "@capacitor/core";', `
    export const testState = { native: true, saved: true, calls: [], error: null };
    const Capacitor = { isNativePlatform: () => testState.native, getPlatform: () => "ios" };
    const registerPlugin = () => ({ addWater: async options => {
      testState.calls.push(options);
      if (testState.error) throw testState.error;
      return { saved: testState.saved };
    } });`);
const { addAppleHealthWater, testState } = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
for (const value of [0, -1, NaN, Infinity, 5001]) {
  await assert.rejects(addAppleHealthWater(value));
}
assert.equal(testState.calls.length, 0);
testState.native = false;
await assert.rejects(addAppleHealthWater(250), /iPhone/);
assert.equal(testState.calls.length, 0);
testState.native = true;
await addAppleHealthWater(250);
assert.deepEqual(testState.calls, [{ milliliters: 250 }]);
testState.saved = false;
await assert.rejects(addAppleHealthWater(250), /未保存/);
testState.error = new Error('WRITE_DENIED');
await assert.rejects(addAppleHealthWater(250), /WRITE_DENIED/);
console.log('Water bridge: validation, platform, save and denial checks passed');
