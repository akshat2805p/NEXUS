// ── GIT ─────────────────────────────────────────────────────

async function fetchUserGitHubRepositories() {
  const token = AppState.gitConfig.token || document.getElementById('githubToken')?.value?.trim();
  if (!token) return;
  
  const selectorRow = document.getElementById('repoSelectorRow');
  const selector = document.getElementById('repoSelector');
  
  try {
    const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!res.ok) throw new Error('Failed to fetch repositories');
    const repos = await res.json();
    
    if (repos && repos.length > 0) {
      if (selector) {
        selector.innerHTML = '<option value="">Select a repository...</option>';
        repos.forEach(repo => {
          const opt = document.createElement('option');
          opt.value = `${repo.owner.login}|${repo.name}|${repo.default_branch}`;
          opt.textContent = `${repo.owner.login} / ${repo.name} (${repo.default_branch || 'main'})`;
          
          if (AppState.gitConfig.owner === repo.owner.login && AppState.gitConfig.repo === repo.name) {
            opt.selected = true;
          }
          selector.appendChild(opt);
        });
      }
      if (selectorRow) selectorRow.style.display = 'block';
    } else {
      if (selectorRow) selectorRow.style.display = 'none';
    }
  } catch (e) {
    console.error("Error fetching user repositories:", e);
  }
}

function updateGitProviderUI() {
  const cfg = AppState.gitConfig;
  const ghStatus = document.getElementById('ghStatus');
  const ghBtn    = document.getElementById('connectGitHub');
  const selectorRow = document.getElementById('repoSelectorRow');
  
  if (cfg.provider === 'github' && cfg.connected) {
    if (ghStatus) { ghStatus.textContent = '● Connected'; ghStatus.className = 'provider-status connected'; }
    if (ghBtn)    { ghBtn.textContent = 'Connected ✓'; ghBtn.className = 'provider-btn connected'; }
    
    // Fetch live repos in real-time!
    fetchUserGitHubRepositories();
  } else {
    if (ghStatus) { ghStatus.textContent = 'Not connected'; ghStatus.className = 'provider-status'; }
    if (ghBtn)    { ghBtn.textContent = 'Connect'; ghBtn.className = 'provider-btn'; }
    if (selectorRow) selectorRow.style.display = 'none';
  }
}

function renderChangedFiles() {
  const el = document.getElementById('changedFiles');
  if (!el) return;
  if (AppState.changedFiles.size === 0) {
    el.innerHTML = '<div class="no-changes">No changed files yet. Edit files in the Editor panel.</div>';
    return;
  }
  el.innerHTML = '';
  AppState.changedFiles.forEach(fname => {
    const div = document.createElement('div');
    div.className = 'changed-file-item';
    div.innerHTML = `<span>${fileIcon(fname)}</span>
      <span style="font-family:var(--font-mono);font-size:.8rem;color:var(--editor-text);flex:1">${fname}</span>
      <span class="cf-status modified">M</span>`;
    el.appendChild(div);
  });
}

function stageAll() {
  if (AppState.files.size === 0) { showToast('No files to stage.', 'error'); return; }
  AppState.files.forEach((_, name) => AppState.changedFiles.add(name));
  renderChangedFiles();
  showToast('All files staged ✓', 'success');
}

async function commitAndPush() {
  const token  = document.getElementById('githubToken')?.value?.trim() || AppState.gitConfig.token;
  const owner  = document.getElementById('repoOwner')?.value?.trim()  || AppState.gitConfig.owner;
  const repo   = document.getElementById('repoName')?.value?.trim()   || AppState.gitConfig.repo;
  const branch = document.getElementById('repoBranch')?.value?.trim() || AppState.gitConfig.branch || 'main';
  const msg    = document.getElementById('commitMsg')?.value?.trim();
  
  if (!token) { showToast('Personal Access Token required.', 'error'); return; }
  if (!owner) { showToast('Repository owner required.', 'error'); return; }
  if (!repo)  { showToast('Repository name required.', 'error'); return; }
  if (!msg)   { showToast('Commit message required.', 'error'); return; }
  if (AppState.changedFiles.size === 0) { showToast('No changed files to commit.', 'error'); return; }
  
  AppState.gitConfig = { ...AppState.gitConfig, token, owner, repo, branch, connected: true };
  saveSession();
  
  const btn = document.getElementById('btnCommit');
  btn.textContent = '⏳ Pushing...'; btn.disabled = true;
  const errors = [], pushed = [];
  
  try {
    for (const filename of AppState.changedFiles) {
      const file = AppState.files.get(filename);
      if (!file) continue;
      
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`;
      const ghHeaders = { 
        Authorization: `Bearer ${token}`, 
        Accept: 'application/vnd.github.v3+json', 
        'Content-Type': 'application/json' 
      };
      
      let sha = null;
      try { 
        const c = await fetch(apiUrl, { headers: ghHeaders }); 
        if (c.ok) sha = (await c.json()).sha; 
      } catch(_) {}
      
      const content = btoa(unescape(encodeURIComponent(file.content)));
      const body = JSON.stringify({ message: msg, content, branch, ...(sha ? { sha } : {}) });
      const res = await fetch(apiUrl, { method: 'PUT', headers: ghHeaders, body });
      res.ok ? pushed.push(filename) : errors.push(filename);
    }
    
    if (pushed.length > 0) {
      const hash = Math.random().toString(36).slice(2,9);
      AppState.commits.unshift({ hash, message: msg, files: [...pushed], time: new Date().toLocaleTimeString() });
      if (AppState.commits.length > 20) AppState.commits.pop();
      pushed.forEach(f => AppState.changedFiles.delete(f));
      document.getElementById('commitMsg').value = '';
      renderChangedFiles(); renderEditorTabs(); renderCommitLog(); saveSession();
      showToast(`✅ Pushed ${pushed.length} file(s) to ${owner}/${repo}`, 'success');
    }
    if (errors.length > 0) showToast(`⚠️ Failed: ${errors.join(', ')} — check token & permissions`, 'error');
  } catch(e) {
    showToast('Network error: ' + e.message, 'error');
  } finally {
    btn.textContent = '🚀 Commit & Push'; btn.disabled = false;
  }
}

function renderCommitLog() {
  const log = document.getElementById('commitLog');
  if (!log) return;
  log.innerHTML = '';
  AppState.commits.slice(0, 8).forEach(c => {
    const div = document.createElement('div');
    div.className = 'commit-entry';
    div.innerHTML = `<span style="color:#8b5cf6; margin-right:8px; display:inline-block; vertical-align:middle;">○─</span>
      <span class="commit-hash" style="display:inline-block; vertical-align:middle;">${c.hash}</span>
      <span class="commit-text" style="display:inline-block; vertical-align:middle;">${c.message} <span style="color:var(--dim);font-size:.7rem">(${c.files.length} file${c.files.length>1?'s':''})</span></span>
      <span class="commit-time">${c.time}</span>`;
    log.appendChild(div);
  });
}

async function loadRepo() {
  const token  = document.getElementById('githubToken')?.value?.trim() || AppState.gitConfig.token;
  const owner  = document.getElementById('repoOwner')?.value?.trim() || AppState.gitConfig.owner;
  const repo   = document.getElementById('repoName')?.value?.trim() || AppState.gitConfig.repo;
  const branch = document.getElementById('repoBranch')?.value?.trim() || AppState.gitConfig.branch || 'main';
  
  if (!owner || !repo) { showToast('Owner and repo name required.', 'error'); return; }
  showToast(`Loading ${owner}/${repo}...`, 'info');
  
  // Clear previous workspace files entirely for clean loading
  AppState.files.clear();
  AppState.openFiles = [];
  AppState.activeFile = null;
  AppState.changedFiles.clear();
  
  try {
    const headers = token ? { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } : {};
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers });
    if (!res.ok) throw new Error('Repo not found or private (provide PAT token)');
    const data = await res.json();
    const fileItems = (data.tree || []).filter(t => t.type === 'blob' && t.size < 200000);
    let loaded = 0;
    
    // Fetch up to 30 files from the repository
    for (const item of fileItems.slice(0, 30)) {
      try {
        const fRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${item.path}?ref=${branch}`, { headers });
        if (!fRes.ok) continue;
        const fData = await fRes.json();
        const content = fData.encoding === 'base64' ? decodeURIComponent(escape(atob(fData.content.replace(/\n/g,'')))) : (fData.content || '');
        const path = item.path;
        AppState.files.set(path, { name: path, content, lang: detectLang(path), size: item.size });
        loaded++;
      } catch(_) {}
    }
    
    AppState.gitConfig = { ...AppState.gitConfig, owner, repo, branch, token };
    updateGitProviderUI(); 
    renderFileList(); 
    renderFileTree(); 
    
    // Open the first loaded file directly in the editor!
    if (AppState.files.size > 0) {
      const firstFileName = AppState.files.keys().next().value;
      openFileInEditor(firstFileName);
    }
    
    saveSession();
    showToast(`✅ Loaded ${loaded} files from ${owner}/${repo}`, 'success');
  } catch(e) { 
    showToast('Error: ' + e.message, 'error'); 
  }
}
