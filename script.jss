// KTR Cosmic — Lightweight 2D Canvas version (Option B)
// - starfield (pre-rendered), comet trails (smooth), asteroid + explosion (controlled), simple shards
// - devicePixelRatio aware, mobile-friendly caps

const dpr = Math.max(window.devicePixelRatio || 1, 1);
const starsCanvas = document.getElementById('stars');
const cometsCanvas = document.getElementById('comets');
const fxCanvas = document.getElementById('fx');
const sCtx = starsCanvas.getContext('2d');
const cCtx = cometsCanvas.getContext('2d');
const fCtx = fxCanvas.getContext('2d');

function resizeAll(){
  const w = innerWidth, h = innerHeight;
  [starsCanvas, cometsCanvas, fxCanvas].forEach(c => {
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  });
  sCtx.setTransform(dpr,0,0,dpr,0,0);
  cCtx.setTransform(dpr,0,0,dpr,0,0);
  fCtx.setTransform(dpr,0,0,dpr,0,0);
}
resizeAll();
addEventListener('resize', () => { resizeAll(); createStarLayer(); });

/* -------------------------
   STAR LAYER (pre-rendered sprite)
   ------------------------- */
let starLayerCanvas = document.createElement('canvas');
function createStarLayer(){
  const w = innerWidth, h = innerHeight;
  starLayerCanvas.width = Math.round(w * dpr);
  starLayerCanvas.height = Math.round(h * dpr);
  const ctx = starLayerCanvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);

  // gradient background faint
  const g = ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0, 'rgba(4,6,10,0.0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);

  const count = Math.floor((w*h) / 12000); // tuned for light weight
  for(let i=0;i<count;i++){
    const x = Math.random()*w;
    const y = Math.random()*h;
    const r = Math.random()*1.6 + 0.2;
    const alpha = 0.45 + Math.random()*0.55;
    ctx.beginPath();
    ctx.fillStyle = `rgba(200,240,255,${alpha})`;
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fill();
    // small glow
    if(Math.random()>0.92){
      const gg = ctx.createRadialGradient(x,y,r*1.5,x,y,r*6);
      gg.addColorStop(0, 'rgba(120,230,255,0.08)');
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(x-r*6,y-r*6,r*12,r*12);
    }
  }
}
createStarLayer();

/* -------------------------
   COMETS (trail using ring buffer)
   ------------------------- */
class Comet {
  constructor(x, y, vx, vy, color){
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color;
    this.trail = []; // store previous points
    this.maxTrail = 28; // cap
  }
  update(){
    // move
    this.x += this.vx;
    this.y += this.vy;
    // push to trail
    this.trail.unshift({x:this.x, y:this.y});
    if(this.trail.length > this.maxTrail) this.trail.pop();
  }
  draw(ctx){
    // tail: draw semi-transparent circles decreasing
    for(let i=0;i<this.trail.length;i++){
      const p = this.trail[i];
      const t = 1 - (i/this.trail.length);
      const size = 2 + 6*t;
      ctx.beginPath();
      ctx.fillStyle = `rgba(100,220,255,${0.18 * t})`;
      ctx.arc(p.x, p.y, size, 0, Math.PI*2);
      ctx.fill();
    }
    // head
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.x, this.y, 3.6, 0, Math.PI*2);
    ctx.fill();
    // streak line for crispness
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(140,240,255,0.25)';
    ctx.lineWidth = 1.6;
    const tail = this.trail[Math.min(6, this.trail.length-1)];
    if(tail){
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(tail.x, tail.y);
      ctx.stroke();
    }
  }
}

let comets = [];
const COMET_SPAWN_MS = 1200;
const MAX_COMETS = Math.max(3, navigator.userAgent.match(/Mobi/i) ? 6 : 10);

function spawnComet(){
  const side = Math.random() < 0.5 ? -1 : 1;
  const startX = side < 0 ? -50 : innerWidth + 50;
  const startY = Math.random()*innerHeight*0.35 + innerHeight*0.05;
  const vx = side < 0 ? (4 + Math.random()*3.5) : (-4 - Math.random()*3.5);
  const vy = (1 + Math.random()*2.2);
  const color = `rgba(185,245,255,1)`;
  comets.push(new Comet(startX, startY, vx, vy, color));
  if(comets.length > MAX_COMETS) comets.splice(0, comets.length - MAX_COMETS);
}
setInterval(spawnComet, COMET_SPAWN_MS);
// initial
for(let i=0;i<3;i++) spawnComet();

/* -------------------------
   ASTEROID + explosion (controlled)
   ------------------------- */
class Particle {
  constructor(x,y,vx,vy,size,color,life){
    this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.size=size;this.color=color;this.life=life;this.age=0;
  }
  update(){
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.12; // gravity
    this.age++;
  }
  draw(ctx){
    const alpha = Math.max(0,1 - (this.age/this.life));
    ctx.beginPath();
    ctx.fillStyle = this.color.replace('ALPHA', alpha.toFixed(2));
    ctx.arc(this.x,this.y,this.size,0,Math.PI*2);
    ctx.fill();
  }
}

let particles = [];
let shards = [];
let asteroid = null;
let asteroidCooldown = 0;

function scheduleAsteroid(){
  if(asteroid || asteroidCooldown>0) return;
  asteroid = {
    x:-120,
    y: Math.random()*innerHeight*0.12 + 40,
    vx: 10 + Math.random()*6,
    vy: 1.6 + Math.random()*1.8,
    size: 46 + Math.random()*64,
    rotated: 0
  };
}
setInterval(()=>{ // occasionally trigger
  if(Math.random() < 0.12) scheduleAsteroid();
  if(asteroidCooldown>0) asteroidCooldown--;
}, 900);

function explodeAt(x,y){
  // create fire + dark smoke particles
  const count = navigator.userAgent.match(/Mobi/i) ? 60 : 140;
  for(let i=0;i<count;i++){
    const ang = Math.random()*Math.PI*2;
    const sp = 1 + Math.random()*6;
    const vx = Math.cos(ang)*sp;
    const vy = Math.sin(ang)*sp;
    const size = 1 + Math.random()*4;
    const col = Math.random()>0.6 ? 'rgba(255,170,90,ALPHA)' : 'rgba(200,200,220,ALPHA)';
    const life = 40 + Math.random()*40;
    particles.push(new Particle(x + (Math.random()-0.5)*20, y + (Math.random()-0.5)*20, vx, vy, size, col, life));
  }
  // shards (rect pieces) for brief break effect
  shards = [];
  const card = document.getElementById('profileCard');
  if(card){
    const rect = card.getBoundingClientRect();
    const cols = 6, rows = 4;
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const w = rect.width/cols, h = rect.height/rows;
        const left = rect.left + c*w, top = rect.top + r*h;
        shards.push({
          x:left, y:top, w:w, h:h,
          vx: (Math.random()-0.5)*6 + (Math.random()>0.5?1.5:-1.5)*4,
          vy: -6 - Math.random()*6,
          rot: (Math.random()-0.5)*0.06,
          life: 120, age:0
        });
      }
    }
  }
  asteroid = null;
  asteroidCooldown = 38;
}

function updateAndDraw(delta){
  // draw base star layer
  sCtx.clearRect(0,0,innerWidth,innerHeight);
  sCtx.drawImage(starLayerCanvas, 0, 0, innerWidth, innerHeight);

  // clear comet layer
  cCtx.clearRect(0,0,innerWidth,innerHeight);

  // update & draw comets
  for(let i=comets.length-1;i>=0;i--){
    const cm = comets[i];
    cm.update();
    cm.draw(cCtx);
    // collision with card center area
    const card = document.getElementById('profileCard');
    if(card){
      const rect = card.getBoundingClientRect();
      if(cm.x > rect.left && cm.x < rect.right && cm.y > rect.top && cm.y < rect.bottom){
        // small chance to trigger asteroid explosion chain
        if(Math.random() < 0.05) scheduleAsteroid();
      }
    }
    // remove off-screen
    if(cm.x < -160 || cm.x > innerWidth+160 || cm.y > innerHeight+160) comets.splice(i,1);
  }

  // asteroid update/draw on comet layer
  if(asteroid){
    asteroid.x += asteroid.vx;
    asteroid.y += asteroid.vy;
    asteroid.rot += 0.02;
    // draw trail
    cCtx.save();
    cCtx.translate(asteroid.x, asteroid.y);
    cCtx.rotate(asteroid.rot);
    // glowing trail behind
    const grad = cCtx.createRadialGradient(-20,0,0, -20,0,120);
    grad.addColorStop(0,'rgba(255,180,100,0.22)');
    grad.addColorStop(1,'rgba(0,0,0,0)');
    cCtx.fillStyle = grad;
    cCtx.beginPath();
    cCtx.ellipse(-20,0,120,80,0,0,Math.PI*2);
    cCtx.fill();
    // asteroid body
    cCtx.fillStyle = '#664432';
    cCtx.beginPath();
    cCtx.ellipse(0,0, asteroid.size, asteroid.size*0.76, 0, 0, Math.PI*2);
    cCtx.fill();
    cCtx.restore();

    // if close to center area -> explode
    const card = document.getElementById('profileCard');
    if(card){
      const rect = card.getBoundingClientRect();
      if(asteroid.x > rect.left && asteroid.x < rect.right && asteroid.y > rect.top && asteroid.y < rect.bottom){
        explodeAt(asteroid.x, asteroid.y);
      }
    }
    // remove if fully off screen
    if(asteroid && (asteroid.x > innerWidth + 300)) asteroid = null;
  }

  // FX layer: particles and shards
  fCtx.clearRect(0,0,innerWidth,innerHeight);

  // particles
  for(let i = particles.length-1; i>=0; i--){
    const p = particles[i];
    p.update();
    p.draw(fCtx);
    if(p.age++ > p.life) particles.splice(i,1);
  }

  // shards (card pieces)
  if(shards.length){
    for(let i=shards.length-1;i>=0;i--){
      const s = shards[i];
      s.x += s.vx; s.y += s.vy; s.vy += 0.2; s.vx *= 0.995; s.age++;
      fCtx.save();
      fCtx.translate(s.x + s.w/2, s.y + s.h/2);
      fCtx.rotate(s.rot * s.age);
      fCtx.fillStyle = 'rgba(18,20,24,0.88)';
      fCtx.fillRect(-s.w/2, -s.h/2, s.w, s.h);
      fCtx.restore();
      if(s.age > s.life) shards.splice(i,1);
    }
  }
}

// main loop
let last = performance.now();
function frame(now){
  const delta = now - last;
  last = now;
  updateAndDraw(delta);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// tiny performance safety: cap many comets on low-end
setInterval(()=>{ if(comets.length > MAX_COMETS) comets.splice(0, comets.length - MAX_COMETS); }, 3000);
