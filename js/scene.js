// ============================================================
// GHARBI AGENCY — WebGL scene
// Chrome 3D GH logo · orbiting ring of video creatives · particles
// Scroll-driven camera (hero progress 0 → 1) + ambient mode after.
// ============================================================
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { WORKS } from './data.js?v=2026.11k';

const BG = 0x050506;
const ACCENT = new THREE.Color('#d4ff3a');

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createScene({ canvas, onProgress, onReady, onCardHover, onCardClick, reducedMotion = false, gentle = 1 }) {
  const isMobile = matchMedia('(max-width: 768px), (pointer: coarse)').matches;

  // ---------- Renderer ----------
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile,
    powerPreference: 'high-performance',
    alpha: false,
  });
  if (!renderer.getContext()) throw new Error('No WebGL');
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 1.75));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.035);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, 10);

  // Coloured rim lights give the chrome its violet / cyan / lime edges
  const l1 = new THREE.PointLight(0x7a5cff, 70); l1.position.set(-4, 2.5, 3); scene.add(l1);
  const l2 = new THREE.PointLight(0x3ad7ff, 50); l2.position.set(4.5, -2, 2.5); scene.add(l2);
  const l3 = new THREE.PointLight(0xd4ff3a, 25); l3.position.set(0, 4, -2); scene.add(l3);

  // ---------- Loading ----------
  const manager = new THREE.LoadingManager();
  let readyFired = false;
  const fireReady = () => { if (!readyFired) { readyFired = true; onReady && onReady(); } };
  manager.onProgress = (_u, loaded, total) => onProgress && onProgress(loaded / total);
  manager.onLoad = fireReady;
  setTimeout(fireReady, 7000); // never block the page on a slow texture

  // ---------- Backlight glow (sprite) ----------
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0x6b55ff, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  glow.scale.set(9, 9, 1); glow.position.z = -2.5;
  scene.add(glow);

  // ---------- Hero group: logo + halo rings ----------
  const hero = new THREE.Group();
  scene.add(hero);

  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 1,
    roughness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    iridescence: 0.6,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [180, 650],
    envMapIntensity: 1.15,
  });

  const logoPivot = new THREE.Group();
  hero.add(logoPivot);

  new SVGLoader(manager).load('media/gh-logo.svg', (data) => {
    const shapes = [];
    data.paths.forEach((p) => shapes.push(...SVGLoader.createShapes(p)));
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: 70,
      bevelEnabled: true,
      bevelThickness: 9,
      bevelSize: 4,
      bevelSegments: isMobile ? 3 : 6,
      curveSegments: isMobile ? 8 : 18,
    });
    geo.center();
    const mesh = new THREE.Mesh(geo, chrome);
    const s = 3.3 / 840; // glyph is ~840px tall in the 960 viewBox
    mesh.scale.set(s, -s, s); // SVG y-down → three y-up (renderer flips winding)
    logoPivot.add(mesh);
  });

  const haloMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.9, fog: false });
  const halo1 = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.007, 8, 256), haloMat);
  const halo2 = new THREE.Mesh(
    new THREE.TorusGeometry(2.75, 0.0035, 6, 256),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, fog: false })
  );
  // tick marks on the outer ring — a camera-lens / timeline feel
  const ticks = (() => {
    const n = 120, pos = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r1 = 2.95, r2 = i % 10 === 0 ? 3.15 : 3.03;
      pos.push(Math.cos(a) * r1, Math.sin(a) * r1, 0, Math.cos(a) * r2, Math.sin(a) * r2, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, fog: false }));
  })();
  const halos = new THREE.Group();
  halos.add(halo1, halo2, ticks);
  hero.add(halos);

  // ---------- Ring of video cards ----------
  const ring = new THREE.Group();
  scene.add(ring);

  const works = isMobile ? WORKS.filter((_, i) => i % 2 === 0) : WORKS;
  const CW = 1.0, CH = 1.78, CR = 0.09;
  const cardGeo = (() => {
    const s = new THREE.Shape();
    const x = -CW / 2, y = -CH / 2;
    s.moveTo(x + CR, y);
    s.lineTo(x + CW - CR, y); s.quadraticCurveTo(x + CW, y, x + CW, y + CR);
    s.lineTo(x + CW, y + CH - CR); s.quadraticCurveTo(x + CW, y + CH, x + CW - CR, y + CH);
    s.lineTo(x + CR, y + CH); s.quadraticCurveTo(x, y + CH, x, y + CH - CR);
    s.lineTo(x, y + CR); s.quadraticCurveTo(x, y, x + CR, y);
    const g = new THREE.ShapeGeometry(s, 6);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x) / CW, (p.getY(i) - y) / CH);
    return g;
  })();

  const cardVert = /* glsl */ `
    varying vec2 vUv; varying float vDepth;
    uniform float uBend;
    void main(){
      vUv = uv;
      vec3 p = position;
      p.z -= (1.0 - cos(p.x * 1.2)) * uBend; // follow the ring's curvature
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`;
  const cardFrag = /* glsl */ `
    uniform sampler2D map; uniform float uHover; uniform float uDim; uniform float uOpacity; uniform float uTime; uniform vec3 uAccent;
    varying vec2 vUv; varying float vDepth;
    void main(){
      vec2 uv = vUv;
      if (!gl_FrontFacing) uv.x = 1.0 - uv.x;  // readable from inside the ring too
      vec4 tex = texture2D(map, uv);
      float b = mix(0.62, 1.05, uHover) * mix(uDim, 1.0, uHover);
      vec3 col = tex.rgb * b;
      // glossy sweep on hover
      float sweep = smoothstep(0.08, 0.0, abs(uv.x + uv.y * 0.6 - mod(uTime * 0.5, 2.4) + 0.4)) * uHover;
      col += sweep * 0.35;
      // accent edge on hover
      float edge = 1.0 - smoothstep(0.0, 0.025, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y) * 0.56));
      col = mix(col, uAccent, edge * uHover);
      float fade = smoothstep(19.0, 7.0, vDepth) * smoothstep(0.4, 1.6, vDepth);
      gl_FragColor = vec4(col, uOpacity * fade);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

  const texLoader = new THREE.TextureLoader(manager);
  const cards = [];
  works.forEach((w, i) => {
    const tex = texLoader.load(w.tex);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: tex },
        uHover: { value: 0 },
        uDim: { value: 0.42 },
        uOpacity: { value: 1 },
        uTime: { value: 0 },
        uBend: { value: 0.05 },
        uAccent: { value: ACCENT },
      },
      vertexShader: cardVert,
      fragmentShader: cardFrag,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const m = new THREE.Mesh(cardGeo, mat);
    m.userData = { work: w, index: i, hover: 0, bob: Math.random() * Math.PI * 2 };
    ring.add(m);
    cards.push(m);
  });

  function layoutRing(radius) {
    const n = cards.length;
    cards.forEach((m, i) => {
      const a = (i / n) * Math.PI * 2;
      m.position.set(Math.sin(a) * radius, 0, Math.cos(a) * radius);
      m.rotation.y = a; // face outward
    });
  }

  // ---------- Particles ----------
  const PN = isMobile ? 700 : 1800;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PN * 3), pSeed = new Float32Array(PN);
  for (let i = 0; i < PN; i++) {
    const r = 5 + Math.pow(Math.random(), 0.6) * 20;
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pPos[i * 3 + 1] = r * Math.cos(ph) * 0.6;
    pPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    pSeed[i] = Math.random();
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(pSeed, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uAccent: { value: ACCENT } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; uniform float uPR; varying float vA; varying float vSeed;
      void main(){
        vec3 p = position;
        p.y += sin(uTime * 0.2 + aSeed * 40.0) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (2.0 + aSeed * 3.5) * uPR * (12.0 / -mv.z);
        vA = (0.35 + 0.65 * sin(uTime * (0.6 + aSeed) + aSeed * 30.0) * 0.5 + 0.5) * smoothstep(30.0, 6.0, -mv.z);
        vSeed = aSeed;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uAccent; varying float vA; varying float vSeed;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 c = mix(vec3(1.0), uAccent, step(0.92, vSeed));
        gl_FragColor = vec4(c, a * vA * 0.7);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // ---------- Post-processing (desktop) ----------
  let composer = null, bloom = null;
  if (!isMobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.2, 0.45, 0.96);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  // ---------- State ----------
  const state = {
    progress: 0,   // hero scroll 0..1
    page: 0,       // rest of the page 0..1
    interactive: true,
    mouse: new THREE.Vector2(0, 0),
    mouseSmooth: new THREE.Vector2(0, 0),
    spin: 0,
    velocity: 0,
  };
  const cur = { camZ: 10, camY: 0, logoZ: 0, logoS: 1, logoY: 0, logoX: 0, spin: 0, radius: 4.3, tilt: 0.42, ringY: -1.1, glow: 0.3, dim: 0.42, look: 0 };

  function portraitFactor() {
    const a = innerWidth / innerHeight;
    return a < 1 ? Math.min(1.9, 1 / a * 0.95) : 1;
  }

  function targets() {
    const p = state.progress;
    const A = ease(seg(p, 0, 0.42));
    const B = ease(seg(p, 0.38, 0.76));
    const C = ease(seg(p, 0.72, 1));
    const M = ease(seg(p, 0.14, 0.36));
    const pf = portraitFactor();
    const wide = innerWidth / innerHeight > 1.15;
    const side = wide ? 1.9 : 0;          // logo slides right so copy on the left stays clean
    const lift = wide ? 0 : 0.9;          // portrait: logo goes up, copy sits at the bottom
    // Path: front view → rise above the ring → dive inside it (never through a card)
    return {
      camZ: lerp(lerp(lerp(10, 9.2, A), 4.2, B), 0.8, C) * lerp(pf, 1, B),
      camY: lerp(lerp(lerp(0, 0.4, A), 2.9, B), 0.15, C),
      logoZ: lerp(0, -1.2, B) - C * 2.8,
      logoS: lerp(lerp(1, 0.95, A), 0.7, B) * lerp(1, 0.62, C),
      logoY: lerp(0, 0.3 + lift, M) + lerp(0, 0.4, C) * (wide ? 0 : 1),
      logoX: lerp(lerp(0, side, M), side * 0.45, C),
      spin: Math.PI * 2 * (ease(seg(p, 0.18, 0.34)) + ease(seg(p, 0.6, 0.76))),
      radius: lerp(lerp(4.3, 4.6, A), 5.4, B),
      tilt: lerp(lerp(0.42, 0.3, A), 0, B),
      ringY: lerp(lerp(-1.1, -0.8, A), 0, B),
      glow: lerp(0.3, 0.16, B),
      dim: lerp(0.42, 1, seg(p, 0.3, 0.7)),
      look: C,
    };
  }

  // ---------- Interaction ----------
  const raycaster = new THREE.Raycaster();
  let hovered = null;
  const ndc = new THREE.Vector2(9, 9);

  addEventListener('pointermove', (e) => {
    state.mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ndc.copy(state.mouse);
  }, { passive: true });

  function pick() {
    if (!state.interactive || isMobile) { setHover(null); return; }
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(cards, false)[0];
    // ignore cards almost invisible (fogged / behind)
    setHover(hit && hit.distance < 16 ? hit.object : null);
  }
  function setHover(m) {
    if (m === hovered) return;
    hovered = m;
    onCardHover && onCardHover(m ? m.userData.work : null);
  }
  function click() {
    if (hovered && state.interactive) { onCardClick && onCardClick(hovered.userData.work); return true; }
    return false;
  }

  // ---------- Resize ----------
  function resize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (composer) { composer.setSize(w, h); bloom.setSize(w, h); }
  }
  addEventListener('resize', resize);

  // ---------- Loop ----------
  const RING_SPEED = (Math.PI * 2) / 26;
  let spinSpeed = RING_SPEED;
  const clock = new THREE.Clock();
  let running = true, frame = 0, raf = 0;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    cancelAnimationFrame(raf);
    if (running) { clock.getDelta(); loop(); }
  });

  function loop() {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const k = 1 - Math.pow(0.0015, dt); // frame-rate independent damping

    state.mouseSmooth.lerp(state.mouse, 1 - Math.pow(0.02, dt));
    const T = targets();
    for (const key in T) cur[key] = lerp(cur[key], T[key], k);

    // camera
    const mx = state.mouseSmooth.x, my = state.mouseSmooth.y;
    camera.position.set(mx * 0.45, cur.camY + my * 0.3, cur.camZ);
    camera.lookAt(0, lerp(cur.camY * 0.15, 0.2, cur.look), lerp(cur.logoZ, -5, cur.look));

    // logo
    const idle = reducedMotion ? 0 : t * gentle;
    logoPivot.rotation.y = Math.sin(idle * 0.45) * 0.3 + cur.spin + mx * 0.35;
    logoPivot.rotation.x = Math.sin(idle * 0.6) * 0.06 - my * 0.18;
    logoPivot.position.y = Math.sin(idle * 0.9) * 0.06;
    hero.position.set(cur.logoX, cur.logoY, cur.logoZ);
    hero.scale.setScalar(cur.logoS);
    halos.rotation.z = idle * 0.12;
    halos.rotation.x = Math.sin(idle * 0.3) * 0.15 + my * 0.1;
    halos.rotation.y = mx * 0.2;
    halo1.scale.setScalar(1 + Math.sin(idle * 1.4) * 0.01);
    glow.material.opacity = cur.glow;
    glow.position.set(cur.logoX, cur.logoY, cur.logoZ - 2.5);

    // ring
    state.velocity *= 0.92;
    // ~1 full turn every 26s, slows a little while a card is hovered so it can be clicked
    spinSpeed += ((hovered ? 0.05 : RING_SPEED) - spinSpeed) * k;
    state.spin += dt * spinSpeed + state.velocity;
    layoutRing(cur.radius);
    ring.rotation.set(cur.tilt, state.spin + state.page * Math.PI * 1.5, 0);
    ring.position.y = cur.ringY;
    cards.forEach((m) => {
      const ud = m.userData;
      ud.hover = lerp(ud.hover, m === hovered ? 1 : 0, k * 1.4);
      m.material.uniforms.uHover.value = ud.hover;
      m.material.uniforms.uDim.value = cur.dim;
      m.material.uniforms.uTime.value = t;
      m.position.y = Math.sin(idle * 0.8 + ud.bob) * 0.08;
      const s = 1 + ud.hover * 0.12;
      m.scale.set(s, s, s);
    });

    particles.rotation.y = t * 0.012 + state.page * 0.6;
    pMat.uniforms.uTime.value = t;

    if ((frame++ & 1) === 0) pick();
    composer ? composer.render() : renderer.render(scene, camera);
  }
  loop();

  return {
    setProgress(p) { state.velocity += (p - state.progress) * 0.6; state.progress = p; },
    setPage(p) { state.page = p; },
    setInteractive(v) { state.interactive = v; if (!v) setHover(null); },
    click,
    isMobile,
  };
}
