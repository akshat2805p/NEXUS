// ── UI HELPERS ────────────────────────────────────────────

// Toast notifications
let toastTimer;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = 'toast ' + type;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

// Panel switcher
function switchPanel(name) {
  document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.dash-nav-item').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  document.querySelectorAll('.dash-nav-item').forEach(b => {
    if (b.dataset.panel === name) b.classList.add('active');
  });
}

// Scroll reveal (enhanced — works with devra-scroll.js)
function initReveal() {
  const els = document.querySelectorAll('.feature-card, .pricing-card, .review-card, .stat-item, .step-card, .blog-card, .section-eyebrow, .section-title, .section-body');
  els.forEach(el => {
    if (!el.classList.contains('reveal') && !el.classList.contains('reveal-left') && !el.classList.contains('reveal-right') && !el.classList.contains('reveal-clip')) {
      el.classList.add('reveal');
    }
  });
}

// Counter animation
function initCounters() {
  const els = document.querySelectorAll('[data-target]');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el     = e.target;
      const target = parseInt(el.dataset.target);
      let v = 0;
      const step = target / 80;
      const timer = setInterval(() => {
        v = Math.min(v + step, target);
        const fmt = target >= 1000000
          ? (v / 1000000).toFixed(1) + 'M+'
          : target >= 10000
            ? Math.floor(v).toLocaleString('en-IN') + '+'
            : Math.floor(v) + '+';
        el.textContent = fmt;
        if (v >= target) clearInterval(timer);
      }, 20);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });
  els.forEach(el => obs.observe(el));
}

// Nav scroll effect
function initNavScroll() {
  const nav = document.getElementById('mainNav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
    const prog = document.getElementById('scroll-progress');
    if (prog) {
      const pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      prog.style.width = pct + '%';
    }
  });
}

// Custom cursor
function initCursor() {
  const dot  = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring-container');
  if (!dot || !ring) return;
  let rx = 0, ry = 0, mx = 0, my = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px'; dot.style.top = my + 'px';
  });
  (function animRing() {
    rx += (mx - rx) * .1; ry += (my - ry) * .1;
    ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
    requestAnimationFrame(animRing);
  })();
}

// Loader
function initLoader() {
  const bar = document.getElementById('ldBar');
  const pct = document.getElementById('ldPct');
  const ldr = document.getElementById('loader');
  if (!bar || !pct || !ldr) return;
  setTimeout(() => { bar.style.width = '100%'; }, 80);
  let p = 0;
  const t = setInterval(() => {
    p = Math.min(p + Math.random() * 4.5, 100);
    pct.textContent = Math.floor(p) + '%';
    if (p >= 100) { clearInterval(t); setTimeout(() => ldr.classList.add('gone'), 360); }
  }, 55);
}

// Hamburger menu
function initHamburger() {
  const btn = document.getElementById('hamburger');
  const overlay = document.getElementById('menuOverlay');
  if (!btn || !overlay) return;

  btn.addEventListener('click', () => {
    btn.classList.toggle('open');
    overlay.classList.toggle('open');
    document.body.style.overflow = overlay.classList.contains('open') ? 'hidden' : '';
  });

  // Close menu when clicking a link
  overlay.querySelectorAll('a, .menu-link').forEach(link => {
    link.addEventListener('click', () => {
      btn.classList.remove('open');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

// File upload handler
function handleFileUpload(fileList) {
  if (!fileList || fileList.length === 0) return;
  let count = 0;
  Array.from(fileList).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const content = e.target.result;
      AppState.files.set(file.name, {
        name: file.name,
        content: content,
        lang: detectLang(file.name),
        size: file.size
      });
      count++;
      if (count === fileList.length) {
        renderFileList();
        renderFileTree();
        showToast(`✅ Uploaded ${count} file${count > 1 ? 's' : ''}`, 'success');
        document.getElementById('dropZone')?.classList.add('hidden');
        document.getElementById('fileList')?.classList.remove('hidden');
      }
    };
    reader.readAsText(file);
  });
}

function renderFileList() {
  const list = document.getElementById('fileList');
  const drop = document.getElementById('dropZone');
  if (!list) return;
  if (AppState.files.size === 0) {
    list.classList.add('hidden');
    if (drop) drop.classList.remove('hidden');
    return;
  }
  if (drop) drop.classList.add('hidden');
  list.classList.remove('hidden');
  list.innerHTML = '';
  AppState.files.forEach((file, name) => {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.innerHTML = `
      <span class="fi-icon">${fileIcon(name)}</span>
      <span class="fi-name">${name}</span>
      <span class="fi-size">${detectLang(name)} · ${formatBytes(file.size)}</span>
      <div class="fi-actions">
        <button class="fi-btn" onclick="openFileInEditor('${name}')">Edit</button>
        <button class="fi-btn danger" onclick="deleteFile('${name}')">✕</button>
      </div>`;
    list.appendChild(div);
  });
}

function deleteFile(name) {
  AppState.files.delete(name);
  AppState.openFiles = AppState.openFiles.filter(f => f !== name);
  AppState.changedFiles.delete(name);
  if (AppState.activeFile === name) {
    AppState.activeFile = AppState.openFiles[AppState.openFiles.length - 1] || null;
    const editor = document.getElementById('codeEditor');
    if (AppState.activeFile) {
      if (window.monacoInstance) {
        window.monacoInstance.setValue(AppState.files.get(AppState.activeFile)?.content || '');
      } else {
        setTimeout(() => window.monacoInstance && window.monacoInstance.setValue(AppState.files.get(AppState.activeFile)?.content || ''), 500);
      }
      document.getElementById('editorLang').textContent = AppState.files.get(AppState.activeFile)?.lang || '—';
    } else { editor.value = ''; document.getElementById('editorLang').textContent = '—'; }
  }
  renderFileList(); renderFileTree(); renderEditorTabs(); renderChangedFiles();
  showToast(`Deleted ${name}`);
}

function newFile() {
  const name = prompt('File name (e.g. index.js):');
  if (!name || !name.trim()) return;
  const fname = name.trim();
  if (AppState.files.has(fname)) { showToast('File already exists.', 'error'); return; }
  AppState.files.set(fname, { name: fname, content: '', lang: detectLang(fname), size: 0 });
  renderFileList(); renderFileTree();
  openFileInEditor(fname);
  showToast(`Created ${fname}`, 'success');
}

function onEditorInput() {
  onEditorChange();
}

function onEditorKeydown(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const el    = e.target;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    el.value = el.value.slice(0, start) + '  ' + el.value.slice(end);
    el.selectionStart = el.selectionEnd = start + 2;
    onEditorChange();
  }
}

function connectGitHub() {
  if (AppState.gitConfig.provider === 'github' && AppState.gitConfig.connected) {
    AppState.gitConfig.connected = false;
    AppState.gitConfig.provider  = null;
    updateGitProviderUI(); saveSession();
    showToast('GitHub disconnected.');
  } else {
    handleGitHubAuth();
  }
}
