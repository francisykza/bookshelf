// Contenedor de los modales (SPEC §11.2, 1.17.0): hermano de #root en index.html, sin ancestros transformados.

/** Si falta (pruebas, un index.html antiguo en caché) se crea al final de <body>. */
export function modalRoot() {
  let node = document.getElementById('modal-root');
  if (!node) {
    node = document.createElement('div');
    node.id = 'modal-root';
    document.body.appendChild(node);
  }
  return node;
}
