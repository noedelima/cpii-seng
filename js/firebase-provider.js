// =============================================================================
// SENG Demandas — Provedor Firebase (produção)
// Carregado dinamicamente apenas quando js/firebase-config.js está preenchido.
// Auth: e-mail/senha. Dados: Cloud Firestore (regras em firebase/firestore.rules).
// =============================================================================
import { api, apiLigada } from './api.js';
import { CATEGORIAS_CHAMADO, STATUS_CHAMADO_ABERTO, slaChamado, PARAMS_DEFAULT } from './config.js';
import { calcularTransparencia } from './calc.js';

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
    this._tarefas = [];
    this._logs = [];
    this._notificacoes = [];
    this._diretorio = [];
    this._chamados = [];
    this._entradas = [];
    this._params = null;
    // v1.31 (#1): ficha pública (/publicas) + documentos completos autorizados.
    this._publicas = {};
    this._completas = {};
    this._veTodasDemandas = false;
    this._agenda = null;
    this._unsubPriv = [];
    this.ready = this._init(config);
  }

  // --- Log de auditoria (gravado a cada modificação; leitura só de admin) ---
  // v1.31 (#11): identidade/horário conferidos pelas rules (nome do perfil,
  // e-mail do token, ts plausível). Pela API, o log entra no mesmo commit.
  async _log(acao, alvo, detalhes = '') {
    if (!this.user?.uid) return;
    const fs = this._F;
    try {
      await fs.addDoc(fs.collection(this.db, 'logs'), {
        ts: Date.now(), uid: this.user.uid, nome: this.user.nome || '', email: this.user.email || '',
        acao: String(acao || '').slice(0, 120), alvo: String(alvo || '').slice(0, 160),
        detalhes: String(detalhes || '').slice(0, 1000),
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
    const [appMod, auth, fs, storage] = await Promise.all([
      import(`${FB}/firebase-app.js`),
      import(`${FB}/firebase-auth.js`),
      import(`${FB}/firebase-firestore.js`),
      import(`${FB}/firebase-storage.js`),
    ]);
    this._App = appMod; this._A = auth; this._F = fs; this._St = storage;
    this._config = config;
    const app = appMod.initializeApp(config);
    this.auth = auth.getAuth(app);
    this.db = fs.getFirestore(app);
    this.storage = storage.getStorage(app);

    // Público (v1.31 — auditoria #1): a fila aberta lê a PROJEÇÃO /publicas
    // (ficha resumida). O documento completo /demandas só é lido por perfis
    // autorizados (ver _assinarPrivados) e sobrepõe a ficha na mesclagem.
    fs.onSnapshot(fs.collection(this.db, 'publicas'), (snap) => {
      this._publicas = {};
      snap.docs.forEach(d => { this._publicas[d.id] = { id: d.id, ...d.data(), _publica: true }; });
      this._mesclarDemandas();
      this._talvezSincronizarPublicas();
    }, (e) => console.warn('publicas', e));
    fs.onSnapshot(fs.doc(this.db, 'config', 'params'), (snap) => {
      this._params = snap.exists() ? snap.data() : null;
      this._emit();
    });
    // Transparência: agregados públicos de chamados (só contagens — ver Início).
    fs.onSnapshot(fs.doc(this.db, 'config', 'transparencia'), (snap) => {
      this._transparencia = snap.exists() ? snap.data() : null;
      this._emit();
    });

    await new Promise((resolve) => {
      auth.onAuthStateChanged(this.auth, async (u) => {
        this._unsubPriv.forEach(fn => fn()); this._unsubPriv = [];
        if (u) {
          const prof = await fs.getDoc(fs.doc(this.db, 'usuarios', u.uid));
          this.user = { uid: u.uid, email: u.email, ...(prof.exists() ? prof.data() : { role: 'campus', nome: u.email }) };
          this._completas = {}; this._veTodasDemandas = false; this._agenda = null;
          await this._sincronizarClaims(u);
          this._assinarPrivados();
        } else {
          this.user = null;
          this._internas = {}; this._profissionais = []; this._usuarios = []; this._tarefas = [];
          this._notificacoes = []; this._diretorio = []; this._chamados = []; this._entradas = [];
          this._completas = {}; this._veTodasDemandas = false; this._agenda = null;
          this._mesclarDemandas();
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
      this._diretorio = snap.exists() ? (snap.data().entradas || []) : [];
      this._diretorioTemUids = snap.exists() && Array.isArray(snap.data().uidsAtivos);
      this._emit();
    }, () => {}));
    const rl = this.user?.role;
    // v2.0 (ADR-004): ENTRADA ÚNICA — chamado e demanda são fases do mesmo
    // registro em /entradas. Equipe, CODIR e apoio veem todas; o campus, as
    // do(s) seu(s) campus (consultas em blocos de 10 — limite do operador `in`).
    if (['engenharia', 'estagiario', 'administrativo', 'chefe', 'codir', 'admin'].includes(rl)) {
      this._veTodasDemandas = true;
      this._unsubPriv.push(fs.onSnapshot(fs.collection(this.db, 'entradas'),
        (snap) => this._aplicarEntradas(snap.docs), (e) => console.warn('entradas', e)));
    } else if (rl === 'campus') {
      const campiD = (Array.isArray(this.user.campi) && this.user.campi.length) ? this.user.campi : (this.user.campus ? [this.user.campus] : []);
      const porBlocoD = [];
      for (let i = 0; i < campiD.length; i += 10) {
        const ix = porBlocoD.length; porBlocoD.push([]);
        this._unsubPriv.push(fs.onSnapshot(fs.query(fs.collection(this.db, 'entradas'), fs.where('campus', 'in', campiD.slice(i, i + 10))),
          (snap) => { porBlocoD[ix] = snap.docs; this._aplicarEntradas(porBlocoD.flat()); }, (e) => console.warn('entradas', e)));
      }
    }
    // Agenda interna (v1.31): saiu de config/params (público) para config/agenda.
    if (['engenharia', 'estagiario', 'administrativo', 'chefe', 'admin'].includes(rl)) {
      this._unsubPriv.push(fs.onSnapshot(fs.doc(this.db, 'config', 'agenda'), (snap) => {
        this._agenda = snap.exists() ? (snap.data().eventos || []) : null; this._emit();
      }, () => {}));
    }
    // (chamados: vista derivada de /entradas — ver _aplicarEntradas)
    // Tarefas da seção (v1.22): Eng/Chefe/Admin — erro silencioso p/ demais (rules).
    if (['engenharia', 'estagiario', 'administrativo', 'admin', 'chefe'].includes(this.user?.role)) {
      this._unsubPriv.push(fs.onSnapshot(fs.collection(this.db, 'tarefas'), (snap) => {
        this._tarefas = snap.docs.map(d => ({ id: d.id, ...d.data() })); this._emit();
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

  // --- Entrada única (v2.0 — ADR-004) ----------------------------------------
  // Vista DEMANDA: registros que já tiveram fase de demanda (`status` presente;
  // inclui os devolvidos, exibidos em Arquivados). Vista CHAMADO: registros com
  // fase de chamado; nela `status` = statusChamado e `demandaId` = o próprio id
  // quando a fase vigente é a demanda. Mesmo id, mesmos anexos/comentários/histórico.
  static vistaDemanda(e) {
    return { ...e, chamadoOrigem: e.statusChamado ? e.id : undefined };
  }
  static vistaChamado(e) {
    return { ...e, status: e.statusChamado, statusDemanda: e.status ?? null,
      demandaId: e.trilha === 'demanda' ? e.id : null };
  }
  _aplicarEntradas(docs) {
    this._entradas = docs.map(d => ({ id: d.id, ...d.data() }));
    this._completas = {};
    this._entradas.forEach(e => { if (e.status != null) this._completas[e.id] = FirebaseProvider.vistaDemanda(e); });
    this._chamados = this._entradas.filter(e => e.statusChamado != null).map(FirebaseProvider.vistaChamado);
    this._mesclarDemandas();
    this._talvezSincronizarPublicas();
    this._talvezSincronizarTransparencia();
  }

  // --- Fila pública por projeção (v1.31 — auditoria #1) ---------------------
  _mesclarDemandas() {
    const m = { ...this._publicas };
    Object.values(this._completas).forEach(d => { m[d.id] = d; });
    this._demandas = Object.values(m);
    this._emit();
  }
  // Ficha resumida aprovada pela SENG (26/10/2026). As Security Rules exigem que
  // cada campo seja IGUAL ao da demanda de origem — este método e as rules
  // precisam listar os mesmos campos.
  static CAMPOS_PUBLICOS = ['ano', 'seq', 'campus', 'objeto', 'status', 'fase', 'etapa', 'tipoDemanda',
    'projetoExiste', 'projetoOrigem', 'especialidades', 'emergencial', 'prazoEstimado', 'valorEstimado',
    'aval', 'codirAprovado', 'criadoEm', 'atualizadoEm', 'concluidoEm'];
  _projecaoPublica(d) {
    const p = {};
    FirebaseProvider.CAMPOS_PUBLICOS.forEach(k => { if (d[k] !== undefined) p[k] = d[k]; });
    p.ajusteValor = d.ajuste ? (d.ajuste.valor ?? null) : null;
    p.refDemanda = d.refs ? (d.refs.demanda ?? null) : null;   // nº antigo citado no SUAP
    return p;
  }
  // Mantém /publicas espelhando as demandas que ESTE usuário enxerga por
  // completo. Qualquer perfil ativo grava, mas as rules só aceitam espelho fiel.
  // Lotes pequenos: cada gravação consulta a origem (limite de 20 acessos por lote).
  async _talvezSincronizarPublicas() {
    if (!this.user?.uid || !this._F) return;
    if (this._syncPub) { this._syncPubPendente = true; return; }
    // serialização estável (ordem de chaves dos mapas do Firestore não é garantida)
    const est = (o) => {
      const ks = new Set();
      const walk = (x) => { if (x && typeof x === 'object') { if (!Array.isArray(x)) Object.keys(x).forEach(k => ks.add(k)); Object.values(x).forEach(walk); } };
      walk(o);
      return JSON.stringify(o, [...ks].sort());
    };
    const ops = [];
    for (const d of Object.values(this._completas)) {
      if (d.status === 'excluido' || d.status === 'devolvido' || d.trilha !== 'demanda') { if (this._publicas[d.id]) ops.push(['del', d.id]); continue; }
      const p = this._projecaoPublica(d);
      const atual = this._publicas[d.id];
      const { id: _i, _publica: _p, ...semMeta } = atual || {};
      if (!atual || est(semMeta) !== est(p)) ops.push(['set', d.id, p]);
    }
    if (this._veTodasDemandas) Object.keys(this._publicas).forEach(id => { if (!this._completas[id]) ops.push(['del', id]); });
    if (!ops.length) return;
    this._syncPub = true;
    const fs = this._F;
    try {
      for (let i = 0; i < ops.length; i += 8) {
        const lote = fs.writeBatch(this.db);
        ops.slice(i, i + 8).forEach(([op, id, p]) => op === 'del'
          ? lote.delete(fs.doc(this.db, 'publicas', id))
          : lote.set(fs.doc(this.db, 'publicas', id), p));
        await lote.commit();
      }
    } catch (e) { console.warn('sincronizar publicas', e); }
    finally {
      this._syncPub = false;
      if (this._syncPubPendente) { this._syncPubPendente = false; setTimeout(() => this._talvezSincronizarPublicas(), 0); }
    }
  }
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
    if (JSON.stringify(novo) === JSON.stringify(this._diretorio || []) && this._diretorioTemUids) return;
    const fs = this._F;
    // uidsAtivos (#2): lista de destinatários válidos conferida pelas rules.
    const uidsAtivos = novo.filter(e => e.ativo && e.uid).map(e => e.uid);
    try { await fs.setDoc(fs.doc(this.db, 'diretorio', 'atual'), { entradas: novo, uidsAtivos, atualizadoEm: Date.now() }); }
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
        tipo: it.tipo, demandaId: it.demandaId, objeto: String(it.objeto || '').slice(0, 160), texto: String(it.texto || '').slice(0, 300),
        link: it.link || '', criadoEm: base, lida: false,
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

  // Custom claims (hardening do Storage — ADR-002): garante que o ID token
  // carregue role/campi espelhando /usuarios/{uid}. As Storage rules dependem
  // disso. Caso comum (claims já corretas): custo zero — só leitura local do
  // token. Divergiu (1º acesso ou perfil alterado): sincroniza pela API e
  // renova o token. Best-effort: sem API/FB_SA_JSON, segue sem claims.
  async _sincronizarClaims(u) {
    try {
      if (!apiLigada()) return;
      const r = await u.getIdTokenResult();
      const doc = this.user || {};
      const roleDoc = doc.ativo === false ? '' : (doc.role || '');
      const campiDoc = roleDoc !== 'campus' ? []
        : (Array.isArray(doc.campi) && doc.campi.length) ? doc.campi
        : (doc.campus ? [doc.campus] : []);
      const roleTok = r.claims.role || '';
      const campiTok = Array.isArray(r.claims.campi) ? r.claims.campi : [];
      const iguais = roleTok === roleDoc
        && campiTok.length === campiDoc.length
        && campiDoc.every(c => campiTok.includes(c));
      if (iguais) return;
      await api.claimsSelf();
      await u.getIdToken(true); // força novo token já com as claims
    } catch (e) { console.warn('claims', e); }
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
  getDemanda(id) {
    return this._demandas.find(d => d.id === id)
      || this._demandas.find(d => d.refs?.demanda === id || d.refDemanda === id) || null;
  }

  // --- Chamados (intake da SENG) ------------------------------------------
  listChamados() { return this._chamados; }
  getTransparencia() { return this._transparencia || null; }
  // Publica os agregados públicos (config/transparencia) quando mudarem —
  // auto-sincronizado por chefe/admin, no mesmo padrão do diretório.
  async _talvezSincronizarTransparencia() {
    if (!['chefe', 'admin'].includes(this.user?.role)) return;
    const novo = calcularTransparencia(this._chamados, slaChamado, STATUS_CHAMADO_ABERTO);
    const { atualizadoEm: _a, ...novoSem } = novo;
    const { atualizadoEm: _b, ...atualSem } = this._transparencia || {};
    if (JSON.stringify(novoSem) === JSON.stringify(atualSem)) return;
    try { await this._F.setDoc(this._F.doc(this.db, 'config', 'transparencia'), novo); }
    catch (e) { console.warn('transparencia', e); }
  }
  getChamado(id) { return this._chamados.find(c => c.id === id) || this._chamados.find(c => c.refs?.chamado === id) || null; }
  // Número antigo (ex.: CH2026CCE003, 2026CCE05) → número novo, pela coleção pública aliases.
  async resolverAlias(antigo) {
    if (!antigo) return null;
    const local = this._entradas.find(e => e.refs?.chamado === antigo || e.refs?.demanda === antigo);
    if (local) return local.id;
    try {
      const snap = await this._F.getDoc(this._F.doc(this.db, 'aliases', String(antigo)));
      return snap.exists() ? (snap.data().id || null) : null;
    } catch { return null; }
  }
  // Próximo número da entrada: ANO + CAMPUS + sequencial de 3 dígitos, único por (ano, campus).
  _proximoId(campus) {
    const ano = new Date().getFullYear();
    const seq = Math.max(0, ...this._entradas.filter(x => x.ano === ano && x.campus === campus).map(x => x.seq || 0)) + 1;
    return { ano, seq, id: `${ano}${campus}${String(seq).padStart(3, '0')}` };
  }
  async criarChamado(c) {
    const { ano, seq, id } = this._proximoId(c.campus);
    const cat = CATEGORIAS_CHAMADO.find(k => k.id === c.categoria);
    const now = Date.now();
    // #12: autor = usuário autenticado (rules e API conferem); quem registra por
    // outra pessoa informa `solicitanteRepresentado` (campo descritivo).
    const data = { ...c, autor: { nome: this.user?.nome || '', email: this.user?.email || '', uid: this.user?.uid },
      ano, seq, trilha: 'chamado', statusChamado: 'aberto', aberturaEm: now, atualizadoEm: now, prazoLimite: now + (cat ? cat.slaDias : 15) * 86400000 };
    delete data.status;
    if (!data.solicitanteRepresentado) delete data.solicitanteRepresentado;
    if (apiLigada()) { await api.criarChamado(id, data); return id; }
    data.historico = [{ ts: now, user: this.user?.nome || 'Sistema', acao: 'Chamado aberto' }];
    await this._F.setDoc(this._F.doc(this.db, 'entradas', id), data);
    await this._log('Chamado aberto', id, c.assunto || '');
    return id;
  }
  async atualizarChamado(id, patch, evento) {
    // Vista chamado → documento: `status` do chamado é `statusChamado`.
    const p = { ...patch };
    delete p.demandaId;
    if ('status' in p) { p.statusChamado = p.status; delete p.status; }
    if (apiLigada()) return api.atualizarChamado(id, p, evento);
    const fs = this._F;
    const upd = { ...p, atualizadoEm: Date.now() };
    if (evento) upd.historico = fs.arrayUnion({ ts: Date.now(), user: this.user?.nome || 'Sistema', acao: evento });
    await fs.updateDoc(fs.doc(this.db, 'entradas', id), upd);
    await this._log('Chamado atualizado', id, evento || Object.keys(patch).join(', '));
  }

  // Anexos (Cloud Storage): chamados/{campus}/{chamadoId}/{arquivo}. As Storage
  // Rules autorizam (SENG ou campus dono) — a apiKey não abre acesso.
  async uploadAnexoChamado(chamadoId, campus, file, onProgress) {
    const st = this._St;
    const nome = String(file.name || 'arquivo').replace(/[^\w.\-]+/g, '_').slice(-80);
    const path = `entradas/${campus}/${chamadoId}/${Date.now()}_${nome}`;
    const ref = st.ref(this.storage, path);
    await new Promise((resolve, reject) => {
      const task = st.uploadBytesResumable(ref, file, { contentType: file.type || 'application/octet-stream', customMetadata: { uid: this.user.uid } });
      task.on('state_changed',
        (snap) => { if (onProgress) onProgress(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0); },
        reject, resolve);
    });
    const url = await st.getDownloadURL(ref);
    return { nome: file.name || nome, path, url, tipo: file.type || '', tamanho: file.size || 0, ts: Date.now(), por: this.user?.nome || '', porUid: this.user.uid };
  }
  async removerAnexoChamado(path) {
    if (!path) return;
    try { await this._St.deleteObject(this._St.ref(this.storage, path)); }
    catch (e) { console.warn('removerAnexoChamado', e); }
  }
  // Miniatura de anexo (JPEG pequeno, gerada no cliente) — mesmo prefixo do
  // chamado no Storage (as rules valem igual: image/jpeg, < 10 MB).
  async uploadThumbChamado(chamadoId, campus, blob, baseNome) {
    return this._uploadThumb(`entradas/${campus}/${chamadoId}`, blob, baseNome);
  }
  // Anexos de DEMANDAS (unificação dos workflows): demandas/{campus}/{id}/{arquivo}.
  async uploadAnexoDemanda(demandaId, campus, file, onProgress) {
    const st = this._St;
    const nome = String(file.name || 'arquivo').replace(/[^\w.\-]+/g, '_').slice(-80);
    const path = `entradas/${campus}/${demandaId}/${Date.now()}_${nome}`;
    const ref = st.ref(this.storage, path);
    await new Promise((resolve, reject) => {
      const task = st.uploadBytesResumable(ref, file, { contentType: file.type || 'application/octet-stream', customMetadata: { uid: this.user.uid } });
      task.on('state_changed',
        (snap) => { if (onProgress) onProgress(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0); },
        reject, resolve);
    });
    const url = await st.getDownloadURL(ref);
    return { nome: file.name || nome, path, url, tipo: file.type || '', tamanho: file.size || 0, ts: Date.now(), por: this.user?.nome || '', porUid: this.user.uid };
  }
  async uploadThumbDemanda(demandaId, campus, blob, baseNome) {
    return this._uploadThumb(`entradas/${campus}/${demandaId}`, blob, baseNome);
  }
  // --- Meu espaço (v1.20): foto de perfil e autoatendimento do profissional ---
  async uploadFotoPerfil(blob) {
    const st = this._St;
    const path = `perfis/${this.user.uid}.jpg`;
    const ref = st.ref(this.storage, path);
    await st.uploadBytesResumable(ref, blob, { contentType: 'image/jpeg' });
    return await st.getDownloadURL(ref);
  }
  async removerFotoPerfil() {
    const st = this._St;
    try { await st.deleteObject(st.ref(this.storage, `perfis/${this.user.uid}.jpg`)); }
    catch (e) { if (e?.code !== 'storage/object-not-found') throw e; }
  }
  // Atualização restrita do PRÓPRIO profissional (foto/ausências) — as Rules
  // limitam os campos e exigem o vínculo por e-mail.
  async atualizarMeuProfissional(patch, evento) {
    const fs = this._F;
    const prof = this.profissionalDoUsuario();
    if (!prof) throw new Error('Nenhum profissional vinculado ao seu e-mail.');
    await fs.updateDoc(fs.doc(this.db, 'profissionais', prof.id), patch);
    await this._log(evento || 'Perfil do profissional atualizado', prof.nome, Object.keys(patch).join(', '));
  }

  // --- Tarefas da seção (v1.22) ---------------------------------------------
  listTarefas() { return this._tarefas; }
  async criarTarefa(t) {
    const fs = this._F;
    const id = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await fs.setDoc(fs.doc(this.db, 'tarefas', id), { ...t, criadoEm: Date.now(), atualizadoEm: Date.now() });
    await this._log('Tarefa criada', t.titulo);
    return id;
  }
  async atualizarTarefa(id, patch, evento) {
    const fs = this._F;
    await fs.updateDoc(fs.doc(this.db, 'tarefas', id), { ...patch, atualizadoEm: Date.now() });
    await this._log(evento || 'Tarefa atualizada', id, Object.keys(patch).join(', '));
  }

  async _uploadThumb(prefixo, blob, baseNome) {
    const st = this._St;
    const nome = String(baseNome || 'thumb').replace(/[^\w.\-]+/g, '_').slice(-60);
    const path = `${prefixo}/${Date.now()}_${nome}.thumb.jpg`;
    const ref = st.ref(this.storage, path);
    await st.uploadBytesResumable(ref, blob, { contentType: 'image/jpeg', customMetadata: { uid: this.user.uid } });
    return { path, url: await st.getDownloadURL(ref) };
  }

  // v2.0: demanda não é criada diretamente — nasce da escalada de um chamado.
  async criarDemanda() { throw new Error('Demandas nascem da escalada de um chamado.'); }

  // Escalada (chamado → demanda, MESMO registro). Reescalada de chamado
  // devolvido volta à análise com nova deliberação (avaliação técnica mantida).
  async escalarChamado(id, classificacao, parecer = '') {
    if (apiLigada()) return api.escalar(id, classificacao, parecer);
    const fs = this._F;
    const e = this._entradas.find(x => x.id === id); if (!e) throw new Error('Registro não encontrado.');
    const now = Date.now();
    const reescalada = e.status === 'devolvido';
    const upd = { ...classificacao, trilha: 'demanda', statusChamado: 'obra', desfecho: 'obra', status: 'recebido',
      codirAprovado: false, ajuste: null, fase: null, atualizadoEm: now,
      historico: fs.arrayUnion({ ts: now, user: this.user?.nome || 'Sistema',
        acao: reescalada ? 'Reescalado para demanda — nova deliberação' : 'Escalado para demanda (fila de Obras)' }) };
    if (!e.criadoEm) upd.criadoEm = now;
    if (parecer) upd.resolucao = { texto: parecer };
    await fs.updateDoc(fs.doc(this.db, 'entradas', id), upd);
    await this._log(reescalada ? 'Chamado reescalado' : 'Chamado escalado', id, classificacao.objeto || '');
    return { id, reescalada };
  }
  // v2.0.1: demanda cadastrada direto → fase de chamado (triagem), mesmo registro.
  async converterEmChamado(id, { motivo, categoria, slaDias = 15 }) {
    if (apiLigada()) return api.converterEmChamado(id, motivo, categoria, slaDias);
    const fs = this._F;
    const e = this._entradas.find(x => x.id === id); if (!e) throw new Error('Registro não encontrado.');
    const now = Date.now();
    const sol = e.solicitante || {};
    await fs.updateDoc(fs.doc(this.db, 'entradas', id), {
      trilha: 'chamado', statusChamado: 'triagem', status: 'devolvido', statusAnterior: e.status, desfecho: null,
      assunto: String(e.objeto || 'Solicitação').slice(0, 140), categoria, urgencia: e.emergencial ? 'emergencial' : 'media',
      autor: { nome: sol.nome || this.user?.nome || '', email: sol.email || '', uid: '' },
      aberturaEm: now, prazoLimite: now + Math.min(90, Math.max(1, slaDias)) * 86400000,
      devolucao: { tipo: 'conversao', motivo: String(motivo || '').slice(0, 1000), por: this.user?.nome || '', papel: this.user?.role || '', em: now },
      atualizadoEm: now,
      historico: fs.arrayUnion({ ts: now, user: this.user?.nome || 'Sistema', acao: `Convertida em chamado (triagem) — ${motivo}`.slice(0, 300) }),
    });
    await this._log('Demanda convertida em chamado', id, motivo);
  }
  // Devolução (demanda → chamado, MESMO registro): Chefia/Admin até o
  // planejamento; CODIR na deliberação (as rules conferem). Motivo obrigatório.
  async devolverDemanda(id, motivo) {
    if (apiLigada()) return api.devolver(id, motivo);
    const fs = this._F;
    const e = this._entradas.find(x => x.id === id); if (!e) throw new Error('Registro não encontrado.');
    const now = Date.now();
    await fs.updateDoc(fs.doc(this.db, 'entradas', id), {
      trilha: 'chamado', statusChamado: 'triagem', status: 'devolvido', statusAnterior: e.status, desfecho: null,
      devolucao: { motivo: String(motivo || '').slice(0, 1000), por: this.user?.nome || '', papel: this.user?.role || '', em: now },
      atualizadoEm: now,
      historico: fs.arrayUnion({ ts: now, user: this.user?.nome || 'Sistema', acao: `Devolvida ao chamado — ${motivo}`.slice(0, 300) }),
    });
    await this._log('Demanda devolvida ao chamado', id, motivo);
  }
  async atualizarDemanda(id, patch, evento) {
    if (apiLigada()) return api.atualizarDemanda(id, patch, evento);
    const fs = this._F;
    const upd = { ...patch, atualizadoEm: Date.now() };
    if (evento) upd.historico = fs.arrayUnion({ ts: Date.now(), user: this.user?.nome || 'Sistema', acao: evento });
    await fs.updateDoc(fs.doc(this.db, 'entradas', id), upd);
    await this._log('Demanda atualizada', id, evento || Object.keys(patch).join(', '));
  }
  async excluirDemanda(id) {
    const fs = this._F;
    const d = this.getDemanda(id);
    if (d && ['atendimento', 'concluido'].includes(d.status))
      throw new Error('Demandas em atendimento ou concluídas não podem ser excluídas.');
    await fs.deleteDoc(fs.doc(this.db, 'entradas', id));
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
    if (d.statusChamado) throw new Error('Esta demanda veio de um chamado: devolva-a ao chamado em vez de excluir.');
    const expurgar = fs.Timestamp.fromMillis(Date.now() + 30 * 86400000);
    await fs.updateDoc(fs.doc(this.db, 'entradas', id), {
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
    await fs.updateDoc(fs.doc(this.db, 'entradas', id), {
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
      await fs.deleteDoc(fs.doc(this.db, 'entradas', d.id)).catch(() => {});
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
    }
    // Matrícula = identificador principal (SUAP): única entre os usuários.
    if (u.matricula && this._usuarios.some(x => x.uid !== uid && x.matricula === u.matricula))
      throw new Error('Já existe usuário com esta matrícula.');
    if (!uid) {
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
    // Claims (Storage): sincroniza o token do usuário afetado (best-effort).
    if (apiLigada()) { try { await api.claimsSync(uid); } catch (e) { console.warn('claimsSync', e); } }
    await this._log(existente ? 'Usuário atualizado' : 'Usuário criado', u.email || uid, `perfil: ${u.role}${u.ativo === false ? ' (desativado)' : ''}`);
  }

  // v1.31 (#2): o cadastro público de contas foi DESATIVADO no Firebase Auth —
  // a credencial é criada pela API (service account; somente administradores).
  async _criarCredencial(email, senha) {
    if (!senha || senha.length < 6) throw new Error('Defina uma senha inicial com ao menos 6 caracteres.');
    if (!apiLigada()) throw new Error('A criação de credenciais exige a camada de API (Azure).');
    const r = await api.criarCredencial(email.trim(), senha);
    return r.uid;
  }

  getParams() {
    // Mescla com os defaults: parâmetros novos ganham valor padrão mesmo em
    // docs de produção antigos (ex.: limites de referência). A Agenda interna
    // vem de config/agenda (v1.31) e é exposta no mesmo formato de antes.
    const p = { ...PARAMS_DEFAULT, ...(this._params || {}) };
    if (this._agenda) p.eventosAgenda = this._agenda;
    return p;
  }
  async setParams(p) {
    const { eventosAgenda, ...resto } = p || {};
    const fs = this._F;
    if (eventosAgenda !== undefined) {
      await fs.setDoc(fs.doc(this.db, 'config', 'agenda'), { eventos: eventosAgenda, atualizadoEm: Date.now() }, { merge: true });
      await this._log('Agenda atualizada', 'config/agenda', `${eventosAgenda.length} evento(s)`);
    }
    if (!Object.keys(resto).length) return;
    if (apiLigada()) return api.setParams(resto);
    await fs.setDoc(fs.doc(this.db, 'config', 'params'), resto, { merge: true });
    await this._log('Parâmetros alterados', 'config', JSON.stringify(resto));
  }
}
