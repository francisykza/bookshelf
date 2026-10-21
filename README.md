# BookShelf · Mediterranean Cozy Reading Sanctuary

Aplicación hermana de GameShelf para libros y lectura. La interfaz es la propia habitación: toca los
objetos de la ilustración para navegar (arquitectura completa en [SPEC.md](SPEC.md)).

| Objeto | Qué hace |
| --- | --- |
| Libro abierto sobre la cama | Abre en 3D el libro que estás leyendo |
| Estantería de la izquierda / etiqueta "Ver mi librería" | Acerca la cámara a la librería de roble |
| Portátil | Estadísticas, reto anual y misiones del Booknook |
| Auriculares | Sonido ambiental (olas, brisa, páginas) |
| Bandeja de té helado | Temporizador de lectura con bebida |
| Carillón / sol / luna | Cambia entre mañana, atardecer y noche |

```bash
npm install
npm run dev
npm test
npm run build
```

Los datos se guardan en `localStorage` del navegador y, si entras con tu cuenta (botón de la nube en la
esquina), se sincronizan con Supabase entre dispositivos. Para activar la nube en local, copia
`.env.example` como `.env.local` con los datos de tu proyecto y ejecuta una vez `supabase/schema.sql`.
Despliegue en Vercel: ver SPEC.md §9ter. La búsqueda usa Google Books sin clave y, si
falla o agota la cuota, Open Library automáticamente.
