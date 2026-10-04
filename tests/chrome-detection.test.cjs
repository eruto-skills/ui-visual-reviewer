const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const file = path.join(__dirname, '..', 'scripts', 'extract-colors.cjs');
const source = fs.readFileSync(file, 'utf8');
const fn = source.match(/function findChrome\(\) \{[\s\S]*?\n\}/)[0];
function detect(platform, env, exists) {
  const context = { process: { platform, env }, fs: { existsSync: p => exists.includes(p.replaceAll('\\', '/')) }, require: name => { assert.equal(name, 'path'); return platform === 'win32' ? path.win32 : path.posix; } };
  return vm.runInNewContext(fn + '; findChrome()', context)?.replaceAll('\\', '/') ?? null;
}
test('explicit override is authoritative and invalid override fails', () => {
  assert.equal(detect('linux', { CHROME_PATH: '/custom/chrome' }, ['/custom/chrome']), '/custom/chrome');
  assert.equal(detect('linux', { CHROME_PATH: '/missing' }, ['/usr/bin/chromium']), null);
});
test('Windows user installation and alternate program files', () => {
  assert.equal(detect('win32', { LOCALAPPDATA: 'D:/User Data' }, ['D:/User Data/Google/Chrome/Application/chrome.exe']), 'D:/User Data/Google/Chrome/Application/chrome.exe');
  assert.equal(detect('win32', { ProgramFiles: 'D:/Programs' }, ['D:/Programs/Google/Chrome/Application/chrome.exe']), 'D:/Programs/Google/Chrome/Application/chrome.exe');
});
test('macOS global/user and Linux Chromium installations', () => {
  assert.equal(detect('darwin', {}, ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']), '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  assert.equal(detect('darwin', { HOME: '/Users/test' }, ['/Users/test/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']), '/Users/test/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  assert.equal(detect('linux', {}, ['/snap/bin/chromium']), '/snap/bin/chromium');
  assert.equal(detect('linux', {}, []), null);
});
