// ── IN-BROWSER COMPILER ───────────────────────────────────

const outputConsole = () => document.getElementById('outputConsole');
const outputStatus  = () => document.getElementById('outputStatus');

function setStatus(label, cls) {
  const el = outputStatus();
  el.textContent = label;
  el.className   = 'output-status ' + (cls || '');
}

function appendOutput(text, cls = '') {
  const line = document.createElement('div');
  line.className = 'console-line ' + cls;
  line.textContent = text;
  outputConsole().appendChild(line);
  outputConsole().scrollTop = outputConsole().scrollHeight;
}

function clearOutput() {
  outputConsole().innerHTML = '<div class="console-welcome">// Output cleared.</div>';
  setStatus('Ready', '');
  document.getElementById('aiFix').classList.add('hidden');
}

// ── Run / compile by language ──────────────────────────────
function runCode() {
  const file = AppState.activeFile;
  const code = window.monacoInstance ? window.monacoInstance.getValue().trim() : '';
  if (!code) { showToast('Nothing to run.', 'error'); return; }

  outputConsole().innerHTML = '';
  setStatus('Running…', 'running');
  appendOutput(`▶ Running ${file || 'code'}…`, 'info');

  let lang = (file ? detectLang(file) : '').toLowerCase();

  if (!lang || lang === 'javascript' || lang === 'code' || lang === 'text') {
    if (/^\s*def\s+\w+\s*\(|^\s*print\s*\(|^\s*import\s+[a-z]+|^\s*from\s+[a-z]+\s+import/m.test(code)) {
      lang = 'python';
    } else if (/^\s*<!DOCTYPE html>|^\s*<html/mi.test(code)) {
      lang = 'html';
    } else if (/^\s*\{[\s\S]*\}\s*$/s.test(code) || /^\s*\[[\s\S]*\]\s*$/s.test(code)) {
      lang = 'json';
    } else if (/^\s*function\s+\w+\s*\(|^\s*console\.log\s*\(|^\s*const\s+|^\s*let\s+/m.test(code)) {
      lang = 'javascript';
    } else if (!lang) {
      lang = 'javascript';
    }
  }

  if (checkPromptLimit()) return;
  setTimeout(() => {
    try {
      if (['javascript', 'jsx', 'typescript', 'tsx'].some(l => lang.toLowerCase().includes(l.toLowerCase().replace('script','').substring(0,4)) || lang === l)) {
        runJavaScript(code);
      } else if (lang === 'html') {
        runHTML(code);
      } else if (lang === 'python') {
        runPython(code);
      } else if (lang === 'json') {
        runJSON(code);
      } else if (lang === 'css') {
        runCSS(code);
      } else {
        appendOutput('ℹ Language "' + lang + '" is shown below (read-only preview):', 'info');
        appendOutput(code.substring(0, 500), '');
        setStatus('Preview', '');
      }
    } catch (err) {
      appendOutput('✕ Error: ' + err.message, 'error');
      setStatus('Error', 'error');
      suggestAIFix(code, err.message);
    }
  }, 200);
}

// ── JavaScript runner ─────────────────────────────────────
function runJavaScript(code) {
  const logs = [];
  const origLog   = console.log;
  const origWarn  = console.warn;
  const origError = console.error;

  // Capture console output
  console.log   = (...a) => { logs.push({ t:'log',   m: a.map(String).join(' ') }); origLog(...a);   };
  console.warn  = (...a) => { logs.push({ t:'warn',  m: a.map(String).join(' ') }); origWarn(...a);  };
  console.error = (...a) => { logs.push({ t:'error', m: a.map(String).join(' ') }); origError(...a); };

  let result, errMsg;
  try {
    result = new Function(code)();
  } catch(e) {
    errMsg = e.message;
  } finally {
    console.log   = origLog;
    console.warn  = origWarn;
    console.error = origError;
  }

  logs.forEach(l => {
    const cls = l.t === 'warn' ? 'warn' : l.t === 'error' ? 'error' : '';
    appendOutput((l.t === 'warn' ? '⚠ ' : l.t === 'error' ? '✕ ' : '  ') + l.m, cls);
  });

  if (errMsg) {
    appendOutput('✕ Runtime Error: ' + errMsg, 'error');
    setStatus('Error', 'error');
    suggestAIFix(code, errMsg);
  } else {
    if (result !== undefined) appendOutput('← ' + String(result), 'success');
    appendOutput('✓ Executed successfully', 'success');
    setStatus('Success', 'success');
  }
}

// ── HTML preview ──────────────────────────────────────────
function runHTML(code) {
  appendOutput('✓ HTML preview opened in new tab', 'success');
  setStatus('Success', 'success');
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(code);
    win.document.close();
  } else {
    appendOutput('⚠ Popup blocked. Allow popups and try again.', 'warn');
    setStatus('Warning', 'running');
  }
}

// ── Python (Pyodide execution) ─────────────────────────────
let pyodideInstance = null;

async function runPython(code) {
  try {
    appendOutput('ℹ Python detected. Setting up environment…', 'info');
    
    if (!pyodideInstance) {
      if (typeof loadPyodide === 'undefined') {
        appendOutput('✕ Pyodide not found. Please refresh the page or check your connection.', 'error');
        setStatus('Error', 'error');
        return;
      }
      appendOutput('  Downloading Pyodide (first time only)…', 'info');
      pyodideInstance = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
      });
      pyodideInstance.setStdout({ batched: (msg) => appendOutput('  ' + msg, '') });
      pyodideInstance.setStderr({ batched: (msg) => appendOutput('✕ ' + msg, 'error') });
    }

    appendOutput('▶ Executing…', 'info');
    
    await pyodideInstance.runPythonAsync(code);
    
    appendOutput('✓ Executed successfully', 'success');
    setStatus('Success', 'success');
  } catch (err) {
    appendOutput('✕ Runtime Error: ' + err.message, 'error');
    setStatus('Error', 'error');
    suggestAIFix(code, err.message);
  }
}

// ── JSON validator ────────────────────────────────────────
function runJSON(code) {
  try {
    const parsed = JSON.parse(code);
    const keys   = typeof parsed === 'object' ? Object.keys(parsed).length : 0;
    appendOutput('✓ Valid JSON', 'success');
    appendOutput(`  Type: ${Array.isArray(parsed) ? 'Array['+parsed.length+']' : typeof parsed}${keys ? '  Keys: '+keys : ''}`, 'info');
    setStatus('Valid', 'success');
  } catch(e) {
    appendOutput('✕ JSON Parse Error: ' + e.message, 'error');
    setStatus('Error', 'error');
    suggestAIFix(code, e.message);
  }
}

// ── CSS validator ─────────────────────────────────────────
function runCSS(code) {
  const rules   = (code.match(/\{[^}]*\}/g) || []).length;
  const selectors = (code.match(/[^{}]+\{/g) || []).length;
  const varDecls  = (code.match(/--[\w-]+\s*:/g) || []).length;
  appendOutput('✓ CSS analysis complete', 'success');
  appendOutput(`  Rules: ${rules}  |  Selectors: ${selectors}  |  CSS Variables: ${varDecls}`, 'info');
  const unclosed = (code.match(/\{/g)||[]).length - (code.match(/\}/g)||[]).length;
  if (unclosed !== 0) {
    appendOutput(`⚠ Possible unclosed braces (${unclosed > 0 ? unclosed + ' missing }' : Math.abs(unclosed) + ' extra }'})`, 'warn');
  }
  setStatus('Success', 'success');
}

// ── AI Bug Fixer ──────────────────────────────────────────
function suggestAIFix(code, error) {
  const fixPanel  = document.getElementById('aiFix');
  const fixBody   = document.getElementById('aiFixBody');
  fixPanel.classList.remove('hidden');

  const lang = AppState.activeFile ? detectLang(AppState.activeFile) : 'code';
  fixBody.textContent = '🧠 Analysing…';

  // Simulated AI fix analysis — in production call Anthropic API
  if (checkPromptLimit()) return;
  setTimeout(() => {
    const fix = generateFix(code, error, lang);
    fixBody.textContent = fix.explanation;
    // Store suggested fixed code
    fixPanel.dataset.fixedCode = fix.fixedCode;
  }, 700);
}

function generateFix(code, error, lang) {
  const lines = code.split('\n');
  let fixedCode = code;
  let explanation = '';

  const errLow = (error || '').toLowerCase();

  // Common patterns
  if (errLow.includes('is not defined')) {
    const varMatch = error.match(/(\w+) is not defined/);
    if (varMatch) {
      explanation = `❌ Error: "${varMatch[1]}" is not defined.\n\n✅ Fix: Declare the variable before use:\n\n  const ${varMatch[1]} = undefined; // or your intended value\n\nMake sure it's in scope — check for typos or missing imports.`;
      fixedCode = `const ${varMatch[1]} = undefined; // TODO: assign correct value\n` + code;
    }
  } else if (errLow.includes('unexpected token')) {
    explanation = `❌ SyntaxError: Unexpected token.\n\n✅ Common causes:\n  • Missing closing bracket } ) ]\n  • Extra comma in object/array\n  • Reserved word used as variable name\n\nCheck the line indicated in the error.`;
  } else if (errLow.includes('cannot read propert')) {
    explanation = `❌ TypeError: Cannot read property of null/undefined.\n\n✅ Fix: Add a null check before accessing the property:\n\n  if (obj && obj.property) {\n    // safe to use obj.property\n  }\n\nOr use optional chaining:\n  const val = obj?.property;`;
  } else if (errLow.includes('syntaxerror') || errLow.includes('syntax error')) {
    explanation = `❌ SyntaxError detected.\n\n✅ Common fixes:\n  • Check for missing semicolons or brackets\n  • Ensure all strings are properly closed\n  • Verify no reserved words used as identifiers\n  • Check for mismatched quotes (" vs ')`;
  } else if (errLow.includes('reference')) {
    explanation = `❌ ReferenceError.\n\n✅ Ensure the variable is:\n  1. Declared (const/let/var)\n  2. In scope where it's being used\n  3. Spelled correctly (case-sensitive)\n  4. Not used before declaration (temporal dead zone)`;
  } else if (errLow.includes('type')) {
    explanation = `❌ TypeError.\n\n✅ Likely causes:\n  • Calling a non-function: check the value before calling\n  • Wrong data type passed to a function\n  • Accessing a property on null/undefined\n\nAdd type checks:\n  if (typeof fn === 'function') fn();`;
  } else {
    explanation = `❌ Error: ${error}\n\n✅ AI Suggestions:\n  1. Check the error line number in the output\n  2. Verify variable declarations and scoping\n  3. Ensure all brackets/braces are matched\n  4. Check for typos in identifiers\n  5. Review API/function signatures\n\nReview the code at the line where the error occurs.`;
  }

  return { explanation, fixedCode };
}

function applyFix() {
  const fixPanel = document.getElementById('aiFix');
  const fixedCode = fixPanel.dataset.fixedCode;
  if (!fixedCode || !AppState.activeFile) return;

  codeEditor().value = fixedCode;
  AppState.files.get(AppState.activeFile).content = fixedCode;
  AppState.changedFiles.add(AppState.activeFile);
  renderChangedFiles();
  updateLineNumbers();
  fixPanel.classList.add('hidden');
  clearOutput();
  showToast('Fix applied! Run again to verify.', 'success');
}

function dismissFix() {
  document.getElementById('aiFix').classList.add('hidden');
}

// ── Fix bugs via AI (manual trigger) ─────────────────────
function fixBugs() {
  const code = window.monacoInstance ? window.monacoInstance.getValue().trim() : '';
  if (!code) { showToast('No code to analyse.', 'error'); return; }
  const lang = AppState.activeFile ? detectLang(AppState.activeFile) : 'code';
  appendOutput('🧠 AI bug analysis running…', 'info');
  setStatus('Analysing…', 'running');
  if (checkPromptLimit()) return;
  setTimeout(() => {
    const fix = generateFix(code, 'general review', lang);
    document.getElementById('aiFix').classList.remove('hidden');
    document.getElementById('aiFixBody').textContent =
      '🔍 Code Review Complete:\n\n' + codeReview(code, lang);
    document.getElementById('aiFix').dataset.fixedCode = code;
    appendOutput('✓ AI analysis complete. See fix panel →', 'success');
    setStatus('Done', 'success');
  }, 900);
}

function codeReview(code, lang) {
  const lines   = code.split('\n').length;
  const todos   = (code.match(/TODO|FIXME|HACK|XXX/g) || []).length;
  const consoles= (code.match(/console\.log/g) || []).length;
  const nested  = code.split('\n').filter(l => (l.match(/^\s+/) || [''])[0].length > 20).length;

  let review = `📋 Summary:\n  Lines: ${lines}  |  Language: ${lang}\n\n`;
  if (todos)    review += `⚠ ${todos} TODO/FIXME comment(s) found — address before production\n`;
  if (consoles) review += `⚠ ${consoles} console.log() call(s) — remove before production\n`;
  if (nested)   review += `⚠ ${nested} deeply nested line(s) — consider refactoring\n`;

  const unused = code.match(/var\s+\w+\s*=\s*[^;]+;(?![^]*\1)/g);
  if (unused && unused.length > 0) review += `⚠ Possible unused variables detected (use const/let)\n`;

  if (todos === 0 && consoles === 0 && nested === 0) {
    review += `✓ No obvious issues found.\n✓ Code looks clean for its size.\n`;
  }
  review += `\n💡 Tip: Run the code to catch runtime errors.`;
  return review;
}
