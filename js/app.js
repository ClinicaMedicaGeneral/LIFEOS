/* ═══════════════════════════════════════════
   LIFE OS — Main Application Controller
   ═══════════════════════════════════════════ */

let APP = {};
let charts = {};

document.addEventListener('DOMContentLoaded', () => {
  APP = Store.load();
  initApp();
});

function initApp() {
  // Calculate and lock initial debt on first load
  if (!APP.financial.initialDebt) {
    APP.financial.initialDebt = ModeEngine.getTotalDebt(APP);
    Store.save(APP);
  }
  updateMode();
  renderSidebar();
  navigateTo('dashboard');
  startAutoSave();
  // Initialize Firebase sync if previously configured
  Sync.init();
}

function getInitialDebt() {
  return APP.financial.initialDebt || ModeEngine.getTotalDebt(APP);
}

function startAutoSave() {
  setInterval(() => {
    Store.save(APP);
    Sync.push(); // also push to cloud silently
  }, 30000);
}

function saveNow() {
  Store.save(APP);
  Sync.push();
}

/* ═══════════════════════
   Cloud Sync Modal
   ═══════════════════════ */

// Explicitly expose sync functions globally (needed for some mobile browsers)
window.showSyncModal = showSyncModal;
window.closeSyncModal = closeSyncModal;
window.setupFirebase = setupFirebase;

function showSyncModal() {
  // Remove existing modal if any
  const existing = document.getElementById('sync-modal');
  if (existing) existing.remove();

  // Overlay — uses top/left/width/height for max browser compat (no inset)
  const overlay = document.createElement('div');
  overlay.id = 'sync-modal';
  overlay.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
    'background:rgba(0,0,0,0.85)', 'z-index:9999',
    'display:flex', 'align-items:flex-start', 'justify-content:center',
    'padding:20px', 'overflow-y:auto', 'box-sizing:border-box'
  ].join(';');

  // Card
  const card = document.createElement('div');
  card.style.cssText = [
    'background:#111119', 'border:1px solid rgba(255,255,255,0.1)',
    'border-radius:16px', 'width:100%', 'max-width:500px',
    'margin-top:40px', 'box-shadow:0 20px 60px rgba(0,0,0,0.8)',
    'font-family:Inter,sans-serif', 'color:#f0f0f5'
  ].join(';');

  // Steps HTML (plain string concat, no nested template literals)
  const steps = [
    ['1', 'Crear proyecto Firebase', 'Ve a <a href="https://console.firebase.google.com" target="_blank" style="color:#06b6d4">console.firebase.google.com</a> → Crear proyecto → Nombre: life-os → Crear'],
    ['2', 'Activar Google Auth', 'Build → Authentication → Comenzar → Sign-in method → Google → Habilitar → Guardar'],
    ['3', 'Crear Firestore', 'Build → Firestore Database → Crear base de datos → Modo de prueba → Habilitar'],
    ['4', 'Obtener config', '⚙️ Configuración del proyecto → Tus apps → icono Web → Registrar app → copia el objeto firebaseConfig'],
    ['5', 'Autorizar dominio', 'Authentication → Settings → Dominios autorizados → Agregar → clinicamedicageneral.github.io']
  ];

  let stepsHTML = '';
  for (const [num, title, desc] of steps) {
    stepsHTML += '<div style="display:flex;gap:10px;margin-bottom:12px;">'
      + '<div style="min-width:20px;height:20px;border-radius:50%;background:#a855f7;color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:2px;">' + num + '</div>'
      + '<div style="font-size:12px;color:#8888a0;line-height:1.6;"><strong style="color:#f0f0f5;">' + title + '</strong><br>' + desc + '</div>'
      + '</div>';
  }

  card.innerHTML = ''
    + '<div style="padding:18px 20px 14px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;">'
    + '<span style="font-size:15px;font-weight:700;">☁️ Sincronización entre dispositivos</span>'
    + '<button id="sync-modal-close" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer;padding:0 4px;line-height:1;">×</button>'
    + '</div>'
    + '<div style="padding:18px 20px;">'
    + '<p style="font-size:13px;color:#8888a0;margin-bottom:16px;">Sincroniza tu progreso entre celular y computadora gratis con Firebase.</p>'
    + stepsHTML
    + '<div style="margin-top:16px;">'
    + '<div style="font-size:12px;color:#8888a0;margin-bottom:6px;">Pega aquí tu firebaseConfig:</div>'
    + '<textarea id="firebase-config-input" rows="8" style="width:100%;background:#0a0a10;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f0f0f5;padding:10px;font-size:11px;font-family:monospace;box-sizing:border-box;resize:vertical;" placeholder=\'const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "...",\n  projectId: "..."\n};\'></textarea>'
    + '<div id="firebase-config-error" style="color:#ef4444;font-size:12px;margin-top:4px;"></div>'
    + '</div>'
    + '</div>'
    + '<div style="padding:14px 20px;border-top:1px solid rgba(255,255,255,0.06);display:flex;justify-content:flex-end;gap:10px;">'
    + '<button id="sync-modal-cancel" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#888;font-size:13px;cursor:pointer;">Cancelar</button>'
    + '<button id="sync-modal-connect" style="padding:8px 16px;border-radius:8px;border:none;background:#6366f1;color:white;font-size:13px;font-weight:600;cursor:pointer;">🔥 Conectar Firebase</button>'
    + '</div>';

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Attach listeners AFTER appending (no onclick attributes)
  document.getElementById('sync-modal-close').addEventListener('click', closeSyncModal);
  document.getElementById('sync-modal-cancel').addEventListener('click', closeSyncModal);
  document.getElementById('sync-modal-connect').addEventListener('click', setupFirebase);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeSyncModal(); });
}

function closeSyncModal() {
  const modal = document.getElementById('sync-modal');
  if (modal) modal.remove();
}

function setupFirebase() {
  const raw = document.getElementById('firebase-config-input').value.trim();
  const errEl = document.getElementById('firebase-config-error');
  errEl.textContent = '';

  try {
    // Extract the JSON object from the pasted text (handles both raw JSON and JS variable syntax)
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No se encontró un objeto de configuración válido');

    // Normalize: quote bare keys, replace single quotes
    const jsonStr = match[0]
      .replace(/([{,]\s*)([a-zA-Z_]\w*)(\s*:)/g, '$1"$2"$3')
      .replace(/'/g, '"');

    const config = JSON.parse(jsonStr);
    if (!config.apiKey)     throw new Error('Falta apiKey');
    if (!config.projectId)  throw new Error('Falta projectId');
    if (!config.authDomain) throw new Error('Falta authDomain');

    const btn = document.getElementById('firebase-connect-btn');
    if (btn) { btn.textContent = '⏳ Conectando...'; btn.disabled = true; }

    Sync.init(config).then(ok => {
      if (btn) { btn.textContent = '🔥 Conectar Firebase'; btn.disabled = false; }
      if (ok) {
        closeSyncModal();
        showNotification('🔥 Firebase listo. Iniciando sesión con Google...', 'success');
        setTimeout(() => Sync.signIn(), 800);
      } else {
        errEl.textContent = 'Error: No se pudo inicializar Firebase. Verifica la configuración.';
      }
    });
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
  }
}

/* ═══════════════════════
   Navigation
   ═══════════════════════ */

function navigateTo(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const el = document.getElementById('section-' + section);
  const nav = document.querySelector(`[data-nav="${section}"]`);
  if (el) el.classList.add('active');
  if (nav) nav.classList.add('active');

  const renderers = {
    dashboard: renderDashboard,
    financial: renderFinancial,
    goals: renderGoals,
    habits: renderHabits,
    deepwork: renderDeepWork,
    plan: renderPlan,
    identity: renderIdentity
  };

  if (renderers[section]) renderers[section]();

  document.querySelector('.sidebar')?.classList.remove('open');
}

function toggleSidebar() {
  document.querySelector('.sidebar')?.classList.toggle('open');
}

/* ═══════════════════════
   Mode System
   ═══════════════════════ */

function updateMode() {
  APP.profile.mode = ModeEngine.calculate(APP);
}

function getModeInfo(mode) {
  const modes = {
    survival: { label: 'SURVIVAL', icon: '🔴', class: 'mode-survival', desc: 'Estabilización básica' },
    recovery: { label: 'RECOVERY', icon: '🟡', class: 'mode-recovery', desc: 'Reconstrucción activa' },
    momentum: { label: 'MOMENTUM', icon: '🔵', class: 'mode-momentum', desc: 'Aceleración de progreso' },
    machine: { label: 'MACHINE MODE', icon: '🟢', class: 'mode-machine', desc: 'Rendimiento máximo' }
  };
  return modes[mode] || modes.survival;
}

/* ═══════════════════════
   Sidebar
   ═══════════════════════ */

function renderSidebar() {
  const level = XP.getLevel(APP.profile.xp);
  const next = XP.getNextLevel(APP.profile.xp);
  const progress = XP.getLevelProgress(APP.profile.xp);

  const xpEl = document.getElementById('sidebar-xp');
  if (xpEl) {
    xpEl.innerHTML = `
      <div class="xp-level">
        <span class="xp-level-badge">Nv.${level.level} ${level.title}</span>
        <span class="xp-level-text">${APP.profile.xp} XP</span>
      </div>
      <div class="xp-bar"><div class="xp-bar-fill" style="width:${progress}%"></div></div>
      <div class="xp-text">${next ? `${next.xp - APP.profile.xp} XP para Nv.${next.level}` : 'Nivel máximo'}</div>
    `;
  }
}

/* ═══════════════════════
   DASHBOARD
   ═══════════════════════ */

function renderDashboard() {
  const container = document.getElementById('section-dashboard');
  const day = Utils.currentDay(APP.startDate);
  const remaining = Utils.daysRemaining(APP.startDate);
  const progress = Utils.progressPercent(APP.startDate);
  const phase = Utils.getPhase(day);
  const modeInfo = getModeInfo(APP.profile.mode);
  const scores = ModeEngine.getScores(APP);
  const totalDebt = ModeEngine.getTotalDebt(APP);
  const quote = getDailyQuote();

  // Sync status for dashboard
  const syncBannerHTML = !Sync.configured
    ? `<div id="dash-sync-banner" style="background:linear-gradient(135deg,rgba(168,85,247,0.1),rgba(99,102,241,0.1));border:1px solid rgba(168,85,247,0.25);border-radius:12px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:22px;">☁️</span>
          <div>
            <div style="font-weight:600;font-size:13px;color:#f0f0f5;">Activa la sincronización</div>
            <div style="font-size:11px;color:#8888a0;margin-top:2px;">Mantén tu progreso igual en todos tus dispositivos</div>
          </div>
        </div>
        <button id="dash-sync-btn" style="padding:8px 16px;border-radius:8px;border:none;background:linear-gradient(135deg,#a855f7,#6366f1);color:white;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">Activar Sync →</button>
      </div>`
    : Sync.user
      ? `<div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:12px 18px;margin-bottom:20px;display:flex;align-items:center;gap:10px;">
          <span style="color:#10b981;">✓</span>
          <span style="font-size:12px;color:#8888a0;">Sincronizado como <strong style="color:#f0f0f5;">${Sync.user.displayName?.split(' ')[0]}</strong></span>
        </div>`
      : `<div id="dash-sync-login" style="background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.2);border-radius:12px;padding:12px 18px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <span style="font-size:12px;color:#8888a0;">Firebase configurado — inicia sesión para sincronizar</span>
          <button id="dash-sync-login-btn" style="padding:7px 14px;border-radius:8px;border:none;background:#06b6d4;color:white;font-size:12px;font-weight:600;cursor:pointer;">Conectar Google →</button>
        </div>`;

  container.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
        <div>
          <h2>Centro de Comando</h2>
          <p>Día ${day} de 90 &bull; ${phase.name} &bull; ${remaining} días restantes</p>
        </div>
        <div class="mode-badge ${modeInfo.class}">${modeInfo.icon} ${modeInfo.label}</div>
      </div>
    </div>

    ${syncBannerHTML}

    <div class="quote-banner animate-in">
      <div class="quote-text">${quote.text}</div>
      <div class="quote-author">— ${quote.author}</div>
    </div>

    <!-- Progress Ring & Stats -->
    <div class="grid-4" style="margin-bottom:24px;">
      <div class="card animate-in animate-delay-1" style="text-align:center;">
        <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;">
          <svg width="120" height="120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>
            <circle cx="60" cy="60" r="52" fill="none" stroke="${phase.color === 'red' ? '#ef4444' : phase.color === 'amber' ? '#f59e0b' : '#10b981'}"
              stroke-width="8" stroke-linecap="round"
              stroke-dasharray="${2 * Math.PI * 52}" stroke-dashoffset="${2 * Math.PI * 52 * (1 - progress / 100)}"
              transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 1s ease"/>
          </svg>
          <div style="position:absolute;text-align:center;">
            <div class="mono" style="font-size:28px;font-weight:900;">${day}</div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Día</div>
          </div>
        </div>
        <div style="margin-top:12px;font-size:13px;color:var(--text-secondary);">${Utils.formatPercent(progress)} completado</div>
      </div>

      <div class="card animate-in animate-delay-2">
        <div class="card-header"><span class="card-title">Deuda Total</span><span class="tag tag-red">Activa</span></div>
        <div class="stat-value" style="color:var(--accent-red);">${Utils.formatL(totalDebt)}</div>
        <div class="progress-bar" style="margin-top:12px;">
          <div class="progress-fill red" style="width:${Math.max(0, 100 - (totalDebt / getInitialDebt()) * 100)}%"></div>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">${Utils.formatPercent(Math.max(0, 100 - (totalDebt / getInitialDebt()) * 100))} eliminada</div>
      </div>

      <div class="card animate-in animate-delay-3">
        <div class="card-header"><span class="card-title">Ahorro</span><span class="tag tag-cyan">Meta</span></div>
        <div class="stat-value" style="color:var(--accent-cyan);">${Utils.formatL(APP.financial.currentSavings)}</div>
        <div class="progress-bar" style="margin-top:12px;">
          <div class="progress-fill cyan" style="width:${Math.min(100, (APP.financial.currentSavings / APP.financial.savingsGoal) * 100)}%"></div>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Meta: ${Utils.formatL(APP.financial.savingsGoal)}</div>
      </div>

      <div class="card animate-in animate-delay-4">
        <div class="card-header"><span class="card-title">XP Total</span><span class="tag tag-indigo">Nv.${APP.profile.level}</span></div>
        <div class="stat-value" style="color:var(--accent-indigo);">${APP.profile.xp}</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:8px;">${XP.getLevel(APP.profile.xp).title}</div>
      </div>
    </div>

    <!-- Score Cards -->
    <div class="grid-5" style="margin-bottom:24px;">
      ${renderScoreCard('Financiero', scores.financial, 'var(--accent-emerald)')}
      ${renderScoreCard('Disciplina', scores.discipline, 'var(--accent-indigo)')}
      ${renderScoreCard('Físico', scores.physical, 'var(--accent-cyan)')}
      ${renderScoreCard('Mental', scores.mental, 'var(--accent-purple)')}
      ${renderScoreCard('Enfoque', scores.focus, 'var(--accent-amber)')}
    </div>

    <!-- Charts Row -->
    <div class="grid-2" style="margin-bottom:24px;">
      <div class="card">
        <div class="card-header"><span class="card-title">Distribución de Deuda</span></div>
        <div class="chart-container"><canvas id="chart-debt-pie"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Scores de Vida</span></div>
        <div class="chart-container"><canvas id="chart-radar"></canvas></div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="card">
      <div class="card-header"><span class="card-title">Acciones Rápidas de Hoy</span></div>
      <div class="grid-3">
        <button class="btn btn-primary" onclick="quickAction('cleanDay')" style="width:100%;justify-content:center;">
          ✓ Día Limpio (Sobredad)
        </button>
        <button class="btn btn-primary" onclick="quickAction('cleanDayPorn')" style="width:100%;justify-content:center;">
          ✓ Día Limpio (Pornografía)
        </button>
        <button class="btn btn-primary" onclick="quickAction('workout')" style="width:100%;justify-content:center;">
          💪 Registrar Entrenamiento
        </button>
        <button class="btn btn-ghost" onclick="navigateTo('deepwork')" style="width:100%;justify-content:center;">
          ⏱ Iniciar Deep Work
        </button>
        <button class="btn btn-ghost" onclick="navigateTo('habits')" style="width:100%;justify-content:center;">
          📋 Check Diario
        </button>
        <button class="btn btn-ghost" onclick="navigateTo('financial')" style="width:100%;justify-content:center;">
          💰 Registrar Pago
        </button>
      </div>
    </div>
  `;

  renderDashboardCharts(scores);

  // Attach sync button listeners — both click AND touchstart for mobile
  const dashSyncBtn = document.getElementById('dash-sync-btn');
  if (dashSyncBtn) {
    dashSyncBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showSyncModal(); });
    dashSyncBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); showSyncModal(); }, { passive: false });
  }

  const dashLoginBtn = document.getElementById('dash-sync-login-btn');
  if (dashLoginBtn) {
    dashLoginBtn.addEventListener('click', (e) => { e.preventDefault(); Sync.signIn(); });
    dashLoginBtn.addEventListener('touchstart', (e) => { e.preventDefault(); Sync.signIn(); }, { passive: false });
  }
}

function renderScoreCard(label, score, color) {
  return `
    <div class="score-card">
      <div style="width:50px;height:50px;border-radius:50%;margin:0 auto;position:relative;display:flex;align-items:center;justify-content:center;">
        <svg width="50" height="50">
          <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="4"/>
          <circle cx="25" cy="25" r="20" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"
            stroke-dasharray="${2 * Math.PI * 20}" stroke-dashoffset="${2 * Math.PI * 20 * (1 - score / 100)}"
            transform="rotate(-90 25 25)"/>
        </svg>
      </div>
      <div class="score-value" style="color:${color};">${score}</div>
      <div class="score-label">${label}</div>
    </div>
  `;
}

function renderDashboardCharts(scores) {
  const ctxPie = document.getElementById('chart-debt-pie');
  const ctxRadar = document.getElementById('chart-radar');
  if (!ctxPie || !ctxRadar) return;

  if (charts.debtPie) charts.debtPie.destroy();
  if (charts.radar) charts.radar.destroy();

  const ccTotal = APP.financial.creditCards.reduce((s, c) => s + Math.max(0, c.balance - c.paid), 0);
  const efTotal = APP.financial.extraFinancing.reduce((s, e) => s + Math.max(0, e.total - e.paid * e.payment), 0);
  const pdTotal = APP.financial.personalDebts.reduce((s, p) => s + (p.paid ? 0 : p.amount), 0);

  charts.debtPie = new Chart(ctxPie, {
    type: 'doughnut',
    data: {
      labels: ['Tarjetas', 'Extrafinanciamientos', 'Deudas Personales'],
      datasets: [{
        data: [ccTotal, efTotal, pdTotal],
        backgroundColor: ['#ef4444', '#f59e0b', '#a855f7'],
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8888a0', padding: 16, usePointStyle: true, font: { family: 'Inter', size: 12 } } }
      }
    }
  });

  charts.radar = new Chart(ctxRadar, {
    type: 'radar',
    data: {
      labels: ['Financiero', 'Disciplina', 'Físico', 'Mental', 'Enfoque'],
      datasets: [{
        label: 'Actual',
        data: [scores.financial, scores.discipline, scores.physical, scores.mental, scores.focus],
        backgroundColor: 'rgba(99,102,241,0.15)',
        borderColor: '#6366f1',
        borderWidth: 2,
        pointBackgroundColor: '#6366f1',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { display: false },
          grid: { color: 'rgba(255,255,255,0.06)' },
          angleLines: { color: 'rgba(255,255,255,0.06)' },
          pointLabels: { color: '#8888a0', font: { family: 'Inter', size: 12 } }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function quickAction(type) {
  const today = Utils.today();
  let result;

  switch (type) {
    case 'cleanDay':
      if (!APP.goals.sobriety.cleanDays.includes(today)) {
        APP.goals.sobriety.cleanDays.push(today);
        APP.goals.sobriety.currentStreak++;
        if (APP.goals.sobriety.currentStreak > APP.goals.sobriety.bestStreak) {
          APP.goals.sobriety.bestStreak = APP.goals.sobriety.currentStreak;
        }
        result = XP.award(APP, 'CLEAN_DAY');
        showNotification('Día limpio registrado +25 XP', 'success');
      } else {
        showNotification('Ya registraste hoy', 'info');
      }
      break;

    case 'cleanDayPorn':
      if (!APP.goals.noPorn.cleanDays.includes(today)) {
        APP.goals.noPorn.cleanDays.push(today);
        APP.goals.noPorn.currentStreak++;
        if (APP.goals.noPorn.currentStreak > APP.goals.noPorn.bestStreak) {
          APP.goals.noPorn.bestStreak = APP.goals.noPorn.currentStreak;
        }
        result = XP.award(APP, 'CLEAN_DAY');
        showNotification('Día limpio registrado +25 XP', 'success');
      } else {
        showNotification('Ya registraste hoy', 'info');
      }
      break;

    case 'workout':
      const weekKey = Utils.getCurrentWeekKey();
      if (!APP.goals.fitness.weeks[weekKey]) {
        APP.goals.fitness.weeks[weekKey] = { sessions: 0, extra: 0, days: [] };
      }
      if (!APP.goals.fitness.weeks[weekKey].days) APP.goals.fitness.weeks[weekKey].days = [];
      if (!APP.goals.fitness.weeks[weekKey].days.includes(today)) {
        APP.goals.fitness.weeks[weekKey].sessions++;
        APP.goals.fitness.weeks[weekKey].days.push(today);
        APP.goals.fitness.totalSessions++;
        result = XP.award(APP, 'WORKOUT');
        showNotification('Entrenamiento registrado +30 XP', 'success');
      } else {
        showNotification('Ya registraste entrenamiento hoy', 'info');
      }
      break;
  }

  updateMode();
  renderSidebar();
  saveNow();
  renderDashboard();
}

/* ═══════════════════════
   FINANCIAL
   ═══════════════════════ */

function getIncomeTotal() {
  return APP.financial.salary + (APP.financial.remittance * APP.financial.exchangeRate);
}

function renderFinancial() {
  const container = document.getElementById('section-financial');
  const remesaL = APP.financial.remittance * APP.financial.exchangeRate;
  const income = getIncomeTotal();
  const totalCC = APP.financial.creditCards.reduce((s, c) => s + Math.max(0, c.balance - c.paid), 0);
  const totalEF = APP.financial.extraFinancing.reduce((s, e) => s + Math.max(0, e.total - e.paid * e.payment), 0);
  const totalPD = APP.financial.personalDebts.reduce((s, p) => s + (p.paid ? 0 : p.amount), 0);
  const totalDebt = totalCC + totalEF + totalPD;
  const monthlyEFPayments = APP.financial.extraFinancing.reduce((s, e) => s + (e.remaining > e.paid ? e.payment : 0), 0);
  const bankTotal = Object.values(APP.financial.banks).reduce((s, v) => s + v, 0);
  const riskLevel = totalDebt > income * 5 ? 'ALTO' : totalDebt > income * 3 ? 'MEDIO' : 'BAJO';
  const riskColor = riskLevel === 'ALTO' ? 'red' : riskLevel === 'MEDIO' ? 'amber' : 'green';
  const financialScore = Math.max(0, Math.round(100 - (totalDebt / income) * 10));
  const availableAfterEF = income - monthlyEFPayments;

  const schedule = APP.financial.salarySchedule || [
    { label: 'Quincena (15 del mes)', amount: 10000 },
    { label: 'Fin de mes (Último)', amount: 9404 }
  ];

  // Build 3-month income calendar starting from June 2026
  const [sy, sm, sd] = APP.startDate.split('-').map(Number);
  const planStart = new Date(sy, sm - 1, sd);
  const months3 = [];
  for (let m = 0; m < 3; m++) {
    const d = new Date(planStart.getFullYear(), planStart.getMonth() + m, 1);
    const monthName = d.toLocaleDateString('es-HN', { month: 'long', year: 'numeric' });
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const isFirstMonth = m === 0;
    months3.push({
      name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      entries: [
        ...(isFirstMonth ? [{ date: '01', label: 'Capital inicial (Mayo)', amount: APP.financial.startingCapital || 0, highlight: true }] : []),
        { date: '15', label: schedule[0].label, amount: schedule[0].amount },
        { date: `${lastDay}`, label: schedule[1].label, amount: schedule[1].amount },
        { date: `${lastDay}`, label: `Remesa ($${APP.financial.remittance})`, amount: remesaL }
      ],
      total: schedule[0].amount + schedule[1].amount + remesaL + (isFirstMonth ? (APP.financial.startingCapital || 0) : 0),
      isFirstMonth
    });
  }

  container.innerHTML = `
    <div class="page-header">
      <h2>Panel Financiero</h2>
      <p>Control total de tus finanzas &bull; Ingreso mensual: ${Utils.formatL(income)}</p>
    </div>

    <!-- Alerts -->
    ${totalDebt > income * 4 ? `<div class="alert alert-danger">⚠️ Ratio deuda/ingreso crítico. Deuda es ${(totalDebt / income).toFixed(1)}x tu ingreso mensual.</div>` : ''}
    ${APP.financial.personalDebts.some(p => !p.paid && new Date(p.dueDate) <= new Date(Date.now() + 7 * 86400000)) ? `<div class="alert alert-warning">⏰ Tienes pagos venciendo pronto. Revisa tus deudas personales.</div>` : ''}

    <!-- Starting Capital Banner -->
    ${APP.financial.startingCapital ? `
    <div class="alert alert-info" style="margin-bottom:16px;">
      💰 <strong>Capital Inicial (Último pago Mayo):</strong> ${Utils.formatL(APP.financial.startingCapital)}
      (Salario L9,404 + Remesa $${APP.financial.remittance}) &mdash; Reservado como colchón mínimo.
      <strong>Plan activo desde 01/Jun. Primer pago de deuda: 15/Jun.</strong>
    </div>` : ''}

    <!-- Top Stats -->
    <div class="grid-5" style="margin-bottom:24px;">
      <div class="card">
        <div class="card-title" style="margin-bottom:12px;">Ingreso Mensual</div>
        <div class="stat-value" style="color:var(--accent-emerald);">${Utils.formatL(income)}</div>
        <div class="stat-label">Salario + Remesas</div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:12px;">Capital Inicial</div>
        <div class="stat-value" style="color:var(--accent-cyan);">${Utils.formatL(APP.financial.startingCapital || 0)}</div>
        <div class="stat-label">Colchón Mayo</div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:12px;">Deuda Total</div>
        <div class="stat-value" style="color:var(--accent-red);">${Utils.formatL(totalDebt)}</div>
        <div class="stat-change negative">${(totalDebt / income).toFixed(1)}x ingreso</div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:12px;">En Bancos</div>
        <div class="stat-value">${Utils.formatL(bankTotal)}</div>
        <div class="stat-label">BAC + Ficohsa + BanPaís</div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:12px;">Riesgo</div>
        <div class="stat-value" style="color:var(--accent-${riskColor});">${riskLevel}</div>
        <div class="tag tag-${riskColor}" style="margin-top:8px;">${financialScore}/100</div>
      </div>
    </div>

    <!-- Income Schedule + Remittance Editor -->
    <div class="grid-2" style="margin-bottom:24px;">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Calendario de Ingresos (3 Meses)</span>
          <span class="tag tag-green">${Utils.formatL(income)}/mes</span>
        </div>
        ${months3.map((month, mi) => `
          <div style="margin-bottom:${mi < 2 ? '16px' : '0'};padding-bottom:${mi < 2 ? '16px' : '0'};border-bottom:${mi < 2 ? '1px solid var(--border-subtle)' : 'none'};">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-weight:700;font-size:14px;">${month.name}</span>
              <span class="mono" style="font-size:14px;font-weight:700;color:var(--accent-emerald);">${Utils.formatL(month.total)}</span>
            </div>
            ${month.entries.map(e => `
              <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;${e.highlight ? 'background:rgba(6,182,212,0.08);margin:0 -8px;padding:6px 8px;border-radius:6px;' : ''}">
                <div style="color:${e.highlight ? 'var(--accent-cyan)' : 'var(--text-secondary)'};">
                  <span class="mono" style="color:var(--text-muted);margin-right:8px;">Día ${e.date}</span>
                  ${e.highlight ? '<strong>' : ''}${e.label}${e.highlight ? '</strong>' : ''}
                </div>
                <span class="mono" style="font-weight:600;${e.highlight ? 'color:var(--accent-cyan);' : ''}">${Utils.formatL(e.amount)}</span>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Configurar Remesa</span>
          <span class="tag tag-cyan">Variable</span>
        </div>
        <div style="margin-bottom:20px;">
          <label class="input-label">Monto en USD ($)</label>
          <div style="display:flex;gap:8px;">
            <input type="number" id="remittance-usd" class="input" value="${APP.financial.remittance}" min="0" step="5" style="flex:1;">
            <button class="btn btn-primary" onclick="updateRemittance()">Actualizar</button>
          </div>
        </div>
        <div style="padding:16px;background:var(--bg-secondary);border-radius:var(--radius-md);margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:13px;color:var(--text-secondary);">Monto USD</span>
            <span class="mono" style="font-weight:600;">$${APP.financial.remittance}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:13px;color:var(--text-secondary);">Tipo de cambio</span>
            <span class="mono" style="font-weight:600;">L${APP.financial.exchangeRate}</span>
          </div>
          <div class="separator" style="margin:8px 0;"></div>
          <div style="display:flex;justify-content:space-between;">
            <span style="font-size:13px;font-weight:600;">Equivalente en Lempiras</span>
            <span class="mono" style="font-weight:700;color:var(--accent-cyan);">${Utils.formatL(remesaL)}</span>
          </div>
        </div>
        <div style="margin-bottom:16px;">
          <label class="input-label">Tipo de cambio (L por $1 USD)</label>
          <div style="display:flex;gap:8px;">
            <input type="number" id="exchange-rate" class="input" value="${APP.financial.exchangeRate}" min="1" step="0.5" style="flex:1;">
            <button class="btn btn-ghost" onclick="updateExchangeRate()">Cambiar</button>
          </div>
        </div>

        <div style="padding:16px;background:var(--bg-secondary);border-radius:var(--radius-md);">
          <div class="card-title" style="margin-bottom:10px;">Desglose Salarial Mensual</div>
          ${schedule.map(s => `
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
              <span style="color:var(--text-secondary);">${s.label}</span>
              <span class="mono" style="font-weight:600;">${Utils.formatL(s.amount)}</span>
            </div>
          `).join('')}
          <div class="separator" style="margin:8px 0;"></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
            <span style="color:var(--text-secondary);">Remesa</span>
            <span class="mono" style="font-weight:600;color:var(--accent-cyan);">${Utils.formatL(remesaL)}</span>
          </div>
          <div class="separator" style="margin:8px 0;"></div>
          <div style="display:flex;justify-content:space-between;font-weight:700;">
            <span>Total Mensual</span>
            <span class="mono" style="color:var(--accent-emerald);">${Utils.formatL(income)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Debt Breakdown -->
    <div class="grid-2" style="margin-bottom:24px;">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Tarjetas de Crédito</span>
          <span class="tag tag-red">${Utils.formatL(totalCC)}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${APP.financial.creditCards.map(cc => `
            <div class="debt-card">
              <div class="debt-priority ${cc.balance - cc.paid > 5000 ? 'high' : cc.balance - cc.paid > 2000 ? 'medium' : 'low'}"></div>
              <div class="debt-info">
                <div class="debt-name">${cc.name}</div>
                <div class="debt-detail">${cc.cashPending ? 'Contado pendiente: ' + Utils.formatL(cc.cashPending) : ''}</div>
              </div>
              <div>
                <div class="debt-amount">${Utils.formatL(Math.max(0, cc.balance - cc.paid))}</div>
                <button class="btn btn-sm btn-ghost" style="margin-top:4px;" onclick="payDebt('cc','${cc.id}')">Pagar</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Extrafinanciamientos</span>
          <span class="tag tag-amber">${Utils.formatL(totalEF)}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto;">
          ${APP.financial.extraFinancing.map(ef => {
            const remainingPayments = Math.max(0, ef.remaining - ef.paid);
            // Use stored total minus paid installments (actual balance, no interest)
            const remainingTotal = Math.max(0, ef.total - ef.paid * ef.payment);
            return `
              <div class="debt-card ${remainingPayments === 0 ? 'paid' : ''}">
                <div class="debt-priority ${remainingPayments <= 4 ? 'low' : remainingPayments <= 8 ? 'medium' : 'high'}"></div>
                <div class="debt-info">
                  <div class="debt-name">${ef.name}</div>
                  <div class="debt-detail">Cuota: ${Utils.formatL(ef.payment)} &bull; Faltan: ${remainingPayments} cuotas${ef.noInterest ? ' &bull; <span class="tag tag-cyan" style="font-size:10px;padding:1px 6px;">Sin intereses</span>' : ''}</div>
                </div>
                <div>
                  <div class="debt-amount">${Utils.formatL(remainingTotal)}</div>
                  <button class="btn btn-sm btn-ghost" style="margin-top:4px;" onclick="payDebt('ef','${ef.id}')" ${remainingPayments === 0 ? 'disabled' : ''}>Pagar Cuota</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Personal Debts -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <span class="card-title">Deudas Personales & Responsabilidades</span>
        <span class="tag tag-amber">${Utils.formatL(totalPD)}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${APP.financial.personalDebts.map(pd => `
          <div class="debt-card ${pd.paid ? 'paid' : ''}">
            <div class="debt-priority ${pd.paid ? 'low' : 'high'}"></div>
            <div class="debt-info">
              <div class="debt-name">${pd.name}</div>
              <div class="debt-detail">Vence: ${pd.dueDate}</div>
            </div>
            <div>
              <div class="debt-amount">${pd.paid ? 'PAGADA' : Utils.formatL(pd.amount)}</div>
              ${!pd.paid ? `<button class="btn btn-sm btn-success" style="margin-top:4px;" onclick="payPersonalDebt('${pd.id}')">Liquidar</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Simulator & Strategy -->
    <div class="grid-2" style="margin-bottom:24px;">
      <div class="card">
        <div class="card-header"><span class="card-title">Simulador de Pagos Extra</span></div>
        <div class="simulator-input">
          <div style="flex:1;">
            <label class="input-label">Pago extra mensual (L)</label>
            <input type="number" id="sim-extra" class="input" value="1000" min="0" step="100">
          </div>
          <button class="btn btn-primary" onclick="runSimulator()">Simular</button>
        </div>
        <div id="sim-result" style="font-size:13px;color:var(--text-secondary);"></div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">Estrategia Recomendada</span></div>
        <div class="alert alert-info" style="margin-bottom:12px;">
          <div>
            <strong>Estrategia Híbrida Inteligente</strong><br>
            1. Liquidar deudas pequeñas primero (Snowball emocional)<br>
            2. Luego atacar las de mayor interés (Avalanche)<br>
            3. Pagar directo a capital cuando sea posible
          </div>
        </div>
        <div style="font-size:13px;">
          <strong>Prioridad actual:</strong>
          <ol style="padding-left:20px;margin-top:8px;color:var(--text-secondary);line-height:1.8;">
            <li>Deuda personal L2,000 (vence pronto)</li>
            <li>Internet L540 (cancelar servicio)</li>
            <li>Conecta Extra #2 (4 cuotas)</li>
            <li>BanPaís Edu Extra #1 (4 cuotas)</li>
            <li>Walmart Extra #2 (4 cuotas)</li>
          </ol>
        </div>
      </div>
    </div>

    <!-- Debt Elimination Progress -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header"><span class="card-title">Progreso de Eliminación de Deuda</span></div>
      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:13px;">Deuda Total Inicial: ${Utils.formatL(getInitialDebt())}</span>
          <span style="font-size:13px;font-weight:700;color:var(--accent-emerald);">${Utils.formatPercent(Math.max(0, ((getInitialDebt() - totalDebt) / getInitialDebt()) * 100))} eliminada</span>
        </div>
        <div class="progress-bar" style="height:16px;border-radius:8px;">
          <div class="progress-fill emerald" style="width:${Math.max(0, ((getInitialDebt() - totalDebt) / getInitialDebt()) * 100)}%;border-radius:8px;"></div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);">
        <span>Eliminada: ${Utils.formatL(Math.max(0, getInitialDebt() - totalDebt))}</span>
        <span>Restante: ${Utils.formatL(totalDebt)}</span>
      </div>
    </div>

    <!-- Monthly Flow Chart -->
    <div class="card">
      <div class="card-header"><span class="card-title">Flujo Mensual</span></div>
      <div class="chart-container" style="max-height:250px;"><canvas id="chart-flow"></canvas></div>
    </div>
  `;

  renderFlowChart(income, monthlyEFPayments, totalCC, availableAfterEF);
}

function updateRemittance() {
  const val = parseFloat(document.getElementById('remittance-usd')?.value);
  if (isNaN(val) || val < 0) return showNotification('Monto inválido', 'error');
  APP.financial.remittance = val;
  saveNow();
  renderFinancial();
  showNotification(`Remesa actualizada a $${val} (${Utils.formatL(val * APP.financial.exchangeRate)})`, 'success');
}

function updateExchangeRate() {
  const val = parseFloat(document.getElementById('exchange-rate')?.value);
  if (isNaN(val) || val < 1) return showNotification('Tipo de cambio inválido', 'error');
  APP.financial.exchangeRate = val;
  saveNow();
  renderFinancial();
  showNotification(`Tipo de cambio actualizado a L${val} por $1`, 'success');
}

function payDebt(type, id) {
  if (type === 'cc') {
    const card = APP.financial.creditCards.find(c => c.id === id);
    if (!card) return;
    const amount = prompt(`¿Cuánto pagas a ${card.name}? (Saldo: ${Utils.formatL(card.balance - card.paid)})`);
    if (amount && !isNaN(amount)) {
      card.paid += parseFloat(amount);
      XP.award(APP, 'DEBT_PAYMENT');
      showNotification(`Pago de ${Utils.formatL(parseFloat(amount))} registrado`, 'success');
    }
  } else if (type === 'ef') {
    const ef = APP.financial.extraFinancing.find(e => e.id === id);
    if (!ef) return;
    ef.paid++;
    XP.award(APP, 'DEBT_PAYMENT');
    showNotification(`Cuota pagada de ${ef.name}. Faltan ${ef.remaining - ef.paid} cuotas.`, 'success');
  }
  updateMode();
  saveNow();
  renderFinancial();
  renderSidebar();
}

function payPersonalDebt(id) {
  const debt = APP.financial.personalDebts.find(p => p.id === id);
  if (debt) {
    debt.paid = true;
    XP.award(APP, 'DEBT_PAYMENT');
    showNotification(`${debt.name} liquidada`, 'success');
    updateMode();
    saveNow();
    renderFinancial();
    renderSidebar();
  }
}

function runSimulator() {
  const extra = parseFloat(document.getElementById('sim-extra')?.value || 0);
  const totalDebt = ModeEngine.getTotalDebt(APP);
  const monthlyEF = APP.financial.extraFinancing.reduce((s, e) => s + (e.remaining > e.paid ? e.payment : 0), 0);
  const income = getIncomeTotal();
  const totalMonthlyPayment = monthlyEF + extra;

  let months = 0;
  let remaining = totalDebt;
  while (remaining > 0 && months < 120) {
    remaining -= totalMonthlyPayment;
    months++;
  }

  const freedomDate = new Date();
  freedomDate.setMonth(freedomDate.getMonth() + months);

  const el = document.getElementById('sim-result');
  if (el) {
    el.innerHTML = `
      <div class="alert alert-success" style="margin-top:12px;">
        <div>
          <strong>Con ${Utils.formatL(extra)} extra/mes:</strong><br>
          Libertad financiera estimada en <strong>${months} meses</strong> (${freedomDate.toLocaleDateString('es-HN', { month: 'long', year: 'numeric' })})<br>
          Pago total mensual: ${Utils.formatL(totalMonthlyPayment)}
        </div>
      </div>
    `;
  }
}

function renderFlowChart(income, efPayments, ccDebt, available) {
  const ctx = document.getElementById('chart-flow');
  if (!ctx) return;
  if (charts.flow) charts.flow.destroy();

  charts.flow = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Ingreso', 'Cuotas Fijas', 'Tarjetas', 'Disponible'],
      datasets: [{
        data: [income, efPayments, ccDebt, Math.max(0, available - ccDebt * 0.1)],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#6366f1'],
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#55556a', callback: v => 'L' + (v/1000).toFixed(0) + 'k', font: { family: 'JetBrains Mono' } } },
        x: { grid: { display: false }, ticks: { color: '#8888a0', font: { family: 'Inter', size: 12 } } }
      }
    }
  });
}

/* ═══════════════════════
   GOALS
   ═══════════════════════ */

function renderGoals() {
  const container = document.getElementById('section-goals');

  container.innerHTML = `
    <div class="page-header">
      <h2>Metas Personales</h2>
      <p>Sistema de seguimiento y evolución personal</p>
    </div>

    <!-- Sobriety Trackers -->
    <div class="grid-2" style="margin-bottom:24px;">
      ${renderSobrietyCard('sobriety', 'Dejar Vape', '💨', APP.goals.sobriety)}
      ${renderSobrietyCard('noPorn', 'Dejar Pornografía', '🛡️', APP.goals.noPorn)}
    </div>

    <!-- Fitness -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <span class="card-title">💪 Entrenamiento Semanal</span>
        <span class="tag tag-cyan">${APP.goals.fitness.totalSessions} sesiones totales</span>
      </div>
      ${renderFitnessTracker()}
    </div>

    <!-- Learning -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <span class="card-title">📚 Aprendizaje Continuo</span>
        <span class="tag tag-purple">${APP.goals.learning.totalHours.toFixed(1)}h estudiadas</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${APP.goals.learning.courses.map(c => `
          <div style="padding:16px;background:var(--bg-secondary);border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <span style="font-weight:600;">${c.name}</span>
              <span class="mono" style="font-size:13px;color:var(--accent-purple);">${c.completedModules}/${c.totalModules} módulos</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill purple" style="width:${(c.completedModules / c.totalModules) * 100}%"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;">
              <span style="font-size:12px;color:var(--text-muted);">${c.hoursStudied.toFixed(1)}h invertidas</span>
              <button class="btn btn-sm btn-ghost" onclick="advanceCourse('${c.id}')">Completar Módulo</button>
            </div>
          </div>
        `).join('')}
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost" onclick="logStudyTime()">Registrar Horas de Estudio</button>
        </div>
      </div>
    </div>

    <!-- Image -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <span class="card-title">✨ Imagen Personal</span>
        <span class="tag tag-indigo">Check Diario</span>
      </div>
      ${renderImageChecklist()}
    </div>
  `;
}

function renderSobrietyCard(key, title, icon, goal) {
  const today = Utils.today();
  const isCleanToday = goal.cleanDays.includes(today);
  const moneySaved = key === 'sobriety' ? goal.currentStreak * (goal.moneySavedPerDay || 50) : null;
  const last7 = Utils.getWeekDates();

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">${icon} ${title}</span>
        ${isCleanToday ? '<span class="tag tag-green">Hoy: Limpio</span>' : '<span class="tag tag-amber">Pendiente</span>'}
      </div>

      <div class="streak-counter" style="margin-bottom:16px;">
        <div class="streak-flame">🔥</div>
        <div>
          <div class="streak-number" style="color:var(--accent-emerald);">${goal.currentStreak}</div>
          <div class="streak-label">días seguidos</div>
        </div>
        <div style="margin-left:auto;text-align:right;">
          <div style="font-size:20px;font-weight:700;font-family:'JetBrains Mono';color:var(--accent-amber);">${goal.bestStreak}</div>
          <div class="streak-label">mejor racha</div>
        </div>
      </div>

      ${moneySaved !== null ? `
        <div style="padding:12px;background:rgba(16,185,129,0.1);border-radius:var(--radius-sm);margin-bottom:16px;text-align:center;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Dinero Ahorrado</div>
          <div class="mono" style="font-size:24px;font-weight:800;color:var(--accent-emerald);">${Utils.formatL(moneySaved)}</div>
        </div>
      ` : ''}

      <!-- Weekly view -->
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Esta semana</div>
        <div class="week-row">
          ${last7.map(d => `
            <div class="week-day ${goal.cleanDays.includes(d) ? 'done' : ''} ${d === today ? 'current' : ''}">
              <span class="week-day-label">${Utils.getDayName(d)}</span>
              ${goal.cleanDays.includes(d) ? '✓' : d === today ? '•' : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <div style="display:flex;gap:8px;">
        ${!isCleanToday ? `<button class="btn btn-success btn-sm" onclick="quickAction('${key === 'sobriety' ? 'cleanDay' : 'cleanDayPorn'}')">Registrar Día Limpio</button>` : ''}
        <button class="btn btn-danger btn-sm" onclick="registerRelapse('${key}')">Reportar Recaída</button>
      </div>
    </div>
  `;
}

function registerRelapse(key) {
  if (!confirm('¿Reportar recaída? Tu racha se reiniciará pero tu progreso se mantiene. Recuerda: una caída no borra el camino recorrido.')) return;

  const goal = APP.goals[key];
  goal.relapses.push({ date: Utils.today(), streakLost: goal.currentStreak });
  goal.currentStreak = 0;
  saveNow();
  renderGoals();
  showNotification('Racha reiniciada. No te rindas, cada día es una nueva oportunidad.', 'warning');
}

function renderFitnessTracker() {
  const weekKey = Utils.getCurrentWeekKey();
  const weekData = APP.goals.fitness.weeks[weekKey] || { sessions: 0, extra: 0, days: [] };
  const weekGoal = APP.goals.fitness.weeklyGoal;
  const weekDates = Utils.getWeekDates();
  const today = Utils.today();

  return `
    <div style="display:flex;gap:24px;flex-wrap:wrap;">
      <div style="flex:1;min-width:200px;">
        <div style="text-align:center;margin-bottom:16px;">
          <svg width="120" height="120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--accent-cyan)" stroke-width="8" stroke-linecap="round"
              stroke-dasharray="${2 * Math.PI * 52}" stroke-dashoffset="${2 * Math.PI * 52 * (1 - Math.min(1, weekData.sessions / weekGoal))}"
              transform="rotate(-90 60 60)"/>
          </svg>
          <div style="margin-top:-70px;margin-bottom:40px;">
            <div class="mono" style="font-size:28px;font-weight:900;color:var(--accent-cyan);">${weekData.sessions}/${weekGoal}</div>
            <div style="font-size:11px;color:var(--text-muted);">sesiones</div>
          </div>
        </div>
        <div class="week-row" style="margin-bottom:16px;">
          ${weekDates.map(d => `
            <div class="week-day ${weekData.days && weekData.days.includes(d) ? 'done' : ''} ${d === today ? 'current' : ''}"
              onclick="toggleWorkoutDay('${d}')" style="cursor:pointer;" title="${weekData.days && weekData.days.includes(d) ? 'Click para quitar' : 'Click para registrar'}">
              <span class="week-day-label">${Utils.getDayName(d)}</span>
              ${weekData.days && weekData.days.includes(d) ? '💪' : ''}
            </div>
          `).join('')}
        </div>
      </div>
      <div style="flex:1;min-width:200px;">
        <div style="padding:16px;background:var(--bg-secondary);border-radius:var(--radius-md);margin-bottom:12px;">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Actividad Extra (Fútbol/Natación)</div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span class="mono" style="font-size:20px;font-weight:700;">${weekData.extra || 0}/1</span>
            <div style="display:flex;gap:6px;">
              ${(weekData.extra || 0) > 0 ? `<button class="btn btn-sm btn-danger" onclick="undoExtraActivity()" title="Quitar registro">✕</button>` : ''}
              <button class="btn btn-sm btn-ghost" onclick="logExtraActivity()">Registrar</button>
            </div>
          </div>
        </div>
        <div style="padding:16px;background:var(--bg-secondary);border-radius:var(--radius-md);">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Sesiones Totales (90 días)</div>
          <div class="mono" style="font-size:20px;font-weight:700;color:var(--accent-cyan);">${APP.goals.fitness.totalSessions}</div>
        </div>
      </div>
    </div>
  `;
}

function logExtraActivity() {
  const weekKey = Utils.getCurrentWeekKey();
  if (!APP.goals.fitness.weeks[weekKey]) {
    APP.goals.fitness.weeks[weekKey] = { sessions: 0, extra: 0, days: [] };
  }
  APP.goals.fitness.weeks[weekKey].extra++;
  XP.award(APP, 'WORKOUT');
  saveNow();
  renderGoals();
  showNotification('Actividad extra registrada +30 XP', 'success');
}

function undoExtraActivity() {
  const weekKey = Utils.getCurrentWeekKey();
  const weekData = APP.goals.fitness.weeks[weekKey];
  if (weekData && weekData.extra > 0) {
    weekData.extra--;
    saveNow();
    renderGoals();
    showNotification('Actividad extra removida', 'warning');
  }
}

function toggleWorkoutDay(dateStr) {
  const weekKey = Utils.getCurrentWeekKey();
  if (!APP.goals.fitness.weeks[weekKey]) {
    APP.goals.fitness.weeks[weekKey] = { sessions: 0, extra: 0, days: [] };
  }
  if (!APP.goals.fitness.weeks[weekKey].days) APP.goals.fitness.weeks[weekKey].days = [];

  const days = APP.goals.fitness.weeks[weekKey].days;
  const idx = days.indexOf(dateStr);

  if (idx >= 0) {
    days.splice(idx, 1);
    APP.goals.fitness.weeks[weekKey].sessions = Math.max(0, APP.goals.fitness.weeks[weekKey].sessions - 1);
    APP.goals.fitness.totalSessions = Math.max(0, APP.goals.fitness.totalSessions - 1);
    saveNow();
    renderGoals();
    renderSidebar();
    showNotification('Entrenamiento removido', 'warning');
  } else {
    days.push(dateStr);
    APP.goals.fitness.weeks[weekKey].sessions++;
    APP.goals.fitness.totalSessions++;
    XP.award(APP, 'WORKOUT');
    saveNow();
    renderGoals();
    renderSidebar();
    showNotification('Entrenamiento registrado +30 XP', 'success');
  }
}

function renderImageChecklist() {
  const today = Utils.today();
  const checks = APP.goals.image.dailyChecks[today] || {};
  const items = APP.goals.image.items;
  const completed = items.filter(i => checks[i]).length;

  return `
    <div style="margin-bottom:12px;">
      <div class="progress-bar" style="margin-bottom:8px;">
        <div class="progress-fill indigo" style="width:${(completed / items.length) * 100}%"></div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);">${completed}/${items.length} completados hoy</div>
    </div>
    ${items.map(item => `
      <div class="check-item ${checks[item] ? 'checked' : ''}" onclick="toggleImageCheck('${item}')">
        <div class="check-box"></div>
        <span class="check-text">${item}</span>
      </div>
    `).join('')}
  `;
}

function toggleImageCheck(item) {
  const today = Utils.today();
  if (!APP.goals.image.dailyChecks[today]) APP.goals.image.dailyChecks[today] = {};
  APP.goals.image.dailyChecks[today][item] = !APP.goals.image.dailyChecks[today][item];

  const checks = APP.goals.image.dailyChecks[today];
  const allDone = APP.goals.image.items.every(i => checks[i]);
  if (allDone) XP.award(APP, 'IMAGE_PERFECT');

  XP.award(APP, 'DAILY_CHECK');
  saveNow();
  renderGoals();
  renderSidebar();
}

function advanceCourse(courseId) {
  const course = APP.goals.learning.courses.find(c => c.id === courseId);
  if (course && course.completedModules < course.totalModules) {
    course.completedModules++;
    XP.award(APP, 'STUDY_HOUR');
    saveNow();
    renderGoals();
    renderSidebar();
    showNotification(`Módulo completado en ${course.name}`, 'success');
  }
}

function logStudyTime() {
  const hours = prompt('¿Cuántas horas estudiaste? (ej: 1.5)');
  if (hours && !isNaN(hours)) {
    const h = parseFloat(hours);
    APP.goals.learning.totalHours += h;
    const courseId = prompt('¿En cuál curso? (google-pm, fb-community, html-mobile)');
    const course = APP.goals.learning.courses.find(c => c.id === courseId);
    if (course) course.hoursStudied += h;
    for (let i = 0; i < Math.floor(h); i++) XP.award(APP, 'STUDY_HOUR');
    saveNow();
    renderGoals();
    renderSidebar();
    showNotification(`${h}h de estudio registradas`, 'success');
  }
}

/* ═══════════════════════
   HABITS
   ═══════════════════════ */

function renderHabits() {
  const container = document.getElementById('section-habits');
  const today = Utils.today();
  const dailyHabits = [
    { id: 'wake-early', label: 'Despertar temprano (antes de 6:30)', icon: '⏰' },
    { id: 'workout', label: 'Entrenamiento del día', icon: '💪' },
    { id: 'deep-work', label: '3h de Deep Work CMG', icon: '🎯' },
    { id: 'study', label: 'Sesión de estudio', icon: '📚' },
    { id: 'clean', label: 'Día limpio (sustancias)', icon: '🌿' },
    { id: 'image', label: 'Imagen personal cuidada', icon: '✨' },
    { id: 'no-scroll', label: 'Sin scroll infinito', icon: '📵' },
    { id: 'sleep-early', label: 'Dormir antes de 22:30', icon: '😴' }
  ];

  const todayData = APP.habits.daily[today] || {};
  const completed = dailyHabits.filter(h => todayData[h.id]).length;

  // Calculate streaks
  let streak = 0;
  let checkDate = new Date();
  checkDate.setDate(checkDate.getDate() - 1);
  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    const dayData = APP.habits.daily[dateStr] || {};
    const dayComplete = dailyHabits.filter(h => dayData[h.id]).length >= 6;
    if (dayComplete) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
    else break;
  }

  // Heatmap: last 12 weeks
  const heatmapDays = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const dd = APP.habits.daily[ds] || {};
    const count = dailyHabits.filter(h => dd[h.id]).length;
    heatmapDays.push({ date: ds, count, isToday: ds === today, isFuture: d > new Date() });
  }

  container.innerHTML = `
    <div class="page-header">
      <h2>Hábitos Diarios</h2>
      <p>Construye consistencia &bull; Racha actual: ${streak} días</p>
    </div>

    <!-- Today's Habits -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <span class="card-title">Hoy — ${new Date().toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <span class="mono" style="font-size:18px;font-weight:700;color:${completed === dailyHabits.length ? 'var(--accent-emerald)' : 'var(--text-secondary)'};">${completed}/${dailyHabits.length}</span>
      </div>

      <div class="progress-bar" style="margin-bottom:20px;height:10px;">
        <div class="progress-fill ${completed === dailyHabits.length ? 'emerald' : 'indigo'}" style="width:${(completed / dailyHabits.length) * 100}%"></div>
      </div>

      ${dailyHabits.map(h => `
        <div class="check-item ${todayData[h.id] ? 'checked' : ''}" onclick="toggleHabit('${h.id}')">
          <div class="check-box"></div>
          <span style="font-size:18px;">${h.icon}</span>
          <span class="check-text">${h.label}</span>
        </div>
      `).join('')}
    </div>

    <!-- Heatmap -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <span class="card-title">Mapa de Consistencia (12 semanas)</span>
        <div style="display:flex;gap:4px;align-items:center;font-size:11px;color:var(--text-muted);">
          <span>Menos</span>
          <div style="width:14px;height:14px;border-radius:3px;background:rgba(255,255,255,0.04);"></div>
          <div style="width:14px;height:14px;border-radius:3px;background:rgba(16,185,129,0.2);"></div>
          <div style="width:14px;height:14px;border-radius:3px;background:rgba(16,185,129,0.4);"></div>
          <div style="width:14px;height:14px;border-radius:3px;background:rgba(16,185,129,0.6);"></div>
          <div style="width:14px;height:14px;border-radius:3px;background:rgba(16,185,129,0.85);"></div>
          <span>Más</span>
        </div>
      </div>
      <div class="habit-grid">
        ${heatmapDays.map(d => {
          const level = d.isFuture ? 'future' : d.count === 0 ? '' : d.count <= 2 ? 'level-1' : d.count <= 4 ? 'level-2' : d.count <= 6 ? 'level-3' : 'level-4';
          return `<div class="habit-day ${level} ${d.isToday ? 'today' : ''}" title="${d.date}: ${d.count} hábitos"></div>`;
        }).join('')}
      </div>
    </div>

    <!-- Streak Info -->
    <div class="grid-3">
      <div class="card" style="text-align:center;">
        <div style="font-size:36px;margin-bottom:8px;">🔥</div>
        <div class="mono" style="font-size:32px;font-weight:900;color:var(--accent-amber);">${streak}</div>
        <div class="score-label">Racha Actual</div>
      </div>
      <div class="card" style="text-align:center;">
        <div style="font-size:36px;margin-bottom:8px;">📊</div>
        <div class="mono" style="font-size:32px;font-weight:900;color:var(--accent-indigo);">${Object.keys(APP.habits.daily).length}</div>
        <div class="score-label">Días Trackeados</div>
      </div>
      <div class="card" style="text-align:center;">
        <div style="font-size:36px;margin-bottom:8px;">⚡</div>
        <div class="mono" style="font-size:32px;font-weight:900;color:var(--accent-emerald);">${APP.profile.xp}</div>
        <div class="score-label">XP Total</div>
      </div>
    </div>
  `;
}

function toggleHabit(id) {
  const today = Utils.today();
  if (!APP.habits.daily[today]) APP.habits.daily[today] = {};
  APP.habits.daily[today][id] = !APP.habits.daily[today][id];
  if (APP.habits.daily[today][id]) XP.award(APP, 'HABIT_COMPLETE');
  updateMode();
  saveNow();
  renderHabits();
  renderSidebar();
}

/* ═══════════════════════
   DEEP WORK / POMODORO
   ═══════════════════════ */

let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;
let timerMode = 'focus';

function renderDeepWork() {
  const container = document.getElementById('section-deepwork');
  const today = Utils.today();
  const todaySession = APP.goals.deepWork.sessions[today] || { minutes: 0, pomodoros: 0 };
  const goalMinutes = APP.goals.deepWork.dailyGoalMinutes;
  const progress = Math.min(100, (todaySession.minutes / goalMinutes) * 100);

  // Weekly data for chart
  const weekDates = Utils.getWeekDates();
  const weekData = weekDates.map(d => {
    const s = APP.goals.deepWork.sessions[d] || { minutes: 0 };
    return s.minutes;
  });

  container.innerHTML = `
    <div class="page-header">
      <h2>Deep Work — CMG</h2>
      <p>3 horas diarias de trabajo profundo &bull; Timer estilo Pomodoro</p>
    </div>

    <div class="grid-2" style="margin-bottom:24px;">
      <!-- Timer -->
      <div class="card" style="text-align:center;">
        <div style="margin-bottom:8px;">
          <div class="tabs" style="display:inline-flex;">
            <button class="tab ${timerMode === 'focus' ? 'active' : ''}" onclick="setTimerMode('focus')">Enfoque (25m)</button>
            <button class="tab ${timerMode === 'short' ? 'active' : ''}" onclick="setTimerMode('short')">Descanso (5m)</button>
            <button class="tab ${timerMode === 'long' ? 'active' : ''}" onclick="setTimerMode('long')">Largo (15m)</button>
          </div>
        </div>
        <div class="timer-display" id="timer-display">${formatTime(timerSeconds)}</div>
        <div class="timer-controls">
          <button class="timer-btn primary" id="timer-toggle" onclick="toggleTimer()">
            ${timerRunning ? 'PAUSAR' : 'INICIAR'}
          </button>
          <button class="timer-btn secondary" onclick="resetTimer()">REINICIAR</button>
        </div>
        <div style="margin-top:16px;font-size:12px;color:var(--text-muted);">
          Pomodoros hoy: <span class="mono" style="color:var(--accent-indigo);">${todaySession.pomodoros}</span>
        </div>
      </div>

      <!-- Today's Progress -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Progreso de Hoy</span>
          <span class="tag ${progress >= 100 ? 'tag-green' : 'tag-amber'}">${Math.round(todaySession.minutes)}/${goalMinutes} min</span>
        </div>

        <div style="text-align:center;margin:20px 0;">
          <svg width="160" height="160">
            <circle cx="80" cy="80" r="68" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10"/>
            <circle cx="80" cy="80" r="68" fill="none" stroke="var(--accent-indigo)" stroke-width="10" stroke-linecap="round"
              stroke-dasharray="${2 * Math.PI * 68}" stroke-dashoffset="${2 * Math.PI * 68 * (1 - progress / 100)}"
              transform="rotate(-90 80 80)" style="transition:stroke-dashoffset 1s ease"/>
          </svg>
          <div style="margin-top:-100px;margin-bottom:60px;">
            <div class="mono" style="font-size:32px;font-weight:900;color:var(--accent-indigo);">${Utils.formatPercent(progress)}</div>
            <div style="font-size:11px;color:var(--text-muted);">completado</div>
          </div>
        </div>

        <div class="separator"></div>

        <div style="display:flex;justify-content:space-between;font-size:13px;">
          <div><span style="color:var(--text-muted);">Total acumulado:</span> <span class="mono font-bold">${Math.round(APP.goals.deepWork.totalMinutes)}min</span></div>
          <div><span style="color:var(--text-muted);">Pomodoros totales:</span> <span class="mono font-bold">${APP.goals.deepWork.pomodorosCompleted}</span></div>
        </div>
      </div>
    </div>

    <!-- Weekly Chart -->
    <div class="card">
      <div class="card-header"><span class="card-title">Deep Work Esta Semana</span></div>
      <div class="chart-container" style="max-height:200px;"><canvas id="chart-deepwork"></canvas></div>
    </div>
  `;

  renderDeepWorkChart(weekDates, weekData, goalMinutes);
}

function setTimerMode(mode) {
  timerMode = mode;
  const times = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
  timerSeconds = times[mode];
  timerRunning = false;
  if (timerInterval) clearInterval(timerInterval);
  renderDeepWork();
}

function toggleTimer() {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
  } else {
    if (timerSeconds === 0) {
      setTimerMode(timerMode);
      return;
    }
    timerRunning = true;
    timerInterval = setInterval(() => {
      timerSeconds--;
      const display = document.getElementById('timer-display');
      if (display) display.textContent = formatTime(timerSeconds);
      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerRunning = false;
        onTimerComplete();
      }
    }, 1000);
  }
  const btn = document.getElementById('timer-toggle');
  if (btn) btn.textContent = timerRunning ? 'PAUSAR' : 'INICIAR';
}

function resetTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerRunning = false;
  setTimerMode(timerMode);
}

function onTimerComplete() {
  const today = Utils.today();
  if (!APP.goals.deepWork.sessions[today]) {
    APP.goals.deepWork.sessions[today] = { minutes: 0, pomodoros: 0 };
  }
  if (timerMode === 'focus') {
    APP.goals.deepWork.sessions[today].minutes += 25;
    APP.goals.deepWork.sessions[today].pomodoros++;
    APP.goals.deepWork.totalMinutes += 25;
    APP.goals.deepWork.pomodorosCompleted++;
    XP.award(APP, 'DEEP_WORK_HOUR');
  }
  updateMode();
  saveNow();
  renderDeepWork();
  renderSidebar();
  showNotification(timerMode === 'focus' ? 'Pomodoro completado! +20 XP. Toma un descanso.' : 'Descanso terminado. A trabajar!', 'success');

  try { new Audio('data:audio/wav;base64,UklGRlYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTIAAABnZmVjZWdpamtsbm9wcXJzdHV2d3h5ent8fX5/gIGCg4Q=').play(); } catch(e) {}
}

function formatTime(seconds) {
  if (!seconds || seconds <= 0) {
    const defaults = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
    seconds = defaults[timerMode] || 25 * 60;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderDeepWorkChart(dates, data, goal) {
  const ctx = document.getElementById('chart-deepwork');
  if (!ctx) return;
  if (charts.deepwork) charts.deepwork.destroy();

  charts.deepwork = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates.map(d => Utils.getDayName(d)),
      datasets: [{
        label: 'Minutos',
        data: data,
        backgroundColor: data.map(v => v >= goal ? 'rgba(16,185,129,0.6)' : 'rgba(99,102,241,0.5)'),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        annotation: { annotations: { line1: { type: 'line', yMin: goal, yMax: goal, borderColor: 'rgba(239,68,68,0.5)', borderWidth: 2, borderDash: [6, 6] } } }
      },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#55556a', font: { family: 'JetBrains Mono' } } },
        x: { grid: { display: false }, ticks: { color: '#8888a0', font: { family: 'Inter' } } }
      }
    }
  });
}

/* ═══════════════════════
   PLAN
   ═══════════════════════ */

function renderPlan() {
  const container = document.getElementById('section-plan');
  const day = Utils.currentDay(APP.startDate);
  const phase = Utils.getPhase(day);

  container.innerHTML = `
    <div class="page-header">
      <h2>Plan Estratégico 90 Días</h2>
      <p>Día ${day} &bull; ${phase.name}</p>
    </div>

    <!-- Phase Overview -->
    <div class="grid-3" style="margin-bottom:24px;">
      <div class="card ${day <= 30 ? 'glow-red' : ''}" style="${day <= 30 ? 'border-color:rgba(239,68,68,0.3);' : ''}">
        <div class="card-header">
          <span class="card-title" style="color:var(--accent-red);">Fase 1: Supervivencia</span>
          <span class="tag ${day <= 30 ? 'tag-red' : 'tag-green'}">${day <= 30 ? 'ACTIVA' : 'Completada'}</span>
        </div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.8;">
          <strong>Día 1-30</strong><br>
          • Detener el sangrado financiero<br>
          • Establecer rutinas básicas<br>
          • 7 días limpio (ambas metas)<br>
          • Pagar deuda personal + internet<br>
          • Empezar deep work diario<br>
          • Eliminar una deuda pequeña
        </div>
      </div>

      <div class="card ${day > 30 && day <= 60 ? 'glow-indigo' : ''}" style="${day > 30 && day <= 60 ? 'border-color:rgba(245,158,11,0.3);' : ''}">
        <div class="card-header">
          <span class="card-title" style="color:var(--accent-amber);">Fase 2: Reconstrucción</span>
          <span class="tag ${day > 30 && day <= 60 ? 'tag-amber' : day > 60 ? 'tag-green' : 'tag-indigo'}">${day > 30 && day <= 60 ? 'ACTIVA' : day > 60 ? 'Completada' : 'Próxima'}</span>
        </div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.8;">
          <strong>Día 31-60</strong><br>
          • Hábitos consolidados (80%+)<br>
          • 30 días limpio como meta<br>
          • Eliminar 2+ deudas más<br>
          • Completar 1 curso<br>
          • Entrenar 4x/semana consistente<br>
          • Iniciar ahorro de emergencia
        </div>
      </div>

      <div class="card ${day > 60 ? 'glow-emerald' : ''}" style="${day > 60 ? 'border-color:rgba(16,185,129,0.3);' : ''}">
        <div class="card-header">
          <span class="card-title" style="color:var(--accent-emerald);">Fase 3: Dominio</span>
          <span class="tag ${day > 60 ? 'tag-green' : 'tag-indigo'}">${day > 60 ? 'ACTIVA' : 'Próxima'}</span>
        </div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.8;">
          <strong>Día 61-90</strong><br>
          • Machine Mode activado<br>
          • 60+ días limpio<br>
          • Solo quedan deudas grandes<br>
          • 2+ cursos completados<br>
          • Ahorro constante<br>
          • Identidad reconstruida
        </div>
      </div>
    </div>

    <!-- Daily Routine -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header"><span class="card-title">Rutina Ideal Diaria</span></div>
      <div style="display:grid;grid-template-columns:100px 1fr;gap:2px;">
        ${[
          ['05:30', 'Despertar + Agua + 5 min meditación', 'var(--accent-indigo)'],
          ['06:00', 'Entrenamiento / Actividad física', 'var(--accent-cyan)'],
          ['07:00', 'Ducha + Imagen personal + Desayuno', 'var(--accent-emerald)'],
          ['08:00', 'Trabajo (CMG) - Bloque de enfoque #1', 'var(--accent-amber)'],
          ['10:00', 'Descanso activo (15 min)', 'var(--text-muted)'],
          ['10:15', 'Trabajo - Bloque de enfoque #2', 'var(--accent-amber)'],
          ['12:00', 'Almuerzo + Desconexión total', 'var(--text-muted)'],
          ['13:00', 'Trabajo - Bloque de enfoque #3', 'var(--accent-amber)'],
          ['15:00', 'Estudio / Cursos (1-2h)', 'var(--accent-purple)'],
          ['17:00', 'Tiempo libre / Actividad extra', 'var(--text-muted)'],
          ['19:00', 'Cena + Revisión del día', 'var(--text-muted)'],
          ['20:00', 'Lectura / Aprendizaje ligero', 'var(--accent-purple)'],
          ['21:30', 'Preparar siguiente día + Wind down', 'var(--accent-indigo)'],
          ['22:00', 'Dormir', 'var(--text-muted)']
        ].map(([time, activity, color]) => `
          <div class="mono" style="font-size:13px;font-weight:600;color:${color};padding:8px 0;">${time}</div>
          <div style="font-size:13px;padding:8px 0;border-bottom:1px solid var(--border-subtle);color:var(--text-secondary);">${activity}</div>
        `).join('')}
      </div>
    </div>

    <!-- Recovery Protocol -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header"><span class="card-title">Protocolo de Recuperación tras Recaída</span></div>
      <div style="font-size:13px;color:var(--text-secondary);line-height:1.9;">
        <strong style="color:var(--accent-amber);">Si caes, no te destruyas. Reconstruye.</strong><br><br>
        1. <strong>Respira.</strong> Una recaída no borra tu progreso. Son datos, no sentencias.<br>
        2. <strong>Registra.</strong> Reporta la recaída honestamente en el sistema.<br>
        3. <strong>Analiza.</strong> ¿Qué disparó la recaída? ¿Estrés, aburrimiento, soledad?<br>
        4. <strong>Actúa.</strong> Cambia tu ambiente inmediato. Sal, muévete, habla con alguien.<br>
        5. <strong>Reinicia.</strong> El contador se reinicia, pero TÚ no. Tu experiencia acumulada sigue ahí.<br>
        6. <strong>Refuerza.</strong> Duplica la disciplina las siguientes 48 horas.<br>
        7. <strong>Sigue.</strong> Mañana es un nuevo día 1. Y tú ya sabes cómo llegar más lejos.
      </div>
    </div>

    <!-- KPIs -->
    <div class="card">
      <div class="card-header"><span class="card-title">Indicadores Clave de Éxito (KPIs)</span></div>
      <table class="data-table">
        <thead>
          <tr><th>Indicador</th><th>Meta Día 30</th><th>Meta Día 60</th><th>Meta Día 90</th><th>Estado</th></tr>
        </thead>
        <tbody>
          ${[
            ['Días limpio (vape)', '14', '45', '80+', APP.goals.sobriety.currentStreak],
            ['Días limpio (pornografía)', '14', '45', '80+', APP.goals.noPorn.currentStreak],
            ['Deudas eliminadas', '2', '4', '6+', countPaidDebts()],
            ['Sesiones de gym/semana', '3', '4', '4-5', getCurrentWeekSessions()],
            ['Cursos completados', '0', '1', '2+', countCompletedCourses()],
            ['Horas deep work/semana', '10', '15', '18+', Math.round(getWeeklyDeepWorkHours())],
            ['Hábitos diarios (%)', '50%', '75%', '90%+', getHabitCompletionRate() + '%'],
            ['Score financiero', '20', '50', '75+', ModeEngine.getScores(APP).financial]
          ].map(([name, m30, m60, m90, current]) => `
            <tr>
              <td style="font-weight:500;">${name}</td>
              <td class="mono">${m30}</td>
              <td class="mono">${m60}</td>
              <td class="mono">${m90}</td>
              <td><span class="mono font-bold" style="color:var(--accent-indigo);">${current}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function countPaidDebts() {
  const ccPaid = APP.financial.creditCards.filter(c => c.balance - c.paid <= 0).length;
  const efPaid = APP.financial.extraFinancing.filter(e => e.remaining - e.paid <= 0).length;
  const pdPaid = APP.financial.personalDebts.filter(p => p.paid).length;
  return ccPaid + efPaid + pdPaid;
}

function getCurrentWeekSessions() {
  const weekKey = Utils.getCurrentWeekKey();
  return (APP.goals.fitness.weeks[weekKey] || { sessions: 0 }).sessions;
}

function countCompletedCourses() {
  return APP.goals.learning.courses.filter(c => c.completedModules >= c.totalModules).length;
}

function getWeeklyDeepWorkHours() {
  const weekDates = Utils.getWeekDates();
  return weekDates.reduce((sum, d) => {
    const s = APP.goals.deepWork.sessions[d] || { minutes: 0 };
    return sum + s.minutes / 60;
  }, 0);
}

function getHabitCompletionRate() {
  const days = Object.keys(APP.habits.daily);
  if (days.length === 0) return 0;
  const totalHabits = 8;
  const totalCompleted = days.reduce((sum, d) => {
    return sum + Object.values(APP.habits.daily[d]).filter(Boolean).length;
  }, 0);
  return Math.round((totalCompleted / (days.length * totalHabits)) * 100);
}

/* ═══════════════════════
   IDENTITY
   ═══════════════════════ */

function renderIdentity() {
  const container = document.getElementById('section-identity');
  const day = Utils.currentDay(APP.startDate);
  const level = XP.getLevel(APP.profile.xp);
  const scores = ModeEngine.getScores(APP);

  container.innerHTML = `
    <div class="page-header">
      <h2>Dashboard de Identidad</h2>
      <p>Quién estás construyendo &bull; Tu evolución como persona</p>
    </div>

    <div class="card" style="margin-bottom:24px;text-align:center;padding:40px;">
      <div style="font-size:64px;margin-bottom:16px;">⚡</div>
      <h3 style="font-size:24px;font-weight:800;margin-bottom:8px;">Nivel ${level.level}: ${level.title}</h3>
      <p style="color:var(--text-secondary);font-size:15px;max-width:500px;margin:0 auto;">
        ${getIdentityMessage(level.level)}
      </p>
      <div style="margin-top:24px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        ${scores.financial >= 50 ? '<span class="tag tag-green">Financieramente Responsable</span>' : ''}
        ${scores.discipline >= 50 ? '<span class="tag tag-indigo">Disciplinado</span>' : ''}
        ${scores.physical >= 50 ? '<span class="tag tag-cyan">Atleta en Formación</span>' : ''}
        ${scores.mental >= 50 ? '<span class="tag tag-amber">Mente Clara</span>' : ''}
        ${scores.focus >= 50 ? '<span class="tag tag-purple">Enfocado</span>' : ''}
        ${APP.goals.sobriety.currentStreak >= 30 ? '<span class="tag tag-green">30 Días Limpio</span>' : ''}
        ${day > 30 ? '<span class="tag tag-amber">Sobreviviente</span>' : ''}
        ${day > 60 ? '<span class="tag tag-indigo">Reconstruido</span>' : ''}
      </div>
    </div>

    <!-- Timeline -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header"><span class="card-title">Timeline de Evolución</span></div>
      <div style="position:relative;padding-left:32px;">
        ${getTimelineEvents().map((event, i) => `
          <div style="position:relative;padding-bottom:24px;">
            <div style="position:absolute;left:-28px;top:4px;width:12px;height:12px;border-radius:50%;background:${event.achieved ? 'var(--accent-emerald)' : 'var(--bg-elevated)'};border:2px solid ${event.achieved ? 'var(--accent-emerald)' : 'var(--border-medium)'};"></div>
            ${i < getTimelineEvents().length - 1 ? '<div style="position:absolute;left:-23px;top:20px;bottom:0;width:2px;background:var(--border-subtle);"></div>' : ''}
            <div style="font-size:14px;font-weight:600;color:${event.achieved ? 'var(--text-primary)' : 'var(--text-muted)'};">${event.title}</div>
            <div style="font-size:12px;color:var(--text-muted);">${event.desc}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Actions -->
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">Exportar Progreso</span></div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">Guarda un backup de todos tus datos.</p>
        <button class="btn btn-primary" onclick="Store.export(APP)">Descargar Backup</button>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Reiniciar Sistema</span></div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">Cuidado: esto borra todo el progreso.</p>
        <button class="btn btn-danger" onclick="resetAll()">Reiniciar Todo</button>
      </div>
    </div>
  `;
}

function getIdentityMessage(level) {
  const messages = {
    1: 'Estás despertando. El primer paso es el más importante. Cada decisión cuenta.',
    2: 'Eres consciente de lo que necesitas cambiar. Eso ya te pone adelante.',
    3: 'Has tomado la decisión. Ahora es cuestión de ejecución diaria.',
    4: 'La disciplina se está convirtiendo en hábito. Sigue construyendo.',
    5: 'Tu enfoque está afilado. Los resultados empiezan a hablar por ti.',
    6: 'Eres imparable. Nada te detiene cuando decides avanzar.',
    7: 'Guerrero. Has luchado batallas internas y has ganado.',
    8: 'Piensas estratégicamente. No solo reaccionas, planificas y ejecutas.',
    9: 'Maestría en proceso. Tu disciplina inspira a otros.',
    10: 'Leyenda. Has demostrado que la transformación total es posible.'
  };
  return messages[level] || messages[1];
}

function getTimelineEvents() {
  const day = Utils.currentDay(APP.startDate);
  return [
    { title: 'Día 1 — El Despertar', desc: 'Decidiste cambiar tu vida', achieved: day >= 1 },
    { title: 'Día 7 — Primera Semana', desc: '7 días de consistencia', achieved: day >= 7 },
    { title: 'Día 14 — Hábitos Emergentes', desc: 'Las rutinas empiezan a solidificarse', achieved: day >= 14 },
    { title: 'Día 30 — Supervivencia Completada', desc: 'Saliste de la zona de peligro', achieved: day >= 30 },
    { title: 'Día 45 — Punto Medio', desc: 'A mitad del camino. Sin mirar atrás.', achieved: day >= 45 },
    { title: 'Día 60 — Reconstrucción Completa', desc: 'Nueva base sólida construida', achieved: day >= 60 },
    { title: 'Día 75 — Aceleración', desc: 'Todo fluye. Machine Mode activado.', achieved: day >= 75 },
    { title: 'Día 90 — Transformación Total', desc: 'Lo lograste. Nueva identidad forjada.', achieved: day >= 90 }
  ];
}

function resetAll() {
  if (confirm('¿Estás seguro? Esto borrará TODO tu progreso. Esta acción no se puede deshacer.')) {
    if (confirm('¿REALMENTE seguro? Piensa dos veces.')) {
      APP = Store.reset();
      initApp();
      showNotification('Sistema reiniciado', 'warning');
    }
  }
}

/* ═══════════════════════
   NOTIFICATIONS
   ═══════════════════════ */

function showNotification(message, type = 'info') {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();

  const colors = {
    success: 'var(--accent-emerald)',
    warning: 'var(--accent-amber)',
    error: 'var(--accent-red)',
    info: 'var(--accent-indigo)'
  };

  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 10000;
    background: var(--bg-elevated); border: 1px solid ${colors[type]};
    border-radius: 12px; padding: 14px 20px; font-size: 13px;
    color: var(--text-primary); box-shadow: 0 8px 30px rgba(0,0,0,0.4);
    animation: fadeInUp 0.3s ease; display: flex; align-items: center; gap: 10px;
    max-width: 400px;
  `;
  toast.innerHTML = `<span style="color:${colors[type]};font-size:18px;">${type === 'success' ? '✓' : type === 'warning' ? '⚠' : type === 'error' ? '✕' : 'ℹ'}</span> ${message}`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ═══════════════════════
   INIT TIMER
   ═══════════════════════ */

timerSeconds = 25 * 60;
