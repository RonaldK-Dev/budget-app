// ── Hilfsfunktionen ───────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}
function fmtDate(s) {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(new Date(s + 'T00:00:00'));
}
function monthLabel(y, m) {
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
}
function today() { return new Date().toISOString().slice(0, 10); }

// Betrag aus Nutzereingabe robust parsen: akzeptiert Komma UND Punkt,
// behandelt "1.234,56" (DE) und "1234.56" korrekt.
function parseAmount(str) {
  let s = String(str ?? '').trim().replace(/[^\d.,-]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  return parseFloat(s);
}
// Für die Anzeige im Eingabefeld: Punkt -> Komma (deutsch)
function amountToInput(n) {
  return (n === null || n === undefined || n === '') ? '' : String(n).replace('.', ',');
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// ── App-Zustand ───────────────────────────────────────────────
const App = {
  state: {
    user: null,
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    categories: [],
    transactions: [],
    view: 'overview'
  },
  _donut: null,
  _trend: null,

  async init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    Offline.init();

    Auth.onAuthStateChange(async user => {
      if (user) await this.onLogin(user);
      else this.onLogout();
    });

    document.getElementById('btn-prev-month').addEventListener('click', () => this.shiftMonth(-1));
    document.getElementById('btn-next-month').addEventListener('click', () => this.shiftMonth(1));
    document.getElementById('fab').addEventListener('click', () => Modal.openAdd());
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') Modal.close();
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setView(btn.dataset.view));
    });
    document.getElementById('btn-logout').addEventListener('click', async () => {
      await Auth.signOut();
    });
    this.initAuthForm();
  },

  async onLogin(user) {
    this.state.user = user;
    try {
      const hasCategories = await DB.hasCategories();
      if (!hasCategories) await DB.seedDefaultCategories(user.id);
      await DB.processRecurring(user.id);
      if (Offline.isOnline()) await Offline.flush(user.id);
    } catch (e) {
      console.warn('Init-Fehler:', e.message);
    }
    await this.loadData();
    this.showScreen('app');
    this.renderHeader();
  },

  onLogout() {
    this.state.user = null;
    this.showScreen('auth');
  },

  async loadData() {
    const { year, month } = this.state;
    const [cats, txs] = await Promise.all([
      DB.getCategories(),
      DB.getTransactions(year, month)
    ]);
    this.state.categories = cats;
    this.state.transactions = txs;
    this.render();
  },

  async shiftMonth(delta) {
    let { year, month } = this.state;
    month += delta;
    if (month > 12) { month = 1; year++; }
    if (month < 1)  { month = 12; year--; }
    this.state.year = year;
    this.state.month = month;
    await this.loadData();
    this.renderHeader();
  },

  setView(v) {
    this.state.view = v;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    this.render();
  },

  render() {
    const el = document.getElementById('main-content');
    if (this.state.view !== 'overview') {
      this._donut?.destroy(); this._donut = null;
      this._trend?.destroy(); this._trend = null;
    }
    switch (this.state.view) {
      case 'overview':   el.innerHTML = Views.overview(); Views.bindOverview(); Views.renderDonut(); Views.renderTrend(); break;
      case 'recurring':  Recurring.render(el); break;
      case 'compare':    Compare.render(el); break;
      case 'categories': Categories.render(el); break;
    }
  },

  renderHeader() {
    document.getElementById('month-label').textContent = monthLabel(this.state.year, this.state.month);
  },

  showScreen(name) {
    document.getElementById('screen-auth').classList.toggle('active', name === 'auth');
    document.getElementById('screen-app').classList.toggle('active', name === 'app');
  },

  initAuthForm() {
    let mode = 'login';
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        document.getElementById('auth-submit').textContent = mode === 'login' ? 'Anmelden' : 'Registrieren';
        document.getElementById('auth-error').textContent = '';
      });
    });

    document.getElementById('auth-form').addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('auth-email').value.trim();
      const pw    = document.getElementById('auth-pw').value;
      const errEl = document.getElementById('auth-error');
      errEl.textContent = '';
      try {
        if (mode === 'login') await Auth.signIn(email, pw);
        else await Auth.signUp(email, pw);
      } catch (err) {
        errEl.textContent = err.message;
      }
    });
  }
};

// ── Views ─────────────────────────────────────────────────────
const Views = {
  _totals() {
    const txs = App.state.transactions;
    const income  = txs.filter(t => t.typ === 'einnahme').reduce((s, t) => s + +t.betrag, 0);
    const expense = txs.filter(t => t.typ === 'ausgabe').reduce((s, t) => s + +t.betrag, 0);
    return { income, expense, balance: income - expense };
  },

  overview() {
    const txs = App.state.transactions;
    if (!txs.length) {
      return `<div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>Keine Buchungen in diesem Monat.</p>
        <p class="muted">Tippe auf <strong>+</strong> um eine Buchung hinzuzufügen.</p>
      </div>`;
    }

    const { income, expense, balance } = this._totals();

    const donutCard = `
      <div class="ov-card">
        <div class="donut-wrap">
          <canvas id="donut" width="220" height="220"></canvas>
          <div class="donut-center">
            <div class="dc-row"><span class="dc-label">Einnahmen</span><span class="dc-val income">${fmt(income)}</span></div>
            <div class="dc-row"><span class="dc-label">Ausgaben</span><span class="dc-val expense">${expense > 0 ? '−' : ''}${fmt(expense)}</span></div>
            <div class="dc-row saldo"><span class="dc-label">Saldo</span><span class="dc-val ${balance >= 0 ? 'pos' : 'neg'}">${fmt(balance)}</span></div>
          </div>
        </div>
      </div>`;

    // Gruppieren nach Kategorie
    const groups = {};
    for (const tx of txs) {
      const key = tx.category_id || '__none__';
      if (!groups[key]) {
        groups[key] = {
          key,
          name:  tx.categories?.name  || 'Ohne Kategorie',
          color: tx.categories?.color || '#888',
          icon:  tx.categories?.icon  || '🏷️',
          typ:   tx.categories?.typ   || tx.typ,
          items: [], total: 0
        };
      }
      groups[key].items.push(tx);
      groups[key].total += +tx.betrag;
    }
    const all = Object.values(groups);
    const expenseGroups = all.filter(g => g.typ === 'ausgabe').sort((a, b) => b.total - a.total);
    const incomeGroups  = all.filter(g => g.typ === 'einnahme').sort((a, b) => b.total - a.total);

    const section = (label, gs, total) => gs.length ? `
      <div class="bd-section">
        <div class="bd-section-title">${label}</div>
        ${gs.map(g => this._bdGroup(g, total)).join('')}
      </div>` : '';

    const trendCollapsed = localStorage.getItem('trend_collapsed') === '1';
    const trendCard = `
      <div class="ov-card trend-card ${trendCollapsed ? 'collapsed' : ''}">
        <button type="button" class="trend-head">
          <span class="trend-title">Saldo-Verlauf</span>
          <span class="trend-right">
            <span class="trend-sub">letzte 6 Monate</span>
            <span class="trend-chevron">▾</span>
          </span>
        </button>
        <div class="trend-wrap"><canvas id="trend"></canvas></div>
      </div>`;

    return donutCard + trendCard
      + section('Ausgaben',  expenseGroups, expense)
      + section('Einnahmen', incomeGroups,  income);
  },

  _bdGroup(g, totalForTyp) {
    const pct  = totalForTyp > 0 ? Math.round(g.total / totalForTyp * 100) : 0;
    const sign = g.typ === 'ausgabe' ? '−' : '+';
    return `
      <div class="bd-group" data-id="${g.key}">
        <button type="button" class="bd-head">
          <span class="bd-icon" style="background:${g.color}26;color:${g.color}">${g.icon}</span>
          <div class="bd-main">
            <div class="bd-row1">
              <span class="bd-name">${esc(g.name)}</span>
              <span class="bd-amount ${g.typ}">${sign}${fmt(g.total)}</span>
            </div>
            <div class="bd-bar"><span style="width:${pct}%;background:${g.color}"></span></div>
          </div>
          <span class="bd-pct">${pct}%</span>
          <span class="bd-chevron">▾</span>
        </button>
        <div class="bd-items hidden">
          ${g.items.map(tx => `
            <div class="tx-row" data-id="${tx.id}">
              <span class="tx-date">${fmtDate(tx.datum)}</span>
              <span class="tx-note">${esc(tx.notiz || '—')}</span>
              <span class="tx-amount ${tx.typ}">${fmt(+tx.betrag)}</span>
              <button class="tx-edit icon-btn" data-id="${tx.id}" aria-label="Bearbeiten">✎</button>
            </div>`).join('')}
        </div>
      </div>`;
  },

  bindOverview() {
    const trendHead = document.querySelector('.trend-head');
    trendHead?.addEventListener('click', () => {
      const card = trendHead.closest('.trend-card');
      const collapsed = card.classList.toggle('collapsed');
      localStorage.setItem('trend_collapsed', collapsed ? '1' : '0');
      if (collapsed) { App._trend?.destroy(); App._trend = null; }
      else this.renderTrend();
    });

    document.querySelectorAll('.bd-head').forEach(head => {
      head.addEventListener('click', () => {
        const grp = head.closest('.bd-group');
        grp.classList.toggle('open');
        grp.querySelector('.bd-items').classList.toggle('hidden');
      });
    });
    document.querySelectorAll('.tx-edit').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        Modal.openEdit(btn.dataset.id);
      });
    });
  },

  renderDonut() {
    const ctx = document.getElementById('donut');
    if (!ctx || typeof Chart === 'undefined') return;
    App._donut?.destroy();
    const { income, expense } = this._totals();
    App._donut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Einnahmen', 'Ausgaben'],
        datasets: [{
          data: [income, expense],
          backgroundColor: ['#34d399', '#fb7185'],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        cutout: '78%',
        responsive: false,
        animation: { duration: 500 },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${fmt(c.parsed)}` } }
        }
      }
    });
  },

  async renderTrend() {
    const ctx = document.getElementById('trend');
    if (!ctx || typeof Chart === 'undefined') return;
    if (ctx.closest('.trend-card')?.classList.contains('collapsed')) return;
    App._trend?.destroy();

    // Die letzten 6 Monate bis zum aktuell gewählten Monat
    const months = [];
    let y = App.state.year, m = App.state.month;
    for (let i = 0; i < 6; i++) { months.unshift({ y, m }); m--; if (m < 1) { m = 12; y--; } }
    const key = (yy, mm) => `${yy}-${String(mm).padStart(2, '0')}`;

    const first = months[0];
    const last  = months[5];
    const fromDate = `${key(first.y, first.m)}-01`;
    const toDate   = new Date(last.y, last.m, 0).toISOString().slice(0, 10);

    let rows;
    try { rows = await DB.getTransactionsRange(fromDate, toDate); }
    catch (e) { console.warn('Trend-Fehler:', e.message); return; }

    const saldo = {};
    months.forEach(mm => saldo[key(mm.y, mm.m)] = 0);
    for (const r of rows) {
      const k = r.datum.slice(0, 7);
      if (k in saldo) saldo[k] += (r.typ === 'einnahme' ? +r.betrag : -+r.betrag);
    }

    const labels = months.map(mm => new Intl.DateTimeFormat('de-DE', { month: 'short' }).format(new Date(mm.y, mm.m - 1, 1)));
    const data   = months.map(mm => saldo[key(mm.y, mm.m)]);

    const g = ctx.getContext('2d').createLinearGradient(0, 0, 0, 150);
    g.addColorStop(0, 'rgba(52,211,153,.30)');
    g.addColorStop(1, 'rgba(52,211,153,0)');

    const compact = v => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v);

    App._trend = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{
        data, borderColor: '#34d399', backgroundColor: g, fill: true,
        tension: .35, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5,
        pointBackgroundColor: '#34d399'
      }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ' ' + fmt(c.parsed.y) } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#8e8e98', font: { size: 11 } } },
          y: { grid: { color: 'rgba(255,255,255,.06)' }, ticks: { color: '#8e8e98', font: { size: 11 }, maxTicksLimit: 4, callback: compact } }
        }
      }
    });
  }

};

// ── Modal (Buchung) ───────────────────────────────────────────
const Modal = {
  _selCat: null,

  open(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.querySelector('.modal-close')?.addEventListener('click', () => this.close());
  },

  close() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  _categoryTiles(typ, selId) {
    const tiles = App.state.categories
      .filter(c => c.typ === typ)
      .map(c => `
        <button type="button" class="cat-tile ${c.id === selId ? 'selected' : ''}"
          data-id="${c.id}" style="--c:${c.color}">
          <span class="cat-tile-icon">${c.icon || '🏷️'}</span>
          <span class="cat-tile-name">${esc(c.name)}</span>
        </button>`).join('');
    return tiles || '<p class="muted tiles-empty">Keine Kategorien dieses Typs – lege zuerst eine an.</p>';
  },

  _form(tx) {
    const isEdit = !!tx;
    const defTyp = tx?.typ || 'ausgabe';
    const defCat = tx?.category_id || App.state.categories.find(c => c.typ === defTyp)?.id || null;
    this._selCat = defCat;

    return `
      <div class="modal-header">
        <h2>${isEdit ? 'Buchung bearbeiten' : 'Neue Buchung'}</h2>
        <button class="icon-btn modal-close">✕</button>
      </div>
      <form id="tx-form" autocomplete="off">
        <div class="type-toggle">
          <button type="button" class="type-btn ${defTyp === 'ausgabe' ? 'active' : ''}" data-typ="ausgabe">Ausgabe</button>
          <button type="button" class="type-btn ${defTyp === 'einnahme' ? 'active' : ''}" data-typ="einnahme">Einnahme</button>
        </div>
        <div class="form-group amount-group">
          <input type="text" id="f-betrag" inputmode="decimal"
            value="${tx ? amountToInput(tx.betrag) : ''}" placeholder="0,00 €" required autofocus>
        </div>
        <div class="form-group">
          <label>Kategorie</label>
          <div class="cat-tiles" id="f-cat-tiles">${this._categoryTiles(defTyp, defCat)}</div>
        </div>
        <div class="form-group">
          <label>Datum</label>
          <input type="date" id="f-datum" value="${tx?.datum || today()}" required>
        </div>
        <div class="form-group">
          <label>Notiz <span class="muted">(optional)</span></label>
          <input type="text" id="f-notiz" value="${tx ? esc(tx.notiz || '') : ''}" placeholder="z.B. REWE, Tankstelle …">
        </div>
        ${isEdit ? `
          <div class="form-row gap">
            <button type="button" id="f-delete" class="btn-danger btn-half">Löschen</button>
            <button type="submit" class="btn-primary btn-half">Speichern</button>
          </div>` : `
          <button type="submit" class="btn-primary btn-full">Speichern</button>`}
      </form>`;
  },

  _bindTiles(wrap) {
    wrap.querySelectorAll('.cat-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        this._selCat = tile.dataset.id;
        wrap.querySelectorAll('.cat-tile').forEach(t => t.classList.toggle('selected', t === tile));
      });
    });
  },

  _bind(editId) {
    const tx0 = editId ? App.state.transactions.find(t => t.id === editId) : null;
    let currentTyp = tx0?.typ || 'ausgabe';

    const tilesWrap = document.getElementById('f-cat-tiles');
    this._bindTiles(tilesWrap);

    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTyp = btn.dataset.typ;
        document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b === btn));
        this._selCat = App.state.categories.find(c => c.typ === currentTyp)?.id || null;
        tilesWrap.innerHTML = this._categoryTiles(currentTyp, this._selCat);
        this._bindTiles(tilesWrap);
      });
    });

    document.getElementById('f-delete')?.addEventListener('click', async () => {
      if (!confirm('Buchung wirklich löschen?')) return;
      await DB.deleteTransaction(editId);
      this.close();
      await App.loadData();
    });

    document.getElementById('tx-form').addEventListener('submit', async e => {
      e.preventDefault();
      const betrag = parseAmount(document.getElementById('f-betrag').value);
      if (!(betrag > 0)) { alert('Bitte einen gültigen Betrag eingeben (z. B. 12,50).'); return; }
      const payload = {
        betrag,
        typ:         currentTyp,
        category_id: this._selCat || null,
        datum:       document.getElementById('f-datum').value,
        notiz:       document.getElementById('f-notiz').value.trim() || null
      };
      try {
        if (editId) {
          await DB.updateTransaction(editId, payload);
        } else if (Offline.isOnline()) {
          await DB.insertTransaction({ ...payload, user_id: App.state.user.id });
        } else {
          Offline.add({ op: 'insert_transaction', ...payload, user_id: App.state.user.id });
        }
        this.close();
        await App.loadData();
      } catch (err) {
        alert('Fehler: ' + err.message);
      }
    });
  },

  openAdd() {
    this.open(this._form(null));
    this._bind(null);
  },

  openEdit(id) {
    const tx = App.state.transactions.find(t => t.id === id);
    if (!tx) return;
    this.open(this._form(tx));
    this._bind(id);
  }
};

App.init();
