// ── SCROLL-DRIVEN ANIMATIONS — Aurora Noir ──────────────
// Enhanced text reveal, parallax, tilt cards, and staggered reveals

function initScrollAnimations() {
  // ── TEXT REVEAL — Word-by-word on scroll ────────────────
  function initTextReveal() {
    const headings = document.querySelectorAll('.text-reveal');
    headings.forEach(heading => {
      const html = heading.innerHTML;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;

      function wrapWords(node) {
        const nodes = Array.from(node.childNodes);
        nodes.forEach(child => {
          if (child.nodeType === 3) {
            const words = child.textContent.split(/(\s+)/);
            const frag = document.createDocumentFragment();
            words.forEach(word => {
              if (word.trim()) {
                const span = document.createElement('span');
                span.className = 'word';
                span.textContent = word;
                frag.appendChild(span);
              } else if (word) {
                frag.appendChild(document.createTextNode(word));
              }
            });
            child.replaceWith(frag);
          } else if (child.nodeType === 1) {
            wrapWords(child);
          }
        });
      }

      wrapWords(wrapper);
      heading.innerHTML = wrapper.innerHTML;
    });

    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          setupScrollProgress(e.target);
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });

    headings.forEach(h => observer.observe(h));
  }

  function setupScrollProgress(element) {
    const words = element.querySelectorAll('.word');
    if (words.length === 0) return;

    function onScroll() {
      const rect = element.getBoundingClientRect();
      const viewH = window.innerHeight;
      const start = viewH * 0.85;
      const end = viewH * 0.15;
      const progress = Math.max(0, Math.min(1, (start - rect.top) / (start - end)));
      const activeCount = Math.floor(progress * words.length);
      words.forEach((word, i) => {
        word.classList.toggle('active', i < activeCount);
      });
      if (progress >= 1) {
        words.forEach(w => w.classList.add('active'));
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── ENHANCED SCROLL REVEAL ─────────────────────────────
  function initEnhancedReveal() {
    const revealEls = document.querySelectorAll(
      '.reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-clip'
    );

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const parent = entry.target.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter(c =>
              c.classList.contains('reveal') ||
              c.classList.contains('reveal-left') ||
              c.classList.contains('reveal-right') ||
              c.classList.contains('reveal-scale') ||
              c.classList.contains('reveal-clip')
            );
            const index = siblings.indexOf(entry.target);
            if (index > 0) {
              entry.target.style.transitionDelay = `${index * 0.12}s`;
            }
          }
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.06,
      rootMargin: '0px 0px -60px 0px'
    });

    revealEls.forEach(el => observer.observe(el));
  }

  // ── NAVBAR HIDE/SHOW ON SCROLL ─────────────────────────
  function initNavHideShow() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
      const currentScroll = window.scrollY;
      if (currentScroll > 100) {
        nav.classList.add('scrolled');
        if (currentScroll > lastScroll && currentScroll > 300) {
          nav.style.transform = 'translateY(-100%)';
        } else {
          nav.style.transform = 'translateY(0)';
        }
      } else {
        nav.classList.remove('scrolled');
        nav.style.transform = 'translateY(0)';
      }
      lastScroll = currentScroll;
    }, { passive: true });
  }

  // ── SPOTLIGHT CARDS (Mouse-follow glow) ─────────────────
  function initSpotlightCards() {
    const cards = document.querySelectorAll('.feature-card, .pricing-card, .step-card, .blog-card');
    cards.forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });
    });
  }

  // ── 3D TILT EFFECT ON CARDS ─────────────────────────────
  function initTiltCards() {
    const cards = document.querySelectorAll('.feature-card, .stat-item');
    cards.forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const tiltX = (y - 0.5) * 8;
        const tiltY = (x - 0.5) * -8;
        card.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-6px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  // ── MAGNETIC BUTTONS ────────────────────────────────────
  function initMagneticButtons() {
    const btns = document.querySelectorAll('.magnetic-btn');
    btns.forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  // ── SECTION FADE ───────────────────────────────────────
  function initSectionFade() {
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
      section.style.willChange = 'opacity';
    });
  }

  // ── FLOATING CARDS PARALLAX ────────────────────────────
  function initFloatingCardsParallax() {
    const cards = document.querySelectorAll('.floating-card');
    if (cards.length === 0) return;

    const hero = document.getElementById('hero');
    if (!hero) return;

    hero.addEventListener('mousemove', e => {
      const rect = hero.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      
      cards.forEach((card, i) => {
        const speed = (i + 1) * 8;
        const dx = x * speed;
        const dy = y * speed;
        card.style.transform = `translate(${dx}px, ${dy}px)`;
      });
    });
  }

  // Initialize all
  initTextReveal();
  initEnhancedReveal();
  initNavHideShow();
  initSpotlightCards();
  initTiltCards();
  initMagneticButtons();
  initSectionFade();
  initFloatingCardsParallax();
}
