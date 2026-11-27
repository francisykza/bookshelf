// 1.155 · Lo que queda de una sala cuando el móvil no puede con el 3D (o pierde la GPU). Sustituye a los dibujos isométricos
// de respaldo (Francisco, 26-11-2026: «borra las vistas isométricas»; docs/qa/amigos-vecinos.md, bloque 5): la sala no se
// dibuja, pero sus funciones siguen debajo. `sala`: «el casino», «la sala de lectura»… `children`: lo que dice la sala.

/** Un papel que avisa de que esta sala no se puede dibujar en este móvil. */
export function SinTresD({ sala, children = null }) {
  return (
    <div className="ed-sin3d" role="note">
      <p className="ed-sin3d__title">Sin 3D en este móvil</p>
      <p>No puede dibujar {sala}, pero todo lo demás funciona igual.</p>
      {children}
    </div>
  );
}
