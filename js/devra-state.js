// ── STATE ──────────────────────────────────────────────────
/** @type {{ user: null|Object, files: Map<string,Object>, openFiles: string[], activeFile: string|null, gitConfig: Object, changedFiles: Set<string>, commits: Array }} */
const AppState = {
  user: null,
  files: new Map(),          // filename → { name, content, lang, size }
  openFiles: [],             // tabs
  activeFile: null,
  gitConfig: {
    provider: null,          // 'github' | 'gitlab'
    token: null,
    owner: null,
    repo: null,
    branch: 'main',
    connected: false
  },
  changedFiles: new Set(),
  commits: []
};

// Persist user session
function saveSession() {
  try {
    const data = { user: AppState.user, gitConfig: AppState.gitConfig, commits: AppState.commits };
    localStorage.setItem('nf_session', JSON.stringify(data));
  } catch(e) {}
}

function loadSession() {
  try {
    const raw = localStorage.getItem('nf_session');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.user)      AppState.user      = data.user;
    if (data.gitConfig) AppState.gitConfig = { ...AppState.gitConfig, ...data.gitConfig };
    if (data.commits)   AppState.commits   = data.commits;
  } catch(e) {}
}

// Language detection from extension
function detectLang(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    js: 'JavaScript', ts: 'TypeScript', jsx: 'JSX', tsx: 'TSX',
    html: 'HTML', css: 'CSS', scss: 'SCSS', less: 'LESS',
    py: 'Python', json: 'JSON', md: 'Markdown',
    vue: 'Vue', svelte: 'Svelte', java: 'Java',
    cpp: 'C++', c: 'C', go: 'Go', rs: 'Rust',
    php: 'PHP', rb: 'Ruby', sh: 'Shell', yaml: 'YAML', yml: 'YAML',
    txt: 'Text', xml: 'XML', sql: 'SQL'
  };
  return map[ext] || 'Plain Text';
}

// File icon from extension
function fileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    js:'🟨', ts:'🔷', jsx:'⚛️', tsx:'⚛️',
    html:'🌐', css:'🎨', scss:'🎨', less:'🎨',
    py:'🐍', json:'📋', md:'📝',
    vue:'💚', svelte:'🧡', go:'🐹',
    rs:'🦀', java:'☕', sh:'⚙️',
    yaml:'📄', yml:'📄', txt:'📄',
    png:'🖼️', jpg:'🖼️', svg:'🎭',
    sql:'🗄️', env:'🔐'
  };
  return map[ext] || '📄';
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Load session immediately so it's available before onAuthStateChanged fires
loadSession();
