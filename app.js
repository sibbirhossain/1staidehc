/* ============================================================
   1st Aide Home Care — PCA Master System JavaScript
   ============================================================ */

// ── STATE ────────────────────────────────────────────────────
const STATE = {
  user: JSON.parse(localStorage.getItem('pca_user') || 'null'),
  activeData: JSON.parse(localStorage.getItem('pca_active') || '[]'),
  leftData:   JSON.parse(localStorage.getItem('pca_left')   || '[]'),
  auditLog:   JSON.parse(localStorage.getItem('pca_audit')  || '[]'),
  comments:   JSON.parse(localStorage.getItem('pca_comments') || '{}'),
  currentView: 'dashboard',
  pagination:  { active: { page: 1, perPage: 50 }, left: { page: 1, perPage: 50 } },
  filters:     { active: {}, left: {} },
  editingId:   null,
  deletingId:  null,
  commentingId:null,
  selectedFile:null,
  reportData:  null,
  reportTitle: '',
};

// ── INIT ─────────────────────────────────────────────────────
window.onload = () => {
  if (!STATE.user) { openLogin(); }
  else { boot(); }
};

function boot() {
  updateUserUI();
  updateBadges();
  updateDashboard();
  populateFilters();
  if (STATE.currentView !== 'dashboard') showView(STATE.currentView);
  updateReportCounts();
}

// ── AUTH ─────────────────────────────────────────────────────
function openLogin() {
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-login').style.display = 'flex';
  hideModal('modal-member');
  hideModal('modal-comment');
  hideModal('modal-delete');
}
function doLogin() {
  const name = document.getElementById('login-name').value.trim();
  const role = document.getElementById('login-role').value;
  if (!name) { showToast('Please enter your name', 'error'); return; }
  STATE.user = { name, role };
  localStorage.setItem('pca_user', JSON.stringify(STATE.user));
  document.getElementById('modal-overlay').classList.remove('open');
  hideModal('modal-login');
  boot();
  showToast(`Welcome, ${name}!`, 'success');
}
function updateUserUI() {
  if (!STATE.user) return;
  document.getElementById('user-name-nav').textContent = STATE.user.name;
  document.getElementById('user-role-nav').textContent = STATE.user.role;
  document.getElementById('user-avatar-nav').textContent = STATE.user.name.charAt(0).toUpperCase();
}

// ── NAVIGATION ───────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelector(`[data-view="${name}"]`)?.classList.add('active');
  STATE.currentView = name;
  const titles = { dashboard:'Dashboard', active:'Active Members', left:'Left / Dead Members', import:'Import Data', reports:'Reports', auditlog:'Audit Log' };
  document.getElementById('page-title').textContent = titles[name] || name;
  const showSearch = ['active','left'].includes(name);
  document.getElementById('global-search-wrap').style.display = showSearch ? 'block' : 'none';
  document.getElementById('btn-add-member').style.display = name === 'active' ? 'block' : 'none';
  if (name === 'active') renderTable('active');
  if (name === 'left') renderTable('left');
  if (name === 'auditlog') renderAuditLog();
  if (name === 'dashboard') updateDashboard();
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar').classList.toggle('hidden');
}

// ── DATA HELPERS ─────────────────────────────────────────────
function save() {
  localStorage.setItem('pca_active', JSON.stringify(STATE.activeData));
  localStorage.setItem('pca_left',   JSON.stringify(STATE.leftData));
  localStorage.setItem('pca_audit',  JSON.stringify(STATE.auditLog));
  localStorage.setItem('pca_comments', JSON.stringify(STATE.comments));
}

function addAuditEntry(action, memberSno, memberName, field, oldVal, newVal) {
  const entry = {
    id: Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    user: STATE.user?.name || 'Unknown',
    role: STATE.user?.role || '',
    action,
    memberSno,
    memberName,
    field,
    oldVal: oldVal ?? '',
    newVal: newVal ?? '',
  };
  STATE.auditLog.unshift(entry);
  if (STATE.auditLog.length > 2000) STATE.auditLog.splice(2000);
}

function getMemberId(row) {
  return row._id || row['S.NO'] || row.sno || '';
}

function findById(dataset, id) {
  return dataset.find(r => getMemberId(r) === id);
}

function dateStr(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isExpiringSoon(row) {
  const expField = row['AUTH EXP DATE'] || row['Auth Exp Date'] || '';
  if (!expField) return false;
  const exp = new Date(expField);
  if (isNaN(exp)) return false;
  const diff = (exp - Date.now()) / 86400000;
  return diff >= 0 && diff <= 30;
}
function isExpired(row) {
  const expField = row['AUTH EXP DATE'] || row['Auth Exp Date'] || '';
  if (!expField) return false;
  const exp = new Date(expField);
  if (isNaN(exp)) return false;
  return exp < Date.now();
}

// ── RENDER TABLE ─────────────────────────────────────────────
function applyFilters(sheet) {
  STATE.pagination[sheet].page = 1;
  renderTable(sheet);
}
function clearFilters(sheet) {
  if (sheet === 'active') {
    document.getElementById('filter-mltc').value = '';
    document.getElementById('filter-marketer').value = '';
    document.getElementById('filter-hiring').value = '';
  } else {
    document.getElementById('filter-mltc-left').value = '';
  }
  STATE.pagination[sheet].page = 1;
  renderTable(sheet);
}
function onSearch(val) {
  STATE.filters[STATE.currentView === 'active' ? 'active' : 'left'].search = val;
  STATE.pagination[STATE.currentView === 'active' ? 'active' : 'left'].page = 1;
  renderTable(STATE.currentView === 'active' ? 'active' : 'left');
}

function getFiltered(sheet) {
  const data = sheet === 'active' ? STATE.activeData : STATE.leftData;
  let rows = [...data];
  const search = (document.getElementById('global-search')?.value || '').toLowerCase();

  if (sheet === 'active') {
    const mltc = document.getElementById('filter-mltc')?.value || '';
    const mktr = document.getElementById('filter-marketer')?.value || '';
    const hire = document.getElementById('filter-hiring')?.value || '';
    if (mltc) rows = rows.filter(r => (r['MLTC-CONTRACT']||'').toUpperCase() === mltc.toUpperCase());
    if (mktr) rows = rows.filter(r => (r['MARKETER']||'').toUpperCase() === mktr.toUpperCase());
    if (hire) rows = rows.filter(r => (r['HIRING STATUS']||'') === hire);
  } else {
    const mltc = document.getElementById('filter-mltc-left')?.value || '';
    if (mltc) rows = rows.filter(r => (r['MLTC-CONTRACT']||'').toUpperCase() === mltc.toUpperCase());
  }

  if (search) {
    rows = rows.filter(r =>
      Object.values(r).some(v => String(v||'').toLowerCase().includes(search))
    );
  }
  return rows;
}

function renderTable(sheet) {
  const filtered = getFiltered(sheet);
  const pag = STATE.pagination[sheet];
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pag.perPage));
  const start = (pag.page - 1) * pag.perPage;
  const pageRows = filtered.slice(start, start + pag.perPage);

  document.getElementById(`filter-count-${sheet}`).textContent =
    `${total.toLocaleString()} record${total !== 1 ? 's' : ''}`;

  if (sheet === 'active') renderActiveRows(pageRows);
  else renderLeftRows(pageRows);
  renderPagination(sheet, pag.page, pages, total);
}

function hiringChip(val) {
  if (!val) return '<span class="chip chip-gray">—</span>';
  const v = val.toUpperCase();
  if (v.includes('DONE') || v.includes('HIRED')) return `<span class="chip chip-green">${esc(val)}</span>`;
  if (v.includes('SENT') || v.includes('PENDING')) return `<span class="chip chip-orange">${esc(val)}</span>`;
  if (v.includes('PCA') || v.includes('CDPAP')) return `<span class="chip chip-blue">${esc(val)}</span>`;
  return `<span class="chip chip-gray">${esc(val)}</span>`;
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderActiveRows(rows) {
  const tbody = document.getElementById('tbody-active');
  tbody.innerHTML = rows.map(row => {
    const id = getMemberId(row);
    const expiring = isExpiringSoon(row);
    const expired = isExpired(row);
    const rowClass = expiring ? 'expiring-row' : (expired ? 'expired-row' : '');
    const commentCount = (STATE.comments[id] || []).length;
    return `<tr class="${rowClass}" data-id="${esc(id)}">
      <td><span class="chip chip-blue">${esc(row['S.NO'])}</span></td>
      <td><strong>${esc(row['LAST NAME'])}</strong></td>
      <td>${esc(row['FIRST NAME'])}</td>
      <td>${dateStr(row['DOB'])}</td>
      <td title="${esc(row['AIDE NAME'])}">${esc((row['AIDE NAME']||'').substring(0,20))}</td>
      <td><code>${esc(row['Medicaid ID'])}</code></td>
      <td><span class="chip chip-gray">${esc(row['MLTC-CONTRACT'])}</span></td>
      <td title="${esc(row['CONTACT'])}">${esc((row['CONTACT']||'').substring(0,20))}</td>
      <td>${dateStr(row['Start Date'])}</td>
      <td style="color:${expired?'var(--accent)':expiring?'var(--orange)':'inherit'}">${dateStr(row['AUTH EXP DATE'])}</td>
      <td><code>${esc(row['SCHEDULE'])}</code></td>
      <td>${esc(row['WEEKLY HOURS'])}</td>
      <td>${esc(row['MARKETER'])}</td>
      <td>${hiringChip(row['HIRING STATUS'])}</td>
      <td title="${esc(row['COMMENT'])}">${esc((row['COMMENT']||'').substring(0,25))}${(row['COMMENT']||'').length > 25 ? '…' : ''}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon edit" title="Edit" onclick="openEditModal('${esc(id)}','active')">✎</button>
          <button class="btn-icon comment-btn" title="Comment (${commentCount})" onclick="openComment('${esc(id)}','active')">💬${commentCount > 0 ? `<sup style="font-size:.6rem;color:var(--orange)">${commentCount}</sup>` : ''}</button>
          <button class="btn-icon move" title="Move to Left/Dead" onclick="moveMember('${esc(id)}','active')">→</button>
          <button class="btn-icon" title="Delete" onclick="openDeleteModal('${esc(id)}','active')" style="hover:var(--accent)">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderLeftRows(rows) {
  const tbody = document.getElementById('tbody-left');
  tbody.innerHTML = rows.map(row => {
    const id = getMemberId(row);
    const commentCount = (STATE.comments[id] || []).length;
    return `<tr data-id="${esc(id)}">
      <td><span class="chip chip-gray">${esc(row['S.NO'])}</span></td>
      <td><strong>${esc(row['LAST NAME'])}</strong></td>
      <td>${esc(row['FIRST NAME'])}</td>
      <td>${dateStr(row['DOB'])}</td>
      <td title="${esc(row['AIDE NAME'])}">${esc((row['AIDE NAME']||'').substring(0,20))}</td>
      <td><span class="chip chip-gray">${esc(row['MLTC-CONTRACT'])}</span></td>
      <td title="${esc(row['CONTACT'])}">${esc((row['CONTACT']||'').substring(0,22))}</td>
      <td title="${esc(row['COMMENT'])}">${esc((row['COMMENT']||'').substring(0,30))}${(row['COMMENT']||'').length > 30 ? '…' : ''}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon edit" title="Edit" onclick="openEditModal('${esc(id)}','left')">✎</button>
          <button class="btn-icon comment-btn" title="Comment" onclick="openComment('${esc(id)}','left')">💬</button>
          <button class="btn-icon move" title="Move to Active" onclick="moveMember('${esc(id)}','left')">←</button>
          <button class="btn-icon" title="Delete" onclick="openDeleteModal('${esc(id)}','left')">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderPagination(sheet, page, pages, total) {
  const el = document.getElementById(`pag-${sheet}`);
  if (pages <= 1) { el.innerHTML = ''; return; }
  const max = 7;
  let btns = '';
  btns += `<button class="pag-btn" onclick="goPage('${sheet}',${page-1})" ${page===1?'disabled':''}>‹ Prev</button>`;
  let start = Math.max(1, page - 3);
  let end = Math.min(pages, start + max - 1);
  if (end - start < max - 1) start = Math.max(1, end - max + 1);
  for (let i = start; i <= end; i++) {
    btns += `<button class="pag-btn ${i===page?'active':''}" onclick="goPage('${sheet}',${i})">${i}</button>`;
  }
  btns += `<button class="pag-btn" onclick="goPage('${sheet}',${page+1})" ${page===pages?'disabled':''}>Next ›</button>`;
  btns += `<span class="pag-info">${((page-1)*STATE.pagination[sheet].perPage+1).toLocaleString()}–${Math.min(page*STATE.pagination[sheet].perPage, total).toLocaleString()} of ${total.toLocaleString()}</span>`;
  el.innerHTML = btns;
}
function goPage(sheet, page) {
  const pag = STATE.pagination[sheet];
  const total = getFiltered(sheet).length;
  const pages = Math.ceil(total / pag.perPage);
  pag.page = Math.max(1, Math.min(pages, page));
  renderTable(sheet);
}

// ── DASHBOARD ────────────────────────────────────────────────
function updateDashboard() {
  const active = STATE.activeData.length;
  const left = STATE.leftData.length;
  const expiring = STATE.activeData.filter(r => isExpiringSoon(r)).length;
  const today = new Date().toDateString();
  const todayChanges = STATE.auditLog.filter(e => new Date(e.timestamp).toDateString() === today).length;

  document.getElementById('stat-active').textContent = active.toLocaleString();
  document.getElementById('stat-left').textContent = left.toLocaleString();
  document.getElementById('stat-expiring').textContent = expiring.toLocaleString();
  document.getElementById('stat-changes').textContent = todayChanges.toLocaleString();
  document.getElementById('badge-active').textContent = active;
  document.getElementById('badge-left').textContent = left;

  renderMltcChart();
  renderHiringChart();
  renderActivity();
}

function renderMltcChart() {
  const counts = {};
  STATE.activeData.forEach(r => {
    const k = (r['MLTC-CONTRACT'] || 'Unknown').trim().toUpperCase();
    counts[k] = (counts[k] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 8);
  const max = sorted[0]?.[1] || 1;
  const colors = ['#e84444','#3b82f6','#22c55e','#f97316','#a78bfa','#06b6d4','#ec4899','#eab308'];
  document.getElementById('chart-mltc').innerHTML = `<div class="bar-chart">` +
    sorted.map(([label, count], i) =>
      `<div class="bar-row">
        <div class="bar-label" title="${esc(label)}">${esc(label)}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${(count/max*100).toFixed(1)}%;background:${colors[i%colors.length]}">${count}</div>
        </div>
        <div class="bar-count">${count}</div>
      </div>`
    ).join('') + `</div>`;
}

function renderHiringChart() {
  const counts = {};
  STATE.activeData.forEach(r => {
    let k = (r['HIRING STATUS'] || 'No Status').trim();
    if (k.toUpperCase().includes('DONE') || k.toUpperCase().includes('HIRED')) k = 'Hired / Done';
    else if (k.toUpperCase().includes('SENT')) k = 'Sent / In Progress';
    else if (k.toUpperCase().includes('PENDING')) k = 'Pending';
    else if (!k || k === 'No Status') k = 'Not Set';
    counts[k] = (counts[k] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 6);
  const max = sorted[0]?.[1] || 1;
  const colors = ['#22c55e','#f97316','#eab308','#9ca3af','#3b82f6','#e84444'];
  document.getElementById('chart-hiring').innerHTML = `<div class="bar-chart">` +
    sorted.map(([label, count], i) =>
      `<div class="bar-row">
        <div class="bar-label" title="${esc(label)}">${esc(label)}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${(count/max*100).toFixed(1)}%;background:${colors[i%colors.length]}">${count}</div>
        </div>
        <div class="bar-count">${count}</div>
      </div>`
    ).join('') + `</div>`;
}

function renderActivity() {
  const items = STATE.auditLog.slice(0, 20);
  if (items.length === 0) {
    document.getElementById('recent-activity').innerHTML = '<div style="color:var(--text-dim);font-size:.85rem;padding:.5rem">No activity yet. Import data or make changes to see activity here.</div>';
    return;
  }
  document.getElementById('recent-activity').innerHTML = items.map(e => {
    const actMap = { add:'add', edit:'edit', delete:'delete', comment:'comment', move:'edit', import:'add' };
    const cls = actMap[e.action] || 'edit';
    const msg = e.action === 'edit'
      ? `<span class="activity-who">${esc(e.user)}</span> edited <strong>${esc(e.memberName)}</strong> — ${esc(e.field)}`
      : e.action === 'add'
        ? `<span class="activity-who">${esc(e.user)}</span> added <strong>${esc(e.memberName)}</strong>`
        : e.action === 'delete'
          ? `<span class="activity-who">${esc(e.user)}</span> deleted <strong>${esc(e.memberName)}</strong>`
          : e.action === 'comment'
            ? `<span class="activity-who">${esc(e.user)}</span> commented on <strong>${esc(e.memberName)}</strong>`
            : e.action === 'move'
              ? `<span class="activity-who">${esc(e.user)}</span> moved <strong>${esc(e.memberName)}</strong>`
              : `<span class="activity-who">${esc(e.user)}</span> ${esc(e.action)}`;
    const timeAgo = timeSince(e.timestamp);
    return `<div class="activity-item">
      <div class="activity-dot ${cls}"></div>
      <div class="activity-main">${msg}</div>
      <div class="activity-time">${timeAgo}</div>
    </div>`;
  }).join('');
}

function timeSince(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs/3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

// ── POPULATE FILTERS ─────────────────────────────────────────
function populateFilters() {
  const mltcSet = new Set();
  const mktSet = new Set();
  const hireSet = new Set();
  STATE.activeData.forEach(r => {
    if (r['MLTC-CONTRACT']) mltcSet.add(r['MLTC-CONTRACT'].trim().toUpperCase());
    if (r['MARKETER']) mktSet.add(r['MARKETER'].trim());
    if (r['HIRING STATUS']) hireSet.add(r['HIRING STATUS'].trim());
  });
  const mltcEl = document.getElementById('filter-mltc');
  const curMltc = mltcEl.value;
  mltcEl.innerHTML = '<option value="">All MLTC</option>' +
    [...mltcSet].sort().map(v => `<option ${v===curMltc?'selected':''} value="${esc(v)}">${esc(v)}</option>`).join('');

  const mktrEl = document.getElementById('filter-marketer');
  const curMktr = mktrEl.value;
  mktrEl.innerHTML = '<option value="">All Marketers</option>' +
    [...mktSet].sort().map(v => `<option ${v===curMktr?'selected':''} value="${esc(v)}">${esc(v)}</option>`).join('');

  const hireEl = document.getElementById('filter-hiring');
  const curHire = hireEl.value;
  hireEl.innerHTML = '<option value="">All Status</option>' +
    [...hireSet].sort().map(v => `<option ${v===curHire?'selected':''} value="${esc(v)}">${esc(v)}</option>`).join('');

  const mltcLeftEl = document.getElementById('filter-mltc-left');
  const mltcLeftSet = new Set();
  STATE.leftData.forEach(r => { if (r['MLTC-CONTRACT']) mltcLeftSet.add(r['MLTC-CONTRACT'].trim().toUpperCase()); });
  mltcLeftEl.innerHTML = '<option value="">All MLTC</option>' +
    [...mltcLeftSet].sort().map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');

  // Audit user filter
  const userSet = new Set(STATE.auditLog.map(e => e.user));
  const auditUserEl = document.getElementById('audit-user-filter');
  auditUserEl.innerHTML = '<option value="">All Users</option>' +
    [...userSet].sort().map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
}

function updateBadges() {
  document.getElementById('badge-active').textContent = STATE.activeData.length;
  document.getElementById('badge-left').textContent = STATE.leftData.length;
}

// ── ADD / EDIT MODAL ─────────────────────────────────────────
function openAddModal() {
  STATE.editingId = null;
  STATE.editingSheet = 'active';
  document.getElementById('modal-member-title').textContent = 'Add New Member';
  ['sno','lastname','firstname','dob','address','aide','medicaid','mltc','contact','start','auth-start','auth-exp','schedule','hours','icd','marketer','hiring','comment']
    .forEach(f => { const el = document.getElementById('f-'+f); if(el) el.value = ''; });
  showModal('modal-member');
}

function openEditModal(id, sheet) {
  const data = sheet === 'active' ? STATE.activeData : STATE.leftData;
  const row = findById(data, id);
  if (!row) return;
  STATE.editingId = id;
  STATE.editingSheet = sheet;
  document.getElementById('modal-member-title').textContent = 'Edit Member';
  const map = {
    'sno': 'S.NO', 'lastname': 'LAST NAME', 'firstname': 'FIRST NAME',
    'dob': 'DOB', 'address': 'ADDRESS', 'aide': 'AIDE NAME',
    'medicaid': 'Medicaid ID', 'mltc': 'MLTC-CONTRACT', 'contact': 'CONTACT',
    'start': 'Start Date', 'auth-start': 'AUTH START DATE', 'auth-exp': 'AUTH EXP DATE',
    'schedule': 'SCHEDULE', 'hours': 'WEEKLY HOURS', 'icd': 'ICD-10',
    'marketer': 'MARKETER', 'hiring': 'HIRING STATUS', 'comment': 'COMMENT'
  };
  for (const [fid, key] of Object.entries(map)) {
    const el = document.getElementById('f-' + fid);
    if (!el) continue;
    let val = row[key] || '';
    if (el.type === 'date' && val) {
      try { val = new Date(val).toISOString().split('T')[0]; } catch(e) { val = ''; }
    }
    el.value = val;
  }
  showModal('modal-member');
}

function saveMember() {
  const getVal = id => document.getElementById('f-' + id)?.value.trim() || '';
  const newData = {
    'S.NO': getVal('sno'),
    'LAST NAME': getVal('lastname'),
    'FIRST NAME': getVal('firstname'),
    'DOB': getVal('dob'),
    'ADDRESS': getVal('address'),
    'AIDE NAME': getVal('aide'),
    'Medicaid ID': getVal('medicaid'),
    'MLTC-CONTRACT': getVal('mltc'),
    'CONTACT': getVal('contact'),
    'Start Date': getVal('start'),
    'AUTH START DATE': getVal('auth-start'),
    'AUTH EXP DATE': getVal('auth-exp'),
    'SCHEDULE': getVal('schedule'),
    'WEEKLY HOURS': getVal('hours'),
    'ICD-10': getVal('icd'),
    'MARKETER': getVal('marketer'),
    'HIRING STATUS': getVal('hiring'),
    'COMMENT': getVal('comment'),
  };
  if (!newData['S.NO'] || !newData['LAST NAME']) {
    showToast('S.NO and Last Name are required', 'error'); return;
  }

  const sheet = STATE.editingSheet || 'active';
  const dataset = sheet === 'active' ? STATE.activeData : STATE.leftData;
  const memberName = `${newData['FIRST NAME']} ${newData['LAST NAME']}`.trim();

  if (STATE.editingId) {
    const idx = dataset.findIndex(r => getMemberId(r) === STATE.editingId);
    if (idx === -1) { showToast('Member not found', 'error'); return; }
    const old = dataset[idx];
    // Track changed fields
    for (const key of Object.keys(newData)) {
      const oldVal = String(old[key] || '');
      const newVal = String(newData[key] || '');
      if (oldVal !== newVal) {
        addAuditEntry('edit', newData['S.NO'], memberName, key, oldVal, newVal);
      }
    }
    dataset[idx] = { ...old, ...newData };
    showToast('Member updated', 'success');
  } else {
    // Check duplicate
    if (dataset.some(r => getMemberId(r) === newData['S.NO'])) {
      showToast(`S.NO ${newData['S.NO']} already exists`, 'error'); return;
    }
    newData._id = newData['S.NO'];
    dataset.unshift(newData);
    addAuditEntry('add', newData['S.NO'], memberName, '', '', '');
    showToast('Member added', 'success');
  }

  save();
  populateFilters();
  updateBadges();
  updateDashboard();
  renderTable(sheet);
  closeModalMember();
}

// ── MOVE MEMBER ──────────────────────────────────────────────
function moveMember(id, fromSheet) {
  const fromData = fromSheet === 'active' ? STATE.activeData : STATE.leftData;
  const toData = fromSheet === 'active' ? STATE.leftData : STATE.activeData;
  const idx = fromData.findIndex(r => getMemberId(r) === id);
  if (idx === -1) return;
  const row = fromData.splice(idx, 1)[0];
  toData.unshift(row);
  const name = `${row['FIRST NAME']||''} ${row['LAST NAME']||''}`.trim();
  const dest = fromSheet === 'active' ? 'Left/Dead' : 'Active';
  addAuditEntry('move', getMemberId(row), name, 'Sheet', fromSheet, dest);
  save();
  populateFilters();
  updateBadges();
  updateDashboard();
  renderTable(fromSheet);
  showToast(`Moved ${name} to ${dest}`, 'info');
}

// ── DELETE ───────────────────────────────────────────────────
function openDeleteModal(id, sheet) {
  const data = sheet === 'active' ? STATE.activeData : STATE.leftData;
  const row = findById(data, id);
  if (!row) return;
  STATE.deletingId = id;
  STATE.deletingSheet = sheet;
  document.getElementById('delete-name').textContent = `${row['FIRST NAME']||''} ${row['LAST NAME']||''}`.trim();
  showModal('modal-delete');
}
function confirmDelete() {
  const sheet = STATE.deletingSheet;
  const dataset = sheet === 'active' ? STATE.activeData : STATE.leftData;
  const idx = dataset.findIndex(r => getMemberId(r) === STATE.deletingId);
  if (idx === -1) return;
  const row = dataset.splice(idx, 1)[0];
  const name = `${row['FIRST NAME']||''} ${row['LAST NAME']||''}`.trim();
  addAuditEntry('delete', getMemberId(row), name, '', '', '');
  save();
  populateFilters();
  updateBadges();
  updateDashboard();
  renderTable(sheet);
  closeModals();
  showToast(`Deleted ${name}`, 'error');
}

// ── COMMENT ──────────────────────────────────────────────────
function openComment(id, sheet) {
  const data = sheet === 'active' ? STATE.activeData : STATE.leftData;
  const row = findById(data, id);
  if (!row) return;
  STATE.commentingId = id;
  const name = `${row['FIRST NAME']||''} ${row['LAST NAME']||''}`.trim();
  document.getElementById('comment-member-info').innerHTML = `<strong>${esc(name)}</strong> — ${esc(row['S.NO']||id)}`;
  const history = STATE.comments[id] || [];
  document.getElementById('comment-history').innerHTML = history.length === 0
    ? '<div style="color:var(--text-dim);font-size:.8rem">No comments yet</div>'
    : history.map(c => `<div class="comment-entry">
        <div class="comment-entry-who">${esc(c.user)}</div>
        <div class="comment-entry-time">${new Date(c.timestamp).toLocaleString()}</div>
        <div class="comment-entry-text">${esc(c.text)}</div>
      </div>`).join('');
  document.getElementById('comment-new').value = '';
  showModal('modal-comment');
}
function saveComment() {
  const text = document.getElementById('comment-new').value.trim();
  if (!text) { showToast('Comment cannot be empty', 'error'); return; }
  const id = STATE.commentingId;
  if (!STATE.comments[id]) STATE.comments[id] = [];
  STATE.comments[id].push({ user: STATE.user?.name || 'Unknown', timestamp: new Date().toISOString(), text });
  const data = [...STATE.activeData, ...STATE.leftData];
  const row = findById(data, id);
  const name = row ? `${row['FIRST NAME']||''} ${row['LAST NAME']||''}`.trim() : id;
  addAuditEntry('comment', id, name, 'COMMENT', '', text.substring(0, 60));
  save();
  renderTable(STATE.currentView === 'active' ? 'active' : 'left');
  updateDashboard();
  closeModals();
  showToast('Comment added', 'success');
}

// ── IMPORT ───────────────────────────────────────────────────
let pendingFileData = null;

function handleDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) setSelectedFile(file);
  document.getElementById('drop-zone').classList.remove('drag-over');
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) setSelectedFile(file);
}
function setSelectedFile(file) {
  STATE.selectedFile = file;
  document.getElementById('drop-filename').textContent = file.name;
}

function processFile() {
  if (!STATE.selectedFile) { showToast('Please select a file first', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      importFromWorkbook(wb);
    } catch(err) {
      logImport('❌ Error reading file: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(STATE.selectedFile);
}

function loadFromDrive() {
  const url = document.getElementById('drive-url').value.trim();
  if (!url) { showToast('Please enter a URL', 'error'); return; }
  // Transform Google Sheets URL to CSV export
  let csvUrl = url;
  const gidMatch = url.match(/gid=(\d+)/);
  const idMatch = url.match(/\/d\/([^/]+)/);
  if (idMatch) {
    const gid = gidMatch ? gidMatch[1] : '0';
    csvUrl = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
  }
  logImport('⏳ Fetching from URL…\n' + csvUrl);
  fetch(csvUrl)
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(csv => {
      const wb = XLSX.read(csv, { type: 'string' });
      importFromWorkbook(wb);
    })
    .catch(err => {
      logImport('❌ Failed to fetch: ' + err.message + '\n\nTip: Make sure the sheet is published to web as CSV.');
    });
}

function importFromWorkbook(wb) {
  let activeCount = 0, leftCount = 0;
  const sheets = wb.SheetNames;
  logImport(`📄 Found sheets: ${sheets.join(', ')}`);

  for (const name of sheets) {
    const ws = wb.Sheets[name];
    const isActive = name.toLowerCase().includes('active');
    const isLeft = name.toLowerCase().includes('left') || name.toLowerCase().includes('dead');

    if (!isActive && !isLeft) {
      logImport(`  ⏭ Skipping sheet: ${name}`);
      continue;
    }

    // Try to find header row
    let rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    let headerIdx = -1;
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const row = rows[i].map(c => String(c||'').toUpperCase());
      if (row.includes('S.NO') || row.includes('LAST NAME')) { headerIdx = i; break; }
    }
    if (headerIdx === -1) { logImport(`  ⚠ Could not find header in ${name}`); continue; }

    const headers = rows[headerIdx].map(c => String(c||'').trim());
    const dataRows = rows.slice(headerIdx + 1)
      .filter(r => r.some(c => c !== ''))
      .map(r => {
        const obj = {};
        headers.forEach((h, i) => { if (h) obj[h] = r[i] ?? ''; });
        obj._id = obj['S.NO'] || `_${Math.random().toString(36).slice(2)}`;
        return obj;
      })
      .filter(r => r['S.NO'] || r['LAST NAME']);

    if (isActive) {
      STATE.activeData = dataRows;
      activeCount = dataRows.length;
      logImport(`  ✅ Active Members: ${activeCount} records loaded`);
    } else {
      STATE.leftData = dataRows;
      leftCount = dataRows.length;
      logImport(`  ✅ Left/Dead Members: ${leftCount} records loaded`);
    }
  }

  if (activeCount + leftCount === 0) {
    logImport('⚠ No data loaded. Make sure sheets are named containing "Active" and "Left/Dead".');
    return;
  }

  addAuditEntry('import', '', 'Bulk Import', '', '', `${activeCount} active, ${leftCount} left`);
  save();
  populateFilters();
  updateBadges();
  updateDashboard();
  updateReportCounts();
  logImport(`\n✅ Import complete! ${activeCount + leftCount} total members loaded.`);
  showToast('Import successful!', 'success');
}

function logImport(msg) {
  const el = document.getElementById('import-log');
  el.textContent += msg + '\n';
  el.scrollTop = el.scrollHeight;
}

// ── REPORTS ──────────────────────────────────────────────────
function updateReportCounts() {
  const expiring = STATE.activeData.filter(r => isExpiringSoon(r)).length;
  document.getElementById('rpt-expiring-count').textContent = expiring || '';
  const hiring = STATE.activeData.filter(r => {
    const h = (r['HIRING STATUS']||'').toUpperCase();
    return !h || (!h.includes('DONE') && !h.includes('HIRED'));
  }).length;
  document.getElementById('rpt-hiring-count').textContent = hiring || '';
}

let currentReportRows = [];

function generateReport(type) {
  const out = document.getElementById('report-output');
  const body = document.getElementById('report-output-body');
  let title = '';
  let rows = [];

  if (type === 'expiring') {
    title = 'Expiring Authorizations (≤ 30 days)';
    rows = STATE.activeData.filter(r => isExpiringSoon(r));
    body.innerHTML = simpleTable(rows, ['S.NO','LAST NAME','FIRST NAME','AIDE NAME','MLTC-CONTRACT','AUTH EXP DATE','MARKETER','HIRING STATUS']);
  } else if (type === 'hiring_pending') {
    title = 'Hiring Pending Members';
    rows = STATE.activeData.filter(r => {
      const h = (r['HIRING STATUS']||'').toUpperCase();
      return !h || (!h.includes('DONE') && !h.includes('HIRED'));
    });
    body.innerHTML = simpleTable(rows, ['S.NO','LAST NAME','FIRST NAME','AIDE NAME','MLTC-CONTRACT','MARKETER','HIRING STATUS']);
  } else if (type === 'by_mltc') {
    title = 'Members by MLTC Contract';
    const groups = {};
    STATE.activeData.forEach(r => {
      const k = (r['MLTC-CONTRACT']||'Unknown').trim().toUpperCase();
      if (!groups[k]) groups[k] = [];
      groups[k].push(r);
    });
    let html = '';
    for (const [mltc, members] of Object.entries(groups).sort()) {
      html += `<h4 style="margin:1.2rem 0 .5rem;font-family:Syne,sans-serif">${esc(mltc)} <span style="color:var(--text-muted);font-size:.8rem">(${members.length})</span></h4>`;
      html += simpleTable(members, ['S.NO','LAST NAME','FIRST NAME','AIDE NAME','MARKETER']);
    }
    body.innerHTML = html;
    rows = STATE.activeData;
  } else if (type === 'by_marketer') {
    title = 'Members by Marketer';
    const groups = {};
    STATE.activeData.forEach(r => {
      const k = (r['MARKETER']||'Unknown').trim();
      if (!groups[k]) groups[k] = [];
      groups[k].push(r);
    });
    let html = '';
    for (const [mktr, members] of Object.entries(groups).sort()) {
      html += `<h4 style="margin:1.2rem 0 .5rem;font-family:Syne,sans-serif">${esc(mktr)} <span style="color:var(--text-muted);font-size:.8rem">(${members.length})</span></h4>`;
      html += simpleTable(members, ['S.NO','LAST NAME','FIRST NAME','AIDE NAME','MLTC-CONTRACT','HIRING STATUS']);
    }
    body.innerHTML = html;
    rows = STATE.activeData;
  } else if (type === 'full_export') {
    exportCSV(STATE.activeData, 'pca_active_members.csv');
    showToast('CSV downloaded', 'success');
    return;
  } else if (type === 'audit_report') {
    title = 'Audit Report — All Changes';
    rows = STATE.auditLog;
    body.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Member</th><th>Field</th><th>Old Value</th><th>New Value</th></tr></thead><tbody>` +
      rows.map(e => `<tr><td><code>${esc(new Date(e.timestamp).toLocaleString())}</code></td><td><strong>${esc(e.user)}</strong></td><td>${esc(e.action)}</td><td>${esc(e.memberName)}</td><td>${esc(e.field)}</td><td style="color:var(--accent)">${esc(e.oldVal)}</td><td style="color:var(--green)">${esc(e.newVal)}</td></tr>`).join('') +
      `</tbody></table></div>`;
  }

  currentReportRows = rows;
  STATE.reportTitle = title;
  document.getElementById('report-output-title').textContent = title;
  out.style.display = 'block';
  out.scrollIntoView({ behavior: 'smooth' });
}

function simpleTable(rows, cols) {
  return `<div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>` +
    rows.map(r => `<tr>${cols.map(c=>`<td>${esc(r[c]||'')}</td>`).join('')}</tr>`).join('') +
    `</tbody></table></div>`;
}

function exportReportCSV() {
  if (!currentReportRows.length) return;
  exportCSV(currentReportRows, 'pca_report.csv');
}

function exportCSV(data, filename) {
  if (!data.length) { showToast('No data to export', 'error'); return; }
  const keys = Object.keys(data[0]).filter(k => !k.startsWith('_'));
  const lines = [keys.join(',')].concat(data.map(r =>
    keys.map(k => `"${String(r[k]||'').replace(/"/g,'""')}"`).join(',')
  ));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ── AUDIT LOG ────────────────────────────────────────────────
function renderAuditLog(filter) {
  let rows = [...STATE.auditLog];
  const search = document.getElementById('audit-search')?.value.toLowerCase() || '';
  const user = document.getElementById('audit-user-filter')?.value || '';
  if (search) rows = rows.filter(e => JSON.stringify(e).toLowerCase().includes(search));
  if (user) rows = rows.filter(e => e.user === user);

  const tbody = document.getElementById('tbody-audit');
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:2rem">No audit entries yet. Import data or make edits to track changes.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(e => `<tr>
    <td><code style="font-size:.75rem">${new Date(e.timestamp).toLocaleString()}</code></td>
    <td><strong>${esc(e.user)}</strong> <span style="color:var(--text-dim);font-size:.75rem">(${esc(e.role)})</span></td>
    <td><span class="chip ${e.action==='add'?'chip-green':e.action==='delete'?'chip-red':e.action==='comment'?'chip-blue':'chip-gray'}">${esc(e.action)}</span></td>
    <td>${esc(e.memberName)} <span style="color:var(--text-dim)">${esc(e.memberSno)}</span></td>
    <td>${esc(e.field)}</td>
    <td style="color:var(--accent)">${esc(String(e.oldVal||'').substring(0,50))}</td>
    <td style="color:var(--green)">${esc(String(e.newVal||'').substring(0,50))}</td>
  </tr>`).join('');
}

function filterAuditLog() { renderAuditLog(); }
function clearAuditFilters() {
  document.getElementById('audit-search').value = '';
  document.getElementById('audit-user-filter').value = '';
  renderAuditLog();
}

// ── MODAL UTILS ──────────────────────────────────────────────
function showModal(id) {
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById(id).style.display = 'flex';
}
function hideModal(id) { document.getElementById(id).style.display = 'none'; }
function closeModals(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  if (document.getElementById('modal-login').style.display === 'flex' && !STATE.user) return;
  document.getElementById('modal-overlay').classList.remove('open');
  ['modal-member','modal-comment','modal-delete'].forEach(hideModal);
}
function closeModalMember() {
  hideModal('modal-member');
  if (!document.querySelector('.modal[style*="flex"]')) {
    document.getElementById('modal-overlay').classList.remove('open');
  }
}

// ── TOAST ────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── KEYBOARD SHORTCUTS ───────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModals({ target: document.getElementById('modal-overlay') });
  if ((e.ctrlKey || e.metaKey) && e.key === 'f' && ['active','left'].includes(STATE.currentView)) {
    e.preventDefault();
    document.getElementById('global-search').focus();
  }
});
