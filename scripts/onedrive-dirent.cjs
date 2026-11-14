// OneDrive (14-11-2026): con los archivos de la carpeta sincronizados, Node 24 lista cada archivo como «enlace» al leer una
// carpeta con `withFileTypes` (el `lstat` dice que no lo es). Playwright y otras herramientas los saltan y dicen «No tests found».
// Este parche, cargado con NODE_OPTIONS, corrige esas entradas mirando el archivo de verdad. No cambia nada en disco.
//   NODE_OPTIONS="--require ./scripts/onedrive-dirent.cjs" npx playwright test …
const fs = require('fs');
const path = require('path');

function arreglar(dir, entradas) {
  for (const e of entradas) {
    if (!e || typeof e.isSymbolicLink !== 'function' || !e.isSymbolicLink()) continue;
    let st;
    try {
      const ruta = path.join(e.parentPath ?? e.path ?? String(dir), e.name);
      if (fs.lstatSync(ruta).isSymbolicLink()) continue;
      st = fs.statSync(ruta);
    } catch {
      continue;
    }
    e.isFile = () => st.isFile();
    e.isDirectory = () => st.isDirectory();
    e.isSymbolicLink = () => false;
  }
  return entradas;
}
const conTipos = (o) => o && typeof o === 'object' && o.withFileTypes;

const readdirSync = fs.readdirSync;
fs.readdirSync = function (dir, o) {
  const r = readdirSync.apply(this, arguments);
  return conTipos(o) ? arreglar(dir, r) : r;
};
const readdir = fs.readdir;
fs.readdir = function (dir, o, cb) {
  if (typeof o === 'function') return readdir.call(this, dir, o);
  if (!conTipos(o)) return readdir.apply(this, arguments);
  return readdir.call(this, dir, o, (err, r) => cb(err, err ? r : arreglar(dir, r)));
};
const pReaddir = fs.promises.readdir;
fs.promises.readdir = async function (dir, o) {
  const r = await pReaddir.apply(this, arguments);
  return conTipos(o) ? arreglar(dir, r) : r;
};
