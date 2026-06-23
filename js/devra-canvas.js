// ── AURORA CANVAS ANIMATIONS ─────────────────────────────

// Hero — Floating particle constellation with aurora colors
(function initHeroCanvas() {
  const c = document.getElementById('heroCanvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  let nodes, W, H, t = 0;
  let mouseX = -1000, mouseY = -1000;

  const colors = [
    { r: 99, g: 102, b: 241 },   // Indigo
    { r: 168, g: 85, b: 247 },    // Purple
    { r: 236, g: 72, b: 153 },    // Rose
    { r: 245, g: 158, b: 11 },    // Amber
    { r: 34, g: 211, b: 238 },    // Cyan
  ];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = c.parentElement.offsetWidth;
    H = c.parentElement.offsetHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    c.style.width = W + 'px';
    c.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    const count = Math.min(Math.floor((W * H) / 12000), 100);
    nodes = Array.from({ length: count }, () => {
      const color = colors[Math.floor(Math.random() * colors.length)];
      return {
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 0.5,
        color: color,
        bright: Math.random() > 0.7,
      };
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    t += 0.002;

    nodes.forEach(n => {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;

      // Mouse repulsion
      const dx = n.x - mouseX, dy = n.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        const force = (150 - dist) / 150 * 0.5;
        n.x += (dx / dist) * force;
        n.y += (dy / dist) * force;
      }
    });

    // Draw connections
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 140) {
          const alpha = (1 - d / 140) * (nodes[i].bright && nodes[j].bright ? 0.15 : 0.04);
          const c1 = nodes[i].color, c2 = nodes[j].color;
          const r = (c1.r + c2.r) / 2, g = (c1.g + c2.g) / 2, b = (c1.b + c2.b) / 2;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    nodes.forEach(n => {
      const pulse = Math.sin(t * 3 + n.x * 0.01) * 0.3 + 0.7;
      const { r, g, b } = n.color;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 2 * pulse, 0, Math.PI * 2);
      if (n.bright) {
        ctx.shadowColor = `rgba(${r},${g},${b},0.6)`;
        ctx.shadowBlur = 12;
      }
      ctx.fillStyle = `rgba(${r},${g},${b},${n.bright ? 0.6 * pulse : 0.2 * pulse})`;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    requestAnimationFrame(draw);
  }

  c.parentElement.addEventListener('mousemove', e => {
    const rect = c.parentElement.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  c.parentElement.addEventListener('mouseleave', () => {
    mouseX = -1000;
    mouseY = -1000;
  });

  window.addEventListener('resize', resize);
  resize(); draw();
})();


// CTA — Aurora particle constellation
(function initCtaCanvas() {
  const c = document.getElementById('ctaCanvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  let pts, W, H;

  const colors = [
    { r: 99, g: 102, b: 241 },
    { r: 168, g: 85, b: 247 },
    { r: 236, g: 72, b: 153 },
    { r: 245, g: 158, b: 11 },
  ];

  function resize() {
    W = c.parentElement.offsetWidth;
    H = c.parentElement.offsetHeight;
    c.width = W;
    c.height = H;
    pts = Array.from({ length: 60 }, () => {
      const color = colors[Math.floor(Math.random() * colors.length)];
      return {
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.5 + 0.3,
        color: color,
        bright: Math.random() > 0.6
      };
    });
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
        if (d < 130) {
          const c1 = pts[i].color, c2 = pts[j].color;
          const r = (c1.r + c2.r) / 2, g = (c1.g + c2.g) / 2, b = (c1.b + c2.b) / 2;
          const alpha = (1 - d / 130) * (pts[i].bright && pts[j].bright ? 0.12 : 0.04);
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = 0.4;
          ctx.stroke();
        }
      }
    }

    pts.forEach(p => {
      const { r, g, b } = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.bright ? `rgba(${r},${g},${b},0.4)` : `rgba(${r},${g},${b},0.1)`;
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(c.parentElement);
  resize(); draw();
})();
