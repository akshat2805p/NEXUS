// ── MAIN — Wires everything together ────────────────────

// Safe listener binding wrappers
function safeAddListener(id, event, callback) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener(event, callback);
  }
}

function safeAddListenerToAll(selector, event, callback) {
  const els = document.querySelectorAll(selector);
  if (els.length > 0) {
    els.forEach(el => el.addEventListener(event, callback));
  }
}

document.addEventListener('DOMContentLoaded', () => {

  // Init UI systems
  try { initLoader(); } catch (e) { console.error("Loader error:", e); }
  try { initCursor(); } catch (e) { console.error("Cursor error:", e); }
  try { initNavScroll(); } catch (e) { console.error("Nav error:", e); }
  try { 
    initReveal(); 
    if (typeof initScrollAnimations === 'function') {
      initScrollAnimations();
    }
  } catch (e) { console.error("Reveal error:", e); }
  try { initCounters(); } catch (e) { console.error("Counters error:", e); }
  try { initHamburger(); } catch (e) { console.error("Hamburger error:", e); }

  // Load saved session
  try {
    if (AppState.user) {
      renderDashboard();
      showDashboard();

      if (AppState.gitConfig.token) {
        const ownerEl = document.getElementById('repoOwner');
        if (ownerEl && AppState.gitConfig.owner) ownerEl.value = AppState.gitConfig.owner;
        const branchEl = document.getElementById('repoBranch');
        if (branchEl && AppState.gitConfig.branch) branchEl.value = AppState.gitConfig.branch;
        const tokenEl = document.getElementById('githubToken');
        if (tokenEl) tokenEl.value = AppState.gitConfig.token;

        if (typeof autoVerifyGitHubConnection === 'function') {
          autoVerifyGitHubConnection().then(() => {
            updateGitProviderUI();
          });
        }
      }
    }
  } catch (e) {
    console.error("Session error:", e);
  }

  // ── AUTH MODAL ─────────────────────────────────────────
  safeAddListener('btnSignIn', 'click', openAuth);
  safeAddListener('btnGetStarted', 'click', openAuth);
  safeAddListener('heroGetStarted', 'click', openAuth);
  safeAddListener('menuSignIn', 'click', (e) => {
    e.preventDefault();
    // Close mobile menu first
    const ham = document.getElementById('hamburger');
    const overlay = document.getElementById('menuOverlay');
    if (ham) ham.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
    openAuth();
  });

  safeAddListener('tryEditorBtn', 'click', () => {
    if (AppState.user) { switchPanel('editor'); }
    else openAuth();
  });

  safeAddListener('authClose', 'click', closeAuth);

  const overlay = document.getElementById('auth-overlay');
  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeAuth();
    });
  }

  // Auth tabs
  safeAddListenerToAll('.auth-tab', 'click', function() {
    switchTab(this.dataset.tab);
  });

  // Social auth
  safeAddListener('btnGoogle', 'click', handleGoogleAuth);
  safeAddListener('btnGitHub', 'click', handleGitHubAuth);

  // Email auth
  safeAddListener('btnEmailLogin', 'click', handleEmailLogin);
  safeAddListener('btnEmailSignup', 'click', handleEmailSignup);

  // Enter key submit
  ['loginEmail', 'loginPass'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleEmailLogin();
      });
    }
  });

  ['signupName', 'signupEmail', 'signupPass'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleEmailSignup();
      });
    }
  });

  // Token Panel Events
  safeAddListener('btnTokenVerify', 'click', verifyTokenAndSignIn);
  safeAddListener('btnTokenDemo', 'click', useDemoAccount);

  const tokenBack = document.getElementById('btnTokenBack');
  if (tokenBack) {
    tokenBack.addEventListener('click', e => {
      e.preventDefault();
      hideTokenPanel();
    });
  }

  const tokenInput = document.getElementById('authTokenInput');
  if (tokenInput) {
    tokenInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') verifyTokenAndSignIn();
    });
  }

  // ── DASHBOARD ──────────────────────────────────────────
  safeAddListener('btnLogout', 'click', logoutUser);

  // Panel navigation
  safeAddListenerToAll('.dash-nav-item', 'click', function() {
    switchPanel(this.dataset.panel);
  });

  // ── FILE UPLOAD ────────────────────────────────────────
  const fileInput = document.getElementById('fileInput');
  const drop      = document.getElementById('dropZone');

  safeAddListener('btnUpload', 'click', () => {
    if (fileInput) fileInput.click();
  });

  if (fileInput) {
    fileInput.addEventListener('change', e => handleFileUpload(e.target.files));
  }

  safeAddListener('btnNewFile', 'click', newFile);

  // Drag & drop
  if (drop && fileInput) {
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('drag-over');
      handleFileUpload(e.dataTransfer.files);
    });
  }

  // Global drag & drop on dashboard
  const dash = document.getElementById('dashboard');
  if (dash) {
    dash.addEventListener('dragover', e => e.preventDefault());
    dash.addEventListener('drop', e => {
      e.preventDefault();
      if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files);
    });
  }

  // ── EDITOR ────────────────────────────────────────────
  const editor = document.getElementById('codeEditor');
  if (editor) {
    editor.addEventListener('input', onEditorInput);
    editor.addEventListener('keydown', onEditorKeydown);
    editor.addEventListener('scroll', () => {
      const lineNums = document.getElementById('lineNumbers');
      if (lineNums) lineNums.scrollTop = editor.scrollTop;
    });
  }

  safeAddListener('btnRun', 'click', runCode);
  safeAddListener('btnFixBugs', 'click', fixBugs);
  safeAddListener('btnFormat', 'click', formatCode);
  safeAddListener('btnClearOutput', 'click', clearOutput);
  safeAddListener('btnApplyFix', 'click', applyFix);
  safeAddListener('btnDismissFix', 'click', dismissFix);

  // ── GIT ───────────────────────────────────────────────
  safeAddListener('connectGitHub', 'click', connectGitHub);
  safeAddListener('btnLoadRepo', 'click', loadRepo);

  const repoSelector = document.getElementById('repoSelector');
  if (repoSelector) {
    repoSelector.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        const parts = val.split('|');
        const ownerEl = document.getElementById('repoOwner');
        const nameEl = document.getElementById('repoName');
        const branchEl = document.getElementById('repoBranch');

        if (ownerEl) ownerEl.value = parts[0];
        if (nameEl) nameEl.value = parts[1];
        if (branchEl) branchEl.value = parts[2] || 'main';

        loadRepo();
      }
    });
  }

  safeAddListener('btnCommit', 'click', commitAndPush);
  safeAddListener('btnStageAll', 'click', stageAll);

  const ghTokenInput = document.getElementById('githubToken');
  if (ghTokenInput) {
    ghTokenInput.addEventListener('change', e => {
      AppState.gitConfig.token = e.target.value.trim();
      saveSession();
    });
  }

  // ── KEYBOARD SHORTCUTS ────────────────────────────────
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (AppState.activeFile) {
        showToast('File saved.', 'success');
        runCode();
      }
    }
    if (e.key === 'Escape') closeAuth();
  });

  // ── SMOOTH SCROLL for landing nav links ───────────────
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    });
  });

});
