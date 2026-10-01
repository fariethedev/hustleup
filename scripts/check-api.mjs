import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only smoke check. Never creates users, orders, uploads, payments or messages.
// API_TOKEN may be supplied for authenticated GET checks; it is never printed.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.env.API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const token = process.env.API_TOKEN;
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.filter(entry => !['target', 'node_modules', '.git'].includes(entry.name)).map(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat();
}
const controllers = (await files(path.join(root, 'backend'))).filter(file => file.endsWith('Controller.java'));
const routes = [];
for (const file of controllers) {
  const source = (await readFile(file, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const prefix = source.match(/@RequestMapping\(\s*(?:value\s*=\s*)?"([^"]*)"/)?.[1] || '';
  for (const match of source.matchAll(/@(Get|Post|Put|Patch|Delete)Mapping(?:\(([^\n]*)\))?/g)) {
    const suffixes = [...(match[2] || '').matchAll(/"([^"]*)"/g)].map(value => value[1]).filter(value => value.startsWith('/'));
    for (const suffix of suffixes.length ? suffixes : ['']) routes.push({ method: match[1].toUpperCase(), route: prefix + suffix, source: path.relative(root, file) });
  }
}
console.log(`Inventory: ${routes.length} HTTP mappings in ${controllers.length} controllers.`);
if (process.argv.includes('--contracts')) {
  const normalize = value => value.replace(/\$\{[^}]+\}/g, '{}').replace(/\{[^}]+\}/g, '{}').replace(/\/$/, '');
  let missing = 0;
  let checked = 0;
  for (const client of ['frontend/src/api/client.js', 'mobile/src/api/client.js']) {
    const source = await readFile(path.join(root, client), 'utf8');
    for (const match of source.matchAll(/api\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g)) {
      if (!match[3].startsWith('/')) continue;
      checked++;
      const method = match[1].toUpperCase();
      const requested = normalize('/api/v1' + match[3].split('?')[0]);
      if (!routes.some(route => route.method === method && normalize(route.route) === requested)) {
        missing++;
        console.log(`REVIEW ${client}: ${method} ${match[3]}`);
      }
    }
  }
  console.log(`${checked} literal client calls compared with controller mappings; ${missing} need manual review (dynamic/array mappings may need inspection).`);
  process.exitCode = missing ? 1 : 0;
  process.exit();
}
if (process.argv.includes('--inventory')) {
  for (const route of routes.sort((a, b) => a.route.localeCompare(b.route))) console.log(`${route.method.padEnd(6)} ${route.route}  (${route.source})`);
  process.exit(0);
}
const checks = ['/listings', '/listings/recommended', '/shops', '/feed', '/communities', '/users', '/leaderboard'];
const privateChecks = ['/listings/my', '/feed/following', '/feed/communities', '/feed/saved/me', '/communities/mine', '/bookings/my', '/shops/me', '/shops/orders/mine', '/shops/orders/received', '/shops/appointments/mine', '/payouts/status', '/subscriptions/my', '/subscriptions/plans', '/notifications', '/notifications/unread-count', '/direct-messages/partners', '/follows/followers', '/follows/following'];
let failures = 0;
for (const endpoint of [...checks, ...privateChecks]) {
  // Stay comfortably below the gateway's per-IP request limit.
  await new Promise(resolve => setTimeout(resolve, 250));
  const authenticated = privateChecks.includes(endpoint);
  const expected = authenticated && !token ? [401, 403] : [200];
  try {
    const response = await fetch(`${base}/api/v1${endpoint}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, redirect: 'manual', signal: AbortSignal.timeout(8000) });
    const ok = expected.includes(response.status);
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'} GET ${endpoint} → ${response.status}${authenticated && !token ? ' (authentication guard)' : ''}`);
  } catch (error) { failures++; console.log(`UNREACHABLE GET ${endpoint}: ${error.cause?.code || error.name}`); }
}
console.log(token ? 'Authenticated GET checks used API_TOKEN. No mutations performed.' : 'Authenticated success flows require API_TOKEN. Without it, private routes are checked for correct rejection, not claimed as 200 OK.');
console.log(`${failures} checks need attention. Creation may correctly return 201 and deletion 204; not every endpoint should return 200.`);
process.exitCode = failures ? 1 : 0;
