const Recurring = {
  async render(container) {
    container.innerHTML = '<div class="placeholder"><div class="placeholder-icon">⏳</div><p class="muted">Lädt …</p></div>';
    let list;
    try {
      list = await DB.getRecurring();
    } catch (e) {
      container.innerHTML = `<div class="placeholder"><p>Fehler: ${e.message}</p></div>`;
      return;
    }
    this._all = list;

    const aktiv    = list.filter(r => r.aktiv);
    const pausiert = list.filter(r => !r.aktiv);

    container.innerHTML = `
      <div class="rec-intro">
        Feste monatliche Posten werden beim Öffnen der App automatisch
        für den jeweiligen Monat gebucht.
      </div>
      <div class="cat-mgmt-section">
        <div class="section-title">Aktiv</div>
        <div class="cat-mgmt-list">
          ${aktiv.map(r => this._row(r)).join('') ||
            '<div class="cat-mgmt-empty">Noch keine Vorlagen</div>'}
        </div>
        <button class="add-cat-btn" id="rec-add">+ Wiederkehrende Buchung</button>
      </div>
      ${pausiert.length ? `
        <div class="cat-mgmt-section">
          <div class="section-title">Pausiert</div>
          <div class="cat-mgmt-list">
            ${pausiert.map(r => this._row(r)).join('')}
          </div>
        </div>` : ''}
    `;
    this._bind(container);
  },

  _row(r) {
    const sign  = r.typ === 'ausgabe' ? '−' : '+';
    const color = r.categories?.color || '#888';
    const cat   = r.categories?.name || 'Ohne Kategorie';
    return `
      <div class="rec-row ${r.aktiv ? '' : 'paused'}" data-id="${r.id}">
        <span class="cat-dot" style="background:${color}"></span>
        <div class="rec-info">
          <div class="rec-name">${this._esc(r.name)}</div>
          <div class="rec-meta">am ${r.tag_im_monat}. · ${this._esc(cat)}</div>
        </div>
        <div class="rec-right">
          <span class="rec-amount ${r.typ}">${sign}${fmt(r.betrag)}</span>
          <div class="rec-actions">
            <button class="icon-btn rec-toggle" data-id="${r.id}" title="${r.aktiv ? 'Pausieren' : 'Aktivieren'}">${r.aktiv ? '⏸' : '▶'}</button>
            <button class="icon-btn rec-edit" data-id="${r.id}">✎</button>
          </div>
        </div>
      </div>`;
  },

  _bind(container) {
    container.querySelector('#rec-add')?.addEventListener('click', () => this._openModal(null));
    container.querySelectorAll('.rec-edit').forEach(btn =>
      btn.addEventListener('click', () => this._openModal(this._all.find(r => r.id === btn.dataset.id))));
    container.querySelectorAll('.rec-toggle').forEach(btn =>
      btn.addEventListener('click', () => this._toggle(btn.dataset.id)));
  },

  async _toggle(id) {
    const r = this._all.find(x => x.id === id);
    const changes = { aktiv: !r.aktiv };
    // Beim Reaktivieren keine pausierten Monate nachbuchen:
    // letzter_lauf auf Ende Vormonat heben (aber nie zurücksetzen).
    if (!r.aktiv) {
      const prevEnd = this._prevMonthEnd();
      changes.letzter_lauf = (r.letzter_lauf && r.letzter_lauf > prevEnd) ? r.letzter_lauf : prevEnd;
    }
    await DB.updateRecurring(id, changes);
    if (!r.aktiv) await DB.processRecurring(App.state.user.id); // gerade aktiviert → ggf. Buchung erzeugen
    await this._reload();
  },

  _prevMonthEnd() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
  },

  _categoryOptions(typ, selectedId) {
    return App.state.categories
      .filter(c => c.typ === typ)
      .map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${this._esc(c.name)}</option>`)
      .join('');
  },

  _openModal(rec) {
    const isEdit = !!rec;
    let typ = rec?.typ || 'ausgabe';

    Modal.open(`
      <div class="modal-header">
        <h2>${isEdit ? 'Vorlage bearbeiten' : 'Neue wiederkehrende Buchung'}</h2>
        <button class="icon-btn modal-close">✕</button>
      </div>
      <form id="rec-form" autocomplete="off">
        <div class="type-toggle">
          <button type="button" class="type-btn ${typ === 'ausgabe' ? 'active' : ''}" data-typ="ausgabe">Ausgabe</button>
          <button type="button" class="type-btn ${typ === 'einnahme' ? 'active' : ''}" data-typ="einnahme">Einnahme</button>
        </div>
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="rf-name" value="${isEdit ? this._esc(rec.name) : ''}"
            placeholder="z.B. Miete, Gehalt, Netflix" required autofocus>
        </div>
        <div class="form-group">
          <label>Betrag (€)</label>
          <input type="text" id="rf-betrag" inputmode="decimal"
            value="${isEdit ? amountToInput(rec.betrag) : ''}" placeholder="0,00" required>
        </div>
        <div class="form-group">
          <label>Kategorie</label>
          <select id="rf-category">${this._categoryOptions(typ, rec?.category_id)}</select>
        </div>
        <div class="form-group">
          <label>Tag im Monat</label>
          <input type="number" id="rf-tag" min="1" max="28" value="${isEdit ? rec.tag_im_monat : 1}" required>
          <span class="field-hint">1–28 (sicher in jedem Monat verfügbar)</span>
        </div>
        ${isEdit ? `
          <div class="form-row gap">
            <button type="button" id="rf-delete" class="btn-danger btn-half">Löschen</button>
            <button type="submit" class="btn-primary btn-half">Speichern</button>
          </div>` : `
          <button type="submit" class="btn-primary btn-full">Anlegen</button>`}
      </form>
    `);

    const catSel = document.getElementById('rf-category');
    document.querySelectorAll('.type-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        typ = btn.dataset.typ;
        document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b === btn));
        catSel.innerHTML = this._categoryOptions(typ, null);
      }));

    document.getElementById('rf-delete')?.addEventListener('click', async () => {
      if (!confirm('Vorlage löschen? Bereits erzeugte Buchungen bleiben erhalten.')) return;
      await DB.deleteRecurring(rec.id);
      Modal.close();
      await this._reload();
    });

    document.getElementById('rec-form').addEventListener('submit', async e => {
      e.preventDefault();
      const betrag = parseAmount(document.getElementById('rf-betrag').value);
      if (!(betrag > 0)) { alert('Bitte einen gültigen Betrag eingeben (z. B. 12,50).'); return; }
      const payload = {
        name:        document.getElementById('rf-name').value.trim(),
        betrag,
        typ,
        category_id: document.getElementById('rf-category').value || null,
        tag_im_monat: parseInt(document.getElementById('rf-tag').value, 10)
      };
      if (!payload.name) return;
      try {
        if (isEdit) {
          await DB.updateRecurring(rec.id, payload);
        } else {
          await DB.insertRecurring({ ...payload, user_id: App.state.user.id, aktiv: true });
          await DB.processRecurring(App.state.user.id); // diesen Monat sofort buchen
        }
        Modal.close();
        await this._reload();
      } catch (err) {
        alert('Fehler: ' + err.message);
      }
    });
  },

  // Nach Änderungen: Vorlagen + aktuelle Monatsdaten neu laden,
  // dann diese Ansicht neu zeichnen.
  async _reload() {
    App.state.transactions = await DB.getTransactions(App.state.year, App.state.month);
    await this.render(document.getElementById('main-content'));
  },

  _esc(s) {
    return String(s).replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
};
