// El sonido de las evidencias del café (Francisco, tras ver la 1.133: los vídeos de Playwright no tienen sonido). La misma
// grabadora que la prueba del taller (v1133), aquí para usarla en las demás: escucha lo que la página manda a los altavoces, sin
// cambiar lo que suena, y después se pega al vídeo con el ffmpeg que trae Playwright (solo copia pistas, no codifica).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Antes de cargar la app: todo lo que va a los altavoces va también a una grabadora (MediaRecorder, opus). */
export async function grabarSonido(page) {
  await page.addInitScript(() => {
    const destinos = new WeakMap();
    const g = (window.__grabacion = { trozos: [], inicio: 0, rec: null });
    const conectar = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (destino, ...resto) {
      const r = conectar.call(this, destino, ...resto);
      try {
        if (destino instanceof AudioDestinationNode && typeof this.context.createMediaStreamDestination === 'function') {
          let md = destinos.get(this.context);
          if (!md) {
            md = this.context.createMediaStreamDestination();
            destinos.set(this.context, md);
            if (!g.rec) {
              g.rec = new MediaRecorder(md.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 96000 });
              g.rec.ondataavailable = (e) => e.data.size && g.trozos.push(e.data);
              g.rec.start(1000);
              g.inicio = Date.now();
            }
          }
          conectar.call(this, md);
        }
      } catch {
        /* sin grabadora, la prueba sigue igual */
      }
      return r;
    };
  });
}

/** Para la grabadora y devuelve el sonido (base64) y cuándo empezó (ms de la época), o null si no sonó nada. */
export async function sonidoGrabado(page) {
  return page.evaluate(async () => {
    const g = window.__grabacion;
    if (!g?.rec) return null;
    await new Promise((r) => {
      g.rec.onstop = r;
      g.rec.stop();
    });
    const blob = new Blob(g.trozos, { type: 'audio/webm' });
    const url = await new Promise((r) => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result);
      fr.readAsDataURL(blob);
    });
    return { b64: String(url).split(',')[1], inicio: g.inicio };
  });
}

/** El ffmpeg que trae Playwright, o null. */
function ffmpeg() {
  const base = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
  try {
    const dir = readdirSync(base)
      .filter((d) => d.startsWith('ffmpeg-'))
      .sort()
      .pop();
    const exe = dir && join(base, dir, process.platform === 'win32' ? 'ffmpeg-win64.exe' : 'ffmpeg-linux');
    return exe && existsSync(exe) ? exe : null;
  } catch {
    return null;
  }
}

/**
 * Guarda el vídeo en `destino` con su sonido: el vídeo, tal cual; el sonido, desplazado lo que tardó en empezar a sonar desde
 * que empezó el vídeo (`t0`, al empezar la prueba). Sin sonido o sin ffmpeg, el vídeo mudo. Devuelve si lleva sonido.
 */
export async function guardarConSonido(video, destino, sonido, t0) {
  const mudo = destino.replace(/\.webm$/, '.mudo.webm');
  await video.saveAs(mudo);
  const exe = ffmpeg();
  if (!sonido || !exe) {
    renameSync(mudo, destino);
    return false;
  }
  const pista = destino.replace(/\.webm$/, '.sonido.webm');
  writeFileSync(pista, Buffer.from(sonido.b64, 'base64'));
  try {
    const desfase = Math.max(0, (sonido.inicio - t0) / 1000).toFixed(3);
    execFileSync(exe, ['-y', '-loglevel', 'error', '-i', mudo, '-itsoffset', desfase, '-i', pista, '-map', '0:v', '-map', '1:a', '-c', 'copy', destino]);
    unlinkSync(mudo);
    return true;
  } catch {
    renameSync(mudo, destino);
    return false;
  } finally {
    unlinkSync(pista);
  }
}
