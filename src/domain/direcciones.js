// Las direcciones de Libotown (1.136, SPEC §136.6). Mientras dura el traslado hay dos de producción: el dominio propio y
// la de Vercel de siempre, que avisa de la mudanza y más adelante redirigirá (bloque 4). Lo guardado en el navegador es de
// cada dirección: en la nueva hay que entrar con la cuenta y quedarse con los datos de la cuenta.
export const DOMINIO = 'libotown.es';
export const DIRECCION = `https://${DOMINIO}/`;
export const HOST_ANTIGUO = 'bookshelf-wine-iota.vercel.app';
export const HOSTS_PRODUCCION = [DOMINIO, `www.${DOMINIO}`, HOST_ANTIGUO];

const normal = (host) =>
  String(host ?? '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');

/** ¿Es una dirección de producción? Ahí nunca se cargan datos de demostración. */
export const esProduccion = (host) => HOSTS_PRODUCCION.includes(normal(host));

/** ¿Es la dirección de antes, la que avisa de la mudanza? */
export const esDireccionAntigua = (host) => normal(host) === HOST_ANTIGUO;
