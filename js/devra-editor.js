// ── EDITOR ─────────────────────────────────────────────────

let monacoInstance = null;
const lineNums      = () => document.getElementById('lineNumbers');
const editorTabsEl  = () => document.getElementById('editorTabs');
const editorLangEl  = () => document.getElementById('editorLang');
const fileTreeEl    = () => document.getElementById('editorFileTree');
const outputConsoleEl = () => document.getElementById('outputConsole');
const outputStatusEl  = () => document.getElementById('outputStatus');

function openFileInEditor(filename) {
  const file = AppState.files.get(filename);
  if (!file) return;
  if (!AppState.openFiles.includes(filename)) AppState.openFiles.push(filename);
  AppState.activeFile = filename;
  codeEditor().value = file.content;
  editorLangEl().textContent = file.lang;
  updateLineNumbers();
  renderEditorTabs();
  renderFileTree();
  switchPanel('editor');
}

function renderEditorTabs() {
  const tabs = editorTabsEl();
  if (!tabs) return;
  tabs.innerHTML = '';
  AppState.openFiles.forEach(fname => {
    const isActive  = fname === AppState.activeFile;
    const isChanged = AppState.changedFiles.has(fname);
    const tab = document.createElement('div');
    tab.className = 'editor-tab' + (isActive ? ' active' : '');
    tab.innerHTML = `<span>${fileIcon(fname)}</span><span>${fname}${isChanged ? ' ●' : ''}</span><span class="tab-close" data-file="${fname}">✕</span>`;
    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-close')) closeTab(fname);
      else openFileInEditor(fname);
    });
    tabs.appendChild(tab);
  });
}

function closeTab(filename) {
  AppState.openFiles = AppState.openFiles.filter(f => f !== filename);
  if (AppState.activeFile === filename) {
    AppState.activeFile = AppState.openFiles[AppState.openFiles.length - 1] || null;
    if (AppState.activeFile) {
      codeEditor().value = AppState.files.get(AppState.activeFile)?.content || '';
      editorLangEl().textContent = AppState.files.get(AppState.activeFile)?.lang || '—';
    } else { codeEditor().value = ''; editorLangEl().textContent = '—'; }
  }
  renderEditorTabs(); renderFileTree(); updateLineNumbers();
}

function renderFileTree() {
  const tree = fileTreeEl();
  if (!tree) return;
  tree.innerHTML = '';
  if (AppState.files.size === 0) {
    tree.innerHTML = '<div style="padding:.8rem 1.2rem;font-size:.72rem;color:var(--editor-comment)">No files open</div>';
    return;
  }
  AppState.files.forEach((file, name) => {
    const div = document.createElement('div');
    div.className = 'ft-item' + (name === AppState.activeFile ? ' active' : '');
    div.innerHTML = `<span class="ft-icon">${fileIcon(name)}</span><span>${name}</span>`;
    div.addEventListener('click', () => openFileInEditor(name));
    tree.appendChild(div);
  });
}

function updateLineNumbers() {
  const editor = codeEditor();
  const nums   = lineNums();
  if (!editor || !nums) return;
  const lines = editor.value.split('\n').length;
  nums.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
}

function onEditorChange() {
  updateLineNumbers();
  if (!AppState.activeFile) return;
  const file = AppState.files.get(AppState.activeFile);
  if (file) {
    const newContent = codeEditor().value;
    if (newContent !== file.content) {
      AppState.changedFiles.add(AppState.activeFile);
      file.content = newContent;
      renderEditorTabs();
      renderChangedFiles();
    }
  }
}

function formatCode() {
  const editor = codeEditor();
  if (!editor.value.trim()) return;
  try {
    const lang = AppState.files.get(AppState.activeFile)?.lang || '';
    if (lang === 'JSON') {
      editor.value = JSON.stringify(JSON.parse(editor.value), null, 2);
      if (AppState.activeFile) AppState.files.get(AppState.activeFile).content = editor.value;
    }
    updateLineNumbers();
    showToast('Code formatted ✨', 'success');
  } catch(e) { showToast('Cannot format: ' + e.message, 'error'); }
}

// Monaco init
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});
require(['vs/editor/editor.main'], function () {
    window.monacoInstance = monaco.editor.create(document.getElementById('monacoContainer'), {
        value: '// DevRA AI Editor Ready',
        language: 'javascript',
        theme: 'vs-dark',
        minimap: { enabled: false },
        automaticLayout: true
    });
});
