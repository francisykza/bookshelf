// Los gestos de la barra del café hechos con el ratón, como el dedo (1.121, revisión del 12-11-2026; 1.122, bloque 4a: el
// molinillo y el cazo del chocolate y las varillas de la nata). Comunes a los specs del café.
import { expect } from '@playwright/test';

export const quieto = async (page, ms = 600) => {
  await page.waitForFunction(() => window.__cafe3d?.settled());
  await page.waitForTimeout(ms);
};

/**
 * Hace un gesto de la barra con el ratón, como el dedo: sobre el objeto (donde está la pista). `capturas`: además, una foto a
 * medio gesto; `ayuda`: comprobar la «!» (niveles 1 y 2). Espera a que la barra pase al siguiente.
 */
export async function hacerGesto(page, cafe, tipo, { foto = null, arte = 'hoja', ayuda = true } = {}) {
  const caja = cafe.locator('.cf3-franja--atender');
  const zona = cafe.locator('.cf3-gesto[data-activo="true"]');
  await expect(caja).toHaveAttribute('data-gesto', tipo);
  await quieto(page, 150);
  await expect(zona.locator('.cf3-gesto__pista')).toBeVisible();
  // La «!» sobre el objeto: en los niveles 1 y 2 (después, solo si te quedas parado)
  if (ayuda) await expect(zona.locator('.cf3-ayuda--gesto')).toBeVisible();
  if (foto && (tipo === 'manivela' || tipo === 'tetera' || tipo === 'vapor' || tipo === 'molinillo')) await foto(`ayuda-${tipo}`);
  const pista = await zona.locator('.cf3-gesto__pista').boundingBox();
  const zonaBox = await zona.boundingBox();
  const franja = await caja.boundingBox();
  const e = Math.min(zonaBox.width, 600) / 390;
  // El objeto (la pista); si quedara muy abajo, el gesto se hace más arriba (vale en toda la escena)
  const c = { x: pista.x + pista.width / 2, y: Math.min(pista.y + pista.height / 2, franja.y - 140 * e) };
  const m = page.mouse;
  const a = async (x, y) => m.move(x, y, { steps: 3 });
  const medio = async () => {
    if (foto) await foto(`gesto-${tipo}`);
  };
  if (tipo === 'manivela') {
    const r = 55 * e;
    await m.move(c.x + r, c.y);
    await m.down();
    for (let k = 1; k <= 80; k += 1) {
      const ang = (k * Math.PI) / 18;
      await m.move(c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r);
      if (k === 30) await medio();
    }
    await m.up();
  } else if (tipo === 'apisonar') {
    await m.move(c.x, c.y - 30 * e);
    await m.down();
    await a(c.x, c.y + 10 * e);
    await medio();
    await a(c.x, c.y + 60 * e);
    await m.up();
  } else if (tipo === 'palanca' || tipo === 'tetera' || tipo === 'vapor') {
    const [dx, dy] = { palanca: [0, 120], tetera: [0, -100], vapor: [90, 0] }[tipo];
    await m.move(c.x - (tipo === 'vapor' ? 30 * e : 0), c.y - (tipo === 'palanca' ? 40 * e : 0));
    await m.down();
    await a(c.x + dx * e - (tipo === 'vapor' ? 30 * e : 0), c.y + dy * e - (tipo === 'palanca' ? 40 * e : 0));
    await page.waitForTimeout(700);
    await medio();
    await page.waitForTimeout(1100);
    await m.up();
  } else if (tipo === 'cuchara') {
    await m.move(c.x - 40 * e, c.y);
    await m.down();
    await a(c.x + 40 * e, c.y - 10 * e);
    await medio();
    await a(c.x + 140 * e, c.y);
    await m.up();
  } else if (tipo === 'colador' || tipo === 'agitar') {
    const vert = tipo === 'colador';
    await m.move(c.x, c.y);
    await m.down();
    for (let k = 1; k <= 12; k += 1) {
      const v = (k % 2 ? 1 : -1) * 40 * e;
      await a(vert ? c.x : c.x + v, vert ? c.y + v : c.y);
      if (k === 4) await medio();
    }
    await m.up();
  } else if (tipo === 'verter') {
    await m.move(c.x, c.y - 90 * e);
    await m.down();
    for (let k = 1; k <= 12; k += 1) {
      await a(c.x + (arte === 'hoja' ? (k % 2 ? 16 : -16) * e : 0), c.y - 90 * e + k * 16 * e);
      if (k === 5) await medio();
    }
    await m.up();
  } else if (tipo === 'hilo') {
    await m.move(c.x, c.y);
    await m.down();
    for (let k = 1; k <= 70; k += 1) {
      const ang = k * 0.35;
      const r = (10 + k * 0.9) * e;
      await m.move(c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r);
      if (k === 30) await medio();
    }
    await m.up();
  } else if (tipo === 'molinillo' || tipo === 'batir') {
    // Remover: círculos amplios en el cazo (tres vueltas); batir: vueltas pequeñas y seguidas (cinco)
    const r = (tipo === 'molinillo' ? 60 : 24) * e;
    const vueltas = tipo === 'molinillo' ? 3.3 : 5.4;
    await m.move(c.x + r, c.y);
    await m.down();
    const pasos = Math.round(vueltas * 18);
    for (let k = 1; k <= pasos; k += 1) {
      const ang = (k * Math.PI) / 9;
      await m.move(c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r);
      if (k === Math.round(pasos / 2)) await medio();
    }
    await m.up();
  } else if (tipo === 'cazo') {
    // Inclinar el cazo: a la izquierda y mantener mientras cae el chocolate
    await m.move(c.x + 40 * e, c.y);
    await m.down();
    await a(c.x - 60 * e, c.y);
    await page.waitForTimeout(700);
    await medio();
    await page.waitForTimeout(1200);
    await m.up();
  }
  await expect(caja).not.toHaveAttribute('data-gesto', tipo, { timeout: 4000 });
}

/**
 * «Hasta luego» y, si sale el cartel de lo conseguido (1.122: el primer día, una subida, un hito o los tickets del día), lo
 * cierra. Devuelve su texto (o null si no salió).
 */
export async function despedir(page, cafe) {
  await cafe.getByRole('button', { name: 'Hasta luego' }).click();
  const logro = page.locator('.cf3-logro');
  try {
    await logro.waitFor({ state: 'visible', timeout: 1500 });
  } catch {
    return null;
  }
  const texto = await logro.textContent();
  await logro.locator('.cf3-logro__ok').click();
  await expect(logro).toBeHidden();
  return texto;
}
