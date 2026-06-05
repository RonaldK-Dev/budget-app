const Offline = {
  QUEUE_KEY: 'budget_offline_queue',

  isOnline() { return navigator.onLine; },

  getQueue() {
    try { return JSON.parse(localStorage.getItem(this.QUEUE_KEY) || '[]'); }
    catch { return []; }
  },

  add(item) {
    const q = this.getQueue();
    q.push({ ...item, _id: crypto.randomUUID(), _ts: Date.now() });
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(q));
    this._updateBadge();
  },

  remove(id) {
    const q = this.getQueue().filter(i => i._id !== id);
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(q));
    this._updateBadge();
  },

  async flush(userId) {
    const q = this.getQueue();
    if (!q.length) return 0;
    let done = 0;
    for (const item of q) {
      try {
        const { _id, _ts, op, ...payload } = item;
        if (op === 'insert_transaction') {
          await DB.insertTransaction({ ...payload, user_id: userId });
          this.remove(_id);
          done++;
        }
      } catch (e) {
        console.warn('Sync fehlgeschlagen:', e.message);
      }
    }
    return done;
  },

  _updateBadge() {
    const n = this.getQueue().length;
    const el = document.getElementById('sync-badge');
    if (el) el.textContent = n > 0 ? n : '';
  },

  init() {
    const offlineBar = document.getElementById('offline-bar');
    const update = () => {
      offlineBar?.classList.toggle('hidden', navigator.onLine);
      this._updateBadge();
    };
    window.addEventListener('online', async () => {
      update();
      if (App.state?.user) {
        const n = await this.flush(App.state.user.id);
        if (n > 0) await App.loadData();
      }
    });
    window.addEventListener('offline', update);
    update();
  }
};
