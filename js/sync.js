/* ═══════════════════════════════════════════
   LIFE OS — Firebase Cloud Sync
   ═══════════════════════════════════════════ */

const Sync = {
  db: null,
  auth: null,
  user: null,
  configured: false,
  syncing: false,
  lastSync: null,
  CONFIG_KEY: 'life-os-firebase-config',

  /* ── Config Storage ── */
  getStoredConfig() {
    try {
      const raw = localStorage.getItem(this.CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  storeConfig(config) {
    localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
  },

  /* ── Initialize Firebase ── */
  async init(config) {
    config = config || this.getStoredConfig();
    if (!config || !config.apiKey) {
      // Still render the widget so the "Activar Sync" button shows
      setTimeout(() => this._updateUI(), 100);
      return false;
    }

    try {
      if (typeof firebase === 'undefined') {
        console.warn('[Sync] Firebase SDK not loaded');
        return false;
      }
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }
      this.db = firebase.firestore();
      this.auth = firebase.auth();
      this.configured = true;

      // Listen to auth state changes
      this.auth.onAuthStateChanged(user => this._onAuthChange(user));

      this.storeConfig(config);
      this._updateUI();
      return true;
    } catch (e) {
      console.error('[Sync] Init error:', e);
      return false;
    }
  },

  /* ── Authentication ── */
  async signIn() {
    if (!this.configured) {
      showSyncModal();
      return;
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await this.auth.signInWithPopup(provider);
    } catch (e) {
      console.error('[Sync] Sign in error:', e);
      showNotification('Error al iniciar sesión con Google', 'error');
    }
  },

  async signOut() {
    if (!this.auth) return;
    try {
      await this.auth.signOut();
    } catch(e) {}
    this.user = null;
    this._updateUI();
    showNotification('Sesión cerrada. Usando datos locales.', 'info');
  },

  /* ── Cloud Push (local → cloud) ── */
  async push() {
    if (!this.configured || !this.user || !this.db) return false;
    this.syncing = true;
    this._updateUI();
    try {
      const docRef = this.db
        .collection('users').doc(this.user.uid)
        .collection('data').doc('life-os');
      await docRef.set({
        payload: JSON.stringify(APP),
        _modified: firebase.firestore.FieldValue.serverTimestamp(),
        _version: APP.version || 4
      });
      this.lastSync = new Date();
      this.syncing = false;
      this._updateUI();
      return true;
    } catch (e) {
      console.error('[Sync] Push error:', e);
      this.syncing = false;
      this._updateUI();
      showNotification('Error al guardar en la nube', 'error');
      return false;
    }
  },

  /* ── Cloud Pull (cloud → local) ── */
  async pull() {
    if (!this.configured || !this.user || !this.db) return null;
    try {
      const docRef = this.db
        .collection('users').doc(this.user.uid)
        .collection('data').doc('life-os');
      const doc = await docRef.get();
      if (!doc.exists) return null;
      const raw = doc.data()?.payload;
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('[Sync] Pull error:', e);
      return null;
    }
  },

  /* ── Auth State Handler ── */
  async _onAuthChange(user) {
    this.user = user;
    if (user) {
      showNotification(`✅ Conectado como ${user.displayName}`, 'success');
      const cloudData = await this.pull();

      if (cloudData) {
        const localXP  = APP.profile?.xp || 0;
        const cloudXP  = cloudData.profile?.xp || 0;
        const localJournal  = APP.journal?.length || 0;
        const cloudJournal  = cloudData.journal?.length || 0;

        // Pick the "more advanced" dataset by XP + journal entries
        const localScore = localXP + localJournal * 5;
        const cloudScore = cloudXP + cloudJournal * 5;

        if (cloudScore > localScore) {
          // Cloud is ahead → load cloud
          APP = Store.migrate(cloudData);
          Store.save(APP);
          const current = document.querySelector('.nav-item.active')?.dataset?.nav || 'dashboard';
          navigateTo(current);
          showNotification('☁️ Datos sincronizados desde la nube ✓', 'success');
        } else {
          // Local is ahead or equal → push local
          await this.push();
          showNotification('☁️ Datos locales guardados en la nube ✓', 'info');
        }
      } else {
        // First time: upload local data
        await this.push();
        showNotification('☁️ Backup inicial creado en la nube ✓', 'success');
      }
    }
    this._updateUI();
  },

  /* ── UI Update ── */
  _ensureWidget() {
    let el = document.getElementById('sync-widget');
    if (el) return el;
    // Create sync section dynamically if HTML doesn't have it
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return null;
    const section = document.createElement('div');
    section.style.cssText = 'margin-top:auto;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);';
    section.innerHTML = `
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#55556a;padding:0 4px;margin-bottom:8px;font-weight:600;">Sincronización</div>
      <div id="sync-widget"></div>`;
    sidebar.appendChild(section);
    return document.getElementById('sync-widget');
  },

  _updateUI() {
    const el = this._ensureWidget();
    if (!el) return;

    if (!this.configured) {
      el.innerHTML = `
        <button class="sync-btn sync-btn-setup" onclick="showSyncModal()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          Activar Sync
        </button>`;
      return;
    }

    if (!this.user) {
      el.innerHTML = `
        <button class="sync-btn sync-btn-login" onclick="Sync.signIn()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M3 21a9 9 0 0 1 18 0"/></svg>
          Conectar con Google
        </button>`;
      return;
    }

    const syncTime = this.lastSync
      ? this.lastSync.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })
      : '—';

    el.innerHTML = `
      <div class="sync-user">
        <img src="${this.user.photoURL || ''}" class="sync-avatar"
             onerror="this.style.display='none'">
        <div class="sync-info">
          <span class="sync-name">${(this.user.displayName || 'Usuario').split(' ')[0]}</span>
          <span class="sync-time ${this.syncing ? 'syncing' : ''}">
            ${this.syncing ? '⟳ Sincronizando...' : '✓ Sync ' + syncTime}
          </span>
        </div>
        <button class="sync-action-btn"
                onclick="Sync.push().then(ok => ok && showNotification('✅ Sincronizado','success'))"
                title="Sincronizar ahora">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
        <button class="sync-action-btn" onclick="Sync.signOut()" title="Cerrar sesión">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>`;
  }
};
