// ── AUTH ───────────────────────────────────────────────────

let firebaseAuth = null;

// Robust Firebase initialization with retry
function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.warn("Firebase SDK not loaded yet.");
    return false;
  }
  if (!isFirebaseConfigured()) {
    console.warn("Firebase is not configured. Using developer simulation mode.");
    return false;
  }
  try {
    // Prevent double initialization
    if (firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
    }
    firebaseAuth = firebase.auth();

    // Set persistence to LOCAL so sessions survive page refresh
    firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .catch(err => console.warn("Could not set auth persistence:", err));

    console.log("Firebase Authentication initialized successfully! 🚀");

    // Initialize Firebase App Check with reCAPTCHA if Site Key is set up
    if (typeof firebase.appCheck === 'function' && typeof recaptchaSiteKey !== 'undefined' && recaptchaSiteKey && !recaptchaSiteKey.startsWith("YOUR_")) {
      try {
        const appCheck = firebase.appCheck();
        appCheck.activate(
          new firebase.appCheck.ReCaptchaEnterpriseProvider(recaptchaSiteKey),
          true
        );
        console.log("Firebase App Check (reCAPTCHA Enterprise) activated! 🛡️");
      } catch (e) {
        try {
          const appCheck = firebase.appCheck();
          appCheck.activate(
            new firebase.appCheck.ReCaptchaV3Provider(recaptchaSiteKey),
            true
          );
          console.log("Firebase App Check (reCAPTCHA v3) activated! 🛡️");
        } catch (err) {
          console.warn("App Check activation skipped:", err.message);
        }
      }
    }
    return true;
  } catch (e) {
    console.error("Failed to initialize Firebase:", e);
    return false;
  }
}

// Initialize immediately
initFirebase();

function openAuth() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.classList.remove('hidden');
}
function closeAuth() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.classList.add('hidden');
  hideTokenPanel();
}
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  const loginForm = document.getElementById('authFormLogin');
  const signupForm = document.getElementById('authFormSignup');
  if (loginForm) loginForm.classList.toggle('hidden', tab !== 'login');
  if (signupForm) signupForm.classList.toggle('hidden', tab !== 'signup');
}

// ── Session Syncing ──
function loginUser(user) {
  AppState.user = user;
  saveSession();
  closeAuth();
  renderDashboard();
  showDashboard();
  showToast('Welcome, ' + user.name + '! 👋', 'success');
}

function logoutUser() {
  if (firebaseAuth) {
    firebaseAuth.signOut().catch(err => console.error("Error signing out:", err));
  }
  AppState.user = null;
  AppState.gitConfig = {
    provider: null, token: null, owner: null,
    repo: null, branch: 'main', connected: false
  };
  localStorage.removeItem('nf_session');
  hideDashboard();
  showToast('Signed out successfully.');
}

function renderDashboard() {
  const u = AppState.user;
  if (!u) return;

  const usernameEl = document.getElementById('dashUsername');
  if (!usernameEl) {
    document.addEventListener('DOMContentLoaded', () => renderDashboard());
    return;
  }

  usernameEl.textContent = u.name || 'User';

  const emailEl = document.getElementById('dashUserEmail');
  if (emailEl) emailEl.textContent = u.email || '';

  const avatarEl = document.getElementById('dashAvatar');
  if (avatarEl) {
    if (u.avatar) {
      avatarEl.style.backgroundImage = `url(${u.avatar})`;
      avatarEl.style.backgroundSize  = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      avatarEl.textContent = '';
    } else {
      avatarEl.style.backgroundImage = 'none';
      avatarEl.textContent = (u.name||'U')[0].toUpperCase();
    }
  }

  // Restore git config in UI
  const ownerEl = document.getElementById('repoOwner');
  if (ownerEl && AppState.gitConfig.owner) ownerEl.value = AppState.gitConfig.owner;

  const repoEl = document.getElementById('repoName');
  if (repoEl && AppState.gitConfig.repo) repoEl.value = AppState.gitConfig.repo;

  const branchEl = document.getElementById('repoBranch');
  if (branchEl && AppState.gitConfig.branch) branchEl.value = AppState.gitConfig.branch;

  const tokenEl = document.getElementById('githubToken');
  if (tokenEl && AppState.gitConfig.token) tokenEl.value = AppState.gitConfig.token;

  updateGitProviderUI();
  renderCommitLog();
}

function showDashboard() {
  const dash = document.getElementById('dashboard');
  const land = document.getElementById('landing');
  if (dash) dash.classList.remove('hidden');
  if (land) land.style.display = 'none';
}
function hideDashboard() {
  const dash = document.getElementById('dashboard');
  const land = document.getElementById('landing');
  if (dash) dash.classList.add('hidden');
  if (land) land.style.display = '';
}

function showTokenPanel(provider) {
  const panel = document.getElementById('authTokenPanel');
  if (!panel) return;

  panel.dataset.provider = 'github';

  const title = document.getElementById('tokenPanelTitle');
  const icon = document.getElementById('tokenProviderIcon');
  const desc = document.getElementById('tokenPanelDesc');
  const input = document.getElementById('authTokenInput');

  if (icon) icon.textContent = '🐙';
  if (title) title.textContent = 'GitHub Connect';
  if (desc) desc.innerHTML = `Enter your GitHub Personal Access Token (PAT) with <code>repo</code> scope to fetch your real-time profile and files.`;
  if (input) { input.placeholder = 'ghp_...'; input.value = ''; }

  document.getElementById('authTabsHeader')?.classList.add('hidden');
  document.getElementById('authSocialsArea')?.classList.add('hidden');
  document.getElementById('authSocialsDivider')?.classList.add('hidden');
  document.getElementById('authFormLogin')?.classList.add('hidden');
  document.getElementById('authFormSignup')?.classList.add('hidden');

  panel.classList.remove('hidden');
}

function hideTokenPanel() {
  const panel = document.getElementById('authTokenPanel');
  if (!panel) return;

  panel.classList.add('hidden');

  document.getElementById('authTabsHeader')?.classList.remove('hidden');
  document.getElementById('authSocialsArea')?.classList.remove('hidden');
  document.getElementById('authSocialsDivider')?.classList.remove('hidden');

  const activeTab = document.querySelector('.auth-tab.active')?.dataset.tab || 'login';
  if (activeTab === 'login') {
    document.getElementById('authFormLogin')?.classList.remove('hidden');
  } else {
    document.getElementById('authFormSignup')?.classList.remove('hidden');
  }
}

// ── Real-Time API Token Verification ──
async function verifyTokenAndSignIn() {
  const input = document.getElementById('authTokenInput');
  const token = input?.value.trim();
  const panel = document.getElementById('authTokenPanel');
  const provider = panel?.dataset.provider;

  if (!token) { showToast('Please enter your Personal Access Token.', 'error'); return; }

  showToast('Connecting and verifying token...', 'info');
  const btn = document.getElementById('btnTokenVerify');
  btn.textContent = '⏳ Connecting...'; btn.disabled = true;

  try {
    if (provider === 'github') {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (!res.ok) throw new Error('Unauthorized or invalid token scopes');
      const user = await res.json();

      loginUser({
        name: user.name || user.login,
        email: user.email || `${user.login}@github.com`,
        provider: 'github',
        avatar: user.avatar_url
      });

      AppState.gitConfig.provider = 'github';
      AppState.gitConfig.token = token;
      AppState.gitConfig.owner = user.login;
      AppState.gitConfig.connected = true;

      const ownerEl = document.getElementById('repoOwner');
      if (ownerEl) ownerEl.value = user.login;
      const branchEl = document.getElementById('repoBranch');
      if (branchEl) branchEl.value = 'main';
      const tokenEl = document.getElementById('githubToken');
      if (tokenEl) tokenEl.value = token;

      updateGitProviderUI();
      saveSession();
      showToast('Successfully connected to GitHub! 🐙', 'success');
      hideTokenPanel();
    }
  } catch(e) {
    showToast('Verification failed: ' + e.message, 'error');
  } finally {
    btn.textContent = 'Verify & Sign In'; btn.disabled = false;
  }
}

function useDemoAccount() {
  showToast('Connecting simulated account...', 'info');
  setTimeout(() => {
    loginUser({
      name: 'GitHub User (Demo)',
      email: 'demo@github.com',
      provider: 'github',
      avatar: null
    });
    AppState.gitConfig.provider  = 'github';
    AppState.gitConfig.connected = true;
    updateGitProviderUI();
    saveSession();
    hideTokenPanel();
  }, 600);
}

// ── Google Authentication Handler ──
window.onGoogleAuthSuccess = function(data) {
  loginUser(data);
};

function handleGoogleAuth() {
  if (firebaseAuth) {
    showToast('Opening Google Sign-In...', 'info');
    const provider = new firebase.auth.GoogleAuthProvider();

    // Try popup first, fall back to redirect
    firebaseAuth.signInWithPopup(provider)
      .then(result => {
        const user = result.user;
        loginUser({
          name: user.displayName || user.email.split('@')[0],
          email: user.email,
          provider: 'google',
          avatar: user.photoURL
        });
        showToast('Successfully signed in with Google! 🚀', 'success');
      })
      .catch(error => {
        // If popup was blocked, try redirect
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
          showToast('Popup blocked. Trying redirect sign-in...', 'info');
          firebaseAuth.signInWithRedirect(provider)
            .catch(redirectError => {
              showToast('Sign-in failed: ' + redirectError.message, 'error');
              console.error("Redirect auth error:", redirectError);
            });
        } else if (error.code === 'auth/cancelled-popup-request') {
          // User cancelled, do nothing
        } else {
          showToast('Google Sign-In failed: ' + error.message, 'error');
          console.error("Google OAuth error:", error);
        }
      });
  } else {
    showToast('Developer Mode: Using Simulated Google Sign-In', 'info');
    runSimulatedGoogleAuth();
  }
}

function runSimulatedGoogleAuth() {
  const width = 500, height = 620;
  const left = (screen.width - width) / 2, top = (screen.height - height) / 2;

  const win = window.open('', 'Google Sign-In', `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`);
  if (!win) {
    showToast('Popup blocked! Please allow popups to continue.', 'error');
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Sign in — Google Accounts</title>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Roboto', sans-serif;
          background: #ffffff;
          color: #202124;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 100vh; padding: 2rem;
        }
        .container {
          width: 100%; max-width: 400px;
          border: 1px solid #dadce0; border-radius: 8px;
          padding: 2.5rem 2rem; text-align: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .g-logo { display: flex; justify-content: center; margin-bottom: 1rem; }
        h1 { font-size: 1.5rem; font-weight: 400; margin-bottom: 0.5rem; }
        .sub { font-size: 0.95rem; color: #5f6368; margin-bottom: 2rem; }
        .account-list { display: flex; flex-direction: column; gap: 0.5rem; text-align: left; }
        .account-item {
          display: flex; align-items: center; gap: 1rem;
          padding: 0.8rem 1rem; border-bottom: 1px solid #e8eaed;
          cursor: pointer; border-radius: 4px; transition: background 0.15s;
        }
        .account-item:hover { background: #f8f9fa; }
        .avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, #4285f4, #34a853);
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 500; font-size: 1.1rem;
        }
        .avatar.pink { background: linear-gradient(135deg, #ea4335, #fbbc05); }
        .avatar.purple { background: linear-gradient(135deg, #a855f7, #f43f5e); }
        .info { flex: 1; }
        .name { font-size: 0.9rem; font-weight: 500; }
        .email { font-size: 0.8rem; color: #5f6368; }
        .loader-wrap { display: none; flex-direction: column; align-items: center; gap: 1.2rem; margin-top: 1.5rem; }
        .google-loader {
          width: 48px; height: 48px;
          border: 4px solid #f3f3f3; border-top: 4px solid #4285f4;
          border-radius: 50%; animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <div class="container" id="pickerContainer">
        <div class="g-logo">
          <svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
        </div>
        <h1>Choose an account</h1>
        <div class="sub">to continue to <strong>DevRA</strong></div>
        <div class="account-list">
          <div class="account-item" onclick="selectAccount('Arjun Khanna', 'arjun.khanna@gmail.com')">
            <div class="avatar">A</div>
            <div class="info"><div class="name">Arjun Khanna</div><div class="email">arjun.khanna@gmail.com</div></div>
          </div>
          <div class="account-item" onclick="selectAccount('Priya Rajan', 'priya.rajan@gmail.com')">
            <div class="avatar pink">P</div>
            <div class="info"><div class="name">Priya Rajan</div><div class="email">priya.rajan@gmail.com</div></div>
          </div>
          <div class="account-item" onclick="selectAccount('Sneha Sharma', 'sneha.sharma@gmail.com')">
            <div class="avatar purple">S</div>
            <div class="info"><div class="name">Sneha Sharma</div><div class="email">sneha.sharma@gmail.com</div></div>
          </div>
        </div>
      </div>
      <div class="container" id="loaderContainer" style="display:none;">
        <div class="google-loader"></div>
        <h2 style="font-weight:400; font-size:1.2rem; margin-top: 1rem;">Signing in...</h2>
      </div>
      <script>
        function selectAccount(name, email) {
          document.getElementById('pickerContainer').style.display = 'none';
          document.getElementById('loaderContainer').style.display = 'flex';
          setTimeout(() => {
            if (window.opener && !window.opener.closed) {
              window.opener.onGoogleAuthSuccess({ name, email, provider: 'google', avatar: null });
            }
            window.close();
          }, 1100);
        }
      </script>
    </body>
    </html>
  `);
}

// ── GitHub Authentication Handler ──
async function handleGitHubAuth() {
  if (firebaseAuth) {
    showToast('Opening GitHub Sign-In...', 'info');
    const provider = new firebase.auth.GithubAuthProvider();
    provider.addScope('repo');
    provider.addScope('read:user');
    provider.addScope('user:email');

    try {
      let result;
      try {
        result = await firebaseAuth.signInWithPopup(provider);
      } catch(popupError) {
        // Fallback to redirect if popup is blocked
        if (popupError.code === 'auth/popup-blocked') {
          showToast('Popup blocked. Trying redirect...', 'info');
          await firebaseAuth.signInWithRedirect(provider);
          return; // Will continue after redirect
        }
        throw popupError;
      }

      const user = result.user;
      const credential = result.credential;
      const token = credential ? credential.accessToken : null;

      let githubUsername = '';
      try { githubUsername = user.reloadUserInfo?.screenName || ''; } catch(e) {}

      if (!githubUsername && token) {
        try {
          const ghRes = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
          });
          if (ghRes.ok) {
            const ghUser = await ghRes.json();
            githubUsername = ghUser.login;
          }
        } catch(e) { console.warn('Could not fetch GitHub username:', e); }
      }

      if (!githubUsername) {
        githubUsername = user.email ? user.email.split('@')[0] : 'user';
      }

      if (token) {
        AppState.gitConfig.provider = 'github';
        AppState.gitConfig.token = token;
        AppState.gitConfig.owner = githubUsername;
        AppState.gitConfig.connected = true;
      }

      loginUser({
        name: user.displayName || githubUsername,
        email: user.email,
        provider: 'github',
        avatar: user.photoURL
      });

      if (token) {
        const ownerEl = document.getElementById('repoOwner');
        if (ownerEl) ownerEl.value = githubUsername;
        const branchEl = document.getElementById('repoBranch');
        if (branchEl) branchEl.value = 'main';
        const tokenEl = document.getElementById('githubToken');
        if (tokenEl) tokenEl.value = token;

        updateGitProviderUI();
        saveSession();
        showToast('Connected to GitHub as @' + githubUsername + '! 🐙', 'success');
      } else {
        showToast('Signed in with GitHub! 🐙', 'success');
      }
    } catch(error) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        return; // User cancelled, don't show error
      }
      showToast('GitHub Sign-In failed: ' + error.message, 'error');
      console.error('GitHub OAuth error:', error);
    }
  } else {
    showToast('Developer Mode: Connecting with Personal Access Token', 'info');
    showTokenPanel('github');
  }
}

// ── Email/Password Authentication ──
function handleEmailLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  if (!email || !pass) { showToast('Please fill in all fields.', 'error'); return; }
  if (!email.includes('@')) { showToast('Invalid email address.', 'error'); return; }

  if (firebaseAuth) {
    showToast('Signing in...', 'info');
    firebaseAuth.signInWithEmailAndPassword(email, pass)
      .then(result => {
        const user = result.user;
        loginUser({
          name: user.displayName || user.email.split('@')[0],
          email: user.email,
          provider: 'email',
          avatar: user.photoURL
        });
        showToast('Signed in successfully! 👋', 'success');
      })
      .catch(error => {
        // Better error messages
        let msg = error.message;
        if (error.code === 'auth/user-not-found') msg = 'No account found with this email.';
        if (error.code === 'auth/wrong-password') msg = 'Incorrect password.';
        if (error.code === 'auth/invalid-email') msg = 'Invalid email format.';
        if (error.code === 'auth/too-many-requests') msg = 'Too many attempts. Try again later.';
        showToast('Login failed: ' + msg, 'error');
        console.error("Email login error:", error);
      });
  } else {
    showToast('Developer Mode: Simulated Email Sign-In', 'info');
    setTimeout(() => {
      loginUser({ name: email.split('@')[0], email, provider: 'email', avatar: null });
    }, 600);
  }
}

function handleEmailSignup() {
  const name  = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pass  = document.getElementById('signupPass').value;
  if (!name || !email || !pass) { showToast('Please fill in all fields.', 'error'); return; }
  if (!email.includes('@'))      { showToast('Invalid email address.', 'error'); return; }
  if (pass.length < 8)           { showToast('Password must be at least 8 characters.', 'error'); return; }

  if (firebaseAuth) {
    showToast('Creating account...', 'info');
    firebaseAuth.createUserWithEmailAndPassword(email, pass)
      .then(result => {
        const user = result.user;
        user.updateProfile({ displayName: name })
          .then(() => {
            loginUser({
              name: name,
              email: user.email,
              provider: 'email',
              avatar: null
            });
            showToast('Account created successfully! Welcome! 🎉', 'success');
          })
          .catch(err => {
            console.error("Error updating profile:", err);
            loginUser({ name: name, email: user.email, provider: 'email', avatar: null });
          });
      })
      .catch(error => {
        let msg = error.message;
        if (error.code === 'auth/email-already-in-use') msg = 'An account with this email already exists.';
        if (error.code === 'auth/weak-password') msg = 'Password is too weak. Use at least 8 characters.';
        showToast('Signup failed: ' + msg, 'error');
        console.error("Email signup error:", error);
      });
  } else {
    showToast('Developer Mode: Simulated Email Sign-Up', 'info');
    setTimeout(() => loginUser({ name, email, provider: 'email', avatar: null }), 600);
  }
}

// ── Firebase Session Observer ──
// Handle redirect result (for when popup was blocked)
if (firebaseAuth) {
  firebaseAuth.getRedirectResult()
    .then(result => {
      if (result && result.user) {
        const user = result.user;
        const credential = result.credential;
        const token = credential ? credential.accessToken : null;
        const providerType = result.additionalUserInfo?.providerId || 'email';

        if (providerType.includes('github') && token) {
          AppState.gitConfig.provider = 'github';
          AppState.gitConfig.token = token;
          AppState.gitConfig.owner = user.email ? user.email.split('@')[0] : 'user';
          AppState.gitConfig.connected = true;
        }

        loginUser({
          name: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email,
          provider: providerType.includes('github') ? 'github' : providerType.includes('google') ? 'google' : 'email',
          avatar: user.photoURL
        });
        saveSession();
      }
    })
    .catch(err => {
      if (err.code !== 'auth/credential-already-in-use') {
        console.warn("Redirect result error:", err);
      }
    });

  firebaseAuth.onAuthStateChanged((user) => {
    if (user) {
      if (!AppState.user || AppState.user.email !== user.email) {
        const savedGitConfig = { ...AppState.gitConfig };
        loginUser({
          name: user.displayName || user.email.split('@')[0],
          email: user.email,
          provider: user.providerData[0]?.providerId || 'email',
          avatar: user.photoURL
        });
        if (savedGitConfig.token && savedGitConfig.connected) {
          AppState.gitConfig = savedGitConfig;
          saveSession();
        }
      }
    } else {
      if (AppState.user) {
        logoutUser();
      }
    }
  });
}

// ── Auto-verify saved GitHub connection on page load ──
async function autoVerifyGitHubConnection() {
  if (!AppState.gitConfig.token || !AppState.gitConfig.connected) return;
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${AppState.gitConfig.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (res.ok) {
      const ghUser = await res.json();
      AppState.gitConfig.owner = ghUser.login;
      AppState.gitConfig.provider = 'github';
      AppState.gitConfig.connected = true;
      saveSession();
      console.log('GitHub connection verified: @' + ghUser.login);
    } else {
      console.warn('GitHub token invalid, resetting connection');
      AppState.gitConfig.connected = false;
      AppState.gitConfig.token = null;
      saveSession();
    }
  } catch(e) {
    console.warn('Could not verify GitHub connection:', e);
  }
}
