// La radio del rincón (1.62, SPEC §62.3): UN solo reproductor de música para toda la app (no uno por pantalla). Vive en
// este módulo, fuera de los componentes: cerrar el panel, ir al lector EPUB o al diario no lo destruye.
// - Nada suena sin un gesto: el elemento de audio se crea al pulsar «Reproducir». Al recargar, la radio queda en pausa.
// - La interfaz enseña lo que de verdad hace el reproductor (cargando, sonando, en pausa, error), no la intención del
//   clic: el estado sale de sus eventos y de la promesa de `play()`.
// - Volumen de música y del ambiente por separado (el ambiente es el de siempre, `ambientAudio.js`). En iOS el volumen
//   de un elemento de audio no se puede cambiar: por eso la música pasa por una ganancia de Web Audio cuando la hay.
// - Temporizador por hora límite (15/30/60 min o desactivado): se comprueba también al volver del segundo plano. Al
//   cumplirse pausa la música; el ambiente sigue como esté (lo decide la persona aparte).
// - Preferencias del dispositivo (sintonía y volúmenes) en `bookshelf:radio`; nada de historial.
import { useSyncExternalStore } from 'react';
import { setAmbienceVolume as applyAmbience, sharedAudio } from '../../audio/ambientAudio';
import { STATIONS, stationById } from './catalog';

const PREFS_KEY = 'bookshelf:radio';
export const SLEEP_OPTIONS = [15, 30, 60];

function readPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    const vol = (v, d) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);
    return { stationId: stationById(p.stationId)?.id ?? null, musicVolume: vol(p.musicVolume, 0.6), ambienceVolume: vol(p.ambienceVolume, 1) };
  } catch {
    return { stationId: STATIONS[0]?.id ?? null, musicVolume: 0.6, ambienceVolume: 1 };
  }
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ stationId: snapshot.stationId, musicVolume: snapshot.musicVolume, ambienceVolume: snapshot.ambienceVolume }));
  } catch {
    // Sin almacenamiento (modo privado): la radio funciona igual, sin recordar
  }
}

const prefs = readPrefs();
/** `status`: idle (nada cargado aún) · loading · playing · paused · error. `sleepAt`: hora límite (ms) o null. */
let snapshot = { ...prefs, trackIndex: 0, status: 'idle', error: '', sleepAt: null, sleepMinutes: null, slept: false };
const listeners = new Set();
const set = (patch) => {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
};
applyAmbience(prefs.ambienceVolume);

let el = null;
let gain = null;
let sleepTimer = null;

export const currentStation = () => stationById(snapshot.stationId);
export const currentTrack = () => {
  const st = currentStation();
  return st ? st.tracks[snapshot.trackIndex % st.tracks.length] : null;
};

/** El único elemento de audio, creado con el primer «Reproducir» (dentro del gesto). */
function element() {
  if (el) return el;
  el = new Audio();
  el.preload = 'none';
  el.addEventListener('playing', () => set({ status: 'playing', error: '' }));
  el.addEventListener('waiting', () => !el.paused && set({ status: 'loading' }));
  el.addEventListener('pause', () => snapshot.status !== 'error' && set({ status: 'paused' }));
  el.addEventListener('ended', () => step(1, true));
  el.addEventListener('error', () => {
    if (!el.getAttribute('src')) return;
    set({ status: 'error', error: 'No se ha podido cargar la pista.' });
  });
  // La música por una ganancia de Web Audio (iOS no deja cambiar el volumen del elemento); si no hay, el del elemento
  const shared = sharedAudio();
  if (shared) {
    try {
      const src = shared.ctx.createMediaElementSource(el);
      gain = shared.ctx.createGain();
      gain.gain.value = snapshot.musicVolume;
      src.connect(gain).connect(shared.ctx.destination);
    } catch {
      gain = null;
    }
  }
  if (!gain) el.volume = snapshot.musicVolume;
  return el;
}

function load(track) {
  const a = element();
  if (a.getAttribute('src') !== track.src) {
    a.setAttribute('src', track.src);
    a.load();
  }
  mediaSession(track);
}

export async function play() {
  const track = currentTrack();
  if (!track) return;
  load(track);
  sharedAudio();
  set({ status: 'loading', error: '', slept: false });
  try {
    await el.play();
  } catch (e) {
    // Bloqueo del navegador, archivo inaccesible…: se dice, sin fingir que suena
    set({ status: 'error', error: e?.name === 'NotAllowedError' ? 'El navegador no ha dejado reproducir. Vuelve a pulsar.' : 'No se ha podido reproducir la pista.' });
  }
}

export function pause() {
  if (el && !el.paused) el.pause();
  else if (snapshot.status === 'loading') set({ status: 'paused' });
}

export const toggle = () => (snapshot.status === 'playing' || snapshot.status === 'loading' ? pause() : play());

/** Pista anterior o siguiente de la sintonía (vuelve al principio al acabar). */
function step(dir, auto = false) {
  const st = currentStation();
  if (!st) return;
  const n = st.tracks.length;
  const wasPlaying = auto || snapshot.status === 'playing' || snapshot.status === 'loading';
  set({ trackIndex: (snapshot.trackIndex + dir + n) % n });
  if (el) el.currentTime = 0;
  if (wasPlaying) play();
}
export const next = () => step(1);
export const previous = () => step(-1);

export function selectStation(id) {
  const st = stationById(id);
  if (!st || st.id === snapshot.stationId) return;
  const wasPlaying = snapshot.status === 'playing' || snapshot.status === 'loading';
  set({ stationId: st.id, trackIndex: 0 });
  savePrefs();
  if (wasPlaying) play();
}

export function setMusicVolume(v) {
  const vol = Math.min(1, Math.max(0, Number(v) || 0));
  set({ musicVolume: vol });
  if (gain) gain.gain.value = vol;
  else if (el) el.volume = vol;
  savePrefs();
}

export function setAmbienceVolume(v) {
  const vol = Math.min(1, Math.max(0, Number(v) || 0));
  set({ ambienceVolume: vol });
  applyAmbience(vol);
  savePrefs();
}

// ── Temporizador ────────────────────────────────────────────────────────────────────────────────────────────────────
function checkSleep() {
  if (snapshot.sleepAt && Date.now() >= snapshot.sleepAt) {
    clearTimeout(sleepTimer);
    sleepTimer = null;
    const was = snapshot.status === 'playing' || snapshot.status === 'loading';
    pause();
    set({ sleepAt: null, sleepMinutes: null, slept: was });
  }
}

/** `minutes`: 15, 30, 60 o null (desactivado). Cuenta desde ahora hasta una hora límite fija. */
export function setSleep(minutes) {
  clearTimeout(sleepTimer);
  sleepTimer = null;
  if (!SLEEP_OPTIONS.includes(minutes)) {
    set({ sleepAt: null, sleepMinutes: null });
    return;
  }
  const at = Date.now() + minutes * 60000;
  set({ sleepAt: at, sleepMinutes: minutes, slept: false });
  sleepTimer = setTimeout(checkSleep, at - Date.now() + 50);
}

if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && checkSleep());

// ── MediaSession (solo si existe; no promete reproducción en segundo plano) ─────────────────────────────────────────
function mediaSession(track) {
  const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : null;
  if (!ms || typeof window.MediaMetadata !== 'function') return;
  try {
    ms.metadata = new window.MediaMetadata({ title: track.title, artist: track.artist, album: 'La radio del rincón · BookShelf' });
    ms.setActionHandler('play', play);
    ms.setActionHandler('pause', pause);
    const many = (currentStation()?.tracks.length ?? 0) > 1;
    ms.setActionHandler('nexttrack', many ? next : null);
    ms.setActionHandler('previoustrack', many ? previous : null);
  } catch {
    // Acciones no admitidas por este navegador
  }
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Estado de la radio para la interfaz (se re-renderiza solo cuando cambia). */
export function useRadio() {
  const state = useSyncExternalStore(subscribe, () => snapshot);
  const station = stationById(state.stationId);
  const track = station ? station.tracks[state.trackIndex % station.tracks.length] : null;
  return { ...state, station, track, stations: STATIONS };
}
