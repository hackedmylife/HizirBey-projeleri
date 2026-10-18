import {readdir, readFile, access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
async function files(dir) {const out = []; for (const entry of await readdir(dir, {withFileTypes: true})) {const name = path.join(dir, entry.name); if (entry.isDirectory()) out.push(...await files(name)); else out.push(name);} return out;}
const source = await files(path.join(root, 'extension'));
for (const file of source.filter(x => x.endsWith('.js'))) execFileSync(process.execPath, ['--check', file]);
const manifest = JSON.parse(await readFile(path.join(root, 'extension/manifest.json'), 'utf8'));
if (manifest.commands['toggle-dictation'].suggested_key.default !== 'Alt+H') throw new Error('Alt+H contract broken');
const required = [manifest.background.service_worker, manifest.options_page, manifest.action.default_popup, ...Object.values(manifest.icons), ...manifest.content_scripts.flatMap(x => x.js)];
for (const file of required) await access(path.join(root, 'extension', file));
const vad = await readFile(path.join(root, 'extension/vendor/fvad/libfvad.wasm'));
if (createHash('sha256').update(vad).digest('hex') !== '3fadafc9c5c1c3117d0178ae631484c6dabc72e0f8742b95c370cd39f46cf171') throw new Error('Bundled speech detector checksum changed');
for (const name of ['LICENSE.txt', 'PATENTS.txt', 'AUTHORS.txt', 'PROVENANCE.txt']) await access(path.join(root, 'extension/vendor/fvad', name));
if (manifest.host_permissions.join(',') !== 'https://api.groq.com/*,https://my.livechatinc.com/*,https://my.livechat.com/*') throw new Error('Unexpected host origin');
for (const file of source.filter(x => /\.(?:js|json|html|css)$/.test(x))) {
  const text = await readFile(file, 'utf8');
  if (/\b(?:gsk_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|sk-or-[A-Za-z0-9]{20,})\b/.test(text)) throw new Error(`Possible literal credential: ${file}`);
  if (/\beval\s*\(|new Function\s*\(/.test(text)) throw new Error(`Dynamic code execution: ${file}`);
}
console.log(`Syntax, manifest, host allowlist, resources and credential scan passed (${source.length} extension files).`);
