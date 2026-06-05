const Auth = {
  async signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signUp(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  },

  async getUser() {
    const { data: { user } } = await sb.auth.getUser();
    return user;
  },

  onAuthStateChange(callback) {
    return sb.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
  }
};
