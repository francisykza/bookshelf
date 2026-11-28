// 1.164 · En la visita a un vecino, lo que antes eran botones (la tarjeta «Ver toda la biblioteca», «Tablón de…») se toca en
// la escena 3D (VisitaPiso.jsx): esto busca en pantalla un punto que dé en `id` ('estanteria', 'tablon', 'libro'…), girando
// la vista si hace falta, y lo toca. Usa la API de pruebas de la habitación (`window.__pisoLab`, solo en desarrollo).
import { expect } from '@playwright/test';

const buscar = (id) => {
  const api = window.__pisoLab?.();
  if (!api) return null;
  const mirar = () => {
    for (let y = 120; y < innerHeight - 60; y += 18) for (let x = 12; x < innerWidth - 8; x += 16) if (api.hitAt(x, y) === id) return { x, y };
    return null;
  };
  const aqui = mirar();
  if (aqui) return aqui;
  const [min, max] = api.yawRange?.() ?? [-1, 1];
  for (let yaw = min; yaw <= max; yaw += 0.12) {
    api.setYawForTest(yaw);
    const p = mirar();
    if (p) return p;
  }
  return null;
};

export async function tocarEnVisita(page, id) {
  let punto = null;
  await expect
    .poll(
      async () => {
        punto = await page.evaluate(buscar, id);
        return punto;
      },
      { timeout: 15000 },
    )
    .not.toBeNull();
  await page.waitForTimeout(150);
  await page.mouse.click(punto.x, punto.y);
}
