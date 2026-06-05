const Compare = {
  async render(container) {
    container.innerHTML = '<div class="placeholder"><div class="placeholder-icon">⏳</div><p class="muted">Lädt …</p></div>';

    const { year, month } = App.state;
    let py = year, pm = month - 1;
    if (pm < 1) { pm = 12; py--; }

    let cur = App.state.transactions, prev;
    try {
      prev = await DB.getTransactions(py, pm);
    } catch (e) {
      container.innerHTML = `<div class="placeholder"><p>Fehler: ${e.message}</p></div>`;
      return;
    }

    if (!cur.length && !prev.length) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📊</div>
        <p>Kein Vergleich möglich.</p>
        <p class="muted">In diesem und im Vormonat gibt es keine Buchungen.</p>
      </div>`;
      return;
    }

    const prevLabel = monthLabel(py, pm);

    // Pro-Kategorie-Map über beide Monate
    const map = {};
    const collect = (txs, field) => {
      for (const tx of txs) {
        const key = tx.category_id || '__none__';
        if (!map[key]) {
          map[key] = {
            name:  tx.categories?.name  || 'Ohne Kategorie',
            icon:  tx.categories?.icon  || '🏷️',
            color: tx.categories?.color || '#888',
            typ:   tx.categories?.typ   || tx.typ,
            cur: 0, prev: 0
          };
        }
        map[key][field] += +tx.betrag;
      }
    };
    collect(cur, 'cur');
    collect(prev, 'prev');

    const groups = Object.values(map);
    const expense = groups.filter(g => g.typ === 'ausgabe').sort((a, b) => b.cur - a.cur || b.prev - a.prev);
    const income  = groups.filter(g => g.typ === 'einnahme').sort((a, b) => b.cur - a.cur || b.prev - a.prev);

    const tc = this._totals(cur);
    const tp = this._totals(prev);

    const section = (label, gs) => gs.length ? `
      <div class="bd-section">
        <div class="bd-section-title">${label}</div>
        <div class="cmp-list">${gs.map(g => this._row(g)).join('')}</div>
      </div>` : '';

    container.innerHTML = `
      <div class="cmp-card">
        <div class="cmp-card-title">Vergleich zu ${prevLabel}</div>
        ${this._line('Einnahmen', tc.income,  tp.income,  'einnahme')}
        ${this._line('Ausgaben',  tc.expense, tp.expense, 'ausgabe')}
        ${this._line('Saldo',     tc.balance, tp.balance, 'saldo')}
      </div>
      ${section('Ausgaben',  expense)}
      ${section('Einnahmen', income)}`;
  },

  _totals(txs) {
    const income  = txs.filter(t => t.typ === 'einnahme').reduce((s, t) => s + +t.betrag, 0);
    const expense = txs.filter(t => t.typ === 'ausgabe').reduce((s, t) => s + +t.betrag, 0);
    return { income, expense, balance: income - expense };
  },

  // Differenz-Klasse: grün = günstig (Ausgabe runter / Einnahme & Saldo rauf)
  _cls(diff, typ) {
    if (diff === 0) return 'neutral';
    const favorable = typ === 'ausgabe' ? diff < 0 : diff > 0;
    return favorable ? 'good' : 'bad';
  },

  _fmtSigned(n) {
    const s = fmt(Math.abs(n));
    return n > 0 ? '+' + s : n < 0 ? '−' + s : '±' + s;
  },

  _pct(cur, prev) {
    if (prev === 0) return cur === 0 ? '±0 %' : 'neu';
    const p = Math.round((cur - prev) / prev * 100);
    return (p > 0 ? '+' : p < 0 ? '−' : '±') + Math.abs(p) + ' %';
  },

  _line(label, cur, prev, typ) {
    const diff = cur - prev;
    const cls  = this._cls(diff, typ);
    return `
      <div class="cmp-line">
        <span class="cmp-line-label">${label}</span>
        <div class="cmp-line-right">
          <span class="cmp-now">${fmt(cur)}</span>
          <span class="cmp-diff ${cls}">${this._fmtSigned(diff)} · ${this._pct(cur, prev)}</span>
        </div>
      </div>`;
  },

  _row(g) {
    const diff = g.cur - g.prev;
    const cls  = this._cls(diff, g.typ);
    return `
      <div class="cmp-row">
        <span class="bd-icon" style="background:${g.color}26;color:${g.color}">${g.icon}</span>
        <div class="cmp-main">
          <div class="cmp-row1">
            <span class="cmp-name">${esc(g.name)}</span>
            <span class="cmp-diff ${cls}">${this._fmtSigned(diff)} · ${this._pct(g.cur, g.prev)}</span>
          </div>
          <div class="cmp-row2">
            <span class="muted">jetzt ${fmt(g.cur)}</span>
            <span class="muted">Vormonat ${fmt(g.prev)}</span>
          </div>
        </div>
      </div>`;
  }
};
