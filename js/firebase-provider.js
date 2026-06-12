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
    this._params = null;
    this._unsubPriv = [];
    this.ready = this._init(config);
  }

  async _init(config) {
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import(`${FB}/firebase-app.js`),
      import(`${FB}/firebase-auth.js`),
      import(`${FB}/firebase-firestore.js`),
    ]);
    this._A = auth; this._F = fs;
    const app = initializeApp(config);
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
    if (this.user?.role === 'admin') {
      this._unsubPriv.push(fs.onSnapshot(fs.collection(this.db, 'usuarios'), (snap) => {
        this._usuarios = snap.docs.map(d => ({ uid: d.id, ...d.data() })); this._emit();
      }, () => {}));
    }
  }

  _emit() { this._subs.forEach(cb => { try { cb(); } catch (e) { console.error(e); } }); }
  subscribe(cb) { this._subs.add(cb); return () => this._subs.delete(cb); }

  async login(email, senha) {
    await this._A.signInWithEmailAndPassword(this.auth, email.trim(), senha);
    return this.user;
  }
  async logout() { await this._A.signOut(this.auth); }

  listDemandas() { return this._demandas; }
  getDemanda(id) { return this._demandas.find(d => d.id === id) || null; }

  async criarDemanda(d) {
    const fs = this._F;
    const ano = this.getParams().anoPlano;
    const seq = Math.max(0, ...this._demandas.filter(x => x.ano === ano && x.campus === d.campus).map(x => x.seq || 0)) + 1;
    const id = `${ano}${d.campus}${String(seq).padStart(2, '0')}`;
    await fs.setDoc(fs.doc(this.db, 'demandas', id),
      { ...d, ano, seq, criadoEm: Date.now(), atualizadoEm: Date.now() });
    return id;
  }
  async atualizarDemanda(id, patch, evento) {
    const fs = this._F;
    const upd = { ...patch, atualizadoEm: Date.now() };
    if (evento) upd.historico = fs.arrayUnion({ ts: Date.now(), user: this.user?.nome || 'Sistema', acao: evento });
    await fs.updateDoc(fs.doc(this.db, 'demandas', id), upd);
  }
  async excluirDemanda(id) {
    const fs = this._F;
    await fs.deleteDoc(fs.doc(this.db, 'demandas', id));
    await fs.deleteDoc(fs.doc(this.db, 'internas', id)).catch(() => {});
  }

  getInternas() { return this._internas; }
  async setInterna(id, patch) {
    const fs = this._F;
    await fs.setDoc(fs.doc(this.db, 'internas', id), patch, { merge: true });
  }

  listProfissionais() { return this._profissionais; }
  async salvarProfissional(p) {
    const fs = this._F;
    if (p.id) { const { id, ...rest } = p; await fs.setDoc(fs.doc(this.db, 'profissionais', id), rest, { merge: true }); return id; }
    const ref = await fs.addDoc(fs.collection(this.db, 'profissionais'), p);
    return ref.id;
  }

  listUsuarios() { return this._usuarios; }
  // Criação de usuários em produção: criar credencial no console do Firebase
  // (Authentication → Users) e o perfil correspondente em /usuarios/{uid}.
  async salvarUsuario(u) {
    const fs = this._F;
    if (!u.uid) throw new Error('Em produção, crie a credencial no console do Firebase e informe o UID (firebase/SETUP.md).');
    const { uid, senha, ...rest } = u;
    await fs.setDoc(fs.doc(this.db, 'usuarios', uid), rest, { merge: true });
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
  }
}
