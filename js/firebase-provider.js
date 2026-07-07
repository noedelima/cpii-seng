// =============================================================================
// SENG Demandas — Provedor Firebase (produção)
// Carregado dinamicamente apenas quando js/firebase-config.js está preenchido.
// Auth: e-mail/senha. Dados: Cloud Firestore (regras em firebase/firestore.rules).
// =============================================================================
import { api, apiLigada } from './api.js';
import { CATEGORIAS_CHAMADO } from './config.js';

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
    this._notificacoes = [];
    this._diretorio = [];
    this._chamados = [];
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
          this._notificacoes = []; this._diretorio = []; this._chamados = [];
        }
        this._emit();
        resolve();
      });
    });
  }

  _assinarPrivados() {
    const fs = this._F;
    const uid = this.user.uid;
    this._unsubPriv.push(fs.onSnapshot(fs.collection(this.db, 'internas'), (snap) => {
      this._internas = {}; snap.docs.forEach(d => { this._internas[d.id] = d.data(); }); this._emit();
    }, () => {}));
    this._unsubPriv.push(fs.onSnapshot(fs.collection(this.db, 'profissionais'), (snap) => {
      this._profissionais = snap.docs.map(d => ({ id: d.id, ...d.data() })); this._emit(); this._talvezSincronizarDiretorio();
    }, () => {}));
    // Inbox pessoal: apenas as notificações destinadas a mim (regra reforça no servidor).
    this._unsubPriv.push(fs.onSnapshot(fs.query(fs.collection(this.db, 'notificacoes'), fs.where('para', '==', uid)), (snap) => {
      this._notificacoes = snap.docs.map(d => ({ id: d.id, ...d.data() })); this._emit();
    }, () => {}));
    // Diretório de roteamento (sem nomes) — todo perfil lê; só chefe/admin grava.
    this._unsubPriv.push(fs.onSnapshot(fs.doc(this.db, 'diretorio', 'atual'), (snap) => {
      this._diretorio = snap.exists() ? (snap.data().entradas || []) : []; this._emit();
    }, () => {}));
    // chamados: interno vê todos; campus vê os do(s) seu(s) campus.
    const rl = this.user?.role;
    if (['engenharia', 'chefe', 'codir', 'admin'].includes(rl)) {
      this._unsubPriv.push(fs.onSnapshot(fs.collection(this.db, 'chamados'), (snap) => {
        this._chamados = snap.docs.map(d => ({ id: d.id, ...d.data() })); this._emit();
      }, () => {}));
    } else if (rl === 'campus') {
      const campi = (Array.isArray(this.user.campi) && this.user.campi.length) ? this.user.campi : (this.user.campus ? [this.user.campus] : []);
      if (campi.length) this._unsubPriv.push(fs.onSnapshot(fs.query(fs.collection(this.db, 'chamados'), fs.where('campus', 'in', campi.slice(0, 10))), (snap) => {
        this._chamados = snap.docs.map(d => ({ id: d.id, ...d.data() })); this._emit();
      }, () => {}));
    }
    if (['admin', 'chefe'].includes(this.user?.role)) {
      this._unsubPriv.push(fs.onSnapshot(fs.collection(this.db, 'usuarios'), (snap) => {
        this._usuarios = snap.docs.map(d => ({ uid: d.id, ...d.data() })); this._emit(); this._talvezSincronizarDiretorio();
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

  // --- Notificações + diretório de roteamento -----------------------------
  _montarDiretorio() {
    const porEmail = {};
    this._profissionais.forEach(p => { if (p.email) porEmail[p.email.toLowerCase()] = p; });
    return this._usuarios.map(u => {
      const p = porEmail[(u.email || '').toLowerCase()];
      const profAtivo = p && p.ativo !== false;
      const campi = Array.isArray(u.campi) && u.campi.length ? u.campi : (u.campus ? [u.campus] : []);
      return { uid: u.uid, role: u.role, ativo: u.ativo !== false, pid: profAtivo ? (p.id || null) : null, disc: profAtivo ? (p.area || null) : null, campi };
    });
  }
  getDiretorio() {
    // Chefe/Admin têm usuários+profissionais ao vivo → diretório preciso;
    // demais perfis usam o diretório armazenado (sem nomes).
    if (['admin', 'chefe'].includes(this.user?.role) && this._usuarios.length) return this._montarDiretorio();
    return this._diretorio || [];
  }
  async _talvezSincronizarDiretorio() {
    if (!['admin', 'chefe'].includes(this.user?.role) || !this._usuarios.length) return;
    const novo = this._montarDiretorio();
    if (JSON.stringify(novo) === JSON.stringify(this._diretorio || [])) return;
    const fs = this._F;
    try { await fs.setDoc(fs.doc(this.db, 'diretorio', 'atual'), { entradas: novo, atualizadoEm: Date.now() }); }
    catch (e) { console.warn('diretorio', e); }
  }
  listNotificacoes() {
    return this.user ? [...this._notificacoes].sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0)) : [];
  }
  async criarNotificacoes(itens) {
    if (!this.user || !Array.isArray(itens) || !itens.length) return;
    const fs = this._F;
    const base = Date.now();
    const batch = fs.writeBatch(this.db);
    itens.forEach(it => {
      const ref = fs.doc(fs.collection(this.db, 'notificacoes'));
      batch.set(ref, {
        para: it.para, de: this.user.uid, deNome: this.user.nome || '',
        tipo: it.tipo, demandaId: it.demandaId, objeto: it.objeto || '', texto: it.texto || '',
        criadoEm: base, lida: false,
      });
    });
    try { await batch.commit(); } catch (e) { console.warn('criarNotificacoes', e); }
  }
  async marcarNotificacaoLida(id) {
    const fs = this._F;
    try { await fs.updateDoc(fs.doc(this.db, 'notificacoes', id), { lida: true }); } catch (e) { console.warn(e); }
  }
  async marcarTodasLidas() {
    const fs = this._F;
    const naoLidas = this._notificacoes.filter(n => !n.lida);
    if (!naoLidas.length) return;
    const batch = fs.writeBatch(this.db);
    naoLidas.forEach(n => batch.update(fs.doc(this.db, 'notificacoes', n.id), { lida: true }));
    try { await batch.commit(); } catch (e) { console.warn(e); }
  }
  // Limpeza automática do próprio inbox (regras permitem o dono apagar as suas):
  // remove avisos JÁ LIDOS com mais de `dias` e o excedente acima de 300 (mais
  // recentes preservados; não lidos têm prioridade de retenção).
  async purgarNotificacoes(dias = 30) {
    const fs = this._F;
    const limite = Date.now() - dias * 86400000;
    const remover = this._notificacoes.filter(n => n.lida && (n.criadoEm || 0) < limite);
    if (this._notificacoes.length > 300) {
      const ids = new Set(remover.map(n => n.id));
      [...this._notificacoes].sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0)).slice(300)
        .forEach(n => { if (!ids.has(n.id)) { remover.push(n); ids.add(n.id); } });
    }
    if (!remover.length) return 0;
    const batch = fs.writeBatch(this.db);
    remover.slice(0, 400).forEach(n => batch.delete(fs.doc(this.db, 'notificacoes', n.id)));
    try { await batch.commit(); } catch (e) { console.warn('purgarNotificacoes', e); }
    return remover.length;
  }

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

  // --- Chamados (intake da SENG) ------------------------------------------
  listChamados() { return this._chamados; }
  getChamado(id) { return this._chamados.find(c => c.id === id) || null; }
  async criarChamado(c) {
    const ano = new Date().getFullYear();
    const seq = Math.max(0, ...this._chamados.filter(x => x.ano === ano && x.campus === c.campus).map(x => x.seq || 0)) + 1;
    const id = `CH${ano}${c.campus}${String(seq).padStart(3, '0')}`;
    const cat = CATEGORIAS_CHAMADO.find(k => k.id === c.categoria);
    const now = Date.now();
    const data = { ...c, ano, seq, status: 'aberto', aberturaEm: now, atualizadoEm: now, prazoLimite: now + (cat ? cat.slaDias : 15) * 86400000 };
    if (apiLigada()) { await api.criarChamado(id, data); return id; }
    await this._F.setDoc(this._F.doc(this.db, 'chamados', id), data);
    await this._log('Chamado aberto', id, c.assunto || '');
    return id;
  }
  async atualizarChamado(id, patch, evento) {
    if (apiLigada()) return api.atualizarChamado(id, patch, evento);
    const fs = this._F;
    const upd = { ...patch, atualizadoEm: Date.now() };
    if (evento) upd.historico = fs.arrayUnion({ ts: Date.now(), user: this.user?.nome || 'Sistema', acao: evento });
    await fs.updateDoc(fs.doc(this.db, 'chamados', id), upd);
    await this._log('Chamado atualizado', id, evento || Object.keys(patch).join(', '));
  }

  async criarDemanda(d) {
    const fs = this._F;
    const ano = this.getParams().anoPlano;
    const seq = Math.max(0, ...this._demandas.filter(x => x.ano === ano && x.campus === d.campus).map(x => x.seq || 0)) + 1;
    const id = `${ano}${d.campus}${String(seq).padStart(2, '0')}`;
    const data = { ...d, ano, seq, criadoEm: Date.now(), atualizadoEm: Date.now() };
    if (apiLigada()) { await api.criarDemanda(id, data); return id; }
    await fs.setDoc(fs.doc(this.db, 'demandas', id), data);
    await this._log('Demanda criada', id, d.objeto || '');
    return id;
  }
  async atualizarDemanda(id, patch, evento) {
    if (apiLigada()) return api.atualizarDemanda(id, patch, evento);
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
  // Arquivo morto: soft-delete recuperável; expurgarEm (Timestamp) alimenta o TTL do Firestore.
  async arquivarDemanda(id) {
    if (apiLigada()) return api.arquivar(id);
    const fs = this._F;
    const d = this.getDemanda(id); if (!d) throw new Error('Demanda não encontrada.');
    if (['atendimento', 'concluido'].includes(d.status))
      throw new Error('Demandas em atendimento ou concluídas não podem ser excluídas.');
    const expurgar = fs.Timestamp.fromMillis(Date.now() + 30 * 86400000);
    await fs.updateDoc(fs.doc(this.db, 'demandas', id), {
      statusAnterior: d.status, status: 'excluido', excluidoEm: Date.now(), expurgarEm: expurgar, atualizadoEm: Date.now(),
      historico: fs.arrayUnion({ ts: Date.now(), user: this.user?.nome || 'Sistema', acao: 'Demanda enviada ao arquivo morto (excluída)' }),
    });
    if (this._internas[id]) await fs.setDoc(fs.doc(this.db, 'internas', id), { expurgarEm: expurgar }, { merge: true }).catch(() => {});
    await this._log('Demanda arquivada (excluída)', id, d.objeto || '');
  }
  async resgatarDemanda(id) {
    if (apiLigada()) return api.resgatar(id);
    const fs = this._F;
    const d = this.getDemanda(id); if (!d) throw new Error('Demanda não encontrada.');
    await fs.updateDoc(fs.doc(this.db, 'demandas', id), {
      status: d.statusAnterior || 'recebido', statusAnterior: fs.deleteField(), excluidoEm: fs.deleteField(), expurgarEm: fs.deleteField(), atualizadoEm: Date.now(),
      historico: fs.arrayUnion({ ts: Date.now(), user: this.user?.nome || 'Sistema', acao: 'Demanda resgatada do arquivo morto' }),
    });
    if (this._internas[id]) await fs.setDoc(fs.doc(this.db, 'internas', id), { expurgarEm: fs.deleteField() }, { merge: true }).catch(() => {});
    await this._log('Demanda resgatada', id, d.objeto || '');
  }
  async purgarExcluidos(dias = 30) {
    const fs = this._F;
    const limite = Date.now() - dias * 86400000;
    const expirados = this._demandas.filter(d => d.status === 'excluido' && (d.excluidoEm || 0) < limite);
    for (const d of expirados) {
      await fs.deleteDoc(fs.doc(this.db, 'demandas', d.id)).catch(() => {});
      await fs.deleteDoc(fs.doc(this.db, 'internas', d.id)).catch(() => {});
      await this._log('Demanda removida definitivamente (arquivo morto expirado)', d.id, d.objeto || '');
    }
    return expirados.length;
  }

  getInternas() { return this._internas; }
  async setInterna(id, patch) {
    if (apiLigada()) return api.setInterna(id, patch);
    const fs = this._F;
    await fs.setDoc(fs.doc(this.db, 'internas', id), patch, { merge: true });
    await this._log('Alocação atualizada', id, Object.keys(patch).join(', '));
  }

  listProfissionais() { return this._profissionais; }
  async salvarProfissional(p) {
    const fs = this._F;
    if (p.email && this._profissionais.some(x => x.id !== p.id && (x.email || '').toLowerCase() === p.email.toLowerCase()))
      throw new Error('Já existe profissional com este e-mail.');
    if (apiLigada()) { const r = await api.salvarProfissional(p); return r.id; }
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
    if (apiLigada()) return api.setParams(p);
    const fs = this._F;
    await fs.setDoc(fs.doc(this.db, 'config', 'params'), p, { merge: true });
    await this._log('Parâmetros alterados', 'config', JSON.stringify(p));
  }
}
