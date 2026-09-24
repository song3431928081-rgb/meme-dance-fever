// ===== ABSTRACT SHAKER — Meme Dance Fever =====
// Pure canvas rhythm + ragdoll dance game. Procedural everything.

const canvas = document.getElementById('game-canvas');
let ctx = canvas.getContext('2d');
let W, H, CX, CY;
function resize() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  W = window.innerWidth; H = window.innerHeight;
  CX = W/2; CY = H/2;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize); resize();

// ===== AUDIO =====
let audioCtx = null, masterGain = null, musicNode = null, musicStartT = 0;
let muted = false;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = muted ? 0 : 0.5;
  masterGain.connect(audioCtx.destination);
}

// Pre-render a 32-bar 128 BPM loop
async function renderBGM(bpm) {
  const BPM = bpm;
  const BEAT = 60 / BPM;
  const dur = BEAT * 32;
  const sr = audioCtx.sampleRate;
  const off = new OfflineAudioContext(2, sr * dur, sr);
  const out = off.createGain(); out.gain.value = 0.85; out.connect(off.destination);

  // Kick on every beat
  for (let b = 0; b < 32; b++) {
    const t = b * BEAT;
    const o = off.createOscillator();
    const g = off.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.2);
  }
  // Hi-hat on off-beats
  for (let b = 0; b < 64; b++) {
    if (b % 2 === 0) continue;
    const t = b * BEAT / 2;
    const len = sr * 0.05;
    const buf = off.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, 3);
    const src = off.createBufferSource(); src.buffer = buf;
    const g = off.createGain(); g.gain.value = 0.12;
    const hp = off.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    src.connect(hp); hp.connect(g); g.connect(out);
    src.start(t);
  }
  // Bassline — A minor pentatonic riff
  const bassNotes = [55, 55, 73.42, 82.41, 73.42, 65.41, 55, 49];
  for (let b = 0; b < 32; b++) {
    const t = b * BEAT;
    const note = bassNotes[b % bassNotes.length];
    const o = off.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = note;
    const g = off.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + BEAT * 0.8);
    const lp = off.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    o.connect(lp); lp.connect(g); g.connect(out);
    o.start(t); o.stop(t + BEAT);
  }
  // Suona-like lead on every 4 beats (square wave + vibrato)
  const leadNotes = [440, 523.25, 587.33, 659.25, 587.33, 523.25, 440, 392];
  for (let b = 0; b < 32; b += 1) {
    if (b % 4 !== 0) continue;
    const t = b * BEAT;
    const note = leadNotes[(b/4) % leadNotes.length];
    const o = off.createOscillator();
    o.type = 'square';
    o.frequency.value = note;
    const vib = off.createOscillator();
    vib.frequency.value = 5;
    const vg = off.createGain(); vg.gain.value = 8;
    vib.connect(vg); vg.connect(o.frequency);
    const g = off.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + BEAT * 3.5);
    o.connect(g); g.connect(out);
    o.start(t); vib.start(t);
    o.stop(t + BEAT*4); vib.stop(t + BEAT*4);
  }
  const buffer = await off.startRendering();
  musicNode = audioCtx.createBufferSource();
  musicNode.buffer = buffer;
  musicNode.loop = true;
  musicNode.connect(masterGain);
  musicNode.start();
  musicStartT = audioCtx.currentTime;
}

// SFX
function sfx(type) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  if (type === 'perfect') {
    const o = audioCtx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.08);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 0.15);
  } else if (type === 'good') {
    const o = audioCtx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(523, t);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 0.16);
  } else if (type === 'miss') {
    // Dog bark + spring
    const o = audioCtx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.2);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 0.3);
  } else if (type === 'combo') {
    const o = audioCtx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1200, t);
    o.frequency.exponentialRampToValueAtTime(2400, t + 0.06);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 0.12);
  } else if (type === 'boss') {
    const o = audioCtx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.6);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 0.7);
  } else if (type === 'party') {
    // Rising arpeggio
    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < notes.length; i++) {
      const o = audioCtx.createOscillator();
      o.type = 'square';
      o.frequency.value = notes[i];
      const g = audioCtx.createGain();
      const st = t + i * 0.06;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.12, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.15);
      o.connect(g); g.connect(masterGain);
      o.start(st); o.stop(st + 0.2);
    }
  } else if (type === 'explosion') {
    // Noise burst
    const len = audioCtx.sampleRate * 0.3;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, 2);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const g = audioCtx.createGain(); g.gain.value = 0.25;
    const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
    src.connect(lp); lp.connect(g); g.connect(masterGain);
    src.start(t);
  }
}

// ===== CHARACTER PARTS =====
const HEADS = ['dog','frog','eggplant','tv','toilet','bean',
  'pineapple','ghost','clown','octopus','skull','cactus','banana','alien','donut','fish','cat','potato'];
const LIMB_TYPES = ['spring','noodle','chicken','slipper','propeller','cable',
  'tentacle','laser','balloon','rubber_duck','wrench','cactus_arm','fire','chain','mace'];
const BODY_TYPES = ['jelly','noodle','sausage','hexagon','star','cloud','diamond','pretzel'];
const SKINS = [
  { name:'toxic',  hue:130 },
  { name:'barbie', hue:320 },
  { name:'glitch', hue:280 },
  { name:'tomato', hue:8   },
  { name:'gold',   hue:45  },
  { name:'cyber',  hue:190 },
  { name:'sunset', hue:25  },
  { name:'neon',   hue:300 },
  { name:'ocean',  hue:200 },
  { name:'fire',   hue:15  },
];
// Facial expressions — mouth/eye combos
const FACES = ['happy','angry','surprised','wink','tongue','dizzy','smug','sad','maniac','deadpan','kiss','grin'];

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

let character = genCharacter();
function genCharacter() {
  return {
    head: pick(HEADS),
    body: pick(BODY_TYPES),
    limbs: [pick(LIMB_TYPES), pick(LIMB_TYPES), pick(LIMB_TYPES), pick(LIMB_TYPES)],
    skin: pick(SKINS),
    face: pick(FACES),
    headSize: rand(50, 90),
    bodyLen: rand(80, 140),
    // Animation state
    headPhase: Math.random() * Math.PI * 2,
    bodyPhase: Math.random() * Math.PI * 2,
    eyePhase: [Math.random()*Math.PI*2, Math.random()*Math.PI*2],
    limbPhase: [0, Math.PI, Math.PI/2, -Math.PI/2],
    // Mutation toggles
    bigHead: false,
    longNeck: false,
    eyesOut: false,
    spiralLimb: false,
    invertColor: false,
    ghostTrail: false,
    extraLimbs: false,
    floatingHead: false,
    rainbowSkin: false,
    bigMouth: false,
    crossEyes: false,
    spinMode: false,
    // Current action
    action: 'idle',
    actionT: 0,
  };
}

// ===== CHARACTER SELECTION =====
let previewChar = genCharacter();

// Preset characters — fun themed combos
const PRESETS = [
  { emoji:'🐸', name:'Froggo',  head:'frog',      body:'jelly',   limbs:['spring','spring','slipper','slipper'], skin:SKINS[0], face:'happy' },
  { emoji:'🍆', name:'Eggman',  head:'eggplant',  body:'noodle',  limbs:['noodle','noodle','noodle','noodle'], skin:SKINS[2], face:'smug' },
  { emoji:'📺', name:'Static',  head:'tv',        body:'sausage', limbs:['cable','cable','cable','cable'], skin:SKINS[6], face:'dizzy' },
  { emoji:'🚽', name:'Flushy',  head:'toilet',    body:'jelly',   limbs:['spring','spring','slipper','slipper'], skin:SKINS[3], face:'tongue' },
  { emoji:'👻', name:'Spooky',  head:'ghost',     body:'cloud',   limbs:['tentacle','tentacle','tentacle','tentacle'], skin:SKINS[1], face:'maniac' },
  { emoji:'🐙', name:'Kraken',  head:'octopus',   body:'cloud',   limbs:['tentacle','tentacle','tentacle','tentacle'], skin:SKINS[7], face:'angry' },
  { emoji:'💀', name:'Bones',   head:'skull',     body:'diamond', limbs:['chain','chain','chain','chain'], skin:SKINS[4], face:'deadpan' },
  { emoji:'🌵', name:'Spikey',  head:'cactus',    body:'hexagon', limbs:['cactus_arm','cactus_arm','cactus_arm','cactus_arm'], skin:SKINS[0], face:'grin' },
  { emoji:'👽', name:'Xeno',    head:'alien',     body:'star',    limbs:['laser','laser','balloon','balloon'], skin:SKINS[0], face:'surprised' },
  { emoji:'🤡', name:'Honko',   head:'clown',     body:'pretzel', limbs:['balloon','balloon','slipper','slipper'], skin:SKINS[9], face:'maniac' },
  { emoji:'🐱', name:'Meow',    head:'cat',       body:'jelly',   limbs:['spring','spring','chicken','chicken'], skin:SKINS[5], face:'wink' },
  { emoji:'🍌', name:'Peely',   head:'banana',    body:'noodle',  limbs:['rubber_duck','rubber_duck','slipper','slipper'], skin:SKINS[8], face:'happy' },
];

function charFromPreset(p) {
  return {
    head: p.head, body: p.body,
    limbs: [...p.limbs], skin: p.skin, face: p.face,
    headSize: rand(60, 80), bodyLen: rand(90, 130),
    headPhase: Math.random()*Math.PI*2, bodyPhase: Math.random()*Math.PI*2,
    eyePhase: [Math.random()*Math.PI*2, Math.random()*Math.PI*2],
    limbPhase: [0, Math.PI, Math.PI/2, -Math.PI/2],
    bigHead:false, longNeck:false, eyesOut:false, spiralLimb:false,
    invertColor:false, ghostTrail:false, extraLimbs:false, floatingHead:false,
    rainbowSkin:false, bigMouth:false, crossEyes:false, spinMode:false,
    action:'idle', actionT:0,
  };
}

// Generate a meme name from character parts
const NAME_PREFIX = ['Disco','Cyber','Mega','Ultra','Wobble','Chaos','Meme','Cosmic','Retro','Funky','Glitch','Turbo'];
const NAME_SUFFIX = ['Shaker','Bopper','Wiggler','Groover','Twister','Flipper','Jiggler','Buzzer','Dancer','Shuffler','Spaz','Freak'];
function genCharName(c) {
  return pick(NAME_PREFIX) + ' ' + pick(NAME_SUFFIX);
}

function rerollPart(part) {
  if (part === 'head') previewChar.head = pick(HEADS);
  else if (part === 'body') previewChar.body = pick(BODY_TYPES);
  else if (part === 'limbs') previewChar.limbs = [pick(LIMB_TYPES), pick(LIMB_TYPES), pick(LIMB_TYPES), pick(LIMB_TYPES)];
  else if (part === 'skin') previewChar.skin = pick(SKINS);
  else if (part === 'face') previewChar.face = pick(FACES);
  else if (part === 'all') previewChar = genCharacter();
  updateCharName();
}

function applyPreset(idx) {
  previewChar = charFromPreset(PRESETS[idx]);
  updateCharName();
  // Highlight active preset
  document.querySelectorAll('.preset-card').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
}

function updateCharName() {
  const el = document.getElementById('char-name');
  if (el) el.textContent = genCharName(previewChar);
}

// Preview render loop
let previewCtx = null;
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
    // subtle animated bg
    const hue = (t * 0.05) % 360;
    previewCtx.fillStyle = `hsla(${hue}, 60%, 10%, 0.3)`;
    previewCtx.fillRect(0, 0, pc.width, pc.height);
    // Draw preview character centered, idle dancing
    drawPreviewChar(previewChar, t);
  }
  if (state !== 'PLAYING') requestAnimationFrame(previewLoop);
}
function drawPreviewChar(c, t) {
  if (!previewCtx) return;
  const pc = previewCtx.canvas;
  // Temporarily swap global ctx to preview canvas (drawBody/drawLimb/drawHead use global ctx)
  const savedCtx = ctx;
  ctx = previewCtx;
  ctx.save();
  ctx.translate(pc.width/2, pc.height * 0.62);
  ctx.scale(0.62, 0.62);
  const bob = Math.sin(t * 0.004) * 6;
  ctx.translate(0, bob);
  drawBody(c, t, 0);
  ctx.restore();
  ctx = savedCtx;
}

// Preset cards UI
function renderPresets() {
  const list = document.getElementById('preset-list');
  if (!list) return;
  list.innerHTML = '';
  PRESETS.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'preset-card';
    card.textContent = p.emoji;
    card.title = p.name;
    card.addEventListener('click', () => applyPreset(i));
    list.appendChild(card);
  });
}

// ===== DANCE MOVES =====
const MOVES = [
  'idle','electro_shake','social_rock','ke_mu_san','flower_hands',
  'head_throw','hip_twist','twitch','reverse','moonwalk','crab','robot','breakdance',
  'floss','dab','gangnam','macarena','silly_walk','disco','karate','spank','worm','shuffle',
  'gorilla','penguin','robot_break','vogue','helicopter','tiptoe','pump','cheer','jazz_hands'
];

// ===== GAME STATE =====
let state = 'START';
let score = 0, combo = 0, maxCombo = 0, chaos = 0;
let bpm = 132;
let beat = 0; // current beat index
let beatT = 0; // time since last beat
const BEAT_INTERVAL = 60 / bpm;
let songTime = 0;
let songDuration = 45; // seconds
let notes = []; // upcoming QTE notes
let noteId = 0;
let nextSpawnBeat = 4;
let bossActive = false;
let bossAppearAt = 25; // seconds
let replayFrames = []; // capture for replay
let replayCapturing = false;
let flashT = 0; // screen flash timer

// ===== QTE NOTE TYPES =====
const NOTE_TYPES = ['tap','hold','spam','swipe_left','swipe_right','swipe_up','swipe_down'];

function spawnNote() {
  // Weighted: tap most common, then spam, then others
  const r = Math.random();
  let type;
  if (r < 0.45) type = 'tap';
  else if (r < 0.65) type = 'spam';
  else if (r < 0.8) type = 'hold';
  else type = pick(['swipe_left','swipe_right','swipe_up','swipe_down']);
  // Place note near top, falling down to hit zone
  const lane = rand(0.2, 0.8);
  notes.push({
    id: noteId++,
    type,
    x: W * lane,
    y: -60,
    hitY: H * 0.78,
    speed: (H * 0.85) / (BEAT_INTERVAL * 4), // 4 beats travel
    spawnedAt: songTime,
    hitWindow: BEAT_INTERVAL * 1.2,
    state: 'falling', // falling, hit, missed
    holdProgress: 0,
    holdNeeded: 0.8,
    spamCount: 0,
    spamNeeded: 5 + Math.floor(Math.random() * 4),
    swipeStart: null,
    active: false,
  });
}

// ===== INPUT =====
let activeNote = null;
function onTap(x, y) {
  if (state !== 'PLAYING') return;
  // Find nearest falling note in hit zone
  let best = null, bestDy = Infinity;
  for (const n of notes) {
    if (n.state !== 'falling') continue;
    const dy = Math.abs(n.y - n.hitY);
    if (dy < 100 && dy < bestDy) { bestDy = dy; best = n; }
  }
  if (!best) return;
  const n = best;
  // All note types can be hit by tap — spam needs multiple taps
  if (n.type === 'spam') {
    n.spamCount++;
    spawnPopup(x, y, n.spamCount + '!', '#39ff14');
    if (n.spamCount >= n.spamNeeded) hitNote(n, 10);
    return;
  }
  // tap, hold, swipe_* — all hit on tap in zone
  hitNote(n, bestDy);
}
function onDrag(x, y) {
  if (state !== 'PLAYING') return;
  for (const n of notes) {
    if (n.state !== 'falling') continue;
    if (n.type === 'spam' && Math.abs(n.y - n.hitY) < 100) {
      n.spamCount++;
      spawnPopup(x, y, n.spamCount + '!', '#39ff14');
      if (n.spamCount >= n.spamNeeded) hitNote(n, 10);
      return;
    }
  }
}
function onRelease() {}

function hitNote(n, dy) {
  n.state = 'hit';
  let judge;
  if (dy < 30) { judge = 'PERFECT'; score += 100; sfx('perfect'); spawnParticles(n.x, n.y, 18, '#39ff14'); flashT = 0.4; }
  else if (dy < 60) { judge = 'GOOD'; score += 50; sfx('good'); spawnParticles(n.x, n.y, 10, '#ffd93d'); }
  else { judge = 'GOOD'; score += 30; sfx('good'); spawnParticles(n.x, n.y, 6, '#ffd93d'); }
  combo++;
  maxCombo = Math.max(maxCombo, combo);
  chaos = Math.min(100, chaos + 3);
  if (combo % 5 === 0) sfx('combo');
  checkComboMilestone();
  showJudgement(judge, judge === 'PERFECT' ? '#39ff14' : '#ffd93d');
  spawnPopup(n.x, n.y - 40, judge, judge === 'PERFECT' ? '#39ff14' : '#ffd93d');
  // Trigger a dance move!
  triggerMove();
}
function missNote(n) {
  combo = 0;
  chaos = Math.max(0, chaos - 5);
  sfx('miss');
  spawnParticles(n.x, n.y, 8, '#ff0040');
  spawnMemeText(n.x, n.y - 40, 'FAIL', '#ff0040');
  showJudgement('MISS', '#ff0040');
  spawnPopup(n.x, n.y - 40, 'MISS', '#ff0040');
  // Glitch punishment
  triggerGlitch();
}

function showJudgement(text, color) {
  const el = document.getElementById('judgement');
  el.textContent = text;
  el.style.color = color;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}
function spawnPopup(x, y, text, color) {
  const el = document.createElement('div');
  el.className = 'popup';
  el.textContent = text;
  el.style.color = color;
  el.style.left = (x - 40) + 'px';
  el.style.top = y + 'px';
  document.getElementById('popups').appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ===== DANCE ACTIONS =====
function triggerMove() {
  const weights = MOVES.map(() => 1);
  weights[0] = 0.3; // idle less likely
  let total = weights.reduce((a,b)=>a+b,0);
  let r = Math.random() * total;
  for (let i = 0; i < MOVES.length; i++) {
    r -= weights[i];
    if (r <= 0) { character.action = MOVES[i]; character.actionT = 0; break; }
  }
  // Random mutation on hit
  if (Math.random() < 0.45) {
    const m = ['bigHead','longNeck','eyesOut','spiralLimb','invertColor','ghostTrail',
      'extraLimbs','floatingHead','rainbowSkin','bigMouth','crossEyes','spinMode'];
    const mutation = pick(m);
    character[mutation] = !character[mutation];
    setTimeout(() => { character[mutation] = !character[mutation]; }, 1400);
  }
  // Random face change
  if (Math.random() < 0.5) character.face = pick(FACES);
}
function triggerGlitch() {
  character.invertColor = true;
  character.action = 'twitch';
  character.actionT = 0;
  character.face = 'dizzy';
  setTimeout(() => { character.invertColor = false; }, 800);
}

// ===== PARTICLE SYSTEM =====
let particles = [];
function spawnParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rand(2, 9);
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 2,
      life: rand(0.4, 1.0),
      maxLife: 1.0,
      size: rand(3, 10),
      color: color || `hsl(${Math.random()*360}, 100%, 60%)`,
      shape: pick(['circle','star','square','heart','spark']),
      rot: Math.random()*Math.PI*2,
      vrot: rand(-0.3, 0.3),
    });
  }
}
function spawnConfetti(x, y) {
  for (let i = 0; i < 30; i++) {
    particles.push({
      x, y: y - 40,
      vx: rand(-6, 6),
      vy: rand(-10, -3),
      life: rand(1.0, 2.0),
      maxLife: 2.0,
      size: rand(4, 9),
      color: `hsl(${Math.random()*360}, 100%, 60%)`,
      shape: pick(['circle','square','star']),
      rot: Math.random()*Math.PI*2,
      vrot: rand(-0.4, 0.4),
      gravity: 0.3,
    });
  }
}
function spawnMemeText(x, y, text, color) {
  particles.push({
    x, y, vx: rand(-1,1), vy: -rand(2,4),
    life: 1.2, maxLife: 1.2,
    text, color: color || '#fff',
    shape: 'text', size: rand(16, 28),
    rot: rand(-0.3, 0.3), vrot: 0,
  });
}
const MEME_WORDS = ['AWESOME!','EPIC!','SLAY!','FIRE!','OMG!','WOW!','LOL!','GOAT!','NICE!','INSANE!','CRAZY!','HYPE!','YEET!','DAB!','SWAG!'];

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = 8;
    if (p.shape === 'text') {
      ctx.font = `bold ${p.size}px Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.strokeText(p.text, 0, 0);
      ctx.fillText(p.text, 0, 0);
    } else if (p.shape === 'star') {
      drawStar(0, 0, 5, p.size, p.size*0.45);
      ctx.fill();
    } else if (p.shape === 'square') {
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
    } else if (p.shape === 'heart') {
      ctx.beginPath();
      ctx.moveTo(0, p.size*0.3);
      ctx.bezierCurveTo(-p.size, -p.size*0.5, -p.size*0.5, -p.size, 0, -p.size*0.3);
      ctx.bezierCurveTo(p.size*0.5, -p.size, p.size, -p.size*0.5, 0, p.size*0.3);
      ctx.fill();
    } else if (p.shape === 'spark') {
      ctx.strokeStyle = p.color; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI/2;
        ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*p.size, Math.sin(a)*p.size);
      }
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}
function drawStar(cx, cy, spikes, outerR, innerR) {
  let rot = -Math.PI/2;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot)*outerR, cy + Math.sin(rot)*outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot)*innerR, cy + Math.sin(rot)*innerR);
    rot += step;
  }
  ctx.closePath();
}
function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.gravity) p.vy += p.gravity;
    p.vx *= 0.98; p.vy *= 0.98;
    p.rot += p.vrot;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
}

// ===== COMBO MILESTONE EFFECTS =====
function checkComboMilestone() {
  if (combo > 0 && combo % 10 === 0) {
    spawnConfetti(CX, H * 0.5);
    spawnMemeText(CX, H * 0.4, pick(MEME_WORDS), pick(['#ffd93d','#ff2d95','#39ff14','#00e5ff']));
    chaos = Math.min(100, chaos + 5);
    sfx('party');
    if (combo >= 50) {
      spawnParticles(CX, H*0.5, 60, '#ff0040');
      sfx('explosion');
      spawnMemeText(CX, H*0.35, 'GODLIKE!', '#ff0040');
    }
  }
}

// ===== RENDER CHARACTER =====
function drawCharacter(c, t) {
  if (!c) return;
  ctx.save();
  const baseX = CX, baseY = H * 0.55;
  const chaosScale = 1 + chaos / 200;
  ctx.translate(baseX, baseY);

  // Spin mode — whole character rotates
  if (c.spinMode) ctx.rotate(t * 0.003);

  // Ghost trail
  if (c.ghostTrail) {
    for (let i = 3; i > 0; i--) {
      ctx.globalAlpha = 0.15;
      ctx.translate(i * 8 * Math.sin(t*0.01), 0);
      drawBody(c, t, i * 0.3);
      ctx.translate(-i * 8 * Math.sin(t*0.01), 0);
    }
    ctx.globalAlpha = 1;
  }

  drawBody(c, t, 0);
  ctx.restore();
}

function drawBody(c, t, trailOffset) {
  if (!c) return;
  const chaosScale = 1 + chaos / 150;
  // Invert filter
  if (c.invertColor) ctx.filter = 'invert(1) hue-rotate(180deg) saturate(2)';

  // Rainbow skin hue
  const baseHue = c.rainbowSkin ? (t * 0.3) % 360 : c.skin.hue;

  // ===== BODY =====
  const bodyWave = Math.sin(t * 0.005 + c.bodyPhase) * 8 * chaosScale;
  const bodyLen = c.bodyLen + (c.action === 'head_throw' ? 60 : 0);
  const bodyW = 35 * chaosScale;

  ctx.strokeStyle = `hsl(${baseHue}, 80%, 55%)`;
  ctx.fillStyle = `hsl(${baseHue}, 80%, 50%)`;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';

  // Body shape varies by body type
  if (c.body === 'hexagon') {
    ctx.fillStyle = `hsl(${baseHue}, 80%, 50%)`;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI/3 + t*0.002;
      const px = Math.cos(a) * bodyW;
      const py = Math.sin(a) * bodyLen*0.4 + bodyWave*Math.sin(i)*0.3;
      if (i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (c.body === 'star') {
    ctx.fillStyle = `hsl(${baseHue}, 80%, 55%)`;
    drawStar(0, 0, 5, bodyW*1.2, bodyW*0.5);
    ctx.fill(); ctx.stroke();
  } else if (c.body === 'cloud') {
    ctx.fillStyle = `hsl(${baseHue}, 70%, 75%)`;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc((i-1.5)*bodyW*0.5, Math.sin(i+t*0.003)*6, bodyW*0.6, 0, Math.PI*2);
      ctx.fill();
    }
  } else if (c.body === 'diamond') {
    ctx.fillStyle = `hsl(${baseHue}, 80%, 55%)`;
    ctx.beginPath();
    ctx.moveTo(0, -bodyLen*0.5);
    ctx.lineTo(bodyW*0.8, 0);
    ctx.lineTo(0, bodyLen*0.5);
    ctx.lineTo(-bodyW*0.8, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (c.body === 'pretzel') {
    ctx.strokeStyle = `hsl(${baseHue}, 70%, 50%)`;
    ctx.lineWidth = bodyW*0.5;
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const p = i/30;
      const a = p * Math.PI * 4;
      const px = Math.cos(a) * bodyW * (0.5 + p*0.5);
      const py = (p-0.5)*bodyLen + Math.sin(a)*10;
      if (i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.stroke();
  } else {
    // jelly/noodle/sausage — wobbly sausage
    ctx.beginPath();
    const segs = 12;
    for (let i = 0; i <= segs; i++) {
      const yy = bodyLen * (i / segs) - bodyLen/2;
      const xx = Math.sin(i * 0.8 + t * 0.006) * bodyWave * (i / segs);
      const r = bodyW * (1 - (i/segs - 0.5) * (i/segs - 0.5) * 0.6);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.lineWidth = bodyW;
    ctx.stroke();
  }

  // ===== NECK =====
  const neckLen = (c.longNeck ? 80 : 18) + Math.sin(t*0.008 + c.headPhase) * 4;
  const neckY = -bodyLen/2 - neckLen;

  // ===== LIMBS (arms + legs) =====
  for (let i = 0; i < 4; i++) {
    drawLimb(c, i, t, trailOffset);
  }
  // Extra limbs mutation
  if (c.extraLimbs) {
    for (let i = 0; i < 2; i++) {
      const saved = c.limbs;
      c.limbs = [pick(LIMB_TYPES), pick(LIMB_TYPES)];
      drawLimb(c, i, t, trailOffset);
      c.limbs = saved;
    }
  }

  // ===== HEAD =====
  const headR = c.headSize * (c.bigHead ? 2.2 : 1) * 0.5;
  const headFloat = c.floatingHead ? Math.sin(t*0.006) * 30 : 0;
  const headY = neckY - headR + Math.sin(t*0.01 + c.headPhase) * 5 + headFloat;
  const headBob = (c.action === 'head_throw') ? Math.sin(t*0.03) * 30 : 0;
  ctx.save();
  ctx.translate(0, headY + headBob);
  drawHead(c, headR, t);
  ctx.restore();

  // Floating head connection line
  if (c.floatingHead) {
    ctx.strokeStyle = `hsla(${baseHue}, 80%, 60%, 0.5)`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, neckY);
    ctx.lineTo(0, headY + headBob);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.filter = 'none';
}

function drawLimb(c, idx, t, off) {
  // 0=left arm, 1=right arm, 2=left leg, 3=right leg
  const isArm = idx < 2;
  const side = idx % 2 === 0 ? -1 : 1;
  const attachX = side * 22;
  const attachY = isArm ? -c.bodyLen*0.2 : c.bodyLen*0.45;
  const len = isArm ? 55 : 60;
  const limbType = c.limbs[idx];
  const phase = c.limbPhase[idx] + t * 0.008;
  const limbHue = c.rainbowSkin ? (t * 0.3 + idx*40) % 360 : c.skin.hue;
  let angle;

  // Action-based poses
  switch (c.action) {
    case 'electro_shake': angle = Math.sin(phase*4) * 1.2; break;
    case 'social_rock': angle = side * Math.sin(phase*3) * 0.8; break;
    case 'flower_hands': angle = Math.sin(phase*5) * 1.5 + (isArm ? Math.PI/2 : 0); break;
    case 'breakdance': angle = isArm ? -Math.PI/2 + Math.sin(phase)*0.5 : Math.PI/2; break;
    case 'robot': angle = Math.round(Math.sin(phase*3)) * 0.8; break;
    case 'head_throw': angle = Math.sin(phase*2) * 0.6; break;
    case 'floss': angle = isArm ? side * Math.sin(phase*6) * 1.0 : Math.sin(phase*3) * 0.3; break;
    case 'dab': angle = isArm ? (side < 0 ? -2.2 : 0.3) : 0.2; break;
    case 'gangnam': angle = isArm ? (side < 0 ? -1.2 : 0.8 + Math.sin(phase)*0.3) : Math.sin(phase*2)*0.4; break;
    case 'macarena': angle = isArm ? Math.sin(phase*2) * 0.6 + side*0.5 : 0.3; break;
    case 'silly_walk': angle = isArm ? side * Math.sin(phase*4) * 1.3 : Math.sin(phase*5) * 0.9; break;
    case 'disco': angle = isArm ? (side < 0 ? -1.0 : 1.0) + Math.sin(phase)*0.3 : 0.5; break;
    case 'karate': angle = isArm ? (side < 0 ? 0.5 : -1.5) : 0.2; break;
    case 'spank': angle = isArm ? (side > 0 ? 1.2 + Math.sin(phase*8)*0.3 : -0.3) : 0.3; break;
    case 'worm': angle = isArm ? -0.5 + Math.sin(phase*4)*0.5 : Math.sin(phase*3)*0.6; break;
    case 'shuffle': angle = isArm ? side * Math.sin(phase*5) * 0.9 : Math.sin(phase*7)*0.5; break;
    case 'gorilla': angle = isArm ? 0.6 + Math.sin(phase*2)*0.2 : 0.1; break;
    case 'penguin': angle = isArm ? side * (0.8 + Math.sin(phase*3)*0.1) : Math.sin(phase*4)*0.3; break;
    case 'robot_break': angle = isArm ? (side < 0 ? -2.5 : 0.5) : Math.PI/2; break;
    case 'vogue': angle = isArm ? side * (1.2 + Math.sin(phase*2)*0.4) : 0.4; break;
    case 'helicopter': angle = isArm ? phase * 3 : 0.3; break;
    case 'tiptoe': angle = isArm ? side * 0.3 : -0.3 + Math.sin(phase*3)*0.2; break;
    case 'pump': angle = isArm ? Math.sin(phase*8) * 1.4 : Math.sin(phase*4)*0.4; break;
    case 'cheer': angle = isArm ? (side < 0 ? -1.8 : -1.8) + Math.sin(phase*4)*0.2 : 0.2; break;
    case 'jazz_hands': angle = isArm ? side * 1.5 + Math.sin(phase*6)*0.4 : 0.4; break;
    case 'ke_mu_san': angle = isArm ? Math.sin(phase*3)*0.7 : Math.sin(phase*2)*0.5; break;
    case 'hip_twist': angle = isArm ? side*0.4 : Math.sin(phase*4)*0.6; break;
    case 'twitch': angle = (Math.random()<0.5 ? 1 : -1) * Math.sin(phase*10) * 1.5; break;
    case 'reverse': angle = -Math.sin(phase) * 0.5; break;
    case 'moonwalk': angle = isArm ? side*0.3 : Math.sin(phase*2)*0.3; break;
    case 'crab': angle = isArm ? -1.5 : 0.5; break;
    default: angle = Math.sin(phase) * 0.4;
  }

  ctx.save();
  ctx.translate(attachX, attachY);
  ctx.rotate(angle * side);

  if (c.spiralLimb) {
    // Spiral arm
    ctx.strokeStyle = `hsl(${limbHue + idx*60}, 80%, 55%)`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let s = 0; s < len; s += 2) {
      const a = s * 0.3 + phase;
      const r = s * 0.5;
      const x = Math.cos(a) * r;
      const y = s;
      if (s === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  } else {
    // Spring/noodle
    ctx.strokeStyle = `hsl(${limbHue + idx*40}, 80%, 55%)`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    const segs = 10;
    for (let s = 0; s <= segs; s++) {
      const yy = (s/segs) * len;
      const xx = Math.sin(s * 0.8 + phase*2) * 6;
      if (s === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }

  // Foot/hand decoration
  const endY = len;
  if (limbType === 'slipper') {
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath(); ctx.ellipse(0, endY, 12, 7, 0, 0, Math.PI*2); ctx.fill();
  } else if (limbType === 'propeller') {
    ctx.save();
    ctx.translate(0, endY);
    ctx.rotate(t * 0.05 * side);
    ctx.fillStyle = '#ffd93d';
    ctx.fillRect(-15, -2, 30, 4);
    ctx.restore();
  } else if (limbType === 'chicken') {
    ctx.fillStyle = '#f39c12';
    ctx.beginPath(); ctx.arc(0, endY, 6, 0, Math.PI*2); ctx.fill();
    for (let f = -1; f <= 1; f++) {
      ctx.fillRect(f*4 - 1, endY, 2, 8);
    }
  } else if (limbType === 'tentacle') {
    ctx.strokeStyle = `hsl(${limbHue+30}, 80%, 55%)`;
    ctx.lineWidth = 4;
    for (let s2 = 0; s2 < 3; s2++) {
      ctx.beginPath();
      ctx.moveTo(0, endY);
      for (let k = 0; k <= 8; k++) {
        const yy = endY + k*3;
        const xx = Math.sin(k*0.8 + phase*3 + s2*2) * (6 + k*0.5) + (s2-1)*5;
        ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
  } else if (limbType === 'laser') {
    ctx.save();
    ctx.translate(0, endY);
    ctx.fillStyle = '#ff0040';
    ctx.shadowColor = '#ff0040'; ctx.shadowBlur = 10;
    ctx.fillRect(-3, 0, 6, 30);
    ctx.restore();
  } else if (limbType === 'balloon') {
    ctx.fillStyle = `hsl(${(c.skin.hue+t*0.1)%360}, 80%, 60%)`;
    ctx.beginPath(); ctx.arc(0, endY, 10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(-1, endY+8, 2, 6);
  } else if (limbType === 'rubber_duck') {
    ctx.fillStyle = '#ffd93d';
    ctx.beginPath(); ctx.arc(0, endY, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ff8c00';
    ctx.beginPath(); ctx.ellipse(6, endY-2, 5, 3, 0, 0, Math.PI*2); ctx.fill();
  } else if (limbType === 'wrench') {
    ctx.fillStyle = '#888';
    ctx.fillRect(-3, endY-10, 6, 18);
    ctx.beginPath(); ctx.arc(0, endY-12, 6, 0, Math.PI*2); ctx.fill();
  } else if (limbType === 'cactus_arm') {
    ctx.fillStyle = '#3a7d44';
    ctx.fillRect(-4, endY-5, 8, 15);
    ctx.fillStyle = '#2d5e33';
    ctx.fillRect(-8, endY, 4, 8);
    ctx.fillRect(4, endY, 4, 8);
  } else if (limbType === 'fire') {
    for (let f2 = 0; f2 < 3; f2++) {
      const fh = 12 + Math.sin(t*0.02 + f2*2) * 6;
      ctx.fillStyle = `hsl(${15+f2*15}, 100%, ${55-f2*10}%)`;
      ctx.beginPath();
      ctx.moveTo(-6+f2*2, endY);
      ctx.quadraticCurveTo(0, endY-fh, 6-f2*2, endY);
      ctx.fill();
    }
  } else if (limbType === 'chain') {
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 3;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.ellipse((k%2)*4-2, endY + k*5, 5, 3, 0, 0, Math.PI*2);
      ctx.stroke();
    }
  } else if (limbType === 'mace') {
    ctx.fillStyle = '#666';
    ctx.beginPath(); ctx.arc(0, endY, 9, 0, Math.PI*2); ctx.fill();
    for (let s3 = 0; s3 < 8; s3++) {
      const a = s3 * Math.PI/4;
      ctx.fillRect(Math.cos(a)*9-1, endY+Math.sin(a)*9-1, 2, 6);
    }
  }
  ctx.restore();
}

function drawHead(c, r, t) {
  ctx.save();
  const hue = c.rainbowSkin ? (t * 0.3) % 360 : c.skin.hue;
  // Head shape varies by type
  switch (c.head) {
    case 'dog':
      ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
      // Ears
      ctx.fillStyle = `hsl(${hue}, 60%, 40%)`;
      ctx.beginPath(); ctx.ellipse(-r*0.7, -r*0.5, r*0.3, r*0.5, -0.4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r*0.7, -r*0.5, r*0.3, r*0.5, 0.4, 0, Math.PI*2); ctx.fill();
      // Snout
      ctx.fillStyle = `hsl(${hue}, 70%, 65%)`;
      ctx.beginPath(); ctx.ellipse(0, r*0.3, r*0.5, r*0.35, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(0, r*0.2, r*0.12, 0, Math.PI*2); ctx.fill();
      break;
    case 'frog':
      ctx.fillStyle = `hsl(${130}, 70%, 50%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, r, r*0.85, 0, 0, Math.PI*2); ctx.fill();
      // Eye bumps
      ctx.fillStyle = `hsl(130, 70%, 45%)`;
      ctx.beginPath(); ctx.arc(-r*0.4, -r*0.5, r*0.28, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(r*0.4, -r*0.5, r*0.28, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-r*0.4, -r*0.5, r*0.18, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(r*0.4, -r*0.5, r*0.18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(-r*0.4, -r*0.5, r*0.08, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(r*0.4, -r*0.5, r*0.08, 0, Math.PI*2); ctx.fill();
      break;
    case 'eggplant':
      ctx.fillStyle = `hsl(280, 70%, 50%)`;
      ctx.beginPath(); ctx.ellipse(0, r*0.1, r*0.7, r*1.1, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = `hsl(130, 60%, 40%)`;
      ctx.beginPath(); ctx.ellipse(0, -r*0.7, r*0.5, r*0.3, 0, 0, Math.PI*2); ctx.fill();
      break;
    case 'tv':
      ctx.fillStyle = `hsl(${hue}, 30%, 35%)`;
      ctx.fillRect(-r, -r*0.7, r*2, r*1.4);
      ctx.fillStyle = `hsl(${hue}, 60%, 60%)`;
      ctx.fillRect(-r*0.8, -r*0.5, r*1.6, r*1);
      // Static noise
      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.5})`;
        ctx.fillRect(-r*0.8 + Math.random()*r*1.6, -r*0.5 + Math.random()*r, 3, 3);
      }
      break;
    case 'toilet':
      ctx.fillStyle = `hsl(0, 0%, 85%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, r*0.9, r, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = `hsl(0, 0%, 70%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, r*0.6, r*0.7, 0, 0, Math.PI*2); ctx.fill();
      break;
    case 'bean':
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, r*0.8, r, 0, 0, Math.PI*2); ctx.fill();
      break;
    case 'pineapple':
      ctx.fillStyle = `hsl(45, 80%, 55%)`;
      ctx.beginPath(); ctx.ellipse(0, r*0.1, r*0.7, r*0.9, 0, 0, Math.PI*2); ctx.fill();
      // crosshatch
      ctx.strokeStyle = `hsl(35, 70%, 40%)`; ctx.lineWidth = 1.5;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-r*0.6, i*r*0.2); ctx.lineTo(r*0.6, i*r*0.2+r*0.1); ctx.stroke(); }
      // leaves
      ctx.fillStyle = `hsl(120, 70%, 45%)`;
      for (let i = 0; i < 5; i++) { const a = -Math.PI/2 + (i-2)*0.3; ctx.beginPath(); ctx.ellipse(Math.cos(a)*r*0.3, -r*0.7+Math.sin(a)*r*0.2, r*0.15, r*0.35, a, 0, Math.PI*2); ctx.fill(); }
      break;
    case 'ghost':
      ctx.fillStyle = `hsl(0, 0%, 90%)`;
      ctx.beginPath();
      ctx.arc(0, -r*0.1, r*0.8, Math.PI, 0);
      ctx.lineTo(r*0.8, r*0.7);
      for (let i = 3; i >= 0; i--) { ctx.lineTo(r*0.8 - (i+0.5)*r*0.4, r*0.5 + (i%2)*r*0.2); }
      ctx.closePath(); ctx.fill();
      break;
    case 'clown':
      ctx.fillStyle = `hsl(0, 0%, 95%)`;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
      // red nose
      ctx.fillStyle = '#ff0040'; ctx.beginPath(); ctx.arc(0, r*0.15, r*0.15, 0, Math.PI*2); ctx.fill();
      // hair
      ctx.fillStyle = '#ff4500';
      ctx.beginPath(); ctx.arc(-r*0.8, -r*0.3, r*0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(r*0.8, -r*0.3, r*0.3, 0, Math.PI*2); ctx.fill();
      break;
    case 'octopus':
      ctx.fillStyle = `hsl(300, 70%, 55%)`;
      ctx.beginPath(); ctx.arc(0, -r*0.1, r*0.8, 0, Math.PI*2); ctx.fill();
      // tentacles
      for (let i = 0; i < 6; i++) {
        const a = Math.PI*0.2 + i * (Math.PI*0.6/5);
        ctx.strokeStyle = `hsl(300, 70%, 50%)`; ctx.lineWidth = r*0.15; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(Math.cos(a)*r*0.6, r*0.3+Math.sin(a)*r*0.2);
        ctx.quadraticCurveTo(Math.cos(a)*r*1.2, r*0.9, Math.cos(a)*r*0.8, r*1.1);
        ctx.stroke();
      }
      break;
    case 'skull':
      ctx.fillStyle = `hsl(0, 0%, 88%)`;
      ctx.beginPath(); ctx.arc(0, -r*0.1, r*0.8, 0, Math.PI*2); ctx.fill();
      // jaw
      ctx.fillRect(-r*0.5, r*0.4, r, r*0.4);
      // teeth
      ctx.fillStyle = '#222';
      for (let i = 0; i < 4; i++) ctx.fillRect(-r*0.4 + i*r*0.22, r*0.5, r*0.1, r*0.25);
      break;
    case 'cactus':
      ctx.fillStyle = `hsl(130, 60%, 45%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, r*0.6, r, 0, 0, Math.PI*2); ctx.fill();
      // arms
      ctx.fillRect(-r*0.9, -r*0.3, r*0.35, r*0.6);
      ctx.fillRect(r*0.55, -r*0.1, r*0.35, r*0.5);
      // spines
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) { const y = -r*0.8 + i*r*0.18; ctx.beginPath(); ctx.moveTo(-r*0.5, y); ctx.lineTo(-r*0.65, y-3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(r*0.5, y); ctx.lineTo(r*0.65, y-3); ctx.stroke(); }
      break;
    case 'banana':
      ctx.fillStyle = `hsl(50, 90%, 55%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, r*0.5, r, 0.3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = `hsl(40, 80%, 40%)`;
      ctx.beginPath(); ctx.arc(r*0.3, -r*0.8, r*0.12, 0, Math.PI*2); ctx.fill();
      break;
    case 'alien':
      ctx.fillStyle = `hsl(130, 70%, 55%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, r*0.7, r*0.9, 0, 0, Math.PI*2); ctx.fill();
      // big black eyes
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(-r*0.3, -r*0.1, r*0.18, r*0.3, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r*0.3, -r*0.1, r*0.18, r*0.3, 0, 0, Math.PI*2); ctx.fill();
      // antenna
      ctx.strokeStyle = `hsl(130, 70%, 45%)`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -r*0.8); ctx.lineTo(0, -r*1.1); ctx.stroke();
      ctx.fillStyle = '#39ff14'; ctx.beginPath(); ctx.arc(0, -r*1.15, r*0.1, 0, Math.PI*2); ctx.fill();
      break;
    case 'donut':
      ctx.fillStyle = `hsl(330, 70%, 70%)`;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = `hsl(45, 80%, 80%)`;
      ctx.beginPath(); ctx.arc(0, 0, r*0.4, 0, Math.PI*2); ctx.fill();
      // sprinkles
      for (let i = 0; i < 12; i++) { const a = Math.random()*Math.PI*2, rr = r*0.55+Math.random()*r*0.3; ctx.fillStyle = `hsl(${Math.random()*360}, 90%, 60%)`; ctx.fillRect(Math.cos(a)*rr-2, Math.sin(a)*rr-2, 4, 2); }
      break;
    case 'fish':
      ctx.fillStyle = `hsl(200, 70%, 55%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, r*0.9, r*0.6, 0, 0, Math.PI*2); ctx.fill();
      // tail
      ctx.beginPath(); ctx.moveTo(r*0.8, 0); ctx.lineTo(r*1.3, -r*0.4); ctx.lineTo(r*1.3, r*0.4); ctx.closePath(); ctx.fill();
      // gill
      ctx.strokeStyle = `hsl(200, 60%, 40%)`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r*0.3, 0, r*0.25, -Math.PI/2, Math.PI/2); ctx.stroke();
      break;
    case 'cat':
      ctx.fillStyle = `hsl(${hue}, 40%, 65%)`;
      ctx.beginPath(); ctx.arc(0, 0, r*0.85, 0, Math.PI*2); ctx.fill();
      // ears
      ctx.beginPath(); ctx.moveTo(-r*0.6, -r*0.5); ctx.lineTo(-r*0.3, -r*1.1); ctx.lineTo(-r*0.1, -r*0.5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r*0.6, -r*0.5); ctx.lineTo(r*0.3, -r*1.1); ctx.lineTo(r*0.1, -r*0.5); ctx.fill();
      // whiskers
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-r*0.5, r*0.2+i*r*0.1); ctx.lineTo(-r*1.1, r*0.15+i*r*0.15); ctx.stroke(); ctx.beginPath(); ctx.moveTo(r*0.5, r*0.2+i*r*0.1); ctx.lineTo(r*1.1, r*0.15+i*r*0.15); ctx.stroke(); }
      break;
    case 'potato':
      ctx.fillStyle = `hsl(35, 50%, 55%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, r*0.8, r*0.95, 0.2, 0, Math.PI*2); ctx.fill();
      // eyes (potato sprouts)
      ctx.fillStyle = `hsl(35, 40%, 40%)`;
      ctx.beginPath(); ctx.arc(-r*0.2, -r*0.1, r*0.06, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(r*0.25, r*0.1, r*0.05, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(r*0.1, -r*0.3, r*0.04, 0, Math.PI*2); ctx.fill();
      break;
  }

  // ===== EYES (independent floating, track beat) =====
  const eyeOffset = (c.eyesOut ? 40 : 0) + Math.sin(t*0.02 + c.eyePhase[0]) * 5;
  const eyeR = r * 0.15;
  // Beat-sync eye pop
  const eyePop = 1 + Math.abs(Math.sin(beat * Math.PI)) * 0.3;
  const crossEye = c.crossEyes ? 0.08 : 0;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-r*0.3 + crossEye*r, -r*0.05, eyeR*eyePop, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(r*0.3 - crossEye*r, -r*0.05, eyeR*eyePop, 0, Math.PI*2); ctx.fill();

  // Pupils vary by face expression
  let pupilColor = '#000';
  if (c.face === 'dizzy') pupilColor = '#ff2d95';
  if (c.face === 'maniac') pupilColor = '#ff0040';
  ctx.fillStyle = pupilColor;

  if (c.face === 'wink') {
    // left eye open, right eye winking
    ctx.beginPath(); ctx.arc(-r*0.3 + eyeOffset*0.05 + crossEye*r, -r*0.05, eyeR*0.5*eyePop, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = pupilColor; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(r*0.22 - crossEye*r, -r*0.05); ctx.lineTo(r*0.38 - crossEye*r, -r*0.05); ctx.stroke();
  } else if (c.face === 'angry') {
    ctx.beginPath(); ctx.arc(-r*0.3 + eyeOffset*0.05 + crossEye*r, -r*0.05, eyeR*0.5*eyePop, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.3 + eyeOffset*0.05 - crossEye*r, -r*0.05, eyeR*0.5*eyePop, 0, Math.PI*2); ctx.fill();
    // angry brows
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r*0.5, -r*0.25); ctx.lineTo(-r*0.1, -r*0.12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r*0.5, -r*0.25); ctx.lineTo(r*0.1, -r*0.12); ctx.stroke();
  } else if (c.face === 'surprised') {
    ctx.beginPath(); ctx.arc(-r*0.3 + crossEye*r, -r*0.05, eyeR*0.7*eyePop, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.3 - crossEye*r, -r*0.05, eyeR*0.7*eyePop, 0, Math.PI*2); ctx.fill();
  } else if (c.face === 'dizzy') {
    // spiral eyes
    ctx.strokeStyle = pupilColor; ctx.lineWidth = 2;
    for (let ex = -1; ex <= 1; ex += 2) {
      ctx.beginPath();
      for (let s = 0; s < 20; s++) {
        const a = s*0.4 + t*0.01;
        const rr = s*0.4;
        const px = ex*r*0.3 + Math.cos(a)*rr;
        const py = -r*0.05 + Math.sin(a)*rr;
        if (s===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.stroke();
    }
  } else if (c.face === 'maniac') {
    ctx.beginPath(); ctx.arc(-r*0.3 + crossEye*r, -r*0.05, eyeR*0.6*eyePop, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.3 - crossEye*r, -r*0.05, eyeR*0.6*eyePop, 0, Math.PI*2); ctx.fill();
    // crazy brows
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r*0.5, -r*0.3); ctx.lineTo(-r*0.1, -r*0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r*0.1, -r*0.15); ctx.lineTo(r*0.5, -r*0.3); ctx.stroke();
  } else if (c.face === 'sad') {
    ctx.beginPath(); ctx.arc(-r*0.3 + crossEye*r, -r*0.02, eyeR*0.5*eyePop, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.3 - crossEye*r, -r*0.02, eyeR*0.5*eyePop, 0, Math.PI*2); ctx.fill();
    // droopy brows
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r*0.5, -r*0.15); ctx.lineTo(-r*0.1, -r*0.25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r*0.5, -r*0.15); ctx.lineTo(r*0.1, -r*0.25); ctx.stroke();
  } else if (c.face === 'smug') {
    // half-closed eyes
    ctx.fillStyle = pupilColor;
    ctx.beginPath(); ctx.ellipse(-r*0.3 + crossEye*r, -r*0.03, eyeR*0.6*eyePop, eyeR*0.25*eyePop, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.3 - crossEye*r, -r*0.03, eyeR*0.6*eyePop, eyeR*0.25*eyePop, 0, 0, Math.PI*2); ctx.fill();
  } else if (c.face === 'deadpan') {
    ctx.fillStyle = pupilColor;
    ctx.fillRect(-r*0.4 + crossEye*r, -r*0.06, eyeR*1.2, eyeR*0.6);
    ctx.fillRect(r*0.18 - crossEye*r, -r*0.06, eyeR*1.2, eyeR*0.6);
  } else {
    // happy / grin / kiss / tongue default round pupils
    ctx.beginPath(); ctx.arc(-r*0.3 + eyeOffset*0.05 + crossEye*r, -r*0.05, eyeR*0.5*eyePop, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.3 + eyeOffset*0.05 - crossEye*r, -r*0.05, eyeR*0.5*eyePop, 0, Math.PI*2); ctx.fill();
  }

  // ===== MOUTH = expression-based =====
  const mouthY = r * 0.4;
  const mouthW = (c.bigMouth ? r*0.6 : r*0.35);
  ctx.fillStyle = '#111';
  ctx.lineWidth = 2;
  if (c.face === 'happy' || c.face === 'grin') {
    ctx.beginPath(); ctx.arc(0, mouthY, mouthW*0.5, 0, Math.PI); ctx.fill();
    // teeth for grin
    if (c.face === 'grin') { ctx.fillStyle = '#fff'; ctx.fillRect(-mouthW*0.4, mouthY, mouthW*0.8, r*0.06); }
  } else if (c.face === 'surprised') {
    ctx.beginPath(); ctx.ellipse(0, mouthY+r*0.05, mouthW*0.3, mouthW*0.5, 0, 0, Math.PI*2); ctx.fill();
  } else if (c.face === 'angry') {
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, mouthY+r*0.1, mouthW*0.5, Math.PI, Math.PI*2); ctx.stroke();
  } else if (c.face === 'kiss') {
    ctx.fillStyle = '#ff2d95';
    ctx.beginPath(); ctx.ellipse(0, mouthY, mouthW*0.35, mouthW*0.3, 0, 0, Math.PI*2); ctx.fill();
  } else if (c.face === 'tongue') {
    ctx.beginPath(); ctx.arc(0, mouthY, mouthW*0.45, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#ff6b9d';
    ctx.beginPath(); ctx.ellipse(mouthW*0.1, mouthY+r*0.15, mouthW*0.18, mouthW*0.25, 0.2, 0, Math.PI*2); ctx.fill();
  } else if (c.face === 'maniac') {
    ctx.beginPath(); ctx.arc(0, mouthY, mouthW*0.5, 0.1, Math.PI-0.1); ctx.fill();
    // sharp teeth
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      const tx = -mouthW*0.35 + i*mouthW*0.23;
      ctx.beginPath(); ctx.moveTo(tx, mouthY); ctx.lineTo(tx+mouthW*0.1, mouthY); ctx.lineTo(tx+mouthW*0.05, mouthY+r*0.12); ctx.fill();
    }
  } else if (c.face === 'sad') {
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, mouthY+r*0.1, mouthW*0.4, Math.PI, Math.PI*2); ctx.stroke();
  } else {
    // default pixel speaker
    ctx.fillStyle = '#111';
    ctx.fillRect(-mouthW*0.5, mouthY, mouthW, r*0.2);
    const bars = 5;
    for (let i = 0; i < bars; i++) {
      const h = Math.abs(Math.sin(t*0.02 + i*0.7 + beat*0.5)) * r * 0.18;
      ctx.fillStyle = `hsl(${(t*0.1 + i*40) % 360}, 100%, 60%)`;
      ctx.fillRect(-mouthW*0.4 + i*(mouthW*0.8/bars), mouthY + r*0.1 - h, mouthW*0.12, h);
    }
  }
  ctx.restore();
}

// ===== RENDER BACKGROUND =====
const BG_EMOJIS = ['💃','🕺','🔥','✨','🎉','💥','⚡','🌈','🎵','💫','😎','🤪','👁️','🍆','🍑'];
let bgItems = [];
function initBgItems() {
  bgItems = [];
  for (let i = 0; i < 20; i++) {
    bgItems.push({
      x: Math.random(), y: Math.random(),
      size: rand(16, 36),
      speed: rand(0.0001, 0.0004),
      phase: Math.random()*Math.PI*2,
      emoji: pick(BG_EMOJIS),
      rot: rand(-0.3, 0.3),
    });
  }
}
initBgItems();

function drawBackground(t) {
  // Base
  const hue = (t * 0.05 + chaos * 3) % 360;
  ctx.fillStyle = `hsl(${hue}, 60%, 8%)`;
  ctx.fillRect(0, 0, W, H);

  // Radial glow
  const glow = ctx.createRadialGradient(CX, H*0.55, 0, CX, H*0.55, Math.max(W,H)*0.6);
  glow.addColorStop(0, `hsla(${(hue+180)%360}, 80%, 40%, 0.25)`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Grid floor (perspective)
  ctx.strokeStyle = `hsla(${(hue+60)%360}, 80%, 50%, 0.3)`;
  ctx.lineWidth = 1;
  const horizon = H * 0.6;
  for (let i = 0; i < 20; i++) {
    const y = horizon + Math.pow(i/20, 2) * (H - horizon);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let i = -10; i <= 10; i++) {
    const x = CX + i * W * 0.3;
    ctx.beginPath();
    ctx.moveTo(CX + i * 20, horizon);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Floating meme emojis
  ctx.font = '24px serif';
  ctx.textAlign = 'center';
  for (const it of bgItems) {
    const yy = (it.y + t * it.speed) % 1;
    const xx = (it.x + Math.sin(t*it.speed*0.5 + it.phase)*0.05) % 1;
    ctx.globalAlpha = 0.15 + chaos/300;
    ctx.save();
    ctx.translate(xx*W, yy*H);
    ctx.rotate(it.rot + Math.sin(t*0.001+it.phase)*0.2);
    ctx.font = `${it.size}px serif`;
    ctx.fillText(it.emoji, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Chaotic overlay
  if (chaos > 60) {
    ctx.fillStyle = `hsla(${(hue+180)%360}, 100%, 50%, ${(chaos-60)/300})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Danmaku bullets when chaos high
  if (chaos > 40) {
    const num = Math.floor((chaos - 40) / 5);
    for (let i = 0; i < num; i++) {
      const x = ((t * 0.1 + i * 137) % W);
      const y = ((t * 0.08 + i * 91) % H);
      ctx.fillStyle = `hsla(${(i*40 + t*0.1)%360}, 100%, 60%, 0.6)`;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.fill();
    }
  }

  // Scanlines when chaos high
  if (chaos > 50) {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let y = 0; y < H; y += 4) {
      ctx.fillRect(0, y, W, 2);
    }
  }
}

// ===== RENDER NOTES =====
function drawNotes() {
  // Hit zone line
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.78);
  ctx.lineTo(W, H * 0.78);
  ctx.stroke();

  for (const n of notes) {
    if (n.state !== 'falling') continue;
    ctx.save();
    ctx.translate(n.x, n.y);
    const color = n.type === 'tap' ? '#39ff14' :
                  n.type === 'hold' ? '#ffd93d' :
                  n.type === 'spam' ? '#ff2d95' :
                  '#00e5ff';
    ctx.strokeStyle = color;
    ctx.fillStyle = color + '40';
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;

    if (n.type === 'tap') {
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px Impact';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('TAP', 0, 0);
    } else if (n.type === 'hold') {
      const holdR = 25 + (n.holdProgress || 0) * 15;
      ctx.beginPath(); ctx.arc(0, 0, holdR, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Impact';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('HOLD', 0, 0);
    } else if (n.type === 'spam') {
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Impact';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${n.spamCount}/${n.spamNeeded}`, 0, 0);
    } else {
      // Swipe arrow
      const dir = n.type.replace('swipe_', '');
      const arrow = dir === 'left' ? '←' : dir === 'right' ? '→' : dir === 'up' ? '↑' : '↓';
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px Impact';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(arrow, 0, 1);
    }
    ctx.restore();
  }
}

// ===== UPDATE =====
let lastTime = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min((t - lastTime) / 1000, 0.05);
  lastTime = t;
  if (state === 'PLAYING') update(dt, t);
  render(t);
}

function update(dt, t) {
  songTime += dt;
  beatT += dt;
  if (beatT >= BEAT_INTERVAL) {
    beatT -= BEAT_INTERVAL;
    beat++;
    // Spawn notes every 2-4 beats
    if (beat >= nextSpawnBeat) {
      const num = 1 + Math.floor(Math.random() * (chaos > 50 ? 2 : 1));
      for (let i = 0; i < num; i++) spawnNote();
      nextSpawnBeat = beat + 2 + Math.floor(Math.random() * 3);
    }
  }

  // Update notes
  for (const n of notes) {
    if (n.state !== 'falling') continue;
    n.y += n.speed * dt;
    // Miss if passed hit zone
    if (n.y > n.hitY + 80) {
      n.state = 'missed';
      missNote(n);
    }
  }
  // Cleanup: only keep falling notes
  notes = notes.filter(n => n.state === 'falling');

  // Update particles
  updateParticles(dt);
  // Update flash
  if (flashT > 0) flashT = Math.max(0, flashT - dt * 2);

  // Update character action timer
  character.actionT += dt;
  if (character.actionT > 2 && Math.random() < 0.02) character.action = 'idle';

  // Boss spawn
  if (!bossActive && songTime > bossAppearAt) {
    bossActive = true;
    document.getElementById('boss-tag').classList.remove('hidden');
    sfx('boss');
    chaos = Math.min(100, chaos + 20);
  }

  // Game over
  if (songTime >= songDuration) {
    endGame();
  }

  // HUD
  document.getElementById('score-val').textContent = score;
  document.getElementById('combo-val').textContent = combo;
  document.getElementById('chaos-val').textContent = Math.floor(chaos) + '%';

  // Capture replay frames during chaos peaks / miss moments
  if (replayCapturing && replayFrames.length < 600) {
    replayFrames.push({
      time: songTime,
      notes: notes.map(n => ({...n})),
      char: {
        action: character.action,
        actionT: character.actionT,
        bigHead: character.bigHead,
        longNeck: character.longNeck,
        eyesOut: character.eyesOut,
        spiralLimb: character.spiralLimb,
        invertColor: character.invertColor,
        ghostTrail: character.ghostTrail,
      },
      chaos, score, combo,
    });
  }
}

function render(t) {
  ctx.save();
  // Fisheye when chaos high
  if (chaos > 50) {
    const amt = (chaos - 50) / 200;
  }
  // Screen shake
  if (chaos > 30) {
    const s = (chaos - 30) / 30;
    ctx.translate((Math.random()-0.5)*s*6, (Math.random()-0.5)*s*6);
  }
  drawBackground(t);
  drawNotes();
  drawCharacter(character, t);
  drawParticles();
  // Screen flash on perfect
  if (flashT > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashT * 0.3})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();

  // Vignette
  const grd = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(W,H)*0.7);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
}

// ===== INPUT HANDLERS =====
let pointerDown = false, pointerStart = null;
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  pointerDown = true;
  pointerStart = { x, y };
  onTap(x, y);
});
canvas.addEventListener('pointermove', e => {
  if (!pointerDown) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  onDrag(e.clientX - rect.left, e.clientY - rect.top);
});
canvas.addEventListener('pointerup', e => {
  pointerDown = false;
  pointerStart = null;
  onRelease();
});

// Keyboard
document.addEventListener('keydown', e => {
  if (state !== 'PLAYING') return;
  const key = e.key.toLowerCase();
  // Map to note types
  if (key === ' ' || key === 'enter') onTap(CX, H*0.78);
  else if (key === 'a') { simulateSwipe('swipe_left'); }
  else if (key === 'd') { simulateSwipe('swipe_right'); }
  else if (key === 'w') { simulateSwipe('swipe_up'); }
  else if (key === 's') { simulateSwipe('swipe_down'); }
});
function simulateSwipe(dir) {
  for (const n of notes) {
    if (n.state !== 'falling') continue;
    if (Math.abs(n.y - n.hitY) < 80 && n.type === dir) {
      hitNote(n, 10); return;
    }
  }
}

// ===== START =====
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('restart-main-btn').addEventListener('click', startGame);
document.getElementById('change-char-btn').addEventListener('click', () => {
  // Go back to character select screen
  document.getElementById('over-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  state = 'START';
  // restart preview loop if it stopped
  if (!previewCtx) initPreview();
  else requestAnimationFrame(previewLoop);
});

// ===== CHARACTER CUSTOMIZATION BUTTONS =====
document.querySelectorAll('.ctrl-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    rerollPart(btn.dataset.part);
    // clear preset highlight when manually customizing
    document.querySelectorAll('.preset-card').forEach(el => el.classList.remove('active'));
  });
});

// ===== INIT PREVIEW ON LOAD =====
initPreview();

function startGame() {
  initAudio();
  if (audioCtx.state !== 'running') audioCtx.resume().catch(()=>{});
  state = 'PLAYING';
  score = 0; combo = 0; maxCombo = 0; chaos = 0;
  beat = 0; beatT = 0; songTime = 0;
  notes = []; nextSpawnBeat = 4;
  particles = [];
  flashT = 0;
  bossActive = false;
  // Build game character from the selected preview character (keep chosen look, reset mutations)
  character = {
    head: previewChar.head,
    body: previewChar.body,
    limbs: [...previewChar.limbs],
    skin: previewChar.skin,
    face: previewChar.face,
    headSize: rand(50, 90),
    bodyLen: rand(80, 140),
    headPhase: Math.random() * Math.PI * 2,
    bodyPhase: Math.random() * Math.PI * 2,
    eyePhase: [Math.random()*Math.PI*2, Math.random()*Math.PI*2],
    limbPhase: [0, Math.PI, Math.PI/2, -Math.PI/2],
    bigHead:false, longNeck:false, eyesOut:false, spiralLimb:false,
    invertColor:false, ghostTrail:false, extraLimbs:false, floatingHead:false,
    rainbowSkin:false, bigMouth:false, crossEyes:false, spinMode:false,
    action:'idle', actionT:0,
  };
  replayFrames = [];
  replayCapturing = true;
  // Start BGM
  bpm = 128 + Math.floor(Math.random() * 32);
  renderBGM(bpm);
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('over-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('boss-tag').classList.add('hidden');
}

// ===== END =====
function endGame() {
  state = 'OVER';
  replayCapturing = false;
  if (musicNode) { try { musicNode.stop(); } catch(e){} musicNode = null; }
  document.getElementById('final-score').textContent = score;
  document.getElementById('final-combo').textContent = maxCombo;
  const rank = score > 3000 ? 'S+' : score > 2000 ? 'S' : score > 1000 ? 'A' : score > 500 ? 'B' : score > 200 ? 'C' : 'D';
  document.getElementById('final-rank').textContent = rank;
  // Challenge code from beat pattern
  const code = genChallengeCode();
  document.getElementById('challenge-code').textContent = code;
  // Leaderboard
  renderLeaderboard(score);
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('over-screen').classList.remove('hidden');
}

function genChallengeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function renderLeaderboard(myScore) {
  const names = ['@dancing_broccoli','@wobble_wizard','@toilet_dancer','@eggplant_king','@chaos_queen'];
  const scores = names.map(() => 500 + Math.floor(Math.random() * 3500));
  scores.push(myScore);
  names.push('YOU');
  const rows = names.map((n,i) => ({name:n, score:scores[i]})).sort((a,b) => b.score - a.score);
  const list = document.getElementById('lb-list');
  list.innerHTML = '';
  rows.slice(0, 6).forEach((r, i) => {
    const el = document.createElement('div');
    el.className = 'lb-row' + (r.name === 'YOU' ? ' me' : '');
    el.innerHTML = `<span class="rank">${i+1}.</span><span>${r.name}</span><b>${r.score}</b>`;
    list.appendChild(el);
  });
}

// ===== REPLAY =====
document.getElementById('replay-btn').addEventListener('click', () => {
  document.getElementById('replay-overlay').classList.remove('hidden');
  playReplay();
});
document.getElementById('close-replay').addEventListener('click', () => {
  document.getElementById('replay-overlay').classList.add('hidden');
});

function playReplay() {
  const rc = document.getElementById('replay-canvas');
  const rctx = rc.getContext('2d');
  rc.width = 360; rc.height = 640;
  let frameIdx = 0;
  function drawReplayFrame() {
    if (frameIdx >= replayFrames.length) {
      frameIdx = 0;
    }
    const f = replayFrames[frameIdx];
    if (!f) { frameIdx++; requestAnimationFrame(drawReplayFrame); return; }
    // Simplified replay render
    rctx.fillStyle = '#000';
    rctx.fillRect(0, 0, 360, 640);
    rctx.fillStyle = '#39ff14';
    rctx.font = 'bold 14px monospace';
    rctx.fillText(`SCORE: ${f.score}`, 10, 20);
    rctx.fillText(`COMBO: ${f.combo}`, 10, 40);
    rctx.fillText(`CHAOS: ${Math.floor(f.chaos)}%`, 10, 60);
    // Draw a stick figure
    rctx.strokeStyle = `hsl(${(frameIdx*10)%360}, 80%, 60%)`;
    rctx.lineWidth = 4;
    rctx.beginPath();
    rctx.arc(180, 200 + Math.sin(frameIdx*0.2)*10, 40, 0, Math.PI*2);
    rctx.moveTo(180, 240);
    rctx.lineTo(180, 380);
    rctx.moveTo(180, 280); rctx.lineTo(120 + Math.sin(frameIdx*0.3)*30, 320);
    rctx.moveTo(180, 280); rctx.lineTo(240 - Math.sin(frameIdx*0.3)*30, 320);
    rctx.moveTo(180, 380); rctx.lineTo(140, 480);
    rctx.moveTo(180, 380); rctx.lineTo(220, 480);
    rctx.stroke();
    rctx.fillStyle = '#ff2d95';
    rctx.font = 'bold 20px Impact';
    rctx.textAlign = 'center';
    rctx.fillText(f.char.action.replace('_',' ').toUpperCase(), 180, 550);
    frameIdx++;
    requestAnimationFrame(drawReplayFrame);
  }
  drawReplayFrame();
}

// ===== SHARE =====
document.getElementById('share-btn').addEventListener('click', () => {
  const code = document.getElementById('challenge-code').textContent;
  document.getElementById('share-code').textContent = code;
  document.getElementById('share-toast').classList.remove('hidden');
});
document.getElementById('toast-close').addEventListener('click', () => {
  document.getElementById('share-toast').classList.add('hidden');
});

requestAnimationFrame(t => { lastTime = t; loop(t); });
