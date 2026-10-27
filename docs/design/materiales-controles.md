# Materiales de los controles (1.44.0)

| Material | Original | Recurso de la app | Uso (solo biblioteca y ficha) |
| --- | --- | --- | --- |
| Terracota | `material-diseno/controles/control-terracota.png` | `public/assets/ui/controls/control-terracota.webp` | «Añadir libro», «Registrar lectura» |
| Lino salvia con costura | `material-diseno/controles/control-lino-salvia.png` | `public/assets/ui/controls/control-lino-salvia.webp` | Filtro seleccionado; estado seleccionado del libro |
| Papel crema | `material-diseno/controles/control-papel-crema.png` | `public/assets/ui/controls/control-papel-crema.webp` | Buscador, «Vista y herramientas», filtros y estados no seleccionados, −10 / − / + / +10, panel de la barra |

Los originales son las tres bases vacías entregadas (PNG con alfa). Los derivados recortan solo el margen
transparente sobrante y se reducen a la mitad (WebP); conservan la silueta, los bordes y la sombra propia.

Se aplican con la utilidad `.craft` (`styles/craft-144.css`): escalado por nueve zonas con corte de 56 px del
recurso y borde de 8–14 px en pantalla, centro repetido (`round`), sin sombras añadidas. El texto y los iconos son
HTML encima. `.craft--choice` pasa de papel a lino según `aria-checked` / `aria-pressed`, es decir, según el estado
real. Maquetas: `docs/design/references/biblioteca-materiales-maqueta.png` y `ficha-libro-maqueta.png`.
