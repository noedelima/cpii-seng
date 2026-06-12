// =============================================================================
// SENG Demandas — Provedor Firebase (produção)
// Carregado dinamicamente apenas quando js/firebase-config.js está preenchido.
// Auth: e-mail/senha. Dados: Cloud Firestore (regras em firebase/firestore.rules).
// =============================================================================
const FB = 'https://www.gstatic.com/firebasejs/10.12.2';

export class FirebaseProvider {
  constructor(config) {
    this.mode = 'firebase';
    this.user = null;
    this._subs = new Set();
    this._demandas = [];
    this._internas = {};
    this._profissionais = [];
    this._usuarios = [];
    this._logs = [];
    this._params = null;
    this._unsubPriv = [];
    this.ready = this._init(config);
  }

  // --- Log de auditoria (gravado a cada modificação; leitura só de admin) ---
  async _log(acao, alvo, detalhes = '') {
    const fs = this._F;
    try {
      await fs.addDoc(fs.collection(this.db, 'logs'), {
        ts: Date.now(), uid: this.user?.uid || 'anon', nome: this.user?.nome || 'Sistema',
        email: this.user?.email || '', acao, alvo, detalhes,
      });
    } catch (e) { console.warn('log', e); }
  }
  listLogs() { return this.user?.role === 'admin' ? this._logs : []; }

  // Profissional vinculado ao usuário pelo e-mail de login
  profissionalDoUsuario(user = this.user) {
    if (!user?.email) return null;
    const e = user.email.toLowerCase();
    return this._profissionais.find(p => (p.email || '').toLowerCase() === e) || null;
  }

  async _init(config) {
    const [appMod, auth, fs] = await Promise.all([
      import(`${FB}/firebase-app.js`),
      import(`${FB}/firebase-auth.js`),
      import(`${FB}/firebase-firestore.js`),
    ]);
    this._App = appMod; this._A = auth; this._F = fs;
    this._config = config;
    const app = appMod.initializeApp(config);
    this.auth = auth.getAuth(app);
    this.db = fs.getFirestore(app);

    // Públicos: demandas e parâmetros
    fs.onSnapshot(fs.query(fs.collection(this.db, 'demandas')), (snap) => {
      this._demandas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      this._emit();
    });
    fs.onSnapshot(fs.doc(this.db, 'config', 'params'), (snap) => {
      this._params = snap.exists() ? snap.data() : null;
      this._emit();
    });

    await new Promise((resolve) => {
      auth.onAuthStateChanged(this.auth, async (u) => {
        this._unsubPriv.forEach(fn => fn()); this._unsubPriv = [];
        if (u) {
          const prof = await fs.getDoc(fs.doc(this.db, 'usuarios', u.uid));
          this.user = { uid: u.uid, email: u.email, ...(prof.exists() ? prof.data() : { role: 'campus', nome: u.email }) };
          this._assinarPrivados();
        } else {
          this.user = null;
          this._internas = {}; this._profissionais = []; this._usuarios = [];
        }
        this._emit();
        resolve();
      });
    });
  }

  _assinarPrivados() {
    const fs = this._F;
    this._unsubPriv.push(fs.onSnapshot(fs.collection(this.db, 'internas'), (snap) => {
      this._internas = {}; snap.docs.forEach(d => { this._internas[d.id] = d.data(); }); this._emit();
    }, () => {}));
    this._unsubPriv.push(fs.onSnapshot(fs.collection(this.db, 'profissionais'), (snap) => {
      this._profissionais = snap.docs.map(d => ({ id: d.id, ...d.data() })); this._emit();
    }, () => {}));
    if (['admin', 'chefe'].includes(this.user?.role)) {
      this._unsubPriv.push(fs.onSnapshot(fs.collection(this.db, 'usuarios'), (snap) => {
        this._usuarios = snap.docs.map(d => ({ uid: d.id, ...d.data() })); this._emit();
      }, () => {}));
    }
    if (this.user?.role === 'admin') {
      this._unsubPriv.push(fs.onSnapshot(
        fs.query(fs.collection(this.db, 'logs'), fs.orderBy('ts', 'desc'), fs.limit(500)),
        (snap) => { this._logs = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse(); this._emit(); },
        () => {}));
    }
  }

  _emit() { this._subs.forEach(cb => { try { cb(); } catch (e) { console.error(e); } }); }
  subscribe(cb) { this._subs.add(cb); return () => this._subs.delete(cb); }

  async login(email, senha) {
    await this._A.signInWithEmailAndPassword(this.auth, email.trim(), senha);
    // aguarda o onAuthStateChanged carregar o perfil de /usuarios/{uid}
    for (let i = 0; i < 50 && !this.user; i++) await new Promise(r => setTimeout(r, 100));
    return this.user;
  }
  async logout() { await this._A.signOut(this.auth); }
  async resetSenha(email) {
    if (!email) throw new Error('Informe o e-mail no campo acima.');
    await this._A.sendPasswordResetEmail(this.auth, email.trim());
  }

  // Troca de senha do próprio usuário (reautentica e atualiza)
  async trocarSenha(senhaAtual, novaSenha) {
    const u = this.auth.currentUser;
    if (!u) throw new Error('Sessão expirada — entre novamente.');
    if (!novaSenha || novaSenha.length < 6) throw new Error('A nova senha deve ter ao menos 6 caracteres.');
    const cred = this._A.EmailAuthProvider.credential(u.email, senhaAtual);
    try {
      await this._A.reauthenticateWithCredential(u, cred);
    } catch { throw new Error('Senha atual incorreta.'); }
    await this._A.updatePassword(u, novaSenha);
    await this._log('Senha alterada', u.email);
  }

  listDemandas() { return this._demandas; }
  getDemanda(id) { return this._demandas.find(d => d.id === id) || null; }

  async criarDemanda(d) {
    const fs = this._F;
    const ano = this.getParams().anoPlano;
    const seq = Math.max(0, ...this._demandas.filter(x => x.ano === ano && x.campus === d.campus).map(x => x.seq || 0)) + 1;
    const id = `${ano}${d.campus}${String(seq).padStart(2, '0')}`;
    await fs.setDoc(fs.doc(this.db, 'demandas', id),
      { ...d, ano, seq, criadoEm: Date.now(), atualizadoEm: Date.now() });
    await this._log('Demanda criada', id, d.objeto || '');
    return id;
  }
  async atualizarDemanda(id, patch, evento) {
    const fs = this._F;
    const upd = { ...patch, atualizadoEm: Date.now() };
    if (evento) upd.historico = fs.arrayUnion({ ts: Date.now(), user: this.user?.nome || 'Sistema', acao: evento });
    await fs.updateDoc(fs.doc(this.db, 'demandas', id), upd);
    await this._log('Demanda atualizada', id, evento || Object.keys(patch).join(', '));
  }
  async excluirDemanda(id) {
    const fs = this._F;
    await fs.deleteDoc(fs.doc(this.db, 'demandas', id));
    await fs.deleteDoc(fs.doc(this.db, 'internas', id)).catch(() => {});
    await this._log('Demanda excluída', id);
  }

  getInternas() { return this._internas; }
  async setInterna(id, patch) {
    const fs = this._F;
    await fs.setDoc(fs.doc(this.db, 'internas', id), patch, { merge: true });
    await this._log('Alocação atualizada', id, Object.keys(patch).join(', '));
  }

  listProfissionais() { return this._profissionais; }
  async salvarProfissional(p) {
    const fs = this._F;
    if (p.email && this._profissionais.some(x => x.id !== p.id && (x.email || '').toLowerCase() === p.email.toLowerCase()))
      throw new Error('Já existe profissional com este e-mail.');
    if (p.id) {
      const { id, ...rest } = p;
      await fs.setDoc(fs.doc(this.db, 'profissionais', id), rest, { merge: true });
      await this._log('Profissional atualizado', p.nome, p.email || '');
      return id;
    }
    const ref = await fs.addDoc(fs.collection(this.db, 'profissionais'), p);
    await this._log('Profissional criado', p.nome, p.email || '');
    return ref.id;
  }

  listUsuarios() { return this._usuarios; }
  // Criação/edição de usuários direto pela interface (sem console do Firebase).
  // A credencial é criada num app secundário para não derrubar a sessão do admin.
  // Salvaguarda: sempre ao menos um administrador ativo (ver também as rules).
  async salvarUsuario(u) {
    const fs = this._F;
    let uid = u.uid;
    const existente = uid ? this._usuarios.find(x => x.uid === uid) : null;
    if (!uid) {
      if (this._usuarios.some(x => (x.email || '').toLowerCase() === u.email.toLowerCase()))
        throw new Error('Já existe usuário com este e-mail.');
      uid = await this._criarCredencial(u.email, u.senha);
    }
    if (existente && existente.role === 'admin') {
      const perdeAdmin = (u.role && u.role !== 'admin') || u.ativo === false;
      if (perdeAdmin) {
        if (existente.uid === this.user?.uid)
          throw new Error('Um administrador não pode revogar o próprio perfil — somente outro administrador pode fazê-lo.');
        const outros = this._usuarios.filter(x => x.uid !== uid && x.role === 'admin' && x.ativo !== false);
        if (!outros.length) throw new Error('Deve haver sempre ao menos um administrador ativo.');
      }
    }
    const { uid: _u, senha: _s, ...rest } = u;
    await fs.setDoc(fs.doc(this.db, 'usuarios', uid), rest, { merge: true });
    await this._log(existente ? 'Usuário atualizado' : 'Usuário criado', u.email || uid, `perfil: ${u.role}${u.ativo === false ? ' (desativado)' : ''}`);
  }

  async _criarCredencial(email, senha) {
    if (!senha || senha.length < 6) throw new Error('Defina uma senha inicial com ao menos 6 caracteres.');
    const nome = 'sec-' + Date.now();
    const app2 = this._App.initializeApp(this._config, nome);
    try {
      const auth2 = this._A.getAuth(app2);
      const cred = await this._A.createUserWithEmailAndPassword(auth2, email.trim(), senha);
      const uid = cred.user.uid;
      await this._A.signOut(auth2);
      return uid;
    } catch (e) {
      if (e?.code === 'auth/email-already-in-use')
        throw new Error('Este e-mail já possui credencial. Edite o usuário existente ou use a redefinição de senha.');
      if (e?.code === 'auth/admin-restricted-operation')
        throw new Error('Criação de credenciais desativada no projeto (Identity Toolkit). Reative o cadastro de clientes ou crie pelo console.');
      throw e;
    } finally {
      this._App.deleteApp(app2).catch(() => {});
    }
  }

  getParams() {
    return this._params || {
      anoPlano: new Date().getFullYear() + 1, valorRef: 125451.15,
      pesoGUT: 0.75, pesoPxC: 0.25, limitePontos: 6,
    };
  }
  async setParams(p) {
    const fs = this._F;
    await fs.setDoc(fs.doc(this.db, 'config', 'params'), p, { merge: true });
    await this._log('Parâmetros alterados', 'config', JSON.stringify(p));
  }
}
