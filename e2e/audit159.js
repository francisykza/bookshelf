// 1.59 (SPEC §59): auditoría de un estado de pantalla para la telemetría de QA. Devuelve los cinco apartados que se
// analizan en `qa-telemetry.json`: elementos que desbordan la pantalla, fondo pintado, controles que se tapan entre sí,
// imágenes rotas o sin recortar y errores de consola. Solo mide lo visible (no lo que está fuera de un contenedor).

/** Recoge el estado actual de la página. `consoleErrors` los aporta la prueba (escuchados desde el principio). */
export async function auditState(page, state, consoleErrors = []) {
  const audit = await page.evaluate(() => {
    const vw = innerWidth;
    const vh = innerHeight;
    const visible = (el) => {
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
    };
    const clipped = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const st = getComputedStyle(p);
        if (/hidden|auto|scroll|clip/.test(st.overflowX)) return true;
      }
      return false;
    };
    const describe = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.classList.length ? `.${[...el.classList].slice(0, 2).join('.')}` : ''}`;
    // 1 · Desbordes horizontales que el usuario vería (no los recortados por su contenedor)
    const overflowElements = [...document.querySelectorAll('body *')]
      .filter((el) => visible(el) && !clipped(el))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.right > vw + 1 || r.left < -1;
      })
      .slice(0, 20)
      .map(describe);
    // 2 · Fondo: en cinco puntos de la pantalla hay algo pintado (nunca el blanco por defecto del documento)
    const painted = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const st = getComputedStyle(n);
        if (st.backgroundImage !== 'none' || !/rgba\(0, 0, 0, 0\)|transparent/.test(st.backgroundColor) || n.tagName === 'IMG' || n.tagName === 'VIDEO' || n.tagName === 'CANVAS') return true;
      }
      return false;
    };
    const points = [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]];
    const unpainted = points.filter(([x, y]) => {
      const el = document.elementFromPoint(vw * x, vh * y);
      return !el || !painted(el);
    });
    const backgroundCheck = { ok: unpainted.length === 0, unpainted };
    // 3 · Controles que se tapan dentro de la misma capa (panel, biblioteca, visita o habitación): un control que recibe
    // toques cuyo centro ocupa otro control. Lo que queda bajo una capa opaca (la habitación bajo la biblioteca) no cuenta
    const layer = (el) => el.closest('.panel-veil, .library, .reader-visit, main, body');
    const reachable = (el) => getComputedStyle(el).pointerEvents !== 'none' && !el.closest('[inert], [aria-hidden="true"]');
    const controls = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="radio"]')].filter((el) => visible(el) && reachable(el));
    const overlappingInteractive = [];
    for (const el of controls) {
      const r = el.getBoundingClientRect();
      const cx = Math.min(vw - 1, Math.max(0, r.left + r.width / 2));
      const cy = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
      const top = document.elementFromPoint(cx, cy);
      if (!top || el.contains(top) || top.contains(el)) continue;
      const other = top.closest('button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="radio"]');
      if (other && other !== el && !other.contains(el) && layer(other) === layer(el)) overlappingInteractive.push(`${describe(el)} ← ${describe(other)}`);
    }
    // 4 · Imágenes rotas (cargadas sin píxeles) o visibles con caja vacía (sin recortar / colapsadas)
    const brokenOrUncroppedAssets = [...document.images]
      .filter((img) => {
        if (!visible(img.parentElement ?? img)) return false;
        const r = img.getBoundingClientRect();
        const broken = img.complete && img.getAttribute('src') && img.naturalWidth === 0;
        const collapsed = img.complete && img.naturalWidth > 0 && (r.width < 1 || r.height < 1) && getComputedStyle(img).display !== 'none';
        return broken || collapsed;
      })
      .slice(0, 20)
      .map((img) => `${describe(img)} ${String(img.getAttribute('src')).slice(-60)}`);
    return { overflowElements, backgroundCheck, overlappingInteractive: overlappingInteractive.slice(0, 20), brokenOrUncroppedAssets };
  });
  return { state, ...audit, consoleErrors: consoleErrors.map((e) => e.text ?? String(e)).slice(0, 20) };
}
