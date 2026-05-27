/* ═══════════════════════════════════════════
   LIFE OS — Utilities & Gamification Engine
   ═══════════════════════════════════════════ */

const Utils = {
  formatL(amount) {
    return 'L' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  formatPercent(value) {
    return Math.round(value) + '%';
  },

  daysBetween(d1, d2) {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return Math.floor((date2 - date1) / (1000 * 60 * 60 * 24));
  },

  today() {
    return new Date().toISOString().split('T')[0];
  },

  currentDay(startDate) {
    return Math.max(1, this.daysBetween(startDate, this.today()) + 1);
  },

  daysRemaining(startDate) {
    return Math.max(0, 90 - this.currentDay(startDate) + 1);
  },

  progressPercent(startDate) {
    return Math.min(100, (this.currentDay(startDate) / 90) * 100);
  },

  getWeekNumber(date) {
    const d = new Date(date);
    const start = new Date(d.getFullYear(), 0, 1);
    const diff = d - start + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000;
    return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
  },

  getCurrentWeekKey() {
    const d = new Date();
    const year = d.getFullYear();
    const week = this.getWeekNumber(d);
    return `${year}-W${week}`;
  },

  getWeekDates() {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  },

  getDayName(dateStr, short = true) {
    const days = short
      ? ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      : ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[new Date(dateStr + 'T12:00:00').getDay()];
  },

  getMonthName(month) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return months[month];
  },

  getPhase(day) {
    if (day <= 30) return { name: 'Fase 1: Supervivencia', range: '1-30', color: 'red' };
    if (day <= 60) return { name: 'Fase 2: Reconstrucción', range: '31-60', color: 'amber' };
    return { name: 'Fase 3: Dominio', range: '61-90', color: 'emerald' };
  }
};

/* ── XP & Gamification ── */
const XP = {
  ACTIONS: {
    HABIT_COMPLETE: 10,
    DAILY_CHECK: 5,
    CLEAN_DAY: 25,
    WORKOUT: 30,
    DEEP_WORK_HOUR: 20,
    STUDY_HOUR: 15,
    DEBT_PAYMENT: 40,
    WEEKLY_REVIEW: 50,
    IMAGE_PERFECT: 15,
    STREAK_7: 100,
    STREAK_30: 500,
    STREAK_60: 1000
  },

  LEVELS: [
    { level: 1, xp: 0, title: 'Despertar' },
    { level: 2, xp: 100, title: 'Consciente' },
    { level: 3, xp: 300, title: 'Decidido' },
    { level: 4, xp: 600, title: 'Disciplinado' },
    { level: 5, xp: 1000, title: 'Enfocado' },
    { level: 6, xp: 1500, title: 'Imparable' },
    { level: 7, xp: 2200, title: 'Guerrero' },
    { level: 8, xp: 3000, title: 'Estratega' },
    { level: 9, xp: 4000, title: 'Maestro' },
    { level: 10, xp: 5500, title: 'Leyenda' }
  ],

  getLevel(xp) {
    let current = this.LEVELS[0];
    for (const lvl of this.LEVELS) {
      if (xp >= lvl.xp) current = lvl;
      else break;
    }
    return current;
  },

  getNextLevel(xp) {
    const current = this.getLevel(xp);
    const idx = this.LEVELS.findIndex(l => l.level === current.level);
    return idx < this.LEVELS.length - 1 ? this.LEVELS[idx + 1] : null;
  },

  getLevelProgress(xp) {
    const current = this.getLevel(xp);
    const next = this.getNextLevel(xp);
    if (!next) return 100;
    const range = next.xp - current.xp;
    const progress = xp - current.xp;
    return Math.round((progress / range) * 100);
  },

  award(data, action) {
    const points = this.ACTIONS[action] || 0;
    data.profile.xp += points;
    const newLevel = this.getLevel(data.profile.xp);
    if (newLevel.level > data.profile.level) {
      data.profile.level = newLevel.level;
      return { levelUp: true, level: newLevel, points };
    }
    return { levelUp: false, points };
  }
};

/* ── Mode Calculator ── */
const ModeEngine = {
  calculate(data) {
    const scores = this.getScores(data);
    const avg = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;

    if (avg < 25) return 'survival';
    if (avg < 50) return 'recovery';
    if (avg < 75) return 'momentum';
    return 'machine';
  },

  getScores(data) {
    const financial = this.financialScore(data);
    const discipline = this.disciplineScore(data);
    const physical = this.physicalScore(data);
    const mental = this.mentalScore(data);
    const focus = this.focusScore(data);
    return { financial, discipline, physical, mental, focus };
  },

  financialScore(data) {
    const totalDebt = this.getTotalDebt(data);
    const initialDebt = data.financial.initialDebt || this.getTotalDebt(data);
    const paidOff = Math.max(0, initialDebt - totalDebt);
    const debtScore = Math.min(50, (paidOff / initialDebt) * 50);
    const savingsScore = Math.min(25, (data.financial.currentSavings / data.financial.savingsGoal) * 25);
    const noRevolvingDebt = data.financial.creditCards.every(c => c.balance <= 0) ? 25 : 0;
    return Math.round(debtScore + savingsScore + noRevolvingDebt);
  },

  getTotalDebt(data) {
    const ccDebt = data.financial.creditCards.reduce((sum, c) => sum + Math.max(0, c.balance - c.paid), 0);
    const efDebt = data.financial.extraFinancing.reduce((sum, e) => {
      const paidAmount = e.paid * e.payment;
      return sum + Math.max(0, e.total - paidAmount);
    }, 0);
    const pdDebt = data.financial.personalDebts.reduce((sum, p) => sum + (p.paid ? 0 : p.amount), 0);
    return ccDebt + efDebt + pdDebt;
  },

  disciplineScore(data) {
    const today = Utils.today();
    const dailyData = data.habits.daily[today] || {};
    const totalHabits = 6;
    const completed = Object.values(dailyData).filter(Boolean).length;
    return Math.round((completed / totalHabits) * 100);
  },

  physicalScore(data) {
    const weekKey = Utils.getCurrentWeekKey();
    const weekData = data.goals.fitness.weeks[weekKey] || { sessions: 0, extra: 0 };
    const sessionScore = Math.min(80, (weekData.sessions / 4) * 80);
    const extraScore = weekData.extra > 0 ? 20 : 0;
    return Math.round(sessionScore + extraScore);
  },

  mentalScore(data) {
    const sobriety = Math.min(40, (data.goals.sobriety.currentStreak / 30) * 40);
    const noPorn = Math.min(40, (data.goals.noPorn.currentStreak / 30) * 40);
    const learningHours = data.goals.learning.totalHours;
    const learning = Math.min(20, (learningHours / 50) * 20);
    return Math.round(sobriety + noPorn + learning);
  },

  focusScore(data) {
    const todayMinutes = (data.goals.deepWork.sessions[Utils.today()] || { minutes: 0 }).minutes;
    const dailyGoal = data.goals.deepWork.dailyGoalMinutes;
    return Math.round(Math.min(100, (todayMinutes / dailyGoal) * 100));
  }
};

/* ── Quotes ── */
const Quotes = [
  { text: "La disciplina es el puente entre las metas y los logros.", author: "Jim Rohn" },
  { text: "No cuentes los días, haz que los días cuenten.", author: "Muhammad Ali" },
  { text: "El dolor que sientes hoy será la fuerza que sentirás mañana.", author: "Anónimo" },
  { text: "Cada maestro fue alguna vez un desastre.", author: "T. Harv Eker" },
  { text: "Los límites están en tu mente.", author: "Anónimo" },
  { text: "El mejor momento para plantar un árbol fue hace 20 años. El segundo mejor es ahora.", author: "Proverbio chino" },
  { text: "Haz hoy lo que otros no quieren, para vivir mañana como otros no pueden.", author: "Anónimo" },
  { text: "No se trata de ser perfecto, sino de ser consistente.", author: "Anónimo" },
  { text: "Tu futuro se crea por lo que haces hoy, no mañana.", author: "Robert Kiyosaki" },
  { text: "La batalla más difícil es contra ti mismo.", author: "Anónimo" },
  { text: "Si cambias la forma en que miras las cosas, las cosas que miras cambian.", author: "Wayne Dyer" },
  { text: "Máquina. Sin excusas. Sin negociación.", author: "LIFE OS" },
  { text: "Un guerrero no se rinde. Se adapta y vuelve a levantarse.", author: "LIFE OS" },
  { text: "90 días pueden cambiar tu vida entera. Estás en el día correcto.", author: "LIFE OS" },
  { text: "El caos fue temporal. La disciplina es para siempre.", author: "LIFE OS" }
];

function getRandomQuote() {
  return Quotes[Math.floor(Math.random() * Quotes.length)];
}

function getDailyQuote() {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return Quotes[dayOfYear % Quotes.length];
}
