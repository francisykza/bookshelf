// 1.136.1 (SPEC §136.7): la dirección de antes redirige a libotown.es. La regla de `vercel.json` y lo que hace el service
// worker en cada dirección (cargado en un entorno simulado: aquí no hay navegador ni Vercel).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { DIRECCION, HOST_ANTIGUO } from '../direcciones';

const raiz = process.cwd();
const vercel = JSON.parse(readFileSync(join(raiz, 'vercel.json'), 'utf8'));
const sw = readFileSync(join(raiz, 'public/sw.js'), 'utf8');

describe('la redirección de la dirección de antes (vercel.json)', () => {
  const [regla, ...otras] = vercel.redirects ?? [];

  it('una sola regla, permanente, solo para la dirección de antes y hacia libotown.es', () => {
    expect(otras).toEqual([]);
    expect(regla.has).toEqual([{ type: 'host', value: HOST_ANTIGUO }]);
    expect(regla.destination).toBe(`${DIRECCION}$1`);
    expect(regla.permanent).toBe(true);
  });

  it('se lleva todas las rutas menos el service worker, que tiene que poder actualizarse', () => {
    const fuente = new RegExp(`^${regla.source}$`);
    for (const ruta of ['/', '/index.html', '/manifest.webmanifest', '/assets/index-abc.js', '/icons/libotown-192.png', '/api/portada', '/club/abc']) expect(fuente.test(ruta), ruta).toBe(true);
    expect(fuente.exec('/assets/x.js')[1]).toBe('assets/x.js');
    expect(fuente.test('/sw.js')).toBe(false);
  });

  it('las cabeceras de siempre siguen ahí (el service worker, sin caché)', () => {
    expect(vercel.headers.find((h) => h.source === '/sw.js')?.headers).toEqual([{ key: 'Cache-Control', value: 'no-cache' }]);
  });
});

/** Carga sw.js como si estuviera en `host`, con cachés, pestañas y registro falsos. */
function cargarSw(host) {
  const oyentes = {};
  const ventana = { url: `https://${host}/?inicio=habitacion`, navigate: vi.fn(async () => null) };
  const borradas = [];
  const self = {
    location: new URL(`https://${host}/sw.js`),
    addEventListener: (tipo, f) => (oyentes[tipo] = f),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => {}), matchAll: vi.fn(async () => [ventana]) },
    registration: { unregister: vi.fn(async () => true) },
  };
  const caches = {
    keys: async () => ['bookshelf-v1.136.0', 'bookshelf-portadas-v1', 'de-otra-app'],
    delete: async (k) => borradas.push(k),
    open: async () => ({ addAll: async () => {}, put: async () => {}, match: async () => undefined }),
    match: async () => undefined,
  };
  vm.runInNewContext(sw, { self, caches, URL, Request, Response, fetch: vi.fn(async () => new Response('')), setTimeout, clearTimeout, console });
  const evento = (extra = {}) => {
    const esperas = [];
    return { waitUntil: (p) => esperas.push(p), respondWith: vi.fn(), esperas, ...extra };
  };
  return { oyentes, self, ventana, borradas, evento };
}

describe('el service worker en la dirección de antes (1.136.1)', () => {
  it('entra sin esperar, borra sus cachés, recarga las pestañas (que acaban en libotown.es) y se da de baja', async () => {
    const { oyentes, self, ventana, borradas, evento } = cargarSw(HOST_ANTIGUO);
    const instalar = evento();
    oyentes.install(instalar);
    expect(self.skipWaiting).toHaveBeenCalled();
    expect(instalar.esperas).toEqual([]); // nada que guardar: todo lo de aquí redirige

    const activar = evento();
    oyentes.activate(activar);
    await Promise.all(activar.esperas);
    expect(self.clients.claim).toHaveBeenCalled();
    expect(borradas.sort()).toEqual(['bookshelf-portadas-v1', 'bookshelf-v1.136.0']); // lo de otras apps, no
    expect(ventana.navigate).toHaveBeenCalledWith(ventana.url);
    expect(self.registration.unregister).toHaveBeenCalled();
  });

  it('no responde a nada: todo va a la red, que redirige', () => {
    const { oyentes, evento } = cargarSw(HOST_ANTIGUO);
    const peticion = evento({ request: new Request(`https://${HOST_ANTIGUO}/`, { method: 'GET' }) });
    Object.defineProperty(peticion.request, 'mode', { value: 'navigate' });
    oyentes.fetch(peticion);
    expect(peticion.respondWith).not.toHaveBeenCalled();
  });
});

describe('el service worker en libotown.es no cambia', () => {
  it('guarda lo de siempre al instalarse, espera a la app y responde a la navegación', () => {
    const { oyentes, self, evento } = cargarSw('libotown.es');
    const instalar = evento();
    oyentes.install(instalar);
    expect(self.skipWaiting).not.toHaveBeenCalled();
    expect(instalar.esperas).toHaveLength(1);

    const peticion = evento({ request: new Request('https://libotown.es/', { method: 'GET' }) });
    Object.defineProperty(peticion.request, 'mode', { value: 'navigate' });
    oyentes.fetch(peticion);
    expect(peticion.respondWith).toHaveBeenCalled();
  });
});
