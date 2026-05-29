'use strict';

// --- データ管理 ---
const DB_KEY = 'review_problems_v1';
const INTERVALS = [1, 2, 5, 10]; // 復習間隔（日）

const SUBJECTS = {
  '算数': '🔢',
  '国語': '📖',
  '理科': '🔬',
  '社会': '🌏',
};

const MATERIAL_TYPES = ['組み分けテスト', '週テスト', '予シリ', '演習問題', 'コベツバ', 'その他'];

function loadProblems() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || '[]');
  } catch { return []; }
}

function saveProblems(problems) {
  localStorage.setItem(DB_KEY, JSON.stringify(problems));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function dateFromStr(s) {
  return new Date(s + 'T00:00:00');
}

function addDays(dateStr, n) {
  const d = dateFromStr(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysDiff(dateStr) {
  const today = dateFromStr(todayStr());
  const target = dateFromStr(dateStr);
  return Math.round((target - today) / 86400000);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// 次の復習日を計算
function getNextReviewDate(problem) {
  if (problem.stage >= INTERVALS.length) return null; // マスター済み
  return addDays(problem.lastReviewedAt || problem.createdAt, INTERVALS[problem.stage]);
}

// 今日復習すべき問題
function getTodayProblems(problems) {
  const today = todayStr();
  return problems.filter(p => {
    if (p.mastered) return false;
    const next = getNextReviewDate(p);
    return next <= today;
  });
}

// --- UI ---
let currentPage = 'today';
let listFilter = 'all';

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('nav-' + name).classList.add('active');
  currentPage = name;

  if (name === 'today') renderToday();
  if (name === 'register') resetForm();
  if (name === 'list') renderList();
  if (name === 'stats') renderStats();
}

// --- 今日の復習 ---
function renderToday() {
  const problems = loadProblems();
  const today = getTodayProblems(problems);
  const container = document.getElementById('today-list');
  const summary = document.getElementById('today-summary');

  // バッジ更新
  const nb = document.getElementById('today-badge');
  if (today.length > 0) {
    nb.textContent = today.length;
    nb.style.display = 'inline-flex';
  } else {
    nb.style.display = 'none';
  }

  if (today.length === 0) {
    summary.innerHTML = `<div class="empty-today"><div class="emoji">🎉</div><p>今日の復習はありません！<br>よくできました！</p></div>`;
    container.innerHTML = '';
    return;
  }

  summary.innerHTML = `
    <div class="today-summary">
      <div>
        <div class="count">${today.length}</div>
        <div class="label">問 今日やる復習</div>
      </div>
      <div class="mascot">📚</div>
    </div>`;

  container.innerHTML = today.map(p => renderReviewCard(p)).join('');
}

function renderReviewCard(p) {
  const emoji = SUBJECTS[p.subject] || '📝';
  const dots = INTERVALS.map((_, i) => {
    if (i < p.stage) return '<span class="progress-dot done"></span>';
    if (i === p.stage) return '<span class="progress-dot current"></span>';
    return '<span class="progress-dot"></span>';
  }).join('');

  const diff = daysDiff(getNextReviewDate(p) || todayStr());
  const overdue = diff < 0 ? `（${Math.abs(diff)}日超過）` : '';

  return `
    <div class="review-card" id="card-${p.id}">
      <div class="subject-tag subject-${p.subject}">${emoji}</div>
      <div class="info">
        <div class="title">${p.materialType} 第${p.round}回 問${p.problemNumber}</div>
        <div class="meta">${p.subject}${overdue ? ' · <span style="color:var(--danger)">' + overdue + '</span>' : ''}</div>
        ${p.memo ? `<div style="font-size:12px;color:var(--gray-600);margin-top:4px">${escHtml(p.memo)}</div>` : ''}
        <div class="progress-dots" style="margin-top:6px">${dots}</div>
      </div>
      <div class="actions">
        <button class="btn-ok" onclick="markReview('${p.id}', true)">OK</button>
        <button class="btn-ng" onclick="markReview('${p.id}', false)">NG</button>
      </div>
    </div>`;
}

function markReview(id, ok) {
  const problems = loadProblems();
  const idx = problems.findIndex(p => p.id === id);
  if (idx === -1) return;

  const p = problems[idx];
  p.lastReviewedAt = todayStr();

  if (ok) {
    p.stage = (p.stage || 0) + 1;
    if (p.stage >= INTERVALS.length) {
      p.mastered = true;
      showToast('🎓 マスター！');
    } else {
      const next = getNextReviewDate(p);
      showToast(`✅ 次は${INTERVALS[p.stage]}日後（${next}）`);
    }
  } else {
    p.stage = 0;
    showToast('📌 リセット。明日また復習！');
  }

  problems[idx] = p;
  saveProblems(problems);

  const card = document.getElementById('card-' + id);
  if (card) {
    card.style.transition = 'opacity 0.3s, transform 0.3s';
    card.style.opacity = '0';
    card.style.transform = 'translateX(60px)';
    setTimeout(() => { renderToday(); }, 350);
  }
}

// --- 登録フォーム ---
function resetForm() {
  // ラジオをデフォルトに
  const subjectRadios = document.querySelectorAll('input[name="subject"]');
  subjectRadios[0].checked = true;
  const typeRadios = document.querySelectorAll('input[name="materialType"]');
  typeRadios[0].checked = true;
  document.getElementById('round').value = '1';
  document.getElementById('problemNumber').value = '1';
  document.getElementById('memo').value = '';
}

function registerProblem() {
  const subject = document.querySelector('input[name="subject"]:checked')?.value;
  const materialType = document.querySelector('input[name="materialType"]:checked')?.value;
  const round = parseInt(document.getElementById('round').value);
  const problemNumber = parseInt(document.getElementById('problemNumber').value);
  const memo = document.getElementById('memo').value.trim();

  if (!subject || !materialType) {
    showToast('教科と教材を選んでください');
    return;
  }

  const problems = loadProblems();
  const newProblem = {
    id: generateId(),
    subject,
    materialType,
    round,
    problemNumber,
    memo,
    createdAt: todayStr(),
    lastReviewedAt: null,
    stage: 0,
    mastered: false,
  };

  problems.push(newProblem);
  saveProblems(problems);

  showToast(`✏️ 登録しました（次回：明日）`);

  // フォームリセット & 数字インクリメント
  const curNum = problemNumber;
  setTimeout(() => {
    resetForm();
    // 問題番号を次へ（同じ教材の連続登録を想定）
    document.querySelector(`input[name="subject"][value="${subject}"]`).checked = true;
    document.querySelector(`input[name="materialType"][value="${materialType}"]`).checked = true;
    document.getElementById('round').value = round;
    const nextNum = curNum < 10 ? curNum + 1 : 1;
    document.getElementById('problemNumber').value = nextNum;
  }, 100);
}

// --- 問題一覧 ---
function renderList() {
  const problems = loadProblems();
  const container = document.getElementById('problem-list');

  let filtered = problems;
  if (listFilter !== 'all') {
    if (listFilter === 'mastered') filtered = problems.filter(p => p.mastered);
    else if (listFilter === 'active') filtered = problems.filter(p => !p.mastered);
    else filtered = problems.filter(p => p.subject === listFilter);
  }

  // 新しい順
  filtered = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--gray-400)">問題がありません</div>`;
    return;
  }

  container.innerHTML = filtered.map(p => renderProblemCard(p)).join('');
}

function renderProblemCard(p) {
  const emoji = SUBJECTS[p.subject] || '📝';
  const next = getNextReviewDate(p);
  const today = todayStr();

  let nextLabel, nextClass;
  if (p.mastered) {
    nextLabel = '🎓 マスター済み';
    nextClass = 'mastered';
  } else if (!next) {
    nextLabel = '';
    nextClass = '';
  } else {
    const diff = daysDiff(next);
    if (diff < 0) { nextLabel = `${Math.abs(diff)}日超過`; nextClass = 'overdue'; }
    else if (diff === 0) { nextLabel = '今日'; nextClass = 'today'; }
    else { nextLabel = `${diff}日後（${next}）`; nextClass = 'future'; }
  }

  const stageLabel = p.mastered ? '完了' : `${p.stage}/${INTERVALS.length}回目`;

  return `
    <div class="problem-card">
      <div class="top-row">
        <div class="subject-tag subject-${p.subject}">${emoji}</div>
        <div class="info">
          <div class="title">${p.materialType} 第${p.round}回 問${p.problemNumber}</div>
          <div class="meta">${p.subject} · ${p.createdAt} 登録 · ${stageLabel}</div>
          ${p.memo ? `<div class="memo-text">「${escHtml(p.memo)}」</div>` : ''}
        </div>
      </div>
      <div class="bottom-row">
        <span class="next-review-label ${nextClass}">
          ${nextLabel ? '次回: ' + nextLabel : ''}
        </span>
        <button class="btn-delete" onclick="deleteProblem('${p.id}')" title="削除">🗑️</button>
      </div>
    </div>`;
}

function setListFilter(f) {
  listFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.filter === f);
  });
  renderList();
}

function deleteProblem(id) {
  if (!confirm('この問題を削除しますか？')) return;
  const problems = loadProblems().filter(p => p.id !== id);
  saveProblems(problems);
  renderList();
}

// --- 統計 ---
function renderStats() {
  const problems = loadProblems();
  const today = getTodayProblems(problems);
  const mastered = problems.filter(p => p.mastered);

  document.getElementById('stat-total').textContent = problems.length;
  document.getElementById('stat-today').textContent = today.length;
  document.getElementById('stat-mastered').textContent = mastered.length;

  const ongoing = problems.filter(p => !p.mastered).length;
  document.getElementById('stat-ongoing').textContent = ongoing;

  // 教科別
  const subjectEl = document.getElementById('subject-stats');
  const counts = {};
  for (const s of Object.keys(SUBJECTS)) counts[s] = 0;
  for (const p of problems) { if (counts[p.subject] !== undefined) counts[p.subject]++; }
  const max = Math.max(...Object.values(counts), 1);

  subjectEl.innerHTML = Object.entries(counts).map(([s, c]) => `
    <div class="subject-stat-row">
      <div class="label">${SUBJECTS[s]} ${s}</div>
      <div class="bar-wrap"><div class="bar" style="width:${(c/max*100)}%"></div></div>
      <div class="count">${c}</div>
    </div>`).join('');
}

// --- ユーティリティ ---
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// --- 初期化 ---
window.addEventListener('load', () => {
  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/review-app/sw.js').catch(() => {});
  }

  // フォーム生成
  buildForm();
  showPage('today');
});

function buildForm() {
  // 教科
  const subjectWrap = document.getElementById('subject-radios');
  subjectWrap.innerHTML = Object.entries(SUBJECTS).map(([s, e], i) => `
    <div class="radio-option">
      <input type="radio" name="subject" id="subj-${s}" value="${s}" ${i===0?'checked':''}>
      <label for="subj-${s}"><span class="subject-emoji">${e}</span>${s}</label>
    </div>`).join('');

  // 教材種類
  const typeWrap = document.getElementById('type-radios');
  typeWrap.innerHTML = MATERIAL_TYPES.map((t, i) => `
    <div class="radio-option">
      <input type="radio" name="materialType" id="type-${i}" value="${t}" ${i===0?'checked':''}>
      <label for="type-${i}">${t}</label>
    </div>`).join('');

  // 回数プルダウン
  const roundSel = document.getElementById('round');
  roundSel.innerHTML = Array.from({length:20},(_,i)=>`<option value="${i+1}">第${i+1}回</option>`).join('');

  // 問題番号プルダウン
  const numSel = document.getElementById('problemNumber');
  numSel.innerHTML = Array.from({length:30},(_,i)=>`<option value="${i+1}">問${i+1}</option>`).join('');
}
