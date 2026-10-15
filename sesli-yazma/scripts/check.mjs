import {readdir, readFile, access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
async function files(dir) {const out = []; for (const entry of await readdir(dir, {withFileTypes: true})) {const name = path.join(dir, entry.name); if (entry.isDirectory()) out.push(...await files(name)); else out.push(name);} return out;}
const source = await files(path.join(root, 'extension'));
for (const file of source.filter(x => x.endsWith('.js'))) execFileSync(process.execPath, ['--check', file]);
const manifest = JSON.parse(await readFile(path.join(root, 'extension/manifest.json'), 'utf8'));
if (manifest.commands['toggle-dictation'].suggested_key.default !== 'Alt+H') throw new Error('Alt+H contract broken');
const required = [manifest.background.service_worker, manifest.options_page, manifest.action.default_popup, ...Object.values(manifest.icons), ...manifest.content_scripts.flatMap(x => x.js)];
for (const file of required) await access(path.join(root, 'extension', file));
if (manifest.host_permissions.join(',') !== 'https://api.groq.com/*,https://my.livechatinc.com/*,https://my.livechat.com/*') throw new Error('Unexpected host origin');
for (const file of source.filter(x => /\.(?:js|json|html|css)$/.test(x))) {
  const text = await readFile(file, 'utf8');
  if (/\b(?:gsk_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|sk-or-[A-Za-z0-9]{20,})\b/.test(text)) throw new Error(`Possible literal credential: ${file}`);
  if (/\beval\s*\(|new Function\s*\(/.test(text)) throw new Error(`Dynamic code execution: ${file}`);
}
console.log(`Syntax, manifest, host allowlist, resources and credential scan passed (${source.length} extension files).`);
