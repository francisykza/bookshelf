// Iconos de píxel del café (1.120.1): el retrato de Pilar, la taza y el grano del marcador, y un icono por mueble para la
// balda de Decorar. Cada icono es una cuadrícula de letras (una por píxel, «.» transparente) con su paleta; se dibuja como
// SVG con bordes duros, sin suavizar. Dibujos propios.

export const PILAR = {
  paleta: { h: '#6b3f24', H: '#8a5532', s: '#e9b88f', g: '#1f1612', e: '#cfd6dc', k: '#e58a7a', m: '#9c4a3c', j: '#c99a2e', J: '#a87c1e', a: '#4c6e50' },
  filas: [
    '................',
    '.....hhhhhh.....',
    '....hHHHHHHh....',
    '...hHHhhhhHHh...',
    '...hhsssssshh...',
    '...hssssssssh...',
    '...hggggsggggh..',
    '...hgeegsgeegh..',
    '...hggggsggggh..',
    '...hskssssskh...',
    '....ssssmssss...',
    '.....ssssss.....',
    '...jjjjsssjjjj..',
    '..jJjjaaaajjJj..',
    '.jjJjjaaaajjJjj.',
    '.jjjjjaaaajjjjj.',
  ],
};

export const TAZA = {
  paleta: { s: '#a8977c', c: '#3a2418', K: '#5a3422', W: '#f3e6c8', w: '#cdb98e', p: '#e7b765', P: '#a87c34' },
  filas: [
    '....s...s.....',
    '...s...s......',
    '....s...s.....',
    '...s...s......',
    '..............',
    '.cccccccccc...',
    '.cKKKKKKKKc...',
    '.cWWWWWWWWccc.',
    '.cWWWWWWWWc.c.',
    '.cWWWWWWWWc.c.',
    '.cwWWWWWWWccc.',
    '..cwwwwwwc....',
    'pppppppppppp..',
    '.PPPPPPPPPP...',
  ],
};

export const GRANO = {
  paleta: { b: '#2a160e', B: '#9a6238', d: '#3a1e10', l: '#c88a56' },
  filas: ['..bbbb..', '.bBBBBb.', 'bBlBdBBb', 'bBlBdBBb', 'bBlBdBBb', 'bBBBdBBb', 'bBBBdBBb', 'bBBBdBBb', '.bBBBBb.', '..bbbb..'],
};

const MESA = {
  paleta: { w: '#f4efe4', W: '#d9d2c4', g: '#a49a8a', k: '#2e2826', t: '#ffffff' },
  filas: [
    '................',
    '................',
    '........tt......',
    '....wwwwwwww....',
    '..wwWWWWWWWWww..',
    '..wWWWWWWWWWWw..',
    '...gggggggggg...',
    '.......kk.......',
    '.......kk.......',
    '.......kk.......',
    '.......kk.......',
    '.......kk.......',
    '.......kk.......',
    '.....kkkkkk.....',
    '....kk....kk....',
    '................',
  ],
};
const SILLA = {
  paleta: { d: '#3e2618', b: '#74482c', c: '#d4b47a' },
  filas: [
    '................',
    '....dddddddd....',
    '...d........d...',
    '...d.dddddd.d...',
    '...d........d...',
    '...d.dddddd.d...',
    '...d........d...',
    '...dbbbbbbbbd...',
    '...bccccccccb...',
    '...dbbbbbbbbd...',
    '...d........d...',
    '...d........d...',
    '...d........d...',
    '...d........d...',
    '..dd........dd..',
    '................',
  ],
};
const TABURETE = {
  paleta: { r: '#6e221c', R: '#a83a30', y: '#d6a65a', Y: '#a87c34' },
  filas: [
    '................',
    '................',
    '................',
    '....rrrrrrrr....',
    '...rRRRRRRRRr...',
    '...rrrrrrrrrr...',
    '....y......Y....',
    '....y......Y....',
    '....y......Y....',
    '....yyyyyyyY....',
    '....y......Y....',
    '....y......Y....',
    '....y......Y....',
    '....y......Y....',
    '...yy......YY...',
    '................',
  ],
};
const ESTANTERIA = {
  paleta: { d: '#3e2618', b: '#74482c', 1: '#a83a30', 2: '#3c5a78', 3: '#c8a860', 4: '#4e6e50', 5: '#76466e', 6: '#d2c4aa' },
  filas: [
    '................',
    '................',
    'dddddddddddddddd',
    'd..............d',
    'd1223.41.55623.d',
    'd1223.41.55623.d',
    'dbbbbbbbbbbbbbbd',
    'd.3.4122.61354.d',
    'd.3.4122.61354.d',
    'dbbbbbbbbbbbbbbd',
    'd14.236.5.2141.d',
    'd14.236.5.2141.d',
    'dbbbbbbbbbbbbbbd',
    'dd............dd',
    '................',
    '................',
  ],
};
const LAMPARA = {
  paleta: { o: '#b8742a', O: '#ffd27e', L: '#fff0c2', y: '#d6a65a', Y: '#8a6a34' },
  filas: [
    '.....oooooo.....',
    '....oOOLLOOo....',
    '...oOOLLLLOOo...',
    '...oOOOOOOOOo...',
    '...oooooooooo...',
    '.......yy.......',
    '.......yY.......',
    '.......yY.......',
    '.......yY.......',
    '.......yY.......',
    '.......yY.......',
    '.......yY.......',
    '.......yY.......',
    '.....yyyyyy.....',
    '....YYYYYYYY....',
    '................',
  ],
};
const MESA_BAJA = {
  paleta: { b: '#9a6a40', B: '#c08a58', d: '#5e3c24' },
  filas: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..BBBBBBBBBBBB..',
    '.bBBBBBBBBBBBBb.',
    '.bbbbbbbbbbbbbb.',
    '..d..........d..',
    '..d..........d..',
    '..d..........d..',
    '..d..........d..',
    '..dd........dd..',
    '................',
    '................',
  ],
};
const LAMPARA_PIE = {
  paleta: { o: '#cbb488', O: '#f3e6c8', y: '#6e5a40', Y: '#4a3c2a' },
  filas: [
    '.....oooooo.....',
    '....oOOOOOOo....',
    '...oOOOOOOOOo...',
    '..oOOOOOOOOOOo..',
    '..oooooooooooo..',
    '.......yy.......',
    '.......yY.......',
    '.......yY.......',
    '.......yY.......',
    '.......yY.......',
    '.......yY.......',
    '.......yY.......',
    '.......yY.......',
    '.....yyyyyy.....',
    '....YYYYYYYY....',
    '................',
  ],
};
const CAJA = {
  paleta: { c: '#b88e5c', C: '#d4aa74', d: '#7e5a36', t: '#ecdcb0' },
  filas: [
    '................',
    '................',
    '................',
    '................',
    '..dddddddddddd..',
    '..dCCCCttCCCCd..',
    '..dCCCCttCCCCd..',
    '..dddddttddddd..',
    '..dcccctccccd...',
    '..dccccttccccd..',
    '..dccccttccccd..',
    '..dccccttccccd..',
    '..dccccttccccd..',
    '..dddddddddddd..',
    '................',
    '................',
  ],
};

// ── Bloque 4a (1.122): los muebles de los niveles 2 y 3 y de los hitos ──
const MACETA = {
  paleta: { k: '#2a1a10', b: '#b06040', B: '#d0805a', h: '#4e7c4a', H: '#70a05c', l: '#9cc47a' },
  filas: [
    '................',
    '................',
    '......kkkk......',
    '.....klHHlk.....',
    '....kHHlHHHk....',
    '...kHhHHHhHHk...',
    '...khHhHHHhHk...',
    '....khhHhhhk....',
    '....kkkkkkkk....',
    '....kBBBBBBk....',
    '.....kbbbbk.....',
    '.....kbbbbk.....',
    '.....kbbbbk.....',
    '......kkkk......',
    '................',
    '................',
  ],
};
const BANCO = {
  paleta: { k: '#2a1a10', m: '#74482c', M: '#a8764a', v: '#607860', V: '#86a07e' },
  filas: [
    '................',
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kmmmmmmmmmmmmk.',
    '.kVvVvVvVvVvVvk.',
    '.kvVvVvVvVvVvVk.',
    '.kVvVvVvVvVvVvk.',
    '.kkkkkkkkkkkkkk.',
    '.kVVVVVVVVVVVVk.',
    '.kMMMMMMMMMMMMk.',
    '.kmkkkkmmkkkkmk.',
    '.kmk..kmmk..kmk.',
    '.kkk..kkkk..kkk.',
    '................',
    '................',
  ],
};
const VITRINA = {
  paleta: { k: '#2a1a10', l: '#d6a65a', c: '#fff0d0', t: '#ecce9c', f: '#c4464c', m: '#5a3420', M: '#7a4a2e' },
  filas: [
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    '.klllllllllllll.',
    '.klcccccccccclk.',
    '.klcfccccfccclk.',
    '.klttcckkcttclk.',
    '.klttcckkcttclk.',
    '.klllllllllllll.',
    '.kMMMMMMMMMMMMk.',
    '.kMmmmmmmmmmmMk.',
    '.kMmmmmmmmmmmMk.',
    '.kMMMMMMMMMMMMk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ],
};
const PLANTA = {
  paleta: { k: '#2a1a10', h: '#4e7c4a', H: '#70a05c', l: '#9cc47a', t: '#6a4e34', p: '#c8baa0', P: '#a89880' },
  filas: [
    '.....kk..kk.....',
    '....kHlk.kHk....',
    '..kkHHlkkHlHk...',
    '.kHlHhkHlHhHlk..',
    '.khHHkHHhkHHhk..',
    '..khkHhHHkhkk...',
    '..kkHhkthHhk....',
    '....kk.tk.kk....',
    '.......tk.......',
    '.......tk.......',
    '....kkkkkkkk....',
    '....kppppppk....',
    '....kPPPPPPk....',
    '.....kPPPPk.....',
    '.....kkkkkk.....',
    '................',
  ],
};
const PERCHERO = {
  paleta: { k: '#2a1a10', m: '#74482c', M: '#a8764a', a: '#80543c', A: '#a87050', r: '#c04646' },
  filas: [
    '.......kk.......',
    '.....kkMMkk.....',
    '....kMkMMkMk....',
    '...kAAkmmk.r....',
    '...kAAAkmkkr....',
    '...kAAAkmk.r....',
    '...kAaAkmk.k....',
    '...kAaAkmk......',
    '...kAaAkmk......',
    '....kkkkmk......',
    '.......kmk......',
    '.......kmk......',
    '.......kmk......',
    '.....kkkmkkk....',
    '....kMMMMMMMk...',
    '....kkkkkkkkk...',
  ],
};
const ESTANTERIA_ALTA = {
  paleta: { k: '#2a1a10', m: '#74482c', M: '#a8764a', r: '#963c34', a: '#3c5a78', y: '#c8a860', g: '#4e6e50' },
  filas: [
    '.kkkkkkkkkkkkkk.',
    '.kMMMMMMMMMMMMk.',
    '.kmrayrgkmaryak.',
    '.kmrayrgkmaryak.',
    '.kMMMMMMMMMMMMk.',
    '.kmgyarkkmrgyak.',
    '.kmgyarkkmrgyak.',
    '.kMMMMMMMMMMMMk.',
    '.kmayrgakmygrak.',
    '.kmayrgakmygrak.',
    '.kMMMMMMMMMMMMk.',
    '.kmrgyakkmaygrk.',
    '.kmrgyakkmaygrk.',
    '.kMMMMMMMMMMMMk.',
    '.kmk........kmk.',
    '.kkk........kkk.',
  ],
};
const OREJERO = {
  paleta: { k: '#2a1a10', c: '#8e322c', C: '#b44a40', l: '#d6a65a', m: '#5a3420' },
  filas: [
    '................',
    '...kkkkkkkkkk...',
    '..kCCkCCCCkCCk..',
    '..kCCkClClkCCk..',
    '..kCCkCCCCkCCk..',
    '..kCCkClClkCCk..',
    '..kCckCCCCkcCk..',
    '.kkkkkkkkkkkkkk.',
    '.kCCkCCCCCCkCCk.',
    '.kccCCCCCCCCcck.',
    '.kcckkkkkkkkcck.',
    '.kcccccccccccck.',
    '.kkkkkkkkkkkkkk.',
    '..kmk......kmk..',
    '..kkk......kkk..',
    '................',
  ],
};
const MESITA = {
  paleta: { k: '#2a1a10', m: '#74482c', M: '#a8764a', l: '#d6a65a', L: '#ffe0a8', a: '#3c5a78', y: '#c8a860' },
  filas: [
    '................',
    '.........kk.....',
    '........kLLk....',
    '........kLLk....',
    '...kkkk.kLLk....',
    '...kyyyk.kk.....',
    '..kaaaaak.kll...',
    '.kkkkkkkkkkkkkk.',
    '.kMMMMMMMMMMMMk.',
    '.kkmkkkkkkkkmkk.',
    '..kmk......kmk..',
    '..kmkkkkkkkkmk..',
    '..kmMMMMMMMMmk..',
    '..kmkkkkkkkkmk..',
    '..kkk......kkk..',
    '................',
  ],
};
const RELOJ = {
  paleta: { k: '#2a1a10', m: '#5c3a26', M: '#8a5a3a', c: '#f0e6cc', l: '#d6a65a', d: '#3c281e' },
  filas: [
    '.....kkkkkk.....',
    '....kMMMMMMk....',
    '...kMkkkkkkMk...',
    '...kMkcckckMk...',
    '...kMkckkckMk...',
    '...kMkcccckMk...',
    '...kMkkkkkkMk...',
    '...kmkddddkmk...',
    '...kmkddldkmk...',
    '...kmkddldkmk...',
    '...kmkdlllkmk...',
    '...kmkddddkmk...',
    '...kmkkkkkkmk...',
    '...kMMMMMMMMk...',
    '..kkkkkkkkkkkk..',
    '................',
  ],
};

// ── Bloque 4b (1.123): los muebles del ala lateral y de la terraza ──
const MESA_LARGA = {
  paleta: { m: '#7a4a2c', M: '#a8774a', L: '#c89a62', l: '#ded2ba', w: '#f4efe4', k: '#2a1a10' },
  filas: [
    '................',
    '................',
    '................',
    '...w........w...',
    '..wkw......wkw..',
    'LLLLLLLLLLLLLLLL',
    'MlllllllllllllMM',
    'MMMMMMMMMMMMMMMM',
    '.mm..........mm.',
    '.mm..........mm.',
    '.mmmmmmmmmmmmmm.',
    '.mm..........mm.',
    '.mm..........mm.',
    'mmmm........mmmm',
  ],
};
const BIOMBO = {
  paleta: { m: '#5a3420', M: '#8a5a38', L: '#b88a5a', r: '#b8574a', v: '#4f7a54', a: '#d6a548', z: '#56708e', o: '#d6a65a' },
  filas: [
    'LLLLL.LLLLL.LLLL',
    'MrvaM.MazrM.MvaM',
    'MrvaMoMazrMoMvaM',
    'MLLLM.MLLLM.MLLM',
    'MazvM.MrvzM.MzrM',
    'MazvM.MrvzM.MzrM',
    'MLLLM.MLLLM.MLLM',
    'MMMMMoMMMMMoMMMM',
    'M...M.M...M.M..M',
    'M...M.M...M.M..M',
    'MMMMM.MMMMM.MMMM',
    'm...m.m...m.m..m',
  ],
};
const BANKERS = {
  paleta: { g: '#2f6e48', G: '#5cb47a', y: '#ffe0a0', b: '#c99a4a', B: '#e8c27a', m: '#6b4228', M: '#9a6a42' },
  filas: [
    '..............',
    '...GGGGGGGG...',
    '..gGGGGGGGGg..',
    '.gggggggggggg.',
    '..yyyyyyyyyy..',
    '......bb......',
    '......bb..B...',
    '......bb..b...',
    '....BBBBBB....',
    'MMMMMMMMMMMMMM',
    'mmmmmmmmmmmmmm',
    '......mm......',
    '......mm......',
    '....mmmmmm....',
  ],
};
const PIANO = {
  paleta: { n: '#4a2c1c', N: '#6e4630', L: '#a8774a', w: '#f4efe4', k: '#1a1414', p: '#e8dcc0', y: '#ffd68c', c: '#8e3a32' },
  filas: [
    'LLLLLLLLLLLLLLLL',
    'NNNNNNNNNNNNNNNN',
    'NyNNNppppppNNNyN',
    'NnNNNppppppNNNnN',
    'NNNNNNNNNNNNNNNN',
    'NNNNNNNNNNNNNNNN',
    'nwkwkwwkwkwkwwkn',
    'nwwwwwwwwwwwwwwn',
    'nnnnnnnnnnnnnnnn',
    'nNNNNNNNNNNNNNNn',
    'nNNNNNccccNNNNNn',
    'nNNNNNn..nNNNNNn',
    'nn....n..n....nn',
  ],
};
const MESA_HIERRO = {
  paleta: { v: '#2c463a', V: '#46684f', G: '#6e9478', w: '#f4efe4', k: '#2a1a10' },
  filas: [
    '..............',
    '..............',
    '......w.......',
    '.....wkw......',
    'GGGGGGGGGGGGGG',
    'VvVvVvVvVvVvVV',
    'VVVVVVVVVVVVVV',
    '.v..........v.',
    '.v..........v.',
    '.vvvvvvvvvvvv.',
    '.v..........v.',
    '.v..........v.',
    'vv..........vv',
  ],
};
const SILLA_TERRAZA = {
  paleta: { v: '#2c463a', V: '#46684f', G: '#6e9478' },
  filas: [
    '..vvvvvvvv....',
    '..vGGGGGGv....',
    '..vG.VV.Gv....',
    '..vGVGGVGv....',
    '..vG.VV.Gv....',
    '..vGGGGGGv....',
    '..v......v....',
    '..GGGGGGGGGG..',
    '..VVVVVVVVVV..',
    '..v.......v...',
    '..v.......v...',
    '..v.......v...',
    '.vv.......vv..',
  ],
};
const MACETERO = {
  paleta: { m: '#5a3a2a', M: '#8a6448', L: '#b88a5a', h: '#56785a', H: '#86b07a', p: '#9278ba', P: '#b8a0dc', a: '#e2c46e' },
  filas: [
    '..P...p..P..a...',
    '.pP..Pp.aP..pP..',
    '.ph.pPh.ah.pPh..',
    '..hHph.hH.Hph.p.',
    '..hHhh.hHhhHhhPp',
    '.HhhHhHhhHhhHhh.',
    'LLLLLLLLLLLLLLLL',
    'MMMMMMMMMMMMMMMM',
    'MmMMMMmMMMMmMMMM',
    'MmMMMMmMMMMmMMMM',
    'MMMMMMMMMMMMMMMM',
    'mmmmmmmmmmmmmmmm',
  ],
};
const FAROL = {
  paleta: { k: '#2e2a2c', K: '#4a4446', y: '#ffe0a0', Y: '#ffc870', b: '#d6a65a' },
  filas: [
    '......b.......',
    '.....kkk......',
    '....kkkkk.....',
    '...kyYkYyk....',
    '...kYykyYk....',
    '...kyYkYyk....',
    '...kkkkkkk....',
    '..K..kk..K....',
    '...KKkkKK.....',
    '......kk......',
    '......kk......',
    '.....kkkk.....',
    '......kk......',
    '....kkkkkk....',
  ],
};
// Bloque 6a (1.125): los de la bodega
const BARRICA = {
  paleta: { d: '#5c3a24', m: '#80522f', l: '#a8784a', k: '#403a38', w: '#f0e6ce', y: '#ffd27a' },
  filas: [
    '.....y........',
    '.....w........',
    '..dddddddddd..',
    '.llllllllllll.',
    '..kkkkkkkkkk..',
    '..mmlmmlmmlm..',
    '.mmmlmmlmmlmm.',
    '.kkkkkkkkkkkk.',
    '.mmmlmmlmmlmm.',
    '.mmmlmmlmmlmm.',
    '..kkkkkkkkkk..',
    '..mmlmmlmmlm..',
    '...dddddddd...',
  ],
};
const BANCO_BODEGA = {
  paleta: { d: '#5c3a24', m: '#80522f', l: '#a8784a', a: '#aa8c62', k: '#403a38' },
  filas: [
    '................',
    '.d............d.',
    '.dmmmmmmmmmmmmd.',
    '.dmmmmmmmmmmmmd.',
    '.d............d.',
    '..aaaaaa.aaaaaa.',
    'llllllllllllllll',
    'dddddddddddddddd',
    '.mmmm......mmmm.',
    '.kkkk......kkkk.',
    '.mmmm......mmmm.',
    '.mmmm......mmmm.',
    '.dddd......dddd.',
  ],
};
const SACO = {
  paleta: { d: '#94744a', m: '#b08e5e', l: '#c4a674', k: '#5c3c2c', g: '#5c3620' },
  filas: [
    '..............',
    '..............',
    '..............',
    '...lllllll....',
    '..lmmmmmmmlk..',
    '.lmmmdmmmmmkk.',
    '.mmkmdmkmmmlk.',
    '.mmmmdmmmmmkk.',
    '.mmmmdmmmmml..',
    '.dmmmdmmmmmd..',
    '..ddddddddd...',
    'g...........g.',
  ],
};
// Bloque 6c (1.129): los de la sala de catas
const BUTACA = {
  paleta: { d: '#56321f', m: '#76462a', l: '#925c38', k: '#3c2416', y: '#cea45a' },
  filas: [
    '..............',
    '...llllllll...',
    '..lmmmmmmmmm..',
    '..mmdmmdmmdm..',
    '..mmmmmmmmmm..',
    'llmmdmmdmmdmll',
    'lmlllllllllmml',
    'mmmmmmmmmmmmmm',
    'mmddddddddddmm',
    'ymddddddddddmy',
    '.k..........k.',
    '..............',
  ],
};
const MESA_CATAS = {
  paleta: { d: '#5c3a24', m: '#80522f', l: '#9e6a42', w: '#ece6d8', c: '#6e4226', g: '#c4c4c0', o: '#b8683e' },
  filas: [
    '..............',
    '..............',
    '...........o..',
    '..........ooo.',
    '.ww.ww.ww.ooo.',
    '.wc.wc.wc.ooo.',
    'llllllllllllll',
    'mmmmmmmmmmmmmm',
    '.d..........d.',
    '.d..........d.',
    '.d..........d.',
    '..............',
  ],
};
const MAPA = {
  paleta: { d: '#5c3a24', m: '#80522f', p: '#d6c6a0', t: '#b0966a', v: '#607850', r: '#c4342c' },
  filas: [
    'mmmmmmmmmmmmmm',
    'mppppppppppppm',
    'mpttpppttpttpm',
    'mpttpptttpttpm',
    'mvvrvvvvrvvrvm',
    'mpttppttpppppm',
    'mpppppttpptppm',
    'mmmmmmmmmmmmmm',
    '.d....d....d..',
    '.d...d.....d..',
    '.d..d.......d.',
    '.d.d........d.',
  ],
};
const LATAS = {
  paleta: { d: '#5c3a24', m: '#80522f', r: '#a8342c', v: '#345c4a', y: '#c4964a', a: '#2c4070', s: '#c4c4c0' },
  filas: [
    'd............d',
    'dssss..ssssssd',
    'drrrr..yyyvvvd',
    'drrrr..yyyvvvd',
    'dmmmmmmmmmmmmd',
    'd.sss.ssss.ssd',
    'd.vvv.aaaa.rrd',
    'd.vvv.aaaa.rrd',
    'dmmmmmmmmmmmmd',
    'dsss.sss.sss.d',
    'dyyy.rrr.aaa.d',
    'dmmmmmmmmmmmmd',
  ],
};
const CANDIL = {
  paleta: { k: '#363032', K: '#544c4c', y: '#ffe0a0', Y: '#ffb860' },
  filas: [
    '..kkkkkkk.....',
    '..k.....k.....',
    '..k.kk..k.....',
    '..k.....k.....',
    '..k....kkk....',
    '..k...KkkkY...',
    '..k....kk.y...',
    '..k...........',
    '.kkk..........',
    '..k...........',
    '..k...........',
    '..k...........',
    '.k.k..........',
    'k...k.........',
  ],
};

/** Bloque 6a: subir al café desde la bodega (una escalera de piedra con su flecha). */
export const SUBIR = {
  paleta: { p: '#8a7e70', P: '#b4a690', m: '#4a3a30', y: '#ffd27a', Y: '#e7b765' },
  filas: [
    '.........yy...',
    '........yyyy..',
    '.......yyyyyy.',
    '.........yy...',
    '.........yy...',
    '........PPPPP.',
    '........ppppp.',
    '.....PPPPpppp.',
    '.....ppppmppp.',
    '..PPPPpppmppp.',
    '..ppppmpppppp.',
    'PPPpppmpppppp.',
    'pppmpppppmppp.',
    'mmmmmmmmmmmmm.',
  ],
};

const POR_MUEBLE = {
  'cafe-mesa': MESA,
  'cafe-silla': SILLA,
  'cafe-taburete': TABURETE,
  'cafe-estanteria': ESTANTERIA,
  'cafe-lampara': LAMPARA,
  'mesa-baja': MESA_BAJA,
  'lampara-pie': LAMPARA_PIE,
  'cafe-maceta': MACETA,
  'cafe-banco': BANCO,
  'cafe-vitrina': VITRINA,
  'cafe-planta': PLANTA,
  'cafe-perchero': PERCHERO,
  'cafe-estanteria-alta': ESTANTERIA_ALTA,
  'cafe-orejero': OREJERO,
  'cafe-mesita': MESITA,
  'cafe-reloj': RELOJ,
  'cafe-mesa-larga': MESA_LARGA,
  'cafe-biombo': BIOMBO,
  'cafe-bankers': BANKERS,
  'cafe-piano': PIANO,
  'cafe-mesa-hierro': MESA_HIERRO,
  'cafe-silla-terraza': SILLA_TERRAZA,
  'cafe-macetero': MACETERO,
  'cafe-farol': FAROL,
  'cafe-barrica': BARRICA,
  'cafe-banco-bodega': BANCO_BODEGA,
  'cafe-candil': CANDIL,
  'cafe-saco': SACO,
  'cafe-latas': LATAS,
  'cafe-butaca': BUTACA,
  'cafe-mesa-catas': MESA_CATAS,
  'cafe-mapa': MAPA,
};
/** El icono de un mueble del café o de casa (los de casa sin dibujo propio, una caja). */
export const iconoDe = (id) => POR_MUEBLE[id] ?? CAJA;

// ── Bloque 3 (1.121): el corazón de «¡justo lo que buscaba!», la tetera, la pizarra y el retrato de cada cliente ──
export const CORAZON = {
  paleta: { r: '#d8485a', R: '#ff8a96', d: '#7a1e2c' },
  filas: ['.dd...dd.', 'dRrd.drrd', 'dRrrdrrrd', 'drrrrrrrd', '.drrrrrd.', '..drrrd..', '...drd...', '....d....'],
};

export const TETERA = {
  paleta: { c: '#2e3a2a', g: '#6e8e62', G: '#9cbc88', l: '#d6a65a', s: '#a8977c' },
  filas: [
    '..............',
    '......s.......',
    '.....s........',
    '......ll......',
    '....cccccc....',
    '...cGGggggc...',
    'cccGGgggggcccc',
    'c.cGggggggc..c',
    'c.cgggggggc.c.',
    '.ccgggggggcc..',
    '...cggggggc...',
    '....cccccc....',
    '..............',
    '..............',
  ],
};

export const PIZARRA = {
  paleta: { m: '#7a5232', M: '#a8774a', p: '#2f4a3a', t: '#e8efe4', T: '#9fb8a6' },
  filas: ['mmmmmmmmmmmm', 'MppppppppppM', 'MpttttpTTppM', 'MppppppppppM', 'MptttTTtpppM', 'MppppppppppM', 'MpTTtttppppM', 'MppppppppppM', 'mmmmmmmmmmmm', '.m........m.', 'm..........m'],
};

const PIELES_RGB = ['#fad8b8', '#ecc098', '#ce986e', '#a26c4a', '#704a32'];
const PELO_RGB = ['#462e20', '#7e5030', '#d6ac62', '#b85430', '#2a262c', '#cccace', '#dea0b0', '#3a4870'];
const JERSEY_RGB = ['#809670', '#b86246', '#cc9e46', '#56708e', '#ce908c', '#e8dabe', '#6e4a68', '#484e5c', '#3e6248', '#96323a', '#a092be', '#346878'];
const oscuro = (hex, k = 0.75) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};
/** El retrato de píxel de un cliente, sacado de su aspecto (piel, pelo y su color, gafas y jersey), sobre la plantilla de Pilar. */
export function retratoDe(a = {}) {
  const largo = ['melena', 'largo', 'rizos', 'mono'].includes(a.pelo);
  const filas = PILAR.filas.map((f, y) => {
    let r = f;
    if (!a.gafas && y >= 6 && y <= 8) r = y === 7 ? '...hsdssssdssh..' : '...hsssssssssh..';
    if (!largo && y >= 5) r = r.replace(/h/g, '.');
    if (a.pelo === 'rapado' && y >= 3 && y <= 4) r = r.replace(/H/g, 'h');
    return r.replace(/a/g, 'A');
  });
  if (a.pelo === 'mono') filas[0] = '......hHHh......';
  if (a.pelo === 'rizos') filas[1] = '....hHhhhHh.....';
  const jersey = JERSEY_RGB[a.jersey] ?? JERSEY_RGB[0];
  return {
    filas,
    paleta: {
      h: oscuro(PELO_RGB[a.colorPelo] ?? PELO_RGB[1], 0.8),
      H: PELO_RGB[a.colorPelo] ?? PELO_RGB[1],
      s: PIELES_RGB[a.piel] ?? PIELES_RGB[1],
      g: '#1f1612',
      e: '#cfd6dc',
      d: '#1f1612',
      k: '#e58a7a',
      m: '#9c4a3c',
      j: jersey,
      J: oscuro(jersey),
      A: oscuro(jersey, 0.9),
    },
  };
}
/** Tus libros del café (§121.3): tres lomos en una balda, para el botón del HUD. */
export const LIBROS = {
  paleta: { r: '#b8574a', R: '#e08a6e', v: '#4f7a54', V: '#86b07a', a: '#d6a548', A: '#f2d27a', m: '#7a5232', M: '#a8774a', k: '#2a1a10' },
  filas: ['............', '.kkk........', '.kRk.kkk....', '.krk.kVk.kkk', '.kRk.kvk.kAk', '.krk.kVk.kak', '.krk.kvk.kAk', '.kRk.kvk.kak', '.krk.kVk.kak', 'MMMMMMMMMMMM', 'mmmmmmmmmmmm'],
};
