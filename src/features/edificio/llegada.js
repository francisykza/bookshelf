// 1.138 (SPEC §138): el mensaje de la pantalla de carga de Libotown al ir al edificio, según adónde vas. Aparte del panel para
// que la app lo use mientras se descarga el edificio, sin cargarlo antes de tiempo.

/** `pisoId` y `sala` son los del panel del edificio (`{ type: 'edificio', id, section }`). */
export function mensajeLlegada(pisoId = null, sala = null) {
  if (pisoId === 'tienda') return 'Abriendo el bajo…';
  if (pisoId === 'hotel') return sala === 'lonja' ? 'Abriendo el portón del almacén…' : 'Llegando al Gran Hotel…';
  return 'Abriendo el portal…';
}
