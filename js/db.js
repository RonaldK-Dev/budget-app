const DB = {
  // ── Kategorien ────────────────────────────────────────────────
  async getCategories() {
    const { data, error } = await sb.from('categories')
      .select('*').eq('archiviert', false)
      .order('typ').order('sort_order');
    if (error) throw error;
    return data;
  },

  async insertCategory(cat) {
    const { data, error } = await sb.from('categories').insert(cat).select().single();
    if (error) throw error;
    return data;
  },

  async updateCategory(id, changes) {
    const { data, error } = await sb.from('categories').update(changes).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async archiveCategory(id) {
    const { error } = await sb.from('categories').update({ archiviert: true }).eq('id', id);
    if (error) throw error;
  },

  async getAllCategories() {
    const { data, error } = await sb.from('categories')
      .select('*').order('typ').order('sort_order');
    if (error) throw error;
    return data;
  },

  async deleteCategory(id) {
    const { error } = await sb.from('categories').delete().eq('id', id);
    if (error) throw error;
  },

  async countTransactionsForCategory(id) {
    const { count } = await sb.from('transactions')
      .select('id', { count: 'exact', head: true }).eq('category_id', id);
    return count ?? 0;
  },

  async hasCategories() {
    const { count } = await sb.from('categories').select('id', { count: 'exact', head: true });
    return (count ?? 0) > 0;
  },

  async seedDefaultCategories(userId) {
    const rows = [
      { user_id: userId, name: 'Miete / Wohnen',  typ: 'ausgabe',  color: '#4A90D9', icon: '🏠', sort_order: 1 },
      { user_id: userId, name: 'Lebensmittel',     typ: 'ausgabe',  color: '#5CB85C', icon: '🛒', sort_order: 2 },
      { user_id: userId, name: 'Auto / Transport', typ: 'ausgabe',  color: '#F0AD4E', icon: '🚗', sort_order: 3 },
      { user_id: userId, name: 'Versicherungen',   typ: 'ausgabe',  color: '#9B59B6', icon: '🛡️', sort_order: 4 },
      { user_id: userId, name: 'Freizeit',         typ: 'ausgabe',  color: '#E74C3C', icon: '🎉', sort_order: 5 },
      { user_id: userId, name: 'Gesundheit',       typ: 'ausgabe',  color: '#1ABC9C', icon: '💊', sort_order: 6 },
      { user_id: userId, name: 'Apps',             typ: 'ausgabe',  color: '#EC407A', icon: '📱', sort_order: 7 },
      { user_id: userId, name: 'Sonstiges',        typ: 'ausgabe',  color: '#95A5A6', icon: '📦', sort_order: 8 },
      { user_id: userId, name: 'Gehalt',           typ: 'einnahme', color: '#27AE60', icon: '💰', sort_order: 1 },
      { user_id: userId, name: 'Sonstiges',        typ: 'einnahme', color: '#7F8C8D', icon: '💸', sort_order: 2 },
    ];
    const { error } = await sb.from('categories').insert(rows);
    if (error) throw error;
  },

  // ── Buchungen ─────────────────────────────────────────────────
  async getTransactions(year, month) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const to   = new Date(year, month, 0).toISOString().slice(0, 10);
    const { data, error } = await sb.from('transactions')
      .select('*, categories(name, color, typ, icon)')
      .gte('datum', from).lte('datum', to)
      .order('datum', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getTransactionsForMonth(year, month) {
    return this.getTransactions(year, month);
  },

  // Minimaler Datensatz über einen Zeitraum – für den Saldo-Trend.
  async getTransactionsRange(fromDate, toDate) {
    const { data, error } = await sb.from('transactions')
      .select('datum, betrag, typ')
      .gte('datum', fromDate).lte('datum', toDate);
    if (error) throw error;
    return data;
  },

  async insertTransaction(tx) {
    const { data, error } = await sb.from('transactions').insert(tx).select().single();
    if (error) throw error;
    return data;
  },

  async updateTransaction(id, changes) {
    const { data, error } = await sb.from('transactions')
      .update(changes).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteTransaction(id) {
    const { error } = await sb.from('transactions').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Wiederkehrende Vorlagen ───────────────────────────────────
  async getRecurring() {
    const { data, error } = await sb.from('recurring')
      .select('*, categories(name, color)').order('name');
    if (error) throw error;
    return data;
  },

  async insertRecurring(rec) {
    const { data, error } = await sb.from('recurring').insert(rec).select().single();
    if (error) throw error;
    return data;
  },

  async updateRecurring(id, changes) {
    const { data, error } = await sb.from('recurring').update(changes).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteRecurring(id) {
    const { error } = await sb.from('recurring').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Wiederkehrende Buchungen erzeugen ─────────────────────────
  async processRecurring(userId) {
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;

    const { data: templates, error } = await sb.from('recurring').select('*').eq('aktiv', true);
    if (error || !templates?.length) return 0;

    const toInsert = [];

    for (const t of templates) {
      let y, m;
      if (t.letzter_lauf) {
        const d = new Date(t.letzter_lauf + 'T00:00:00');
        m = d.getMonth() + 2;
        y = d.getFullYear();
        if (m > 12) { m = 1; y++; }
      } else {
        y = curY; m = curM;
      }

      while (y < curY || (y === curY && m <= curM)) {
        const maxDay = new Date(y, m, 0).getDate();
        const day = Math.min(t.tag_im_monat, maxDay);
        toInsert.push({
          user_id: userId,
          datum: `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
          betrag: t.betrag,
          typ: t.typ,
          category_id: t.category_id,
          notiz: t.name,
          recurring_id: t.id
        });
        m++; if (m > 12) { m = 1; y++; }
      }

      const maxDay = new Date(curY, curM, 0).getDate();
      const day = Math.min(t.tag_im_monat, maxDay);
      await sb.from('recurring').update({
        letzter_lauf: `${curY}-${String(curM).padStart(2,'0')}-${String(day).padStart(2,'0')}`
      }).eq('id', t.id);
    }

    if (toInsert.length) {
      await sb.from('transactions').insert(toInsert);
    }
    return toInsert.length;
  }
};
