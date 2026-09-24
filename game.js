import * as THREE from 'three';

// ============================================================
//  ABSTRACT CLAY — 3D Meme Dance Blob
//  No score. No fail. Just vibe & mutate.
// ============================================================

// ----- helpers -----
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const TAU = Math.PI * 2;

// ============================================================
//  AUDIO (Web Audio synth — no external files)
// ============================================================
let audioCtx = null;
let musicNode = null;
let musicGain = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// BGM — pre-render a chaotic loop
function buildBGM() {
  const bpm = 140;
  const beat = 60 / bpm;
  const len = beat * 16;
  const sr = audioCtx.sampleRate;
  const buf = audioCtx.createBuffer(2, sr * len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const b = Math.floor(t / beat) % 16;
      let v = 0;
      // kick on every beat
      if (t % beat < 0.08) v += Math.sin((t % beat) * 120) * 0.5 * Math.exp(-(t % beat) * 30);
      // bass
      const bassNotes = [55, 55, 73, 65];
      const f = bassNotes[b % 4];
      v += Math.sin(2 * Math.PI * f * t) * 0.18;
      // lead arp
      const leadNotes = [220, 277, 330, 415, 330, 277, 220, 165];
      const lf = leadNotes[b % 8];
      const lt = t % beat;
      if (lt < 0.15) v += Math.sin(2 * Math.PI * lf * t) * 0.12 * (1 - lt / 0.15);
      // hi-hat noise on off-beats
      if (b % 2 === 1 && (t % beat) < 0.04) v += (Math.random() - 0.5) * 0.15;
      d[i] = Math.max(-1, Math.min(1, v * 0.9));
    }
  }
  return buf;
}

function startBGM() {
  ensureAudio();
  if (musicNode) { try { musicNode.stop(); } catch (e) {} }
  const src = audioCtx.createBufferSource();
  src.buffer = buildBGM();
  src.loop = true;
  musicGain = audioCtx.createGain();
  musicGain.gain.value = 0.35;
  src.connect(musicGain).connect(audioCtx.destination);
  src.start();
  musicNode = src;
}

function sfx(type) {
  ensureAudio();
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.connect(g).connect(audioCtx.destination);
  if (type === 'hit') {
    o.type = 'square'; o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(440, t + 0.1);
    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.start(t); o.stop(t + 0.13);
  } else if (type === 'wobble') {
    o.type = 'sawtooth'; o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(600, t + 0.15);
    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.start(t); o.stop(t + 0.2);
  } else if (type === 'pop') {
    o.type = 'sine'; o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.start(t); o.stop(t + 0.11);
  } else if (type === 'explode') {
    const bufSize = audioCtx.sampleRate * 0.5;
    const noiseBuf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const ns = audioCtx.createBufferSource();
    ns.buffer = noiseBuf;
    const ng = audioCtx.createGain();
    ng.gain.value = 0.4;
    ns.connect(ng).connect(audioCtx.destination);
    ns.start(t);
  } else if (type === 'combo') {
    o.type = 'triangle'; o.frequency.setValueAtTime(523, t);
    o.frequency.setValueAtTime(659, t + 0.06); o.frequency.setValueAtTime(784, t + 0.12);
    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.start(t); o.stop(t + 0.26);
  }
}

// ============================================================
//  CHARACTER CONFIG
// ============================================================
const HEADS = ['crt', 'mirror', 'blackhole', 'camera', 'tv', 'fishbowl', 'mushroom', 'trafficcone'];
const BODY_TYPES = ['blob', 'cube', 'pyramid', 'donut', 'capsule', 'crystal'];
const LIMB_TYPES = ['hand', 'slipper', 'chicken', 'plug', 'tentacle', 'spring', 'mitten', 'fork'];
const SKINS = [
  { hue: 140, name: 'toxic' },
  { hue: 320, name: 'bubblegum' },
  { hue: 50, name: 'banana' },
  { hue: 200, name: 'ocean' },
  { hue: 0, name: 'cherry' },
  { hue: 280, name: 'grape' },
  { hue: 180, name: 'mint' },
  { hue: 30, name: 'sunset' },
];
const SKIN_TEXTURES = ['graffiti', 'bullethell', 'glitch', 'solid'];
const FACES = ['happy', 'angry', 'wink', 'tongue', 'dizzy', 'smug', 'maniac', 'deadpan'];
const EMOJIS = ['😀','😂','🤪','😎','🥴','🤡','👽','💀','🤖','🎃','👻','🐸','🍆','🍑','💥','🔥','✨','🌈','💫','🌀','⚡','🎉','👁️','🧠'];
const MEME_WORDS = ['YESS','SLAY','FIRE','EPIC','WTF','LOL','NOICE','GIGACHAD','CRINGE','BASED','VIBE','CHAOS','WOBBLE','MELT','BONK'];

const PRESETS = [
  { emoji:'👁️', name:'Watcher', head:'crt', body:'blob', limbs:['tentacle','tentacle','tentacle','tentacle'], skin:SKINS[2], face:'smug' },
  { emoji:'🌀', name:'Void', head:'blackhole', body:'donut', limbs:['spring','spring','spring','spring'], skin:SKINS[6], face:'dizzy' },
  { emoji:'📺', name:'Static', head:'tv', body:'cube', limbs:['plug','plug','plug','plug'], skin:SKINS[0], face:'maniac' },
  { emoji:'🪞', name:'Mirror', head:'mirror', body:'crystal', limbs:['hand','hand','hand','hand'], skin:SKINS[3], face:'deadpan' },
  { emoji:'📷', name:'Flash', head:'camera', body:'capsule', limbs:['spring','spring','plug','plug'], skin:SKINS[1], face:'wink' },
  { emoji:'🍄', name:'Shroom', head:'mushroom', body:'blob', limbs:['tentacle','slipper','tentacle','slipper'], skin:SKINS[5], face:'happy' },
  { emoji:'🐸', name:'Ribbit', head:'fishbowl', body:'blob', limbs:['mitten','mitten','mitten','mitten'], skin:SKINS[0], face:'tongue' },
  { emoji:'🚧', name:'Cone', head:'trafficcone', body:'pyramid', limbs:['fork','fork','fork','fork'], skin:SKINS[7], face:'angry' },
];

function genCharacter() {
  return {
    head: pick(HEADS),
    body: pick(BODY_TYPES),
    limbs: [pick(LIMB_TYPES), pick(LIMB_TYPES), pick(LIMB_TYPES), pick(LIMB_TYPES)],
    skin: pick(SKINS),
    skinTex: pick(SKIN_TEXTURES),
    face: pick(FACES),
    headSize: rand(0.6, 1.0),
    bodyLen: rand(0.8, 1.4),
    headPhase: Math.random() * TAU,
    bodyPhase: Math.random() * TAU,
    eyePhase: [Math.random()*TAU, Math.random()*TAU],
    limbPhase: [0, Math.PI, Math.PI/2, -Math.PI/2],
    numLimbs: Math.floor(rand(0, 9)),
    action: 'idle', actionT: 0,
  };
}

// ============================================================
//  2D PREVIEW (character select screen)
// ============================================================
let previewChar = genCharacter();
let previewCtx = null;
const cvs = document.getElementById('game-canvas');
let ctx = null; // 2D context — only used for preview (char-preview-canvas), never game-canvas

function charFromPreset(p) {
  return {
    head: p.head, body: p.body, limbs: [...p.limbs], skin: p.skin,
    skinTex: pick(SKIN_TEXTURES), face: p.face,
    headSize: rand(0.6,1), bodyLen: rand(0.8,1.4),
    headPhase: Math.random()*TAU, bodyPhase: Math.random()*TAU,
    eyePhase: [Math.random()*TAU, Math.random()*TAU],
    limbPhase: [0,Math.PI,Math.PI/2,-Math.PI/2],
    numLimbs: 4, action:'idle', actionT:0,
  };
}

const NAME_PREFIX = ['Disco','Cyber','Mega','Ultra','Wobble','Chaos','Meme','Cosmic','Retro','Funky','Glitch','Turbo','Goopy','Melty'];
const NAME_SUFFIX = ['Blob','Goop','Jelly','Mush','Slime','Puddle','Drip','Gloop','Wobbler','Dancer','Spaz','Freak'];
function genCharName() { return pick(NAME_PREFIX) + ' ' + pick(NAME_SUFFIX); }

function rerollPart(part) {
  if (part === 'head') previewChar.head = pick(HEADS);
  else if (part === 'body') previewChar.body = pick(BODY_TYPES);
  else if (part === 'limbs') previewChar.limbs = [pick(LIMB_TYPES),pick(LIMB_TYPES),pick(LIMB_TYPES),pick(LIMB_TYPES)];
  else if (part === 'skin') { previewChar.skin = pick(SKINS); previewChar.skinTex = pick(SKIN_TEXTURES); }
  else if (part === 'face') previewChar.face = pick(FACES);
  else if (part === 'all') previewChar = genCharacter();
  updateCharName();
}

function applyPreset(idx) {
  previewChar = charFromPreset(PRESETS[idx]);
  updateCharName();
  document.querySelectorAll('.preset-card').forEach((el, i) => el.classList.toggle('active', i === idx));
}

function updateCharName() {
  const el = document.getElementById('char-name');
  if (el) el.textContent = genCharName();
}

function initPreview() {
  const pc = document.getElementById('char-preview-canvas');
  if (!pc) return;
  previewCtx = pc.getContext('2d');
  updateCharName();
  renderPresets();
  requestAnimationFrame(previewLoop);
}

function previewLoop(t) {
  if (previewCtx) {
    const pc = previewCtx.canvas;
    previewCtx.clearRect(0, 0, pc.width, pc.height);
    const hue = (t * 0.05) % 360;
    previewCtx.fillStyle = `hsla(${hue},60%,10%,0.3)`;
    previewCtx.fillRect(0, 0, pc.width, pc.height);
    const saved = ctx; ctx = previewCtx;
    ctx.save();
    ctx.translate(pc.width/2, pc.height*0.62);
    ctx.scale(0.62, 0.62);
    ctx.translate(0, Math.sin(t*0.004)*6);
    drawBody2D(previewChar, t, 0);
    ctx.restore();
    ctx = saved;
  }
  if (state !== 'PLAYING') requestAnimationFrame(previewLoop);
}

function renderPresets() {
  const list = document.getElementById('preset-list');
  if (!list) return;
  list.innerHTML = '';
  PRESETS.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'preset-card';
    card.textContent = p.emoji; card.title = p.name;
    card.addEventListener('click', () => applyPreset(i));
    list.appendChild(card);
  });
}

// ----- 2D drawing for preview -----
function drawBody2D(c, t, beat) {
  if (!c) return;
  const hue = c.skin.hue;
  const bob = Math.sin(t * 0.005 + c.bodyPhase) * 4;
  ctx.save();
  ctx.translate(0, bob);
  // body
  ctx.fillStyle = `hsl(${hue},80%,55%)`;
  ctx.strokeStyle = `hsl(${hue},90%,70%)`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const w = 70, h = 80 * c.bodyLen;
  ctx.ellipse(0, 0, w, h, 0, 0, TAU);
  ctx.fill(); ctx.stroke();
  // glossy highlight
  ctx.fillStyle = `hsla(${hue},100%,80%,0.4)`;
  ctx.beginPath();
  ctx.ellipse(-20, -h*0.4, 18, 28, -0.3, 0, TAU);
  ctx.fill();
  // limbs
  for (let i = 0; i < Math.min(4, c.numLimbs || 4); i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const up = i < 2 ? -1 : 1;
    const lx = side * (w - 5);
    const ly = up * (h * 0.4);
    const wave = Math.sin(t*0.006 + i) * 0.4;
    ctx.strokeStyle = `hsl(${hue},70%,50%)`;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.quadraticCurveTo(lx + side*30, ly + up*10, lx + side*(40 + wave*10), ly + up*40);
    ctx.stroke();
  }
  // head
  const hy = -h - 30;
  drawHead2D(c, 0, hy, t);
  ctx.restore();
}

function drawHead2D(c, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  const s = c.headSize;
  ctx.scale(s, s);
  if (c.head === 'crt' || c.head === 'tv') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-35, -30, 70, 60);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 4;
    ctx.strokeRect(-35, -30, 70, 60);
    ctx.fillStyle = `hsl(${c.skin.hue},80%,40%)`;
    ctx.fillRect(-30, -25, 60, 45);
    ctx.font = '20px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const e = EMOJIS[Math.floor(t*0.001) % EMOJIS.length];
    ctx.fillText(e, 0, 0);
  } else if (c.head === 'blackhole') {
    const g = ctx.createRadialGradient(0,0,2,0,0,40);
    g.addColorStop(0, '#000'); g.addColorStop(0.6, '#4a0080'); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0,0,40,0,TAU); ctx.fill();
    ctx.strokeStyle = `hsl(${c.skin.hue},80%,60%)`;
    ctx.lineWidth = 2;
    for (let r=8;r<=38;r+=6){
      ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.stroke();
    }
  } else if (c.head === 'mirror') {
    ctx.fillStyle = '#aee';
    ctx.beginPath(); ctx.ellipse(0,0,30,38,0,0,TAU); ctx.fill();
    ctx.strokeStyle = '#888'; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.ellipse(-10,-12,8,14,-0.3,0,TAU); ctx.fill();
  } else if (c.head === 'camera') {
    ctx.fillStyle = '#333';
    ctx.fillRect(-30,-22,60,44);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(0,0,16,0,TAU); ctx.fill();
    ctx.fillStyle = `hsl(${c.skin.hue},80%,50%)`;
    ctx.beginPath(); ctx.arc(0,0,9,0,TAU); ctx.fill();
    ctx.fillStyle = '#ff2d95';
    ctx.fillRect(15,-18,10,6);
  } else if (c.head === 'fishbowl') {
    ctx.fillStyle = 'rgba(120,200,255,0.5)';
    ctx.beginPath(); ctx.arc(0,5,32,0,TAU); ctx.fill();
    ctx.strokeStyle = '#9cf'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#fa3';
    ctx.beginPath(); ctx.ellipse(0,10,12,8,0,0,TAU); ctx.fill();
  } else if (c.head === 'mushroom') {
    ctx.fillStyle = `hsl(${c.skin.hue},70%,55%)`;
    ctx.beginPath(); ctx.arc(0,-8,34,Math.PI,0); ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i=0;i<5;i++){ ctx.beginPath(); ctx.arc(rand(-20,20),rand(-30,-5),4,0,TAU); ctx.fill(); }
    ctx.fillStyle = '#fec'; ctx.fillRect(-10,-8,20,25);
  } else { // trafficcone
    ctx.fillStyle = '#f80';
    ctx.beginPath();
    ctx.moveTo(0,-38); ctx.lineTo(22,20); ctx.lineTo(-22,20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-18,-10,36,7); ctx.fillRect(-16,5,32,5);
  }
  ctx.restore();
}

// ============================================================
//  THREE.JS 3D SCENE
// ============================================================
let scene, camera, renderer, clock;
let blobs = [];
let vibe = 0;
let memeStormActive = false;

function setupThree() {
  try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0014);
    scene.fog = new THREE.FogExp2(0x0a0014, 0.04);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 100);
    camera.position.set(0, 1, 8);

    renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // lights
    const amb = new THREE.AmbientLight(0xffffff, 0.4); scene.add(amb);
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(5, 8, 5); scene.add(key);
    const rim = new THREE.PointLight(0xff2d95, 2, 20);
    rim.position.set(-4, 2, 3); scene.add(rim);
    const fill = new THREE.PointLight(0x39ff14, 1.5, 20);
    fill.position.set(4, -2, 3); scene.add(fill);

    // floor grid
    const grid = new THREE.GridHelper(30, 30, 0x39ff14, 0x1a0033);
    grid.position.y = -2.5; scene.add(grid);

    clock = new THREE.Clock();
    window.addEventListener('resize', onResize);
  } catch (e) {
    console.warn('WebGL not available in this environment:', e.message);
  }
}

function onResize() {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ----- Clay body shader (jelly wobble) -----
const clayVertexShader = `
  uniform float uTime;
  uniform float uVibe;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec3 pos = position;
    float n = sin(pos.x*3.0 + uTime*2.0) * cos(pos.y*3.0 + uTime*1.5) * sin(pos.z*3.0 + uTime*2.5);
    float wobble = n * 0.12 * (1.0 + uVibe*0.5);
    pos += normal * wobble;
    float breathe = sin(uTime*2.0) * 0.04;
    pos *= (1.0 + breathe);
    vPos = pos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;
const clayFragmentShader = `
  uniform vec3 uColor;
  uniform float uVibe;
  uniform float uGlitch;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vec3 lightDir = normalize(vec3(0.5, 0.8, 0.6));
    float diff = max(dot(vNormal, lightDir), 0.0);
    float rim = pow(1.0 - max(dot(vNormal, vec3(0,0,1)), 0.0), 2.0);
    vec3 col = uColor * (0.3 + diff*0.7) + uColor * rim * 0.6;
    // glitch stripes
    if (uGlitch > 0.5) {
      float stripe = step(0.5, fract(vPos.y * 8.0));
      col = mix(col, col * 1.5, stripe * 0.4);
      if (fract(vPos.x * 3.0 + uTime*0.1) > 0.98) col = vec3(1.0);
    }
    col += uColor * uVibe * 0.3;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ----- CRT head texture (canvas with emojis) -----
function makeCRTTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const cx = c.getContext('2d');
  return { canvas: c, ctx: cx, texture: new THREE.CanvasTexture(c) };
}
function updateCRT(crt, t, emoji) {
  const { ctx: cx, canvas: c, texture } = crt;
  cx.fillStyle = '#001a00'; cx.fillRect(0,0,c.width,c.height);
  // scanlines
  for (let y=0; y<c.height; y+=4) {
    cx.fillStyle = 'rgba(0,0,0,0.4)'; cx.fillRect(0,y,c.width,2);
  }
  // emoji
  cx.font = '120px serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText(emoji, c.width/2, c.height/2);
  // noise
  for (let i=0;i<80;i++){
    cx.fillStyle = `rgba(0,255,0,${Math.random()*0.3})`;
    cx.fillRect(Math.random()*c.width, Math.random()*c.height, 2, 2);
  }
  texture.needsUpdate = true;
}

// ----- Build a clay blob character in 3D -----
class ClayBlob {
  constructor(config, isChild=false) {
    this.config = config;
    this.isChild = isChild;
    this.group = new THREE.Group();
    this.phase = Math.random() * TAU;
    this.danceSeed = Math.random() * 100;
    this.limbs = [];
    this.heads = [];
    this.wheels = [];
    this.wings = [];
    this.mutateTimer = rand(3, 8);
    this.lifeTimer = 0;
    this.scale = isChild ? rand(0.3, 0.55) : 1;
    this.build();
    if (scene) scene.add(this.group);
  }

  build() {
    const c = this.config;
    const hue = c.skin.hue / 360;
    const color = new THREE.Color().setHSL(hue, 0.8, 0.55);

    // body geometry
    let geo;
    const s = c.bodyLen;
    switch (c.body) {
      case 'cube': geo = new THREE.BoxGeometry(1.6*s, 1.6*s, 1.6*s); break;
      case 'pyramid': geo = new THREE.ConeGeometry(1.2*s, 2*s, 4); break;
      case 'donut': geo = new THREE.TorusGeometry(0.9*s, 0.5*s, 16, 32); break;
      case 'capsule': geo = new THREE.CapsuleGeometry(0.8*s, 1.2*s, 8, 16); break;
      case 'crystal': geo = new THREE.OctahedronGeometry(1.1*s, 0); break;
      default: geo = new THREE.IcosahedronGeometry(1.1*s, 3);
    }

    this.bodyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: color },
        uVibe: { value: 0 },
        uGlitch: { value: c.skinTex === 'glitch' ? 1 : 0 },
      },
      vertexShader: clayVertexShader,
      fragmentShader: clayFragmentShader,
    });

    // graffiti/bullethell texture overlay
    if (c.skinTex === 'graffiti') {
      this.bodyMat.uniforms.uGlitch.value = 0;
      color.offsetHSL(0, 0, 0.1);
    }

    this.body = new THREE.Mesh(geo, this.bodyMat);
    this.group.add(this.body);

    // limbs (0-8)
    const numL = this.isChild ? Math.floor(rand(0,5)) : c.numLimbs;
    for (let i = 0; i < numL; i++) this.addLimb(i, numL);

    // head(s)
    this.addHead();
  }

  addLimb(i, total) {
    const c = this.config;
    const type = c.limbs[i % c.limbs.length];
    const limbGroup = new THREE.Group();
    // position on body surface
    const angle = (i / Math.max(1,total)) * TAU + this.phase;
    const side = i % 2 === 0 ? -1 : 1;
    const height = rand(-0.6, 0.8);
    limbGroup.position.set(Math.cos(angle)*0.9*c.bodyLen*side*0.6, height, Math.sin(angle)*0.6);

    // limb arm
    const armLen = rand(0.6, 1.1);
    const armGeo = new THREE.CylinderGeometry(0.06, 0.08, armLen, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness:0.5, metalness:0.3 });
    armMat.color.setHSL(c.skin.hue/360, 0.6, 0.45);
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.y = -armLen/2;
    limbGroup.add(arm);

    // end
    const end = new THREE.Group();
    end.position.y = -armLen;
    const endColor = new THREE.Color().setHSL(c.skin.hue/360, 0.7, 0.6);
    switch (type) {
      case 'hand': { // thumbs-up
        const palm = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.22,0.1), new THREE.MeshStandardMaterial({color:0xffdbac}));
        const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.2,0.07), new THREE.MeshStandardMaterial({color:0xffdbac}));
        thumb.position.set(0.13, 0.1, 0); end.add(palm, thumb); break;
      }
      case 'slipper': {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.08,0.5), new THREE.MeshStandardMaterial({color:endColor}));
        end.add(s); break;
      }
      case 'chicken': {
        for (let k=0;k<3;k++){
          const toe = new THREE.Mesh(new THREE.ConeGeometry(0.02,0.2,6), new THREE.MeshStandardMaterial({color:0xffa500}));
          toe.position.set((k-1)*0.08, -0.08, 0); toe.rotation.x = Math.PI;
          end.add(toe);
        } break;
      }
      case 'plug': {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.12,0.18,8), new THREE.MeshStandardMaterial({color:0x444}));
        const pin1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.12,6), new THREE.MeshStandardMaterial({color:0xccc}));
        pin1.position.set(0.05,-0.14,0);
        const pin2 = pin1.clone(); pin2.position.x = -0.05;
        end.add(body, pin1, pin2); break;
      }
      case 'tentacle': {
        for (let k=0;k<4;k++){
          const seg = new THREE.Mesh(new THREE.SphereGeometry(0.06-k*0.01,8,8), new THREE.MeshStandardMaterial({color:endColor}));
          seg.position.set(0, -k*0.07, 0); end.add(seg);
        } break;
      }
      case 'spring': {
        for (let k=0;k<5;k++){
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08,0.02,8,16), new THREE.MeshStandardMaterial({color:0x999, metalness:0.8}));
          ring.position.y = -k*0.06; ring.rotation.x = Math.PI/2; end.add(ring);
        } break;
      }
      case 'mitten': {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.12,12,12), new THREE.MeshStandardMaterial({color:endColor}));
        m.scale.set(1,1.1,0.7); end.add(m); break;
      }
      case 'fork': {
        for (let k=0;k<3;k++){
          const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.22,6), new THREE.MeshStandardMaterial({color:0xccc, metalness:0.8}));
          tine.position.set((k-1)*0.05, -0.1, 0); end.add(tine);
        }
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.12,8), new THREE.MeshStandardMaterial({color:0xaaa, metalness:0.6}));
        end.add(handle); break;
      }
    }
    limbGroup.add(end);
    limbGroup.userData = { type, end, arm, baseY: height, phase: this.phase + i };
    this.limbs.push(limbGroup);
    this.group.add(limbGroup);
  }

  addHead() {
    const c = this.config;
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.4 * c.bodyLen;
    const s = c.headSize;
    headGroup.scale.setScalar(s);

    const headColor = new THREE.Color().setHSL(c.skin.hue/360, 0.7, 0.5);

    if (c.head === 'crt' || c.head === 'tv') {
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.9, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
      );
      headGroup.add(screen);
      // CRT screen face
      this.crt = makeCRTTexture();
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(1.0, 0.7),
        new THREE.MeshBasicMaterial({ map: this.crt.texture })
      );
      face.position.z = 0.16;
      headGroup.add(face);
      this.crtFace = face;
    } else if (c.head === 'blackhole') {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.6, 0.08, 8, 32),
        new THREE.MeshStandardMaterial({ color: headColor, emissive: headColor, emissiveIntensity: 0.6 })
      );
      headGroup.add(ring);
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
      );
      headGroup.add(core);
    } else if (c.head === 'mirror') {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 24, 24),
        new THREE.MeshStandardMaterial({ color: 0xaaddff, metalness: 0.9, roughness: 0.1 })
      );
      headGroup.add(m);
    } else if (c.head === 'camera') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.0,0.7,0.6), new THREE.MeshStandardMaterial({color:0x333}));
      headGroup.add(body);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.25,0.3,16), new THREE.MeshStandardMaterial({color:0x111}));
      lens.rotation.x = Math.PI/2; lens.position.z = 0.4; headGroup.add(lens);
      const flash = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.12,0.05), new THREE.MeshStandardMaterial({color:0xff2d95, emissive:0xff2d95, emissiveIntensity:0.8}));
      flash.position.set(0.3,0.25,0.32); headGroup.add(flash);
    } else if (c.head === 'fishbowl') {
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.6,24,24,0,TAU,0,Math.PI/2), new THREE.MeshStandardMaterial({color:0x88ccff, transparent:true, opacity:0.5}));
      headGroup.add(bowl);
      const fish = new THREE.Mesh(new THREE.SphereGeometry(0.2,12,12), new THREE.MeshStandardMaterial({color:0xff8833}));
      fish.scale.set(1.4,0.7,0.7); fish.position.y = -0.1; headGroup.add(fish);
    } else if (c.head === 'mushroom') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.6,24,16,0,TAU,0,Math.PI/2), new THREE.MeshStandardMaterial({color:headColor}));
      cap.position.y = 0.2; headGroup.add(cap);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.3,0.4,12), new THREE.MeshStandardMaterial({color:0xffeedd}));
      stem.position.y = -0.1; headGroup.add(stem);
    } else { // trafficcone
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5,1.0,16), new THREE.MeshStandardMaterial({color:0xff8800}));
      headGroup.add(cone);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,0.12,16), new THREE.MeshStandardMaterial({color:0xffffff}));
      band.position.y = -0.1; headGroup.add(band);
    }
    this.heads.push(headGroup);
    this.group.add(headGroup);
  }

  update(dt, t) {
    this.lifeTimer += dt;
    const c = this.config;
    const v = vibe / 100;

    // shader uniforms
    if (this.bodyMat) {
      this.bodyMat.uniforms.uTime.value = t;
      this.bodyMat.uniforms.uVibe.value = v;
    }

    // dance — bob & wiggle
    const bob = Math.sin(t * 3 + this.danceSeed) * (0.15 + v * 0.3);
    const wiggle = Math.sin(t * 2 + this.danceSeed) * 0.1 * (1 + v);
    this.group.position.y = bob + (this.isChild ? -0.5 : 0);
    this.group.rotation.z = wiggle;
    this.group.rotation.y = Math.sin(t * 0.7 + this.danceSeed) * 0.3;

    // body squash & stretch
    const sq = 1 + Math.sin(t * 4 + this.danceSeed) * 0.08 * (1 + v);
    if (this.body) this.body.scale.set(1/sq, sq, 1/sq);

    // limbs flail
    this.limbs.forEach((l, i) => {
      const ud = l.userData;
      l.rotation.z = Math.sin(t * 5 + i) * 0.5 * (1 + v);
      l.rotation.x = Math.cos(t * 4 + i * 0.7) * 0.3;
      // end jitter
      if (ud.end) {
        ud.end.rotation.x = Math.sin(t * 8 + i) * 0.4;
        ud.end.rotation.y = Math.cos(t * 6 + i) * 0.4;
      }
    });

    // heads bob & CRT update
    this.heads.forEach((h, i) => {
      h.position.y = 1.4 * c.bodyLen + Math.sin(t * 3 + i) * 0.1;
      h.rotation.z = Math.sin(t * 2 + i) * 0.15;
    });
    if (this.crt && this.crtFace) {
      const eIdx = Math.floor(t * 1.5 + this.danceSeed) % EMOJIS.length;
      updateCRT(this.crt, t, EMOJIS[eIdx]);
    }

    // mutation timer
    this.mutateTimer -= dt;
    if (this.mutateTimer <= 0 && !this.isChild) {
      this.mutate();
      this.mutateTimer = rand(4, 10);
    }

    // child lifetime — merge back
    if (this.isChild && this.lifeTimer > 12) {
      this.mergeBack();
    }
  }

  mutate() {
    const r = Math.random();
    if (r < 0.25 && this.heads.length < 3) {
      // grow extra head
      const h = new THREE.Group();
      h.position.set(rand(-1,1), 1.4*this.config.bodyLen+rand(0,0.3), rand(-0.3,0.3));
      h.scale.setScalar(0.6);
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.5,16,16), this.bodyMat);
      h.add(sphere);
      this.heads.push(h); this.group.add(h);
      spawnMemeText(window.innerWidth/2, window.innerHeight*0.4, 'EXTRA HEAD!', '#ff2d95');
      sfx('pop');
    } else if (r < 0.5) {
      // swap body type
      const newBody = pick(BODY_TYPES);
      if (newBody !== this.config.body) {
        this.config.body = newBody;
        this.rebuildBody();
        spawnMemeText(window.innerWidth/2, window.innerHeight*0.4, 'BODY SWAP!', '#39ff14');
        sfx('wobble');
      }
    } else if (r < 0.65) {
      // grow wheels
      for (let k=0;k<2;k++){
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.3,0.1,8,16), new THREE.MeshStandardMaterial({color:0x222, metalness:0.7}));
        wheel.position.set((k?1:-1)*0.8, -0.8, 0);
        wheel.rotation.y = Math.PI/2;
        this.wheels.push(wheel); this.group.add(wheel);
      }
      spawnMemeText(window.innerWidth/2, window.innerHeight*0.4, 'WHEELS!', '#ffd93d');
      sfx('combo');
    } else if (r < 0.8) {
      // grow wings
      for (let k=0;k<2;k++){
        const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.8,0.5), new THREE.MeshStandardMaterial({color:0xffffff, side:THREE.DoubleSide, transparent:true, opacity:0.7}));
        wing.position.set((k?1:-1)*0.5, 0.5, 0);
        wing.rotation.y = (k?1:-1)*0.5;
        this.wings.push(wing); this.group.add(wing);
      }
      spawnMemeText(window.innerWidth/2, window.innerHeight*0.4, 'WINGS!', '#aee7ff');
      sfx('combo');
    } else {
      // add tentacles
      for (let k=0;k<2;k++){
        const tent = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.02,0.8,8), new THREE.MeshStandardMaterial({color:0xff44aa}));
        tent.position.set(rand(-0.5,0.5), -1, rand(-0.3,0.3));
        this.group.add(tent);
        this.limbs.push({userData:{phase:0}, rotation:{x:0,y:0,z:0}, position:tent.position});
      }
      spawnMemeText(window.innerWidth/2, window.innerHeight*0.4, 'TENTACLES!', '#ff44aa');
      sfx('wobble');
    }
  }

  rebuildBody() {
    if (this.body) {
      this.group.remove(this.body);
      this.body.geometry.dispose();
    }
    const c = this.config;
    const s = c.bodyLen;
    let geo;
    switch (c.body) {
      case 'cube': geo = new THREE.BoxGeometry(1.6*s, 1.6*s, 1.6*s); break;
      case 'pyramid': geo = new THREE.ConeGeometry(1.2*s, 2*s, 4); break;
      case 'donut': geo = new THREE.TorusGeometry(0.9*s, 0.5*s, 16, 32); break;
      case 'capsule': geo = new THREE.CapsuleGeometry(0.8*s, 1.2*s, 8, 16); break;
      case 'crystal': geo = new THREE.OctahedronGeometry(1.1*s, 0); break;
      default: geo = new THREE.IcosahedronGeometry(1.1*s, 3);
    }
    this.body = new THREE.Mesh(geo, this.bodyMat);
    this.group.add(this.body);
  }

  split() {
    // spawn a child blob
    if (blobs.length >= 8) return;
    const childConfig = { ...this.config, numLimbs: Math.floor(rand(0,5)) };
    childConfig.limbs = [pick(LIMB_TYPES),pick(LIMB_TYPES),pick(LIMB_TYPES),pick(LIMB_TYPES)];
    const child = new ClayBlob(childConfig, true);
    child.group.position.set(rand(-3,3), rand(-1,2), rand(-2,2));
    child.group.scale.setScalar(child.scale);
    blobs.push(child);
    spawnMemeText(window.innerWidth/2, window.innerHeight*0.35, 'SPLIT!', '#ff2d95');
    sfx('pop');
  }

  mergeBack() {
    // child merges back into main + contributes to vibe
    if (scene) scene.remove(this.group);
    const idx = blobs.indexOf(this);
    if (idx > 0) blobs.splice(idx, 1);
    vibe = Math.min(100, vibe + 8);
    // merge explosion
    triggerMemeStorm();
  }
}

// ============================================================
//  MEME TEXT POPUPS
// ============================================================
function spawnMemeText(x, y, text, color) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
    color:${color};font-size:32px;font-weight:900;letter-spacing:2px;pointer-events:none;
    text-shadow:0 0 10px ${color},0 2px 0 #000;z-index:150;`;
  el.textContent = text;
  document.body.appendChild(el);
  const start = performance.now();
  const anim = () => {
    const p = (performance.now() - start) / 1200;
    if (p >= 1) { el.remove(); return; }
    el.style.top = (y - p * 80) + 'px';
    el.style.opacity = 1 - p;
    el.style.transform = `translate(-50%,-50%) scale(${1 + p*0.5}) rotate(${(p-0.5)*30}deg)`;
    requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim);
}

// ============================================================
//  MEME STORM (merge explosion → full screen memes)
// ============================================================
function triggerMemeStorm() {
  if (memeStormActive) return;
  memeStormActive = true;
  const overlay = document.getElementById('meme-storm');
  overlay.classList.remove('hidden');
  overlay.innerHTML = '';
  const count = 40;
  for (let i = 0; i < count; i++) {
    const e = document.createElement('div');
    e.className = 'meme-emoji';
    e.textContent = pick(EMOJIS);
    e.style.left = Math.random() * 100 + 'vw';
    e.style.top = Math.random() * 100 + 'vh';
    e.style.fontSize = (30 + Math.random() * 60) + 'px';
    e.style.animationDelay = (Math.random() * 0.8) + 's';
    overlay.appendChild(e);
  }
  sfx('explode');
  setTimeout(() => {
    overlay.classList.add('hidden');
    memeStormActive = false;
  }, 1800);
}

// ============================================================
//  GAME STATE & LOOP
// ============================================================
let state = 'START';
let mainBlob = null;
let splitTimer = 0;

function startGame() {
  ensureAudio();
  startBGM();
  state = 'PLAYING';
  vibe = 0;
  blobs = [];
  memeStormActive = false;
  // clear old blobs
  while (scene.children.length > 6) scene.remove(scene.children[scene.children.length-1]);

  // use selected preview character
  const config = JSON.parse(JSON.stringify(previewChar));
  mainBlob = new ClayBlob(config, false);
  blobs.push(mainBlob);

  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  splitTimer = rand(4, 8);
}

function backToSelect() {
  try { if (musicNode) musicNode.stop(); } catch(e) {}
  musicNode = null;
  state = 'START';
  vibe = 0;
  blobs = [];
  // remove blobs from scene
  const toRemove = [];
  scene.children.forEach(ch => { if (ch.userData.isBlob || ch.type === 'Group') toRemove.push(ch); });
  toRemove.forEach(ch => scene.remove(ch));
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('popups').innerHTML = '';
  if (!previewCtx) initPreview();
  else requestAnimationFrame(previewLoop);
}

let lastTime = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - lastTime) / 1000);
  lastTime = t;
  const time = t / 1000;

  if (state === 'PLAYING') {
    // natural vibe decay/growth
    vibe = Math.max(0, vibe - dt * 2);

    // auto-dance goes crazy even when idle
    if (Math.random() < dt * 0.3) {
      vibe = Math.min(100, vibe + rand(1, 4));
    }

    // splitting
    splitTimer -= dt;
    if (splitTimer <= 0 && blobs.length < 8 && vibe > 15) {
      mainBlob.split();
      splitTimer = rand(5, 10);
    }

    // update all blobs
    blobs.forEach(b => b.update(dt, time));

    // camera sway
    camera.position.x = Math.sin(time * 0.3) * 1.5;
    camera.position.y = 1 + Math.sin(time * 0.5) * 0.3;
    camera.lookAt(0, 0, 0);

    // rotate scene lights for extra chaos
    scene.children.forEach(ch => {
      if (ch.isPointLight) {
        ch.position.x = Math.sin(time * 0.7) * 5;
        ch.position.z = Math.cos(time * 0.5) * 5;
      }
    });

    // HUD
    const vibeFill = document.getElementById('vibe-fill');
    const vibeLabel = document.getElementById('vibe-label');
    if (vibeFill) vibeFill.style.width = vibe + '%';
    if (vibeLabel) vibeLabel.textContent = 'VIBE ' + Math.floor(vibe) + '%';
    const bc = document.getElementById('blob-count');
    if (bc) bc.textContent = blobs.length + ' BLOB' + (blobs.length > 1 ? 'S' : '');

    if (renderer) renderer.render(scene, camera);
  }
}

// ============================================================
//  INPUT — any input is correct, just increases vibe & triggers action
// ============================================================
function onInput(x, y) {
  if (state !== 'PLAYING') return;
  vibe = Math.min(100, vibe + rand(3, 8));
  // trigger random dance move
  blobs.forEach(b => {
    b.group.position.y += 0.5;
    b.group.rotation.z += rand(-0.5, 0.5);
  });
  spawnMemeText(x, y, pick(MEME_WORDS), pick(['#39ff14','#ff2d95','#ffd93d','#a28bff']));
  sfx(Math.random() < 0.5 ? 'hit' : 'pop');

  // chance to mutate or split on input
  if (vibe > 30 && Math.random() < 0.15) mainBlob.mutate();
  if (vibe > 40 && blobs.length < 8 && Math.random() < 0.1) mainBlob.split();
  if (vibe > 70 && Math.random() < 0.08) triggerMemeStorm();
}

window.addEventListener('pointerdown', e => {
  if (state === 'PLAYING') onInput(e.clientX, e.clientY);
});
window.addEventListener('keydown', e => {
  if (state === 'PLAYING') onInput(window.innerWidth/2, window.innerHeight/2);
});

// ============================================================
//  INIT
// ============================================================
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('back-btn').addEventListener('click', backToSelect);
document.querySelectorAll('.ctrl-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    rerollPart(btn.dataset.part);
    document.querySelectorAll('.preset-card').forEach(el => el.classList.remove('active'));
  });
});

setupThree();
initPreview();
requestAnimationFrame(loop);
