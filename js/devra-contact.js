// ── CONTACT PAGE — 3D Card + Particles + Form ──────────

// ── 3D TILT EFFECT ──────────────────────────────────────
(function init3DCard() {
  const card = document.getElementById('contact3dCard');
  if (!card) return;

  const wrapper = card.parentElement;
  let rect, mouseX, mouseY;
  let isHovering = false;
  let animFrame;

  function onMouseMove(e) {
    rect = card.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    isHovering = true;
  }

  function onMouseLeave() {
    isHovering = false;
  }

  function animate() {
    if (isHovering && rect) {
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((mouseY - centerY) / centerY) * -8;
      const rotateY = ((mouseX - centerX) / centerX) * 8;

      card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    } else {
      card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    }
    animFrame = requestAnimationFrame(animate);
  }

  card.addEventListener('mousemove', onMouseMove);
  card.addEventListener('mouseleave', onMouseLeave);
  animate();
})();

// ── CONTACT CANVAS PARTICLES ────────────────────────────
(function initContactCanvas() {
  const c = document.getElementById('contactCanvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  let pts, W, H;

  function resize() {
    W = c.width = window.innerWidth;
    H = c.height = window.innerHeight * 2;
    pts = Array.from({ length: 50 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .2, vy: (Math.random() - .5) * .2,
      r: Math.random() * 1.5 + .3, g: Math.random() > .6
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    });
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 180) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = pts[i].g && pts[j].g
            ? `rgba(201,168,76,${(1 - d / 180) * .12})` : `rgba(244,240,232,${(1 - d / 180) * .04})`;
          ctx.lineWidth = .5; ctx.stroke();
        }
      }
    }
    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.g ? 'rgba(201,168,76,.35)' : 'rgba(244,240,232,.08)';
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize(); draw();
})();

// ── CURSOR ──────────────────────────────────────────────
(function initCursor() {
  const dot = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring-container');
  if (!dot || !ring) return;
  let rx = 0, ry = 0, mx = 0, my = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px'; dot.style.top = my + 'px';
  });
  (function animRing() {
    rx += (mx - rx) * .12; ry += (my - ry) * .12;
    ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
    requestAnimationFrame(animRing);
  })();
})();

// ── NAV SCROLL ──────────────────────────────────────────
(function initNav() {
  const prog = document.getElementById('scroll-progress');
  window.addEventListener('scroll', () => {
    const pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    if (prog) prog.style.width = pct + '%';
  });
})();

// ── SCROLL REVEAL ───────────────────────────────────────
(function initReveal() {
  const els = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  els.forEach(el => obs.observe(el));
})();

// ── HAMBURGER MENU ──────────────────────────────────────
(function initHamburger() {
  const btn = document.getElementById('hamburger');
  const overlay = document.getElementById('menuOverlay');
  if (!btn || !overlay) return;

  btn.addEventListener('click', () => {
    btn.classList.toggle('open');
    overlay.classList.toggle('open');
    document.body.style.overflow = overlay.classList.contains('open') ? 'hidden' : '';
  });

  overlay.querySelectorAll('.menu-link').forEach(link => {
    link.addEventListener('click', () => {
      btn.classList.remove('open');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
})();

// ── TOAST ───────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

// ── FORM SUBMISSION ─────────────────────────────────────
function handleContactSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('contactName').value.trim();
  const email = document.getElementById('contactEmail').value.trim();
  const subject = document.getElementById('contactSubject').value;
  const message = document.getElementById('contactMessage').value.trim();

  if (!name || !email || !subject || !message) {
    showToast('Please fill in all fields.', 'error');
    return false;
  }

  // Animate submit button
  const btn = document.querySelector('.contact-submit');
  const originalText = btn.textContent;
  btn.textContent = '⏳ Sending...';
  btn.disabled = true;

  // Simulate sending (replace with actual API call)
  setTimeout(() => {
    showToast('Message sent successfully! We\'ll get back to you soon. ✨', 'success');
    btn.textContent = '✓ Sent!';
    document.getElementById('contactForm').reset();

    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 2000);
  }, 1200);

  return false;
}
