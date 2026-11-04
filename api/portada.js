// Portadas para la imagen de la reseña (1.85). Google Books no deja leer sus imágenes desde otra web, y sin eso el lienzo no se
// puede exportar. Esta función las sirve desde nuestro dominio, solo de los hosts de portadas y solo si son imágenes.
const HOSTS = ['books.google.com', 'books.googleusercontent.com', 'covers.openlibrary.org'];
const MAXIMO = 4 * 1024 * 1024;

export function portadaPermitida(texto) {
  try {
    const url = new URL(texto);
    return (url.protocol === 'https:' || url.protocol === 'http:') && HOSTS.includes(url.hostname) ? `https://${url.hostname}${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const url = portadaPermitida(String(req.query?.u ?? ''));
  if (!url) return res.status(400).end();
  try {
    const r = await fetch(url, { redirect: 'follow' });
    const tipo = r.headers.get('content-type') ?? '';
    // La redirección también tiene que acabar en un host de portadas o de su almacén
    const final = new URL(r.url).hostname;
    if (!r.ok || !tipo.startsWith('image/') || !(HOSTS.includes(final) || final.endsWith('.archive.org'))) return res.status(404).end();
    const datos = Buffer.from(await r.arrayBuffer());
    if (datos.length > MAXIMO) return res.status(413).end();
    res.setHeader('Content-Type', tipo);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return res.status(200).send(datos);
  } catch {
    return res.status(502).end();
  }
}
