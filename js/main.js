// ============================================================
// GHARBI AGENCY — page logic
// ============================================================
import { WORKS } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
if (reduced) document.documentElement.classList.add('reduced');

const { gsap, ScrollTrigger, Lenis } = window;
const hasGsap = !!(gsap && ScrollTrigger);
if (hasGsap) gsap.registerPlugin(ScrollTrigger);

// ------------------------------------------------------------
// Work grid (from data.js)
// ------------------------------------------------------------
const grid = $('#work-grid');
const PLAY_SVG = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
grid.innerHTML = WORKS.map((w, i) => `
  <article class="card${w.featured ? ' card-featured' : ''}" data-cat="${w.cat}" data-i="${i}" tabindex="0" role="button" aria-label="Regarder : ${w.title}">
    <img src="${w.thumb}" alt="${w.title}" loading="lazy" decoding="async" />
    <span class="card-tag">${w.featured ? '★ ' : ''}${w.label}</span>
    <span class="card-play">${PLAY_SVG}</span>
    <div class="card-meta"><h3>${w.title}</h3><span class="n">${String(i + 1).padStart(2, '0')}</span></div>
  </article>`).join('');
$('#count-all').textContent = WORKS.length;

// ------------------------------------------------------------
// Loader + 3D scene
// ------------------------------------------------------------
const loader = $('#loader');
const pctEl = $('#loader-pct');
const barEl = $('#loader-bar');
let shownPct = 0, targetPct = 0;
(function tickLoader() {
  shownPct += (targetPct - shownPct) * 0.12;
  pctEl.textContent = String(Math.round(shownPct)).padStart(2, '0');
  barEl.style.transform = `scaleX(${shownPct / 100})`;
  if (!loader.classList.contains('is-done')) requestAnimationFrame(tickLoader);
})();

let scene = null;
let pageStarted = false;

function startPage() {
  if (pageStarted) return;
  pageStarted = true;
  targetPct = 100;
  setTimeout(() => {
    loader.classList.add('is-done');
    document.body.classList.remove('is-loading');
    introAnimation();
  }, 450);
}

async function initScene() {
  try {
    const { createScene } = await import('./scene.js');
    scene = createScene({
      canvas: $('#webgl'),
      reducedMotion: reduced,
      onProgress: (p) => { targetPct = Math.max(targetPct, p * 95); },
      onReady: startPage,
      onCardHover: (w) => setCursorPlay(!!w, w ? w.label : ''),
      onCardClick: (w) => openVideo(WORKS.indexOf(w)),
    });
  } catch (err) {
    console.warn('[GHARBI] WebGL indisponible, mode 2D.', err);
    document.documentElement.classList.add('no-webgl');
    document.body.classList.add('no-webgl');
    startPage();
  }
}
initScene();
setTimeout(startPage, 8000); // hard safety net

// ------------------------------------------------------------
// Smooth scroll (Lenis) + ScrollTrigger
// ------------------------------------------------------------
let lenis = null;
if (Lenis && !reduced) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
  if (hasGsap) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
}
function scrollToTarget(target) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6 });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  e.preventDefault();
  closeMenu();
  scrollToTarget(id === '#top' ? document.body : id);
}));

// ------------------------------------------------------------
// Split titles into words
// ------------------------------------------------------------
$$('.split').forEach((el) => {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          const s = document.createElement('span'); s.textContent = part;
          w.appendChild(s); frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') {
        walk(n);
      }
    });
  };
  walk(el);
});

// ------------------------------------------------------------
// Hero scroll choreography
// ------------------------------------------------------------
const stages = $$('.hero-stage');
const heroBar = $('#hero-progress');
const stageNum = $('#hero-stage-num');
const glCanvas = $('#webgl');
let stage2Counted = false;

function applyStage(el, vis, dir) {
  // vis 0..1 ; dir: offset direction for exit
  el.style.opacity = vis;
  el.style.visibility = vis > 0.01 ? 'visible' : 'hidden';
  el.style.transform = `translateY(${(1 - vis) * 40 * dir}px)`;
  el.setAttribute('aria-hidden', vis < 0.5 ? 'true' : 'false');
}

function heroUpdate(p) {
  if (scene) scene.setProgress(p);
  heroBar.style.transform = `scaleX(${p})`;
  // stage 1: visible until 0.18, out by 0.28
  applyStage(stages[0], 1 - seg(p, 0.16, 0.28), -1);
  // stage 2: in 0.3-0.38, out 0.58-0.66
  const v2 = Math.min(seg(p, 0.3, 0.38), 1 - seg(p, 0.58, 0.66));
  applyStage(stages[1], v2, p < 0.5 ? 1 : -1);
  // stage 3: in 0.72-0.8
  applyStage(stages[2], seg(p, 0.72, 0.8), 1);
  stageNum.textContent = `0${p < 0.3 ? 1 : p < 0.68 ? 2 : 3}/03`;
  if (v2 > 0.5 && !stage2Counted) {
    stage2Counted = true;
    $$('.stage-2 [data-count]').forEach(countUp);
  }
}

// ------------------------------------------------------------
// Counters
// ------------------------------------------------------------
function countUp(el) {
  const target = +el.dataset.count;
  if (reduced || !hasGsap) { el.textContent = target; return; }
  const o = { v: 0 };
  gsap.to(o, { v: target, duration: 1.8, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v); } });
}

// ------------------------------------------------------------
// Intro (after loader)
// ------------------------------------------------------------
function introAnimation() {
  if (!hasGsap || reduced) return;
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from('.nav', { y: -80, opacity: 0, duration: 1.2 }, 0)
    .from('.hero-ar .line > span', { yPercent: 110, duration: 1.4, stagger: 0.12 }, 0.1)
    .from('.hero-kicker', { y: 20, opacity: 0, duration: 1 }, 0.3)
    .from('.hero-sub, .hero-actions .btn', { y: 30, opacity: 0, duration: 1, stagger: 0.08 }, 0.45)
    .from('.hero-progress', { opacity: 0, duration: 1 }, 0.8);
}

// ------------------------------------------------------------
// ScrollTriggers
// ------------------------------------------------------------
if (hasGsap) {
  ScrollTrigger.create({
    trigger: '#hero', start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => heroUpdate(self.progress),
    onToggle: (self) => scene && scene.setInteractive(self.isActive),
  });

  // WebGL backdrop dims after the hero, comes back a bit for contact
  ScrollTrigger.create({
    trigger: '#hero', start: 'bottom bottom', end: 'bottom 30%',
    onUpdate: (self) => { glCanvas.style.setProperty('--gl', String(1 - self.progress * 0.82)); },
  });
  ScrollTrigger.create({
    trigger: '#contact', start: 'top 70%', end: 'top 10%',
    onUpdate: (self) => { glCanvas.style.setProperty('--gl', String(0.18 + self.progress * 0.35)); },
  });
  ScrollTrigger.create({
    trigger: '.brands', start: 'top bottom', endTrigger: 'body', end: 'bottom bottom',
    onUpdate: (self) => scene && scene.setPage(self.progress),
  });

  // title word reveals
  $$('.split').forEach((el) => {
    gsap.from($$('.w > span', el), {
      yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.04,
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });

  // generic reveal
  ScrollTrigger.batch('.reveal', {
    start: 'top 88%',
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 }),
  });

  // cards & service cards rise in 3D
  ScrollTrigger.batch('.service, .proof-card, .card', {
    start: 'top 90%',
    onEnter: (els) => gsap.fromTo(els,
      { opacity: 0, y: 60, rotateX: -14, transformOrigin: '50% 100%' },
      { opacity: 1, y: 0, rotateX: 0, duration: 1.2, ease: 'expo.out', stagger: 0.07, overwrite: 'auto', clearProps: 'transform' }),
  });

  gsap.from('.about-card-inner', {
    rotateY: -18, rotateX: 8, y: 60, opacity: 0, duration: 1.6, ease: 'expo.out',
    scrollTrigger: { trigger: '.about-card', start: 'top 80%' },
  });

  gsap.to('#process-line', {
    scaleX: 1, ease: 'none',
    scrollTrigger: { trigger: '.process', start: 'top 75%', end: 'bottom 60%', scrub: true },
  });

  $$('.numbers [data-count]').forEach((el) => {
    ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => countUp(el) });
  });

  gsap.from('.footer-word', {
    yPercent: 60, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true },
  });

  // Marquees with scroll-velocity boost
  $$('.marquee-track').forEach((track, i) => {
    const dir = i % 2 ? 1 : -1;
    const tween = gsap.fromTo(track, { xPercent: dir < 0 ? 0 : -50 }, { xPercent: dir < 0 ? -50 : 0, duration: 32, ease: 'none', repeat: -1 });
    if (reduced) tween.pause();
    ScrollTrigger.create({
      trigger: track, start: 'top bottom', end: 'bottom top',
      onUpdate: (self) => {
        const v = Math.min(Math.abs(self.getVelocity()) / 400, 5);
        gsap.to(tween, { timeScale: 1 + v, duration: 0.2, overwrite: true });
        gsap.to(tween, { timeScale: 1, duration: 1.2, delay: 0.2 });
      },
    });
  });

  // nav: hide on scroll down, active link
  let lastY = 0;
  const nav = $('#nav');
  const wa = $('.wa-float');
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      nav.classList.toggle('is-hidden', y > lastY && y > 200 && !document.body.classList.contains('menu-open'));
      lastY = y;
      wa.classList.toggle('is-visible', y > innerHeight * 1.5);
    },
  });
  $$('.nav-links a').forEach((a) => {
    const sec = $(a.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec, start: 'top 50%', end: 'bottom 50%',
      onToggle: (self) => a.classList.toggle('is-active', self.isActive),
    });
  });
} else {
  $$('.reveal').forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; });
  $$('[data-count]').forEach((el) => { el.textContent = el.dataset.count; });
  addEventListener('scroll', () => {
    const hero = $('#hero');
    const p = clamp01(-hero.getBoundingClientRect().top / (hero.offsetHeight - innerHeight));
    heroUpdate(p);
  }, { passive: true });
  heroUpdate(0);
}

// ------------------------------------------------------------
// Click on 3D cards (hero)
// ------------------------------------------------------------
$('.hero-sticky').addEventListener('click', (e) => {
  if (e.target.closest('a, button')) return;
  scene && scene.click();
});

// ------------------------------------------------------------
// Cursor
// ------------------------------------------------------------
const cursor = $('#cursor');
const cursorLabel = $('#cursor-label');
const dot = $('.cursor-dot');
const ringEl = $('.cursor-ring');
function setCursorPlay(on, label = 'Play') {
  cursor.classList.toggle('is-play', on);
  cursorLabel.textContent = on ? (label ? `▶ ${label}` : 'Play') : 'Play';
}
if (finePointer && !reduced) {
  document.body.classList.add('has-cursor');
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
  (function tick() {
    rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
    dot.style.transform = `translate(${mx}px, ${my}px)`;
    ringEl.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(tick);
  })();
  document.addEventListener('pointerover', (e) => {
    const card = e.target.closest('.card');
    if (card) { setCursorPlay(true, WORKS[+card.dataset.i].label); return; }
    cursor.classList.toggle('is-link', !!e.target.closest('a, button, label, select, input, textarea'));
  });
  document.addEventListener('pointerout', (e) => {
    if (e.target.closest('.card') && !e.relatedTarget?.closest?.('.card')) setCursorPlay(false);
  });
}

// ------------------------------------------------------------
// Magnetic buttons, tilt, spotlight
// ------------------------------------------------------------
if (finePointer && !reduced) {
  $$('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.25;
      const y = (e.clientY - r.top - r.height / 2) * 0.35;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });

  const tiltEls = $$('.tilt, .card');
  tiltEls.forEach((el) => {
    const target = el.classList.contains('about-card') ? $('.about-card-inner', el) : el;
    const max = el.classList.contains('card') ? 8 : 6;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      target.style.transform = `perspective(900px) rotateY(${(px - 0.5) * max * 2}deg) rotateX(${(0.5 - py) * max * 2}deg) translateZ(0)`;
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
    });
    el.addEventListener('pointerleave', () => {
      target.style.transition = 'transform .8s cubic-bezier(.22,1,.36,1)';
      target.style.transform = '';
      setTimeout(() => { target.style.transition = ''; }, 800);
    });
  });
}

// ------------------------------------------------------------
// Portfolio: filters, hover previews, modal
// ------------------------------------------------------------
let currentFilter = 'all';
$$('.filter').forEach((btn) => btn.addEventListener('click', () => {
  currentFilter = btn.dataset.filter;
  $$('.filter').forEach((b) => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-selected', b === btn); });
  const cards = $$('.card');
  cards.forEach((c) => c.classList.toggle('is-hidden', currentFilter !== 'all' && c.dataset.cat !== currentFilter));
  if (hasGsap) {
    gsap.fromTo(cards.filter((c) => !c.classList.contains('is-hidden')),
      { opacity: 0, y: 30, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'expo.out', stagger: 0.03, clearProps: 'transform' });
    ScrollTrigger.refresh();
  }
}));

if (finePointer) {
  $$('.card').forEach((card) => {
    let v = null, timer = 0;
    card.addEventListener('pointerenter', () => {
      timer = setTimeout(() => {
        if (!v) {
          v = document.createElement('video');
          Object.assign(v, { muted: true, loop: true, playsInline: true, preload: 'auto' });
          v.src = WORKS[+card.dataset.i].video;
          card.insertBefore(v, card.querySelector('.card-tag'));
        }
        v.currentTime = 0;
        v.play().then(() => card.classList.add('is-playing')).catch(() => {});
      }, 180);
    });
    card.addEventListener('pointerleave', () => {
      clearTimeout(timer);
      card.classList.remove('is-playing');
      if (v) v.pause();
    });
  });
}

grid.addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (card) openVideo(+card.dataset.i);
});
grid.addEventListener('keydown', (e) => {
  const card = e.target.closest('.card');
  if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openVideo(+card.dataset.i); }
});

const modal = $('#video-modal');
const mVideo = $('#modal-video');
let currentIndex = 0;
function visibleList() {
  return WORKS.map((w, i) => i).filter((i) => currentFilter === 'all' || WORKS[i].cat === currentFilter);
}
function openVideo(i) {
  if (i < 0) return;
  currentIndex = i;
  const w = WORKS[i];
  $('#modal-tag').textContent = w.label;
  $('#modal-title').textContent = w.title;
  const list = visibleList();
  const pos = list.indexOf(i);
  $('#modal-index').textContent = pos >= 0 ? `${pos + 1} / ${list.length}` : `${i + 1} / ${WORKS.length}`;
  mVideo.poster = w.thumb;
  mVideo.src = w.video;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  lenis && lenis.stop();
  mVideo.play().catch(() => {});
  setCursorPlay(false);
}
function closeVideo() {
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  mVideo.pause();
  mVideo.removeAttribute('src');
  mVideo.load();
  lenis && lenis.start();
}
function stepVideo(d) {
  let list = visibleList();
  if (!list.includes(currentIndex)) list = WORKS.map((_, i) => i);
  const pos = list.indexOf(currentIndex);
  openVideo(list[(pos + d + list.length) % list.length]);
}
$$('[data-close]', modal).forEach((b) => b.addEventListener('click', closeVideo));
$('#modal-prev').addEventListener('click', () => stepVideo(-1));
$('#modal-next').addEventListener('click', () => stepVideo(1));

// Lightbox
const lightbox = $('#lightbox');
$$('[data-lightbox]').forEach((b) => b.addEventListener('click', () => {
  $('#lightbox-img').src = b.dataset.lightbox;
  $('#lightbox-cap').textContent = b.dataset.caption || '';
  lightbox.classList.add('is-open');
  lightbox.setAttribute('aria-hidden', 'false');
  lenis && lenis.stop();
}));
function closeLightbox() {
  lightbox.classList.remove('is-open');
  lightbox.setAttribute('aria-hidden', 'true');
  lenis && lenis.start();
}
$$('[data-close]', lightbox).forEach((b) => b.addEventListener('click', closeLightbox));

addEventListener('keydown', (e) => {
  if (modal.classList.contains('is-open')) {
    if (e.key === 'Escape') closeVideo();
    if (e.key === 'ArrowRight') stepVideo(1);
    if (e.key === 'ArrowLeft') stepVideo(-1);
  } else if (lightbox.classList.contains('is-open') && e.key === 'Escape') closeLightbox();
  else if (e.key === 'Escape') closeMenu();
});

// ------------------------------------------------------------
// Voice note player
// ------------------------------------------------------------
(() => {
  const audio = $('#voice-audio');
  const wave = $('#voice-wave');
  const box = $('.voice');
  const BARS = 42;
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  wave.innerHTML = Array.from({ length: BARS }, (_, i) => {
    const h = 18 + Math.abs(Math.sin(i * 0.55)) * 50 + rnd() * 32;
    return `<i style="height:${Math.min(100, h)}%"></i>`;
  }).join('');
  const bars = $$('i', wave);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  $('#voice-btn').addEventListener('click', () => (audio.paused ? audio.play() : audio.pause()));
  audio.addEventListener('play', () => box.classList.add('is-playing'));
  audio.addEventListener('pause', () => box.classList.remove('is-playing'));
  audio.addEventListener('loadedmetadata', () => { if (isFinite(audio.duration)) $('#voice-dur').textContent = fmt(audio.duration); });
  audio.addEventListener('timeupdate', () => {
    $('#voice-cur').textContent = fmt(audio.currentTime);
    const p = audio.duration ? audio.currentTime / audio.duration : 0;
    bars.forEach((b, i) => b.classList.toggle('on', i / BARS < p));
  });
  audio.addEventListener('ended', () => { bars.forEach((b) => b.classList.remove('on')); });
  wave.addEventListener('click', (e) => {
    const r = wave.getBoundingClientRect();
    if (audio.duration) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
    if (audio.paused) audio.play();
  });
})();

// ------------------------------------------------------------
// Contact form → WhatsApp
// ------------------------------------------------------------
$('#contact-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const name = f.name.value.trim();
  const wa = f.whatsapp.value.trim();
  const pack = f.pack.value;
  const type = (f.querySelector('[name="type"]:checked') || {}).value || '';
  const msg = f.message.value.trim();
  let ok = true;
  [['name', name], ['whatsapp', wa], ['pack', pack]].forEach(([k, v]) => {
    const field = f[k].closest('.field');
    field.classList.toggle('is-error', !v);
    if (!v) ok = false;
  });
  const note = $('#form-note');
  if (!ok) { note.textContent = '⚠️ عمّر الخانات الضرورية من فضلك'; note.classList.remove('ok'); return; }
  const text = [
    'Bonjour GHARBI AGENCY 👋',
    `Nom / Brand : ${name}`,
    `WhatsApp : ${wa}`,
    `Business : ${type}`,
    `Projet : ${pack}`,
    msg ? `Message : ${msg}` : '',
  ].filter(Boolean).join('\n');
  window.open(`https://wa.me/21697427727?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  note.textContent = '✅ تحلّ WhatsApp — ابعث الميساج وناخذو معاك الاتصال';
  note.classList.add('ok');
  f.reset();
});

// ------------------------------------------------------------
// Mobile menu
// ------------------------------------------------------------
const burger = $('#nav-burger');
function closeMenu() {
  document.body.classList.remove('menu-open');
  burger.setAttribute('aria-expanded', 'false');
  $('#menu').setAttribute('aria-hidden', 'true');
  lenis && lenis.start();
}
burger.addEventListener('click', () => {
  const open = !document.body.classList.contains('menu-open');
  if (!open) { closeMenu(); return; }
  document.body.classList.add('menu-open');
  burger.setAttribute('aria-expanded', 'true');
  $('#menu').setAttribute('aria-hidden', 'false');
  lenis && lenis.stop();
});
