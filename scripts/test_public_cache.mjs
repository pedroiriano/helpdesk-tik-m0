// Execute the published worker/client against a stale-cache fixture, without user browser data.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const dist = new URL('../frontend/dist/', import.meta.url);
const listeners = new Map();
const stores = new Map();
const calls = [];
let offline = false;
let claimed = false;
const cache = name => {
  if (!stores.has(name)) stores.set(name, new Map());
  const entries = stores.get(name);
  return {
    addAll: async () => {},
    put: async (request, response) => entries.set(typeof request === 'string' ? request : request.url, response.clone()),
    match: async request => entries.get(typeof request === 'string' ? request : request.url)?.clone(),
  };
};
for (const name of ['helpdesk-modern-v4.3-r2-m003', 'courtspec-native-v4.3', 'piui-admin-retained', 'unrelated-retained']) cache(name);
const worker = vm.createContext({
  URL, Response,
  self: {
    location: { origin: 'http://127.0.0.1:18090' },
    registration: { scope: 'http://127.0.0.1:18090/' },
    clients: { claim: async () => { claimed = true; } },
    skipWaiting() {},
    addEventListener: (name, handler) => listeners.set(name, handler),
  },
  caches: {
    open: async name => cache(name), keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
  },
  fetch: async (request, options) => {
    calls.push({ url: request.url, options });
    if (offline) throw new Error('offline fixture');
    return new Response('current-artwork');
  },
});
vm.runInContext(await readFile(new URL('sw.js', dist), 'utf8'), worker);
let pending;
listeners.get('activate')({ waitUntil: promise => { pending = promise; } });
await pending;
assert.equal(claimed, true);
assert.deepEqual([...stores.keys()].sort(), ['piui-admin-retained', 'unrelated-retained']);

function dispatch(path, options = {}) {
  const url = new URL(path, 'http://127.0.0.1:18090');
  const request = new Request(url, { method: options.method || 'GET' });
  Object.defineProperty(request, 'destination', { value: options.destination || 'image' });
  let response;
  listeners.get('fetch')({ request, respondWith: value => { response = value; } });
  return response;
}
const image = 'http://127.0.0.1:18090/assets/helpdesk/05_Brand/logo-favicon.png';
await cache('helpdesk-modern-network-v1').put(image, new Response('stale-artwork'));
assert.equal(await (await dispatch(image)).text(), 'current-artwork');
assert.equal(calls.at(-1).options.cache, 'no-store');
offline = true;
assert.equal(await (await dispatch(image)).text(), 'current-artwork');
for (const path of ['/api/v1/auth/me', '/api/v1/tickets/private/attachments/file/download', '/admin/app/tickets/detail.html', '/admin/assets/private.png', '/lapor.html', '/tiket.html', '/lacak.html', '/detail-tiket.html?id=hidden', '/layanan.html', '/detail-layanan.html?id=hidden', '/assets/picture.png?token=secret', 'https://example.invalid/image.png']) {
  assert.equal(dispatch(path), undefined, path);
}
assert.equal(dispatch('/assets/image.png', { method: 'POST' }), undefined);

const main = await readFile(new URL('js/main.js', dist), 'utf8');
async function clientScenario(controlled, editing = false) {
  const events = new Map();
  let registrationOptions, updates = 0, reloads = 0;
  const context = vm.createContext({
    URL, console,
    window: { isSecureContext: true, location: { href: 'http://127.0.0.1:18090/', reload: () => reloads++ }, addEventListener: (name, handler) => events.set('window:' + name, handler) },
    document: { readyState: 'loading', querySelector: () => null, addEventListener: (name, handler) => events.set('document:' + name, handler) },
    navigator: { serviceWorker: { controller: controlled ? {} : null, addEventListener: (name, handler) => events.set(name, handler), register: async (_url, options) => { registrationOptions = options; return { update: async () => updates++ }; } } },
  });
  vm.runInContext(main + '\ninitServiceWorker();', context);
  events.get('window:load')();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(registrationOptions.updateViaCache, 'none');
  assert.equal(updates, 1);
  if (editing) events.get('document:input')({ target: { closest: () => ({}) } });
  events.get('controllerchange')();
  events.get('controllerchange')();
  assert.equal(reloads, controlled && !editing ? 1 : 0);
}
await clientScenario(true);
await clientScenario(false);
await clientScenario(true, true);
console.log('PASS public stale-image refresh, offline fallback, scoped cleanup, private-route bypass and one-time client update');
