/* ═══════════════════════════════════════════
   LIFE OS — Data Store (LocalStorage)
   ═══════════════════════════════════════════ */

const Store = {
  KEY: 'life-os-data',
  VERSION: 2,

  defaults() {
    const startDate = '2026-05-27';
    return {
      version: this.VERSION,
      startDate,
      profile: {
        name: 'Ruben',
        xp: 0,
        level: 1,
        mode: 'survival'
      },
      financial: {
        salary: 19404,
        salarySchedule: [
          { label: 'Quincena (15 del mes)', amount: 10000 },
          { label: 'Fin de mes (Último)', amount: 9404 }
        ],
        remittance: 190,
        exchangeRate: 25,
        banks: {
          bac: 28.67,
          ficohsa: 0,
          banpais: 116
        },
        creditCards: [
          { id: 'tc-walmart', name: 'TC Walmart 5758', balance: 6313.49, paid: 0, minPayment: 0 },
          { id: 'tc-conecta', name: 'TC Conecta 5213', balance: 3537.15, paid: 0, minPayment: 0 },
          { id: 'tc-banpais-clasica', name: 'TC BanPaís Clásica', balance: 1962.40, paid: 0, minPayment: 0 },
          { id: 'tc-banpais-edu', name: 'TC BanPaís Educación', balance: 9676.35, paid: 0, minPayment: 0, cashPending: 4634.15 }
        ],
        extraFinancing: [
          { id: 'ef-1', name: 'Walmart Extra #1', payment: 878.33, total: 7026.64, remaining: 8, paid: 0, currency: 'L' },
          { id: 'ef-2', name: 'Walmart Extra #2', payment: 512.75, total: 2051.00, remaining: 4, paid: 0, currency: 'L', originalUSD: true, usdPayment: 20.51, usdTotal: 82.04 },
          { id: 'ef-3', name: 'Walmart Extra #3 (Grande)', payment: 4007.30, total: 45861.70, remaining: 15, paid: 0, currency: 'L' },
          { id: 'ef-4', name: 'Conecta Extra #1', payment: 677.06, total: 5416.48, remaining: 8, paid: 0, currency: 'L' },
          { id: 'ef-5', name: 'Conecta Extra #2', payment: 811.20, total: 3244.80, remaining: 4, paid: 0, currency: 'L' },
          { id: 'ef-6', name: 'BanPaís Edu Extra #1', payment: 602.77, total: 2760.54, remaining: 4, paid: 0, currency: 'L' },
          { id: 'ef-7', name: 'BanPaís Edu Extra #2', payment: 290.83, total: 3829.17, remaining: 16, paid: 0, currency: 'L' },
          { id: 'ef-8', name: 'BanPaís Mensual', payment: 893.60, total: 6589.71, remaining: 8, paid: 0, currency: 'L' },
          { id: 'ef-9', name: 'Deuda Laboral Walmart', payment: 1000.26, total: 24006.24, remaining: 24, paid: 0, currency: 'L', noInterest: true }
        ],
        personalDebts: [
          { id: 'pd-1', name: 'Deuda Personal', amount: 2000, dueDate: '2026-05-31', paid: false },
          { id: 'pd-2', name: 'Internet (Cancelar)', amount: 540, dueDate: '2026-06-04', paid: false }
        ],
        expenses: {
          food: 0,
          transport: 0,
          rent: 0,
          other: 0
        },
        savingsGoal: 5000,
        currentSavings: 0,
        initialDebt: null,
        monthlyPayments: []
      },
      goals: {
        sobriety: {
          name: 'Dejar Marihuana',
          startDate,
          cleanDays: [],
          relapses: [],
          currentStreak: 0,
          bestStreak: 0,
          moneySavedPerDay: 50
        },
        noPorn: {
          name: 'Dejar Pornografía',
          startDate,
          cleanDays: [],
          relapses: [],
          currentStreak: 0,
          bestStreak: 0
        },
        fitness: {
          name: 'Entrenamiento',
          weeklyGoal: 4,
          extraActivity: 1,
          weeks: {},
          totalSessions: 0
        },
        learning: {
          name: 'Aprendizaje Continuo',
          courses: [
            { id: 'google-pm', name: 'Google Project Management', totalModules: 6, completedModules: 0, hoursStudied: 0 },
            { id: 'fb-community', name: 'Facebook Community Management', totalModules: 5, completedModules: 0, hoursStudied: 0 },
            { id: 'html-mobile', name: 'HTML desde Celular', totalModules: 8, completedModules: 0, hoursStudied: 0 }
          ],
          totalHours: 0
        },
        image: {
          name: 'Imagen Personal',
          dailyChecks: {},
          items: ['Higiene completa', 'Cabello arreglado', 'Barba cuidada', 'Ropa presentable', 'Skincare']
        },
        deepWork: {
          name: 'Deep Work CMG',
          dailyGoalMinutes: 180,
          sessions: {},
          totalMinutes: 0,
          pomodorosCompleted: 0
        }
      },
      habits: {
        daily: {},
        streaks: {}
      },
      journal: [],
      weeklyReviews: []
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.defaults();
      const data = JSON.parse(raw);
      if (data.version !== this.VERSION) {
        return this.migrate(data);
      }
      return data;
    } catch (e) {
      console.warn('Store load error, using defaults', e);
      return this.defaults();
    }
  },

  save(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Store save error', e);
    }
  },

  migrate(oldData) {
    const fresh = this.defaults();
    // Preserve user progress but merge in new structure
    const merged = JSON.parse(JSON.stringify(fresh));

    // Keep profile progress
    if (oldData.profile) Object.assign(merged.profile, oldData.profile);
    if (oldData.startDate) merged.startDate = oldData.startDate;

    // Keep financial progress but add missing entries
    if (oldData.financial) {
      merged.financial.remittance = oldData.financial.remittance ?? fresh.financial.remittance;
      merged.financial.exchangeRate = oldData.financial.exchangeRate ?? fresh.financial.exchangeRate;
      merged.financial.banks = oldData.financial.banks ?? fresh.financial.banks;
      merged.financial.currentSavings = oldData.financial.currentSavings ?? 0;

      // Merge credit cards — keep paid progress
      for (const cc of merged.financial.creditCards) {
        const old = (oldData.financial.creditCards || []).find(o => o.id === cc.id);
        if (old) cc.paid = old.paid || 0;
      }

      // Merge extraFinancing — keep paid progress, add new entries
      for (const ef of merged.financial.extraFinancing) {
        const old = (oldData.financial.extraFinancing || []).find(o => o.id === ef.id);
        if (old) ef.paid = old.paid || 0;
      }

      // Merge personal debts
      for (const pd of merged.financial.personalDebts) {
        const old = (oldData.financial.personalDebts || []).find(o => o.id === pd.id);
        if (old) pd.paid = old.paid || false;
      }
    }

    // Keep goals progress
    if (oldData.goals) {
      if (oldData.goals.sobriety) Object.assign(merged.goals.sobriety, oldData.goals.sobriety);
      if (oldData.goals.noPorn) Object.assign(merged.goals.noPorn, oldData.goals.noPorn);
      if (oldData.goals.fitness) Object.assign(merged.goals.fitness, oldData.goals.fitness);
      if (oldData.goals.learning) {
        merged.goals.learning.totalHours = oldData.goals.learning.totalHours || 0;
        for (const c of merged.goals.learning.courses) {
          const old = (oldData.goals.learning.courses || []).find(o => o.id === c.id);
          if (old) { c.completedModules = old.completedModules; c.hoursStudied = old.hoursStudied; }
        }
      }
      if (oldData.goals.image) merged.goals.image.dailyChecks = oldData.goals.image.dailyChecks || {};
      if (oldData.goals.deepWork) Object.assign(merged.goals.deepWork, oldData.goals.deepWork);
    }

    // Keep habits & journal
    if (oldData.habits) merged.habits = oldData.habits;
    if (oldData.journal) merged.journal = oldData.journal;

    merged.version = this.VERSION;
    return merged;
  },

  reset() {
    localStorage.removeItem(this.KEY);
    return this.defaults();
  },

  export(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `life-os-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  import(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        this.save(data);
        callback(data);
      } catch (err) {
        alert('Error al importar archivo');
      }
    };
    reader.readAsText(file);
  }
};
