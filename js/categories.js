const Categories = {
  PALETTE: [
    '#4A90D9', '#3498DB', '#5CB85C', '#27AE60', '#1ABC9C', '#16A085',
    '#F0AD4E', '#E67E22', '#E74C3C', '#E91E63', '#9B59B6', '#8E44AD',
    '#795548', '#607D8B', '#95A5A6', '#34495E'
  ],

  ICONS: [
    '🏠', '🛒', '🍽️', '🚗', '⛽', '🛡️', '🎉', '💊', '🏥', '✈️',
    '👕', '📱', '💡', '🎁', '🐾', '📚', '☕', '🍺', '🎮', '🏋️',
    '✂️', '🔧', '🧾', '🏦', '💰', '💸', '📦', '🏷️'
  ],

  // Wird vom App-Router aufgerufen
  async render(container) {
    container.innerHTML = '<div class="placeholder"><div class="placeholder-icon">⏳</div><p class="muted">Lädt …</p></div>';
    let all;
    try {
      all = await DB.getAllCategories();
    } catch (e) {
      container.innerHTML = `<div class="placeholder"><p>Fehler: ${e.message}</p></div>`;
      return;
    }
    this._all = all;

    const active   = all.filter(c => !c.archiviert);
    const archived = all.filter(c => c.archiviert);
    const ausgaben  = active.filter(c => c.typ === 'ausgabe');
    const einnahmen = active.filter(c => c.typ === 'einnahme');

    container.innerHTML = `
      ${this._section('Ausgaben', ausgaben, 'ausgabe')}
      ${this._section('Einnahmen', einnahmen, 'einnahme')}
      ${archived.length ? this._archivedSection(archived) : ''}
    `;
    this._bind(container);
  },

  _section(title, list, typ) {
    return `
      <div class="cat-mgmt-section">
        <div class="section-title">${title}</div>
        <div class="cat-mgmt-list">
          ${list.map((c, i) => this._row(c, i, list.length)).join('') ||
            '<div class="cat-mgmt-empty">Noch keine Kategorien</div>'}
        </div>
        <button class="add-cat-btn" data-typ="${typ}">+ Kategorie hinzufügen</button>
      </div>`;
  },

  _row(c, i, total) {
    return `
      <div class="cat-mgmt-row" data-id="${c.id}">
        <span class="cat-chip" style="background:${c.color}26;color:${c.color}">${c.icon || '🏷️'}</span>
        <span class="cat-mgmt-name">${this._esc(c.name)}</span>
        <div class="cat-mgmt-actions">
          <button class="icon-btn cat-move" data-id="${c.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button class="icon-btn cat-move" data-id="${c.id}" data-dir="1" ${i === total - 1 ? 'disabled' : ''}>▼</button>
          <button class="icon-btn cat-edit" data-id="${c.id}">✎</button>
        </div>
      </div>`;
  },

  _archivedSection(list) {
    return `
      <div class="cat-mgmt-section">
        <div class="section-title">Archiviert</div>
        <div class="cat-mgmt-list">
          ${list.map(c => `
            <div class="cat-mgmt-row archived" data-id="${c.id}">
              <span class="cat-chip" style="background:${c.color}26;color:${c.color}">${c.icon || '🏷️'}</span>
              <span class="cat-mgmt-name">${this._esc(c.name)} <span class="muted">(${c.typ})</span></span>
              <div class="cat-mgmt-actions">
                <button class="icon-btn cat-restore" data-id="${c.id}" title="Wiederherstellen">↩</button>
                <button class="icon-btn cat-delete" data-id="${c.id}" title="Endgültig löschen">🗑</button>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  },

  _bind(container) {
    container.querySelectorAll('.add-cat-btn').forEach(btn =>
      btn.addEventListener('click', () => this._openModal(null, btn.dataset.typ)));

    container.querySelectorAll('.cat-edit').forEach(btn =>
      btn.addEventListener('click', () => {
        const c = this._all.find(x => x.id === btn.dataset.id);
        this._openModal(c);
      }));

    container.querySelectorAll('.cat-move').forEach(btn =>
      btn.addEventListener('click', () => this._move(btn.dataset.id, +btn.dataset.dir)));

    container.querySelectorAll('.cat-restore').forEach(btn =>
      btn.addEventListener('click', async () => {
        await DB.updateCategory(btn.dataset.id, { archiviert: false });
        await this._reload();
      }));

    container.querySelectorAll('.cat-delete').forEach(btn =>
      btn.addEventListener('click', () => this._confirmDelete(btn.dataset.id)));
  },

  async _move(id, dir) {
    const c = this._all.find(x => x.id === id);
    const list = this._all
      .filter(x => !x.archiviert && x.typ === c.typ)
      .sort((a, b) => a.sort_order - b.sort_order);
    const i = list.findIndex(x => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    // Reihenfolge neu durchnummerieren, nur geänderte schreiben
    const updates = list
      .map((x, idx) => (x.sort_order !== idx ? DB.updateCategory(x.id, { sort_order: idx }) : null))
      .filter(Boolean);
    await Promise.all(updates);
    await this._reload();
  },

  async _confirmDelete(id) {
    const count = await DB.countTransactionsForCategory(id);
    const msg = count > 0
      ? `Diese Kategorie wird von ${count} Buchung(en) verwendet. Beim Löschen verlieren diese ihre Kategorie (bleiben aber erhalten). Wirklich löschen?`
      : 'Kategorie endgültig löschen?';
    if (!confirm(msg)) return;
    await DB.deleteCategory(id);
    await this._reload();
  },

  // ── Modal (Anlegen / Bearbeiten) ──────────────────────────────
  _openModal(cat, typForNew) {
    const isEdit = !!cat;
    const typ = isEdit ? cat.typ : typForNew;
    this._selectedColor = cat?.color || this.PALETTE[0];
    this._selectedIcon  = cat?.icon  || (typ === 'einnahme' ? '💰' : '📦');

    Modal.open(`
      <div class="modal-header">
        <h2>${isEdit ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h2>
        <button class="icon-btn modal-close">✕</button>
      </div>
      <form id="cat-form" autocomplete="off">
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="cf-name" value="${isEdit ? this._esc(cat.name) : ''}"
            placeholder="z.B. Lebensmittel" required autofocus>
        </div>
        <div class="form-group">
          <label>Typ</label>
          <div class="typ-pill ${typ}">${typ === 'ausgabe' ? 'Ausgabe' : 'Einnahme'}</div>
        </div>
        <div class="form-group">
          <label>Symbol</label>
          <div class="icon-grid" id="cf-icons">
            ${this.ICONS.map(ic => `
              <button type="button" class="icon-option ${ic === this._selectedIcon ? 'selected' : ''}"
                data-icon="${ic}">${ic}</button>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label>Farbe</label>
          <div class="color-grid" id="cf-colors">
            ${this.PALETTE.map(col => `
              <button type="button" class="color-swatch ${col === this._selectedColor ? 'selected' : ''}"
                style="background:${col}" data-color="${col}"></button>`).join('')}
          </div>
        </div>
        ${isEdit ? `
          <div class="form-row gap">
            <button type="button" id="cf-archive" class="btn-danger btn-half">Archivieren</button>
            <button type="submit" class="btn-primary btn-half">Speichern</button>
          </div>` : `
          <button type="submit" class="btn-primary btn-full">Anlegen</button>`}
      </form>
    `);

    document.querySelectorAll('.icon-option').forEach(op =>
      op.addEventListener('click', () => {
        this._selectedIcon = op.dataset.icon;
        document.querySelectorAll('.icon-option').forEach(o => o.classList.toggle('selected', o === op));
      }));

    document.querySelectorAll('.color-swatch').forEach(sw =>
      sw.addEventListener('click', () => {
        this._selectedColor = sw.dataset.color;
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('selected', s === sw));
      }));

    document.getElementById('cf-archive')?.addEventListener('click', async () => {
      await DB.archiveCategory(cat.id);
      Modal.close();
      await this._reload();
    });

    document.getElementById('cat-form').addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('cf-name').value.trim();
      if (!name) return;
      try {
        if (isEdit) {
          await DB.updateCategory(cat.id, { name, color: this._selectedColor, icon: this._selectedIcon });
        } else {
          const maxSort = Math.max(-1, ...this._all
            .filter(c => c.typ === typ).map(c => c.sort_order));
          await DB.insertCategory({
            user_id: App.state.user.id,
            name, typ, color: this._selectedColor, icon: this._selectedIcon,
            sort_order: maxSort + 1
          });
        }
        Modal.close();
        await this._reload();
      } catch (err) {
        alert('Fehler: ' + err.message);
      }
    });
  },

  // Nach jeder Änderung: aktive Kategorien für Buchungs-Dropdowns
  // aktualisieren UND die Verwaltungsansicht neu zeichnen.
  async _reload() {
    App.state.categories = await DB.getCategories();
    await this.render(document.getElementById('main-content'));
  },

  _esc(s) {
    return String(s).replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
};
