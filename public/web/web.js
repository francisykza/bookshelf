// La web de Libotown (26-11-2026). Sin librerías. El sonido empieza apagado y solo suena tras activarlo a mano.
// Con movimiento reducido: sin zoom de la portada ni animaciones; los juegos siguen funcionando.
(function () {
  'use strict';
  // Si llegas desde libotown.es (el arranque de la app te ha traído: aún no la usas en este navegador), la dirección se queda en
  // la raíz. Al recargar vuelves aquí por el mismo camino. Entrando directo a /web/, la dirección no cambia.
  try {
    if (/^\?raiz$/.test(location.search)) history.replaceState(null, '', '/' + location.hash);
  } catch (e) { /* se queda en /web/ */ }
  var reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var punteroFino = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  document.documentElement.classList.add('js');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var limita = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  // ---------- Sonido sintetizado (apagado hasta que se toca el altavoz) ----------
  var ctx = null, ruido = null, sonidoOn = false;
  var botonSonido = $('#sonido');
  function prepara() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    ruido = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    var d = ruido.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function tono(f, dur, tipo, vol, f2, retraso) {
    var t = ctx.currentTime + (retraso || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.06, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  function soplo(dur, frec, vol, retraso) {
    var t = ctx.currentTime + (retraso || 0);
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruido;
    f.type = 'bandpass';
    f.frequency.value = frec || 1200;
    f.Q.value = 1.2;
    g.gain.setValueAtTime(vol || 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(ctx.destination);
    s.start(t);
    s.stop(t + dur + 0.02);
  }
  var SONIDOS = {
    clic: function () { tono(1100, 0.04, 'square', 0.02); },
    pop: function () { tono(420, 0.12, 'sine', 0.06, 860); },
    molino: function () { soplo(0.05, 2400, 0.05); tono(180, 0.04, 'square', 0.012); },
    golpe: function () { tono(150, 0.16, 'sine', 0.1, 70); soplo(0.08, 500, 0.04); },
    palanca: function () { tono(300, 0.1, 'triangle', 0.05, 200); },
    gota: function () { tono(900, 0.06, 'sine', 0.025, 500); },
    ding: function () { tono(1320, 0.7, 'sine', 0.05); tono(1980, 0.5, 'sine', 0.025, null, 0.02); },
    estrella: function (n) { for (var i = 0; i < n; i++) tono([784, 988, 1175][i], 0.25, 'triangle', 0.05, null, i * 0.16); },
    miau: function () { tono(650, 0.12, 'sine', 0.05, 900); tono(900, 0.22, 'sine', 0.05, 520, 0.12); },
    baraja: function () { soplo(0.09, 3000, 0.035); },
    flojo: function () { tono(330, 0.18, 'triangle', 0.04, 247); },
    libro: function () { tono(200, 0.08, 'triangle', 0.06, 120); soplo(0.06, 900, 0.03); },
  };
  function suena(nombre, arg) {
    if (!sonidoOn || !ctx) return;
    try { SONIDOS[nombre](arg); } catch (e) { /* sin sonido, sin más */ }
  }
  // <ambiente> Lluvia suave en la ventana y la chimenea encendida, muy bajito (solo con el sonido activado)
  function creaAmbiente(ac, destino) {
    var sr = ac.sampleRate;
    var blanco = ac.createBuffer(1, sr * 2, sr), marron = ac.createBuffer(1, sr * 2, sr);
    var b = blanco.getChannelData(0), m = marron.getChannelData(0), ultimo = 0;
    for (var i = 0; i < b.length; i++) {
      b[i] = Math.random() * 2 - 1;
      ultimo = (ultimo + 0.02 * b[i]) / 1.02;
      m[i] = ultimo * 3.5;
    }
    var maestro = ac.createGain();
    maestro.gain.setValueAtTime(0.0001, ac.currentTime);
    maestro.gain.exponentialRampToValueAtTime(1, ac.currentTime + 2.5);
    maestro.connect(destino);
    // la lluvia: ruido filtrado que va y viene despacio
    var lluvia = ac.createBufferSource(); lluvia.buffer = blanco; lluvia.loop = true;
    var paso = ac.createBiquadFilter(); paso.type = 'highpass'; paso.frequency.value = 700;
    var techo = ac.createBiquadFilter(); techo.type = 'lowpass'; techo.frequency.value = 3200;
    var gLluvia = ac.createGain(); gLluvia.gain.value = 0.032;
    var vaiven = ac.createOscillator(), gVaiven = ac.createGain();
    vaiven.frequency.value = 0.06; gVaiven.gain.value = 0.012;
    vaiven.connect(gVaiven).connect(gLluvia.gain);
    lluvia.connect(paso).connect(techo).connect(gLluvia).connect(maestro);
    // el rumor del fuego
    var fuego = ac.createBufferSource(); fuego.buffer = marron; fuego.loop = true;
    var grave = ac.createBiquadFilter(); grave.type = 'lowpass'; grave.frequency.value = 320;
    var gFuego = ac.createGain(); gFuego.gain.value = 0.07;
    fuego.connect(grave).connect(gFuego).connect(maestro);
    lluvia.start(); fuego.start(); vaiven.start();
    // los chasquidos de la leña, al azar
    var hasta = ac.currentTime;
    function chasquidos(fin) {
      while (hasta < fin) {
        hasta += 0.08 + Math.random() * Math.random() * 1.3;
        var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        s.buffer = blanco;
        f.type = 'bandpass'; f.frequency.value = 1400 + Math.random() * 2600; f.Q.value = 2.5;
        var dur = 0.012 + Math.random() * 0.035, vol = 0.03 + Math.random() * Math.random() * 0.09;
        g.gain.setValueAtTime(vol, hasta);
        g.gain.exponentialRampToValueAtTime(0.0001, hasta + dur);
        s.connect(f).connect(g).connect(maestro);
        s.start(hasta, Math.random() * 1.5);
        s.stop(hasta + dur + 0.01);
      }
    }
    return {
      chasquidos: chasquidos,
      para: function () {
        var t = ac.currentTime;
        maestro.gain.cancelScheduledValues(t);
        maestro.gain.setValueAtTime(Math.max(0.0001, maestro.gain.value), t);
        maestro.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        setTimeout(function () {
          [lluvia, fuego, vaiven].forEach(function (n) { try { n.stop(); } catch (e) { /* ya parado */ } });
          maestro.disconnect();
        }, 700);
      },
    };
  }
  // </ambiente>
  var ambiente = null, relojAmbiente = null;
  function empiezaAmbiente() {
    if (!ctx || ambiente || document.hidden) return;
    try { ambiente = creaAmbiente(ctx, ctx.destination); } catch (e) { ambiente = null; return; }
    ambiente.chasquidos(ctx.currentTime + 1);
    relojAmbiente = setInterval(function () { if (ambiente) ambiente.chasquidos(ctx.currentTime + 1); }, 400);
  }
  function paraAmbiente() {
    clearInterval(relojAmbiente);
    if (ambiente) { ambiente.para(); ambiente = null; }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) paraAmbiente();
    else if (sonidoOn) empiezaAmbiente();
  });
  botonSonido.addEventListener('click', function () {
    sonidoOn = !sonidoOn;
    if (sonidoOn) { prepara(); if (ctx && ctx.state === 'suspended') ctx.resume(); empiezaAmbiente(); }
    else paraAmbiente();
    botonSonido.setAttribute('aria-pressed', String(sonidoOn));
    botonSonido.setAttribute('aria-label', 'Sonido y ambiente: ' + (sonidoOn ? 'encendido' : 'apagado'));
    suena('pop');
  });

  // ---------- Confeti de píxeles ----------
  var COLORES = ['#ffb547', '#c4533d', '#f4e6d2', '#3f5a3a', '#2f5d84', '#c49a2a'];
  function confeti(caja, x, y, n) {
    if (reducido) return;
    for (var i = 0; i < n; i++) {
      var c = document.createElement('i');
      c.className = 'confeti';
      c.style.left = x + 'px';
      c.style.top = y + 'px';
      c.style.background = COLORES[i % COLORES.length];
      var ang = Math.random() * Math.PI * 2, dist = 60 + Math.random() * 120;
      c.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      c.style.setProperty('--dy', Math.sin(ang) * dist - 60 + 'px');
      c.style.setProperty('--r', Math.random() * 720 - 360 + 'deg');
      caja.appendChild(c);
      setTimeout(function (el) { el.remove(); }, 1100, c);
    }
  }

  // ---------- Estrellas y chispas ----------
  function estrellas(id, n) {
    var caja = document.getElementById(id);
    if (!caja) return;
    for (var i = 0; i < n; i++) {
      var e = document.createElement('i');
      e.style.left = Math.random() * 100 + '%';
      e.style.top = Math.random() * 100 + '%';
      e.style.animationDelay = -Math.random() * 3 + 's';
      caja.appendChild(e);
    }
  }
  estrellas('estrellas', 26);
  estrellas('estrellas-hotel', 34);
  if (!reducido) {
    var chispas = $('#chispas');
    for (var j = 0; j < 16; j++) {
      var c = document.createElement('i');
      c.style.left = 5 + Math.random() * 90 + '%';
      c.style.setProperty('--dx', Math.random() * 60 - 30 + 'px');
      c.style.animationDuration = 4 + Math.random() * 5 + 's';
      c.style.animationDelay = -Math.random() * 8 + 's';
      chispas.appendChild(c);
    }
  }

  // ---------- Portada: al bajar, la cámara se acerca a la puerta del hotel ----------
  var portada = $('.portada'), escena = $('#escena'), cuerpo = $('#portada-cuerpo');
  var velo = $('#velo'), pista = $('#pista'), bienvenida = $('#bienvenida'), estrellasP = $('#estrellas');
  var mx = 0, my = 0, objX = 0, objY = 0, pendiente = false;
  function pintaPortada() {
    pendiente = false;
    var r = portada.getBoundingClientRect();
    var recorrido = Math.max(1, r.height - window.innerHeight);
    var p = limita(-r.top / recorrido, 0, 1);
    mx += (objX - mx) * 0.12;
    my += (objY - my) * 0.12;
    if (reducido) return;
    var s = 1 + p * p * 1.9;
    escena.style.transform = 'translate3d(' + mx.toFixed(2) + 'px,' + (my - p * 30).toFixed(2) + 'px,0) scale(' + s.toFixed(4) + ')';
    estrellasP.style.transform = 'translateY(' + (p * 60).toFixed(1) + 'px)';
    cuerpo.style.opacity = String(limita(1 - p * 2.4, 0, 1));
    cuerpo.style.transform = 'translateY(' + (-p * 140).toFixed(1) + 'px)';
    pista.style.opacity = String(limita(1 - p * 6, 0, 1));
    velo.style.opacity = String(limita((p - 0.5) / 0.4, 0, 1));
    var b = p < 0.62 ? 0 : p < 0.78 ? (p - 0.62) / 0.16 : p < 0.92 ? 1 : 1 - (p - 0.92) / 0.08;
    bienvenida.style.opacity = String(limita(b, 0, 1));
    bienvenida.style.transform = 'scale(' + (0.9 + b * 0.1).toFixed(3) + ')';
    if (Math.abs(objX - mx) > 0.1 || Math.abs(objY - my) > 0.1) pide();
  }
  function pide() { if (!pendiente) { pendiente = true; requestAnimationFrame(pintaPortada); } }
  window.addEventListener('scroll', pide, { passive: true });
  window.addEventListener('resize', pide);
  if (punteroFino && !reducido) {
    window.addEventListener('pointermove', function (e) {
      if (window.scrollY > window.innerHeight * 1.5) return;
      objX = (e.clientX / window.innerWidth - 0.5) * -22;
      objY = (e.clientY / window.innerHeight - 0.5) * -14;
      pide();
    }, { passive: true });
  }
  pide();

  // ---------- Barra y sección en la que estás ----------
  var barra = $('#barra');
  var compa = $('#compa');
  function haySalidoDePortada() {
    var fuera = portada.getBoundingClientRect().bottom < window.innerHeight * 0.4;
    barra.classList.toggle('visible', fuera);
    compa.classList.toggle('visible', fuera);
    if (luzRaton) luzRaton.classList.toggle('encendida', fuera && ratonDentro);
  }
  // Luz cálida bajo el ratón, solo en escritorio y fuera de la portada
  var luzRaton = punteroFino && !reducido ? $('#luz-raton') : null, ratonDentro = false, luzPendiente = null;
  if (luzRaton) {
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      if (!ratonDentro) { ratonDentro = true; haySalidoDePortada(); }
      var x = e.clientX, y = e.clientY;
      if (luzPendiente) return;
      luzPendiente = requestAnimationFrame(function () {
        luzPendiente = null;
        luzRaton.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      });
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { ratonDentro = false; luzRaton.classList.remove('encendida'); });
  }
  window.addEventListener('scroll', haySalidoDePortada, { passive: true });
  haySalidoDePortada();
  var enlaces = $$('[data-nav]');
  var secciones = $$('main section[data-libo]');
  var seccionActual = null;
  if ('IntersectionObserver' in window) {
    var ioSec = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { if (e.isIntersecting) cambiaSeccion(e.target); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secciones.forEach(function (s) { ioSec.observe(s); });
  }
  function cambiaSeccion(s) {
    if (seccionActual === s) return;
    seccionActual = s;
    enlaces.forEach(function (a) { a.classList.toggle('aqui', a.getAttribute('data-nav') === s.id); });
    liboDice(s.getAttribute('data-libo'), s.id || s.className);
  }

  // ---------- Lo que aparece al bajar ----------
  var aparecen = $$('.aparece');
  if (!reducido && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visto'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    aparecen.forEach(function (a) { io.observe(a); });
  } else {
    aparecen.forEach(function (a) { a.classList.add('visto'); });
  }

  // ---------- Historias: la pantalla del móvil cambia con cada paso ----------
  $$('[data-historia]').forEach(function (h) {
    var pasos = $$('.paso', h), imgs = $$('.historia__img', h), puntos = $$('.historia__puntos i', h);
    var marco = $('.historia__marco', h), actual = 0;
    function activa(i) {
      if (i === actual) return;
      var sale = imgs[actual];
      sale.classList.remove('activa', 'entra');
      if (!reducido) { sale.classList.add('sale'); setTimeout(function () { sale.classList.remove('sale'); }, 650); }
      pasos[actual].classList.remove('activo');
      puntos[actual].classList.remove('activo');
      actual = i;
      imgs[i].classList.add('activa');
      if (!reducido) { imgs[i].classList.remove('entra'); void imgs[i].offsetWidth; imgs[i].classList.add('entra'); }
      pasos[i].classList.add('activo');
      ponTexto(i, true);
      puntos[i].classList.add('activo');
      marco.style.setProperty('--giro', (i % 2 ? 2 : -2) * (h.classList.contains('historia--izq') ? -1 : 1) + 'deg');
      suena('clic');
    }
    var rotulo = $('.historia__texto', h);
    function ponTexto(i, anima) {
      rotulo.innerHTML = $('.paso__tarjeta', pasos[i]).innerHTML;
      if (anima && !reducido) { rotulo.classList.remove('entra'); void rotulo.offsetWidth; rotulo.classList.add('entra'); }
    }
    ponTexto(0, false);
    var movil = window.matchMedia('(max-width: 860px)').matches;
    var ioH = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { if (e.isIntersecting) activa(pasos.indexOf(e.target)); });
    }, { rootMargin: movil ? '-50% 0px -49% 0px' : '-48% 0px -48% 0px' });
    pasos.forEach(function (p) { ioH.observe(p); });
    marco.addEventListener('click', function () { abreVisor(galeria.indexOf(imgs[actual])); });
  });

  // ---------- La fachada que se toca ----------
  var nota = $('#fachada-nota');
  $$('.exclama--boton').forEach(function (b, i) {
    b.style.setProperty('--d', i * 0.27 + 's');
    b.setAttribute('aria-label', b.getAttribute('data-titulo'));
    b.addEventListener('click', function () {
      $$('.exclama--boton').forEach(function (o) { o.classList.remove('elegido'); });
      b.classList.add('visto', 'elegido');
      $('.fachada__titulo', nota).textContent = b.getAttribute('data-titulo');
      $('.fachada__texto', nota).textContent = b.getAttribute('data-texto');
      nota.classList.remove('nueva');
      void nota.offsetWidth;
      nota.classList.add('nueva');
      suena('pop');
      if ($$('.exclama--boton.visto').length === $$('.exclama--boton').length && !nota.dataset.todo) {
        nota.dataset.todo = '1';
        var r = b.getBoundingClientRect(), f = $('#fachada').getBoundingClientRect();
        confeti($('#fachada'), r.left - f.left + r.width / 2, r.top - f.top, 22);
        suena('estrella', 3);
      }
    });
  });

  // ---------- La balda de prueba ----------
  var libros = $('#balda-libros'), balda = $('#balda'), cuenta = $('#balda-n'), msg = $('#balda-msg');
  var liboDemo = $('#libo-demo'), mas = $('#balda-mas');
  var colLomos = ['#9c3b2e', '#2f5d84', '#4e7a45', '#c49a2a', '#6d4a8a', '#c06a2b', '#2a6b6b', '#a3485c', '#556b2f', '#3d5a99'];
  var n = 0, MAX = 12;
  var frases = ['¡Uno más!', '¡Bien leído!', '¡Qué ritmo!', 'A Libo le encanta.', '¡Casi llena!'];
  function notaFlota(texto, el, caja) {
    if (reducido) return;
    var r = el.getBoundingClientRect(), b = caja.getBoundingClientRect();
    var f = document.createElement('span');
    f.className = 'nota-flota';
    f.textContent = texto;
    f.style.left = r.left - b.left + r.width / 2 - 20 + 'px';
    f.style.top = r.top - b.top - 12 + 'px';
    caja.appendChild(f);
    setTimeout(function () { f.remove(); }, 1200);
  }
  function salta() {
    liboDemo.classList.remove('salta');
    void liboDemo.offsetWidth;
    liboDemo.classList.add('salta', 'carino');
    clearTimeout(salta.t);
    salta.t = setTimeout(function () { liboDemo.classList.remove('carino'); }, 1600);
  }
  function anade(callado) {
    if (n >= MAX) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'lomo' + (callado ? '' : ' cae');
    b.setAttribute('aria-label', 'Libro ' + (n + 1) + ', tócalo para inclinarlo');
    b.style.width = 16 + Math.round(Math.random() * 10) + 'px';
    b.style.height = 66 + Math.round(Math.random() * 30) + '%';
    b.style.background = colLomos[Math.floor(Math.random() * colLomos.length)];
    b.addEventListener('click', function () { b.classList.toggle('inclinado'); suena('libro'); });
    libros.appendChild(b);
    n++;
    cuenta.textContent = n;
    if (callado) return;
    suena('libro');
    cuenta.classList.remove('late');
    void cuenta.offsetWidth;
    cuenta.classList.add('late');
    if (n === MAX) {
      msg.textContent = '¡Balda llena!';
      mas.textContent = 'Empezar otra balda';
      salta();
      var r = balda.getBoundingClientRect();
      confeti(balda, r.width / 2, r.height / 2, 36);
      suena('estrella', 3);
    } else {
      msg.textContent = frases[Math.min(frases.length - 1, Math.floor(n / 3))];
      setTimeout(function () { notaFlota('+1', b, balda); }, 350);
    }
  }
  mas.addEventListener('click', function () {
    if (n >= MAX) {
      libros.innerHTML = '';
      n = 0;
      cuenta.textContent = 0;
      msg.textContent = 'Balda nueva, a leer.';
      mas.textContent = 'Terminé un libro';
      return;
    }
    anade(false);
  });
  liboDemo.addEventListener('click', function () { salta(); notaFlota('¡Miau!', liboDemo, balda); suena('miau'); });
  for (var k = 0; k < 3; k++) anade(true);

  // ---------- Minijuego: prepara un café ----------
  (function () {
    var svg = $('#cafe-svg'), escenaCafe = $('#cafe-escena');
    var manivela = $('#manivela'), granos = $('#granos'), molido = $('#molido'), prensador = $('#prensador');
    var lecho = $('#lecho'), palanca = $('#palanca'), chorro = $('#chorro'), nivel = $('#cafe-nivel'), crema = $('#crema');
    var vapor = $('#vapor'), aguja = $('#aguja'), exclama = $('#cafe-exclama'), estrellasCafe = $('#cafe-estrellas');
    var texto = $('#cafe-paso'), accion = $('#cafe-accion'), chips = $$('#cafe-chips li');
    var medidor = $('#medidor'), medNivel = $('#medidor-nivel');
    var paso, giro, ultimoAng, acumTic, apisonado, y0, extraido, manteniendo, ultimoT, raf, terminado;
    var EXCLAMA = [[67, 9], [130, 25], [173, 5]];
    var TEXTOS = [
      ['Gira la manivela del molinillo: arrastra en círculos.', 'Girar la manivela'],
      ['Apisona el café: arrastra el prensador hacia abajo, con firmeza.', 'Apisonar'],
      ['Mantén la palanca y suéltala cuando la taza llegue a la zona dorada.', 'Mantener la palanca'],
    ];
    function ponPaso(p) {
      paso = p;
      chips.forEach(function (c, i) { c.classList.toggle('activo', i === p); c.classList.toggle('hecho', i < p); });
      if (p < 3) {
        texto.textContent = TEXTOS[p][0];
        accion.textContent = TEXTOS[p][1];
        exclama.style.display = '';
        exclama.setAttribute('transform', 'translate(' + EXCLAMA[p][0] + ' ' + EXCLAMA[p][1] + ')');
      } else {
        exclama.style.display = 'none';
      }
      prensador.style.opacity = p === 1 ? '1' : '0';
      medidor.classList.toggle('oculto', p !== 2 && !terminado);
    }
    function reinicia() {
      giro = 0; ultimoAng = null; acumTic = 0; apisonado = 0; extraido = 0; manteniendo = false; terminado = false;
      manivela.style.transform = 'rotate(0deg)';
      granos.setAttribute('y', 34); granos.setAttribute('height', 22);
      molido.setAttribute('y', 104); molido.setAttribute('height', 0);
      prensador.setAttribute('transform', 'translate(0 0)');
      lecho.setAttribute('opacity', 0);
      palanca.style.transform = 'rotate(0deg)';
      chorro.setAttribute('opacity', 0);
      nivel.setAttribute('y', 104); nivel.setAttribute('height', 0);
      crema.setAttribute('opacity', 0);
      vapor.setAttribute('opacity', 0);
      aguja.setAttribute('transform', '');
      estrellasCafe.innerHTML = '';
      medNivel.style.width = '0';
      ponPaso(0);
    }
    function puntoPivote() {
      var m = svg.getScreenCTM(), pt = svg.createSVGPoint();
      pt.x = 46; pt.y = 22;
      return pt.matrixTransform(m);
    }
    function muele(delta) {
      giro += delta;
      acumTic += delta;
      if (acumTic > 0.5) { acumTic = 0; suena('molino'); }
      var p = limita(giro / (Math.PI * 4), 0, 1);
      manivela.style.transform = 'rotate(' + (giro * 180 / Math.PI).toFixed(1) + 'deg)';
      granos.setAttribute('y', (34 + 22 * p).toFixed(2));
      granos.setAttribute('height', (22 * (1 - p)).toFixed(2));
      molido.setAttribute('y', (104 - 12 * p).toFixed(2));
      molido.setAttribute('height', (12 * p).toFixed(2));
      if (p >= 1) { suena('clic'); ponPaso(1); texto.textContent = '¡Molido! ' + TEXTOS[1][0]; }
    }
    function apisona(d) {
      apisonado = limita(apisonado + d, 0, 1);
      prensador.setAttribute('transform', 'translate(0 ' + (apisonado * 29).toFixed(2) + ')');
      if (apisonado >= 1) {
        suena('golpe');
        lecho.setAttribute('opacity', 1);
        ponPaso(2);
        texto.textContent = '¡Bien apisonado! ' + TEXTOS[2][0];
      }
    }
    function pintaTaza() {
      var l = extraido;
      nivel.setAttribute('y', (104 - 6 * l).toFixed(2));
      nivel.setAttribute('height', (6 * l).toFixed(2));
      crema.setAttribute('y', (104 - 6 * l).toFixed(2));
      crema.setAttribute('opacity', l > 0.55 ? 1 : 0);
      medNivel.style.width = (l * 100).toFixed(1) + '%';
      aguja.setAttribute('transform', 'rotate(' + (l * 120).toFixed(1) + ' 161 60)');
    }
    function bucle(t) {
      if (!manteniendo) return;
      var dt = Math.min(0.05, (t - ultimoT) / 1000);
      ultimoT = t;
      extraido = Math.min(1, extraido + dt * 0.36);
      if (Math.random() < 0.12) suena('gota');
      pintaTaza();
      if (extraido >= 1) { suelta(); return; }
      raf = requestAnimationFrame(bucle);
    }
    function mantiene() {
      if (paso !== 2 || manteniendo || terminado) return;
      manteniendo = true;
      palanca.style.transform = 'rotate(48deg)';
      chorro.setAttribute('opacity', 1);
      suena('palanca');
      ultimoT = performance.now();
      raf = requestAnimationFrame(bucle);
    }
    function suelta() {
      if (!manteniendo) return;
      manteniendo = false;
      cancelAnimationFrame(raf);
      palanca.style.transform = 'rotate(0deg)';
      chorro.setAttribute('opacity', 0);
      if (extraido < 0.3) { texto.textContent = 'Aún apenas hay café: vuelve a mantener la palanca.'; return; }
      termina();
    }
    function estrellaSvg(llena) {
      return '<span class="estrella" style="animation-delay:' + '0s"><svg viewBox="0 0 11 11" shape-rendering="crispEdges"><path fill="' + (llena ? '#ffb547' : '#4a2a12') + '" stroke="#351c0e" stroke-width="0.6" d="M5 0h1v3h2v1h3v1h-1v1H9v1h1v4H9v-1H7V9H6V8H5v1H4v1H2v1H1V7h1V6H1V5H0V4h3V3h2z"/></svg></span>';
    }
    function termina() {
      terminado = true;
      var l = extraido, e, frase;
      if (l >= 0.7 && l <= 0.92) { e = 3; frase = '¡Perfecto! Crema dorada, como en la barra del café.'; }
      else if (l >= 0.5) { e = 2; frase = l > 0.92 ? 'Muy rico, aunque un pelín largo. La zona dorada da las tres estrellas.' : 'Muy rico, aunque un pelín corto. La zona dorada da las tres estrellas.'; }
      else { e = 1; frase = 'Un café cortito. La próxima vez, mantén un poco más la palanca.'; }
      ponPaso(3);
      chips.forEach(function (c) { c.classList.add('hecho'); c.classList.remove('activo'); });
      vapor.setAttribute('opacity', 1);
      var html = '';
      for (var i = 0; i < 3; i++) html += estrellaSvg(i < e);
      estrellasCafe.innerHTML = html;
      $$('.estrella', estrellasCafe).forEach(function (s, i) { s.style.animationDelay = i * 0.16 + 's'; });
      texto.textContent = frase;
      accion.textContent = 'Otro café';
      suena('estrella', e);
      if (e === 3) {
        var r = escenaCafe.getBoundingClientRect();
        confeti(escenaCafe, r.width / 2, r.height * 0.3, 30);
      }
    }
    // Gestos con el dedo o el ratón sobre la escena
    var arrastrando = false;
    svg.addEventListener('pointerdown', function (e) {
      if (terminado) return;
      arrastrando = true;
      svg.classList.add('agarrando');
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
      if (paso === 0) { var c = puntoPivote(); ultimoAng = Math.atan2(e.clientY - c.y, e.clientX - c.x); }
      if (paso === 1) y0 = e.clientY;
      if (paso === 2) mantiene();
    });
    svg.addEventListener('pointermove', function (e) {
      if (!arrastrando) return;
      if (paso === 0) {
        var c = puntoPivote();
        var a = Math.atan2(e.clientY - c.y, e.clientX - c.x);
        if (ultimoAng !== null) {
          var d = a - ultimoAng;
          if (d > Math.PI) d -= Math.PI * 2;
          if (d < -Math.PI) d += Math.PI * 2;
          if (Math.abs(d) < 1.2) muele(Math.abs(d));
        }
        ultimoAng = a;
      } else if (paso === 1) {
        var alto = svg.getBoundingClientRect().height;
        var dy = (e.clientY - y0) / (alto * 0.22);
        y0 = e.clientY;
        if (dy > 0) apisona(dy);
      }
    });
    function fin() { arrastrando = false; svg.classList.remove('agarrando'); ultimoAng = null; if (paso === 2) suelta(); }
    svg.addEventListener('pointerup', fin);
    svg.addEventListener('pointercancel', fin);
    svg.addEventListener('lostpointercapture', fin);
    // El botón: la alternativa sin gesto (y con teclado)
    accion.addEventListener('click', function () {
      if (terminado) { reinicia(); suena('pop'); return; }
      if (paso === 0) muele(Math.PI / 3);
      else if (paso === 1) apisona(0.34);
    });
    accion.addEventListener('pointerdown', function () { if (paso === 2) mantiene(); });
    accion.addEventListener('pointerup', function () { if (paso === 2) suelta(); });
    accion.addEventListener('pointerleave', function () { if (paso === 2) suelta(); });
    accion.addEventListener('keydown', function (e) { if (paso === 2 && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); mantiene(); } });
    accion.addEventListener('keyup', function (e) { if (paso === 2 && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); suelta(); } });
    reinicia();
  })();

  // ---------- Minijuego: las tres chisteras ----------
  (function () {
    var cajas = $$('.chistera'), jugar = $('#chist-jugar'), texto = $('#chist-texto'), marcador = $('#chist-aciertos');
    var lugar = [0, 1, 2], conejo = 0, aciertos = 0, ocupado = false;
    var NOMBRES = ['de la izquierda', 'del centro', 'de la derecha'];
    var espera = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    function coloca() {
      cajas.forEach(function (c, i) {
        c.style.setProperty('--x', lugar[i]);
        c.setAttribute('aria-label', 'Chistera ' + NOMBRES[lugar[i]]);
      });
    }
    coloca();
    function bloquea(si) { cajas.forEach(function (c) { c.disabled = si; }); }
    async function ronda() {
      if (ocupado) return;
      ocupado = true;
      jugar.disabled = true;
      cajas.forEach(function (c) { c.classList.remove('arriba', 'bien', 'tiene'); });
      conejo = Math.floor(Math.random() * 3);
      cajas[conejo].classList.add('tiene');
      texto.textContent = 'El conejo está bajo la chistera ' + NOMBRES[lugar[conejo]] + '. No le pierdas de vista.';
      await espera(250);
      cajas[conejo].classList.add('arriba');
      suena('pop');
      await espera(1100);
      cajas[conejo].classList.remove('arriba');
      await espera(450);
      var vueltas = 5 + Math.min(aciertos, 5);
      var paso = reducido ? 520 : Math.max(260, 380 - aciertos * 14);
      cajas.forEach(function (c) { c.style.transitionDuration = reducido ? '0s' : paso - 40 + 'ms'; });
      texto.textContent = 'Barajando…';
      for (var v = 0; v < vueltas; v++) {
        var a = Math.floor(Math.random() * 3), b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
        var t = lugar[a]; lugar[a] = lugar[b]; lugar[b] = t;
        coloca();
        suena('baraja');
        await espera(paso);
      }
      texto.textContent = '¿Dónde está el conejo? Toca una chistera.';
      bloquea(false);
      cajas[0].focus({ preventScroll: true });
      ocupado = false;
    }
    cajas.forEach(function (c, i) {
      c.addEventListener('click', function () {
        if (c.disabled) return;
        bloquea(true);
        c.classList.add('arriba');
        if (i === conejo) {
          aciertos++;
          marcador.textContent = aciertos;
          c.classList.add('bien');
          texto.textContent = aciertos > 1 ? '¡Otra vez! Llevas ' + aciertos + '. Cada ronda baraja un poco más.' : '¡Lo encontraste! La próxima baraja un poco más.';
          suena('ding');
          var r = c.getBoundingClientRect(), f = $('#chisteras').getBoundingClientRect();
          confeti($('#chisteras'), r.left - f.left + r.width / 2, r.top - f.top + 10, 24);
        } else {
          texto.textContent = 'Aquí no estaba: era la chistera ' + NOMBRES[lugar[conejo]] + '. Sin prisa, otra ronda.';
          suena('flojo');
          setTimeout(function () { cajas[conejo].classList.add('arriba'); }, 350);
        }
        jugar.textContent = 'Otra ronda';
        jugar.disabled = false;
      });
    });
    jugar.addEventListener('click', ronda);
  })();

  // ---------- Libo te acompaña ----------
  var bocadillo = $('#compa-bocadillo'), compaTexto = $('#compa-texto'), yaDicho = {}, cierraT = null, textoLibo = '';
  function abreBocadillo(t) {
    compaTexto.textContent = t;
    bocadillo.hidden = false;
    compa.classList.add('habla');
    clearTimeout(cierraT);
    cierraT = setTimeout(cierraBocadillo, 6000);
  }
  function cierraBocadillo() { bocadillo.hidden = true; compa.classList.remove('habla'); }
  function liboDice(t, clave) {
    textoLibo = t;
    if (yaDicho[clave] || !compa.classList.contains('visible') || compa.classList.contains('apartado')) return;
    yaDicho[clave] = true;
    abreBocadillo(t);
  }
  $('#compa-libo').addEventListener('click', function () {
    if (!bocadillo.hidden) { cierraBocadillo(); return; }
    abreBocadillo(textoLibo || '¡Miau! Baja y curiosea.');
    suena('miau');
  });
  $('#compa-cerrar').addEventListener('click', cierraBocadillo);
  // Se aparta de los juegos y de la fachada, para no tapar nada
  if ('IntersectionObserver' in window) {
    var tapa = new Set();
    var alTapar = function (ents) {
      ents.forEach(function (e) { if (e.isIntersecting) tapa.add(e.target); else tapa.delete(e.target); });
      compa.classList.toggle('apartado', tapa.size > 0);
      if (tapa.size > 0) cierraBocadillo();
    };
    var ioTapa = new IntersectionObserver(alTapar, { rootMargin: '-10% 0px -10% 0px' });
    $$('.juego, .balda-demo, .fachada, .fachada__nota').forEach(function (el) { ioTapa.observe(el); });
    // El pie, solo cuando sus enlaces llegan a la esquina de Libo
    new IntersectionObserver(alTapar, { rootMargin: '0px 0px -40px 0px' }).observe($('.pie'));
  }

  // Si no pasa nada en un rato, Libo se echa una siesta (le salen «z»); al moverte, se despierta
  var siesta = null;
  function despierta() {
    compa.classList.remove('duerme');
    clearTimeout(siesta);
    siesta = setTimeout(function () { if (bocadillo.hidden) compa.classList.add('duerme'); }, 14000);
  }
  ['scroll', 'pointerdown', 'keydown', 'wheel'].forEach(function (ev) { window.addEventListener(ev, despierta, { passive: true }); });
  despierta();

  // ---------- Guirnaldas de luces: se encienden y se apagan al tocarlas ----------
  var LUCES = [['#ffc35c', 'rgb(255 190 90 / 0.55)', 'rgb(255 170 70 / 0.2)'], ['#ffe3a8', 'rgb(255 226 160 / 0.5)', 'rgb(255 210 140 / 0.18)'], ['#ff8f6b', 'rgb(255 140 100 / 0.5)', 'rgb(255 120 80 / 0.18)'], ['#b9d98a', 'rgb(190 220 140 / 0.45)', 'rgb(170 210 120 / 0.15)']];
  $$('.guirnalda').forEach(function (g) {
    var cable = $('path', g), svg = $('svg', g);
    function cuelga() {
      $$('.bombilla', g).forEach(function (b) { b.remove(); });
      var ancho = g.clientWidth || window.innerWidth;
      var arcos = ancho < 700 ? 1 : 2, porArco = ancho < 700 ? 9 : 9, caida = ancho < 700 ? 22 : 26;
      svg.setAttribute('viewBox', '0 0 100 40');
      var d = 'M0 4';
      for (var a = 0; a < arcos; a++) {
        var x0 = (a / arcos) * 100, x1 = ((a + 1) / arcos) * 100;
        d += ' Q' + ((x0 + x1) / 2) + ' ' + (4 + caida * 2) + ' ' + x1 + ' 4';
        for (var k = 0; k < porArco; k++) {
          var t = (k + 0.5) / porArco;
          var y = 4 + caida * 4 * t * (1 - t);
          var luz = LUCES[(a * porArco + k) % LUCES.length];
          var b = document.createElement('span');
          b.className = 'bombilla';
          b.style.left = (x0 + (x1 - x0) * t) + '%';
          b.style.top = y - 1 + 'px';
          b.style.setProperty('--c', luz[0]);
          b.style.setProperty('--g', luz[1]);
          b.style.setProperty('--g2', luz[2]);
          b.style.setProperty('--r', ((t - 0.5) * -24 + (Math.random() * 8 - 4)).toFixed(1) + 'deg');
          b.style.setProperty('--t', (2.4 + Math.random() * 2.6).toFixed(2) + 's');
          b.style.setProperty('--d', (-Math.random() * 4).toFixed(2) + 's');
          b.style.setProperty('--e', ((a * porArco + k) * 0.045).toFixed(2) + 's');
          g.appendChild(b);
        }
      }
      cable.setAttribute('d', d);
    }
    cuelga();
    var anchoAntes = window.innerWidth;
    window.addEventListener('resize', function () {
      if (Math.abs(window.innerWidth - anchoAntes) < 40) return;
      anchoAntes = window.innerWidth;
      cuelga();
    });
    g.addEventListener('click', function () {
      var apagada = g.classList.toggle('apagada');
      g.setAttribute('aria-pressed', String(!apagada));
      g.setAttribute('aria-label', 'Luces de la guirnalda: ' + (apagada ? 'apagadas' : 'encendidas'));
      g.classList.remove('enciende');
      if (!apagada) { void g.offsetWidth; g.classList.add('enciende'); }
      suena(apagada ? 'clic' : 'pop');
    });
  });

  // ---------- Motas de polvo que flotan en la luz de la lámpara ----------
  if (!reducido) {
    $$('.motas').forEach(function (m) {
      for (var i = 0; i < 16; i++) {
        var p = document.createElement('i');
        var cerca = i < 11;
        p.style.left = (cerca ? 58 + Math.random() * 40 : 2 + Math.random() * 30) + '%';
        p.style.top = (cerca ? 60 + Math.random() * 300 : 300 + Math.random() * 440) + 'px';
        p.style.setProperty('--t', (10 + Math.random() * 10).toFixed(1) + 's');
        p.style.setProperty('--d', (-Math.random() * 18).toFixed(1) + 's');
        p.style.setProperty('--dx', (Math.random() * 60 - 30).toFixed(0) + 'px');
        p.style.setProperty('--o', (0.35 + Math.random() * 0.5).toFixed(2));
        if (Math.random() < 0.3) { p.style.width = '2px'; p.style.height = '2px'; }
        m.appendChild(p);
      }
    });
  }

  // ---------- El visor: las capturas en grande ----------
  var visor = $('#visor'), vImg = $('img', visor), vPie = $('figcaption', visor);
  var galeria = $$('img[data-galeria]');
  var actualV = 0, volverA = null;
  function muestra(i) {
    actualV = (i + galeria.length) % galeria.length;
    var img = galeria[actualV];
    vImg.src = img.currentSrc || img.src;
    vImg.alt = img.alt;
    vPie.textContent = img.getAttribute('data-pie') + ' · ' + (actualV + 1) + ' de ' + galeria.length;
  }
  function abreVisor(i) {
    volverA = document.activeElement;
    muestra(i < 0 ? 0 : i);
    visor.hidden = false;
    document.body.style.overflow = 'hidden';
    compa.classList.add('apartado');
    $('.visor__cerrar', visor).focus();
    suena('pop');
  }
  function cierraVisor() {
    visor.hidden = true;
    document.body.style.overflow = '';
    compa.classList.remove('apartado');
    if (volverA) volverA.focus({ preventScroll: true });
  }
  $$('.carta').forEach(function (c) { c.addEventListener('click', function () { abreVisor(galeria.indexOf($('img', c))); }); });
  $('.visor__cerrar', visor).addEventListener('click', cierraVisor);
  $('.visor__ant', visor).addEventListener('click', function () { muestra(actualV - 1); suena('clic'); });
  $('.visor__sig', visor).addEventListener('click', function () { muestra(actualV + 1); suena('clic'); });
  visor.addEventListener('click', function (e) { if (e.target === visor) cierraVisor(); });
  document.addEventListener('keydown', function (e) {
    if (visor.hidden) return;
    if (e.key === 'Escape') cierraVisor();
    else if (e.key === 'ArrowLeft') muestra(actualV - 1);
    else if (e.key === 'ArrowRight') muestra(actualV + 1);
    else if (e.key === 'Tab') {
      var f = $$('button', visor), primero = f[0], ultimo = f[f.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    }
  });
  var x0 = null;
  vImg.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  vImg.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) muestra(actualV + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  // ---------- Inclinación de las cartas del hotel con el ratón ----------
  if (punteroFino && !reducido) {
    $$('.fachada, .juego').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        if (el.classList.contains('juego')) return;
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(900px) rotateY(' + (x * 6).toFixed(2) + 'deg) rotateX(' + (-y * 6).toFixed(2) + 'deg)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }
})();
