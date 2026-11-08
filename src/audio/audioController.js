// Controlador único del sonido (1.90, «Escritorio del puerto»). Encima del AudioContext que ya usaba la app (`sharedAudio`): canales master,
// efectos, ambiente y música, y como mucho una música y un ambiente a la vez (dos solo durante un fundido cruzado).
// Reglas: sin preferencias guardadas, silencio hasta «Activar sonido»; quien ya usaba la app conserva lo que tenía. Los ajustes viven en
// este dispositivo, en su propia clave, sin ningún dato de biblioteca. Los archivos solo se piden cuando hacen falta, una vez.
import { useSyncExternalStore } from 'react';
import { isRadioOn, onRadioChange, pause as pauseRadio } from '../features/radio/radioPlayer';
import { setAmbience, setAmbienceVolume, setSfx, sharedAudio } from './ambientAudio';
import { setUiVolume } from './uiSounds';

const KEY = 'bookshelf:sonido:v1';
const LIBRARY_KEY = 'bookshelf:v1';
const SRC = '/media/sonido/';
export const AMBIENCES = [
  { id: 'none', label: 'Sin ambiente' },
  { id: 'lluvia', label: 'Lluvia', file: 'lluvia.mp3', level: 1 },
];
/** El mar está retirado por ahora (decisión de Francisco, 8-11-2026); su archivo se conserva. Quien lo tenía elegido pasa a «Sin ambiente». */
const sinMar = (p) => ({ ...p, ambienceId: p.ambienceId === 'mar' ? 'none' : p.ambienceId, lastAmbience: p.lastAmbience === 'mar' ? 'none' : p.lastAmbience });
export const MUSICS = [
  { id: 'none', label: 'Sin música' },
  { id: 'tarde', label: 'Tarde en el puerto', file: 'tarde-en-el-puerto.mp3', level: 1 },
  { id: 'luz', label: 'Luz de escritorio', file: 'luz-de-escritorio.mp3', level: 1.2 },
];
/** El ambiente sintetizado de siempre, que solo se ofrece a quien ya lo tenía. */
export const SCENE_AMBIENCE = { id: 'escena', label: 'Ambiente de la habitación' };

const BASE = { v: 1, on: false, decided: false, legacy: false, effects: 25, ambience: 15, music: 12, master: 70, ambienceId: 'none', musicId: 'none', lastAmbience: 'none', lastMusic: 'tarde' };
const CROSSFADE = 0.8;
const OFF_FADE = 0.12;
/** Margen de los canales sobre los controles: los valores de la especificación se quedaban casi inaudibles en altavoz. */
const TRIM = { ambience: 1.8, music: 2.4 };
/** Los archivos llevan 1 s repetido a cada lado: el bucle va por dentro y da igual el retardo del decodificador. */
const LOOP_START = 0.5;
const LOOP_END = 32.5;

const clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

function readPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved?.v === 1) return { ...BASE, ...saved };
    // Instalación con biblioteca de antes: su elección sigue valiendo
    const settings = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? 'null')?.settings;
    if (settings) {
      const sound = settings.sound !== false;
      const sfx = settings.sfx !== false;
      return { ...BASE, decided: true, legacy: true, on: sound || sfx, effects: sfx ? clamp((settings.uiVolume ?? 0.25) * 100) : 0, ambience: 100, master: 90, ambienceId: sound ? 'escena' : 'none', lastAmbience: 'escena' };
    }
  } catch {
    // Almacenamiento no disponible: se sigue en silencio
  }
  return { ...BASE };
}

let prefs = sinMar(readPrefs());
let unlocked = false;
let needsTap = false;
let errors = { ambience: null, music: null };
let snapshot = { ...prefs, needsTap, errors };
const listeners = new Set();
const buffers = new Map();
const failed = new Set();
const buses = { ambience: null, music: null };
const playing = { ambience: null, music: null };
const fading = { ambience: null, music: null };
const wanted = { ambience: null, music: null };
const blockers = new Set();
let saveTimer = 0;
let suspendTimer = 0;
let wasRunning = false;
let mirror = null;
let synced = false;
let onMirror = null;
let starts = 0;

function save() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flush, 200);
}
function flush() {
  window.clearTimeout(saveTimer);
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Sin almacenamiento los ajustes duran esta sesión
  }
}

function emit() {
  snapshot = { ...prefs, needsTap, errors };
  listeners.forEach((fn) => fn());
}

const items = (channel) => (channel === 'ambience' ? AMBIENCES : MUSICS);
const backgroundOn = () => prefs.on && (prefs.ambienceId !== 'none' || prefs.musicId !== 'none');

function publishMirror() {
  const next = { sound: backgroundOn(), sfx: prefs.on && prefs.effects > 0, uiVolume: prefs.effects / 100 };
  if (next.sound === mirror?.sound && next.sfx === mirror?.sfx && next.uiVolume === mirror?.uiVolume) return;
  mirror = next;
  synced = false;
  onMirror?.(next);
}

/** Lo que no necesita AudioContext: se puede llamar antes del primer gesto. */
function applyFlags() {
  setSfx(prefs.on && prefs.effects > 0);
  setUiVolume(prefs.effects / 100);
}

function audioGraph() {
  const shared = sharedAudio();
  if (!shared) return null;
  ['ambience', 'music'].forEach((ch) => {
    if (buses[ch]) return;
    buses[ch] = shared.ctx.createGain();
    buses[ch].gain.value = 0;
    buses[ch].connect(shared.master);
  });
  return shared;
}

function setChannelGains(shared) {
  const t = shared.ctx.currentTime;
  shared.master.gain.setTargetAtTime(prefs.master / 100, t, 0.03);
  buses.ambience.gain.setTargetAtTime((prefs.ambience / 100) * TRIM.ambience, t, 0.05);
  buses.music.gain.setTargetAtTime(blockers.size ? 0 : (prefs.music / 100) * TRIM.music, t, blockers.size ? 0.3 : 0.05);
}

function loadBuffer(ctx, item) {
  if (buffers.has(item.id)) return buffers.get(item.id);
  const job = fetch(SRC + item.file)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((data) => new Promise((ok, ko) => ctx.decodeAudioData(data, ok, ko)));
  buffers.set(item.id, job);
  return job;
}

function stopSlot(slot) {
  if (!slot) return;
  try {
    slot.src.stop();
  } catch {
    // Ya estaba parado
  }
  slot.src.disconnect();
  slot.gain.disconnect();
}

function fadeOutCurrent(ctx, channel, seconds) {
  const slot = playing[channel];
  if (!slot) return;
  playing[channel] = null;
  stopSlot(fading[channel]);
  fading[channel] = slot;
  const t = ctx.currentTime;
  slot.gain.gain.cancelScheduledValues(t);
  slot.gain.gain.setValueAtTime(slot.gain.gain.value, t);
  slot.gain.gain.linearRampToValueAtTime(0, t + seconds);
  window.setTimeout(() => {
    if (fading[channel] === slot) fading[channel] = null;
    stopSlot(slot);
  }, seconds * 1000 + 60);
}

/** Pone en un canal la pista pedida (o ninguna) con fundido cruzado. Si ya suena, no la toca: así no se reinicia nunca. */
function setTrack(shared, channel, id) {
  const { ctx } = shared;
  wanted[channel] = id;
  if (playing[channel]?.id === id) return;
  if (!id) {
    fadeOutCurrent(ctx, channel, CROSSFADE);
    return;
  }
  if (failed.has(id)) return;
  const item = items(channel).find((x) => x.id === id);
  loadBuffer(ctx, item)
    .then((buffer) => {
      if (wanted[channel] !== id || playing[channel]?.id === id) return;
      fadeOutCurrent(ctx, channel, CROSSFADE);
      const gain = ctx.createGain();
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(item.level, t + CROSSFADE);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = LOOP_START;
      src.loopEnd = LOOP_END;
      src.connect(gain).connect(buses[channel]);
      src.start(t, LOOP_START);
      starts += 1;
      playing[channel] = { id, src, gain };
      if (errors[channel]) {
        errors = { ...errors, [channel]: null };
        emit();
      }
    })
    .catch(() => {
      // Un intento por selección: sin red o sin archivo se avisa en Sonido y la interfaz sigue igual
      buffers.delete(id);
      failed.add(id);
      if (wanted[channel] === id) {
        errors = { ...errors, [channel]: id };
        emit();
      }
    });
}

function apply() {
  applyFlags();
  publishMirror();
  if (!unlocked) return;
  if (!prefs.on) {
    // Silencio general: baja el maestro y suspende; las pistas conservan su punto
    const shared = sharedAudio();
    if (!shared) return;
    shared.master.gain.setTargetAtTime(0, shared.ctx.currentTime, OFF_FADE / 3);
    setAmbience(false);
    if (isRadioOn()) pauseRadio();
    window.clearTimeout(suspendTimer);
    suspendTimer = window.setTimeout(() => {
      if (!prefs.on) shared.ctx.suspend?.().catch(() => {});
    }, OFF_FADE * 1000 + 120);
    return;
  }
  window.clearTimeout(suspendTimer);
  const shared = audioGraph();
  if (!shared) return;
  setChannelGains(shared);
  setAmbience(prefs.ambienceId === 'escena');
  if (prefs.ambienceId === 'escena') setAmbienceVolume(prefs.ambience / 100);
  setTrack(shared, 'ambience', prefs.ambienceId === 'none' || prefs.ambienceId === 'escena' ? null : prefs.ambienceId);
  setTrack(shared, 'music', prefs.musicId === 'none' ? null : prefs.musicId);
}

function unlock(event) {
  // Los auriculares de la habitación antigua deciden con su propio toque
  if (event?.target instanceof Element && event.target.closest('[data-id="headphones"]')) return;
  window.removeEventListener('pointerdown', unlock, true);
  window.removeEventListener('keydown', unlock, true);
  unlocked = true;
  if (needsTap) {
    needsTap = false;
    emit();
  }
  apply();
}

function update(patch) {
  prefs = { ...prefs, ...patch };
  save();
  emit();
}

/** Primer «Activar sonido» o nuevo encendido: siempre desde un gesto. */
export function activateSound() {
  const first = !prefs.decided;
  update(first ? { on: true, decided: true, ambienceId: 'none', musicId: 'tarde' } : { on: true, decided: true });
  unlock();
}

export function setSoundOn(on) {
  if (on) {
    activateSound();
    return;
  }
  update({ on: false, decided: true });
  apply();
}

/** Volumen de un canal (0–100). Solo toca nodos de audio; la escena no se entera. */
export function setChannelLevel(channel, value) {
  update({ [channel]: clamp(value) });
  applyFlags();
  publishMirror();
  if (!unlocked || !prefs.on) return;
  const shared = audioGraph();
  if (shared) setChannelGains(shared);
  if (channel === 'ambience' && prefs.ambienceId === 'escena') setAmbienceVolume(prefs.ambience / 100);
}

/** `kind`: 'ambienceId' | 'musicId'. Una selección explícita vuelve a intentar un archivo que falló. */
export function chooseTrack(kind, id) {
  failed.delete(id);
  const channel = kind === 'ambienceId' ? 'ambience' : 'music';
  errors = { ...errors, [channel]: null };
  const last = kind === 'ambienceId' ? 'lastAmbience' : 'lastMusic';
  update({ [kind]: id, ...(id !== 'none' ? { [last]: id } : null) });
  apply();
}

/** Tras volver a la app sin permiso para seguir sonando: el botón de Sonido, que es un gesto. */
export function resumeSound() {
  needsTap = false;
  emit();
  unlock();
}

/** Los interruptores antiguos (auriculares, radio, cuenta) siguen funcionando: mandan sobre el ambiente y la música de este controlador. */
export function setBackgroundSound(next) {
  if (next === backgroundOn()) {
    unlock();
    return;
  }
  if (next) update({ on: true, decided: true, ambienceId: prefs.lastAmbience, musicId: prefs.legacy ? prefs.musicId : prefs.lastMusic });
  else update({ ambienceId: 'none', musicId: 'none' });
  unlock();
}

/** ¿Ha empezado ya a sonar? Hasta el primer gesto el navegador no deja. */
export const soundStarted = () => unlocked;

export function adoptSettings({ sound, sfx, uiVolume }) {
  if (!mirror) return;
  // Hasta que los ajustes antiguos reflejan lo último publicado, lo que llega es el valor anterior, no una decisión
  if (!synced) {
    if (sound === mirror.sound && sfx === mirror.sfx && uiVolume === mirror.uiVolume) synced = true;
    return;
  }
  if (sound !== mirror.sound) setBackgroundSound(sound);
  if (sfx !== mirror.sfx) {
    update({ on: sfx || prefs.on, effects: sfx ? prefs.effects || 25 : 0, decided: true });
    apply();
  } else if (uiVolume !== mirror.uiVolume && sfx) setChannelLevel('effects', uiVolume * 100);
}

/** Quien lleva los ajustes antiguos recibe aquí los cambios. */
export function connectSettings(fn) {
  onMirror = fn;
  mirror = null;
  publishMirror();
  return () => {
    onMirror = null;
  };
}

/** Otra música propia del sitio (el edificio, la radio): la del controlador se calla sin perder su punto. */
export function setMusicBlocked(reason, blocked) {
  if (blocked) blockers.add(reason);
  else blockers.delete(reason);
  if (!unlocked || !prefs.on) return;
  const shared = audioGraph();
  if (shared) setChannelGains(shared);
}

function onVisibility() {
  const live = buses.music?.context ?? buses.ambience?.context;
  if (!live) return;
  if (document.hidden) {
    wasRunning = live.state === 'running';
    if (wasRunning) live.suspend().catch(() => {});
    return;
  }
  if (!wasRunning || !prefs.on) return;
  wasRunning = false;
  live
    .resume()
    .then(() => {
      if (live.state !== 'running') throw new Error('sin permiso');
    })
    .catch(() => {
      needsTap = true;
      unlocked = false;
      window.addEventListener('pointerdown', unlock, true);
      window.addEventListener('keydown', unlock, true);
      emit();
    });
}

if (typeof window !== 'undefined') {
  applyFlags();
  try {
    if (localStorage.getItem(KEY) === null) localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Sin almacenamiento
  }
  // Quien ya lo tenía encendido: empieza con su primer gesto, como antes. Sin preferencias no hay ningún escuchador
  if (prefs.on) {
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', flush);
  onRadioChange(() => setMusicBlocked('radio', isRadioOn()));
  if (import.meta.env?.DEV) {
    window.__portAudio = () => ({
      prefs: { ...prefs },
      unlocked,
      state: buses.music?.context.state ?? null,
      starts,
      musica: playing.music?.id ?? null,
      ambiente: playing.ambience?.id ?? null,
      fundiendo: Number(Boolean(fading.music)) + Number(Boolean(fading.ambience)),
      bloqueos: [...blockers],
      buffers: [...buffers.keys()],
      needsTap,
      errors,
    });
  }
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const useSoundState = () => useSyncExternalStore(subscribe, () => snapshot);
