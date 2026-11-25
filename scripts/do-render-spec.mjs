#!/usr/bin/env node
// Renders .do/app.yaml + .do/secrets.env into .do/app.rendered.yaml for `doctl apps`.
//
// - {{NAME}} placeholders are replaced with values from .do/secrets.env.
// - An env entry whose whole value is a placeholder that is blank is dropped, so the
//   service keeps its application.yml default (an empty env var would override it).
// - Required keys must be non-blank, or nothing is written.
// - ${...} DigitalOcean bindable variables are left untouched.
// Values are never printed.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const templatePath = join(root, '.do', 'app.yaml');
const secretsPath = join(root, '.do', 'secrets.env');
const outPath = join(root, '.do', 'app.rendered.yaml');

const REQUIRED = [
  'JWT_SECRET', 'AWS_REGION', 'AWS_S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_CONNECT_WEBHOOK_SECRET', 'EMAIL_FROM',
];

if (!existsSync(secretsPath)) {
  console.error('Missing .do/secrets.env — copy .do/secrets.env.example and fill it in.');
  process.exit(1);
}

const secrets = {};
for (const raw of readFileSync(secretsPath, 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq < 0) continue;
  let value = line.slice(eq + 1).trim();
  if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
  secrets[line.slice(0, eq).trim()] = value;
}

const missing = REQUIRED.filter((k) => !secrets[k]);
if (missing.length) {
  console.error(`Required values are blank in .do/secrets.env: ${missing.join(', ')}`);
  process.exit(1);
}

// Values sit inside double-quoted YAML scalars.
const yamlEscape = (v) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const wholeValuePlaceholder = /^\s*- \{ key: [A-Z0-9_]+,.*value: "\{\{([A-Z0-9_]+)\}\}" \}\s*$/;

const dropped = [];
const unknown = new Set();
const out = readFileSync(templatePath, 'utf8')
  .split(/\r?\n/)
  .filter((line) => {
    const m = line.match(wholeValuePlaceholder);
    if (m && !secrets[m[1]]) { dropped.push(m[1]); return false; }
    return true;
  })
  .map((line) => line.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    if (!(key in secrets)) unknown.add(key);
    return yamlEscape(secrets[key] ?? '');
  }))
  .join('\n');

writeFileSync(outPath, out);
console.log(`Wrote ${outPath}`);
if (dropped.length) console.log(`Left unset (using app defaults): ${[...new Set(dropped)].join(', ')}`);
if (unknown.size) console.log(`Not in secrets.env, rendered blank: ${[...unknown].join(', ')}`);
