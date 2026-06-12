// =============================================================================
// SENG Demandas — Camada de dados
// Dois provedores intercambiáveis:
//   • DemoProvider     → localStorage com dados fictícios (modo demonstração)
//   • FirebaseProvider → Firebase Auth + Firestore (produção)  [firebase-provider.js]
// A aplicação consome apenas a API do `store`, indiferente ao provedor.
// Toda modificação gera entrada no LOG DE AUDITORIA (visível só ao administrador).
// =============================================================================
import { PARAMS_DEFAULT } from './config.js';
import { FIREBASE_CONFIG } from './firebase-config.js';
import { seedDemo } from './seed.js';

const LS_KEY = 'seng-demandas-demo-v1';
const LS_SESSION = 'seng-demandas-sessao-v1';
const LOG_MAX = 3000;

// ---------------------------------------------------------------------------
// Provedor DEMO (localStorage)
// ---------------------------------------------------------------------------
class DemoProvider {
  constructor() {
    this.mode = 'demo';
    this.user = null;
    this._subs = new Set();
    this._load();
    const sess = sessionStorage.getItem(LS_SESSION);
    if (sess) {
      const u = this.db.usuarios.find(x => x.uid === sess);
      if (u && u.ativo !== false) this.user = this._pub(u);
    }
  }
  _load() {
    try { this.db = JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch { this.db = null; }
    if (!this.db || this.db._v !== 2) { this.db = seedDemo(); this._save(); }
    this.db.logs = this.db.logs || [];
  }
  _save() { localStorage.setItem(LS_KEY, JSON.stringify(this.db)); this._emit(); }
  _emit() { this._subs.forEach(cb => { try { cb(); } catch (e) { console.error(e); } }); }
  subscribe(cb) { this._subs.add(cb); return () => this._subs.delete(cb); }
  _pub(u) { const { senha, ...rest } = u; return rest; }

  // --- Log de auditoria (toda modificação: o quê, quando, quem) -------------
  _log(acao, alvo, detalhes = '') {
    this.db.logs.push({
      ts: Date.now(),
      uid: this.user?.uid || 'anon',
      nome: this.user?.nome || 'Sistema',
      email: this.user?.email || '',
      acao, alvo, detalhes,
    });
    if (this.db.logs.length > LOG_MAX) this.db.logs = this.db.logs.slice(-LOG_MAX);
  }
  listLogs() { return this.user?.role === 'admin' ? this.db.logs : []; }

  // --- Autenticação (somente demo: senhas locais, não usar em produção) ---
  async login(email, senha) {
    await new Promise(r => setTimeout(r, 250)); // simula latência
    const u = this.db.usuarios.find(x => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.senha !== senha) throw new Error('E-mail ou senha incorretos.');
    if (u.ativo === false) throw new Error('Usuário desativado.');
    this.user = this._pub(u);
    sessionStorage.setItem(LS_SESSION, u.uid);
    this._emit();
    return this.user;
  }
  async logout() { this.user = null; sessionStorage.removeItem(LS_SESSION); this._emit(); }

  async trocarSenha(senhaAtual, novaSenha) {
    if (!this.user) throw new Error('Sessão expirada — entre novamente.');
    if (!novaSenha || novaSenha.length < 6) throw new Error('A nova senha deve ter ao menos 6 caracteres.');
    const u = this.db.usuarios.find(x => x.uid === this.user.uid);
    if (!u || u.senha !== senhaAtual) throw new Error('Senha atual incorreta.');
    u.senha = novaSenha;
    this._log('Senha alterada', u.email);
    this._save();
  }

  // Profissional vinculado ao usuário pelo e-mail de login
  profissionalDoUsuario(user = this.user) {
    if (!user?.email) return null;
    const e = user.email.toLowerCase();
    return this.db.profissionais.find(p => (p.email || '').toLowerCase() === e) || null;
  }

  // --- Demandas ---
  listDemandas() { return this.db.demandas; }
  getDemanda(id) { return this.db.demandas.find(d => d.id === id) || null; }
  async criarDemanda(d) {
    const ano = this.db.params.anoPlano;
    const seq = Math.max(0, ...this.db.demandas.filter(x => x.ano === ano && x.campus === d.campus).map(x => x.seq || 0)) + 1;
    const id = `${ano}${d.campus}${String(seq).padStart(2, '0')}`;
    const nova = { ...d, id, ano, seq, criadoEm: Date.now(), atualizadoEm: Date.now() };
    this.db.demandas.push(nova);
    this._log('Demanda criada', id, nova.objeto || '');
    this._save(); return id;
  }
  async atualizarDemanda(id, patch, evento) {
    const d = this.getDemanda(id); if (!d) throw new Error('Demanda não encontrada.');
    Object.assign(d, patch, { atualizadoEm: Date.now() });
    if (evento) (d.historico = d.historico || []).push(this._ev(evento));
    this._log('Demanda atualizada', id, evento || Object.keys(patch).join(', '));
    this._save();
  }
  async excluirDemanda(id) {
    const d = this.getDemanda(id);
    if (d && ['atendimento', 'concluido'].includes(d.status))
      throw new Error('Demandas em atendimento ou concluídas não podem ser excluídas.');
    this.db.demandas = this.db.demandas.filter(x => x.id !== id);
    delete this.db.internas[id];
    this._log('Demanda excluída', id, d?.objeto || '');
    this._save();
  }
  _ev(texto) { return { ts: Date.now(), user: this.user ? this.user.nome : 'Sistema', acao: texto }; }

  // --- Dados internos (alocação) ---
  getInternas() { return this.user ? this.db.internas : {}; }
  async setInterna(id, patch) {
    this.db.internas[id] = { ...(this.db.internas[id] || {}), ...patch };
    this._log('Alocação atualizada', id, Object.keys(patch).join(', '));
    this._save();
  }

  // --- Profissionais ---
  listProfissionais() { return this.user ? this.db.profissionais : []; }
  async salvarProfissional(p) {
    if (p.email && this.db.profissionais.some(x => x.id !== p.id && (x.email || '').toLowerCase() === p.email.toLowerCase()))
      throw new Error('Já existe profissional com este e-mail.');
    let acao;
    if (p.id) {
      const i = this.db.profissionais.findIndex(x => x.id === p.id);
      if (i >= 0) this.db.profissionais[i] = { ...this.db.profissionais[i], ...p };
      acao = 'Profissional atualizado';
    } else {
      p.id = 'p' + Math.random().toString(36).slice(2, 9);
      this.db.profissionais.push(p);
      acao = 'Profissional criado';
    }
    this._log(acao, p.nome, p.email || '');
    this._save(); return p.id;
  }

  // --- Usuários — leitura para admin/chefe (vínculo de profissionais);
  //     gestão (escrita) apenas pelo admin. Salvaguarda: sempre ≥1 admin. ------
  listUsuarios() { return ['admin', 'chefe'].includes(this.user?.role) ? this.db.usuarios.map(u => this._pub(u)) : []; }
  async salvarUsuario(u) {
    if (this.user?.role !== 'admin') throw new Error('Apenas administradores gerenciam usuários.');
    const i = this.db.usuarios.findIndex(x => x.uid === u.uid);
    const existente = i >= 0 ? this.db.usuarios[i] : null;
    if (u.email && this.db.usuarios.some(x => x.uid !== u.uid && x.email.toLowerCase() === u.email.toLowerCase()))
      throw new Error('Já existe usuário com este e-mail.');
    if (existente && existente.role === 'admin') {
      const perdeAdmin = (u.role && u.role !== 'admin') || u.ativo === false;
      if (perdeAdmin) {
        if (existente.uid === this.user.uid)
          throw new Error('Um administrador não pode revogar o próprio perfil — somente outro administrador pode fazê-lo.');
        const outrosAdmins = this.db.usuarios.filter(x => x.uid !== existente.uid && x.role === 'admin' && x.ativo !== false);
        if (!outrosAdmins.length)
          throw new Error('Deve haver sempre ao menos um administrador ativo.');
      }
    }
    if (existente) {
      this.db.usuarios[i] = { ...existente, ...u };
      this._log('Usuário atualizado', u.email || existente.email, `perfil: ${u.role || existente.role}${u.ativo === false ? ' (desativado)' : ''}`);
    } else {
      this.db.usuarios.push({ ...u, uid: 'u' + Math.random().toString(36).slice(2, 9), senha: u.senha || 'cp2demo' });
      this._log('Usuário criado', u.email, `perfil: ${u.role}`);
    }
    this._save();
  }

  // --- Parâmetros ---
  getParams() { return { ...PARAMS_DEFAULT, ...this.db.params }; }
  async setParams(p) {
    this.db.params = { ...this.db.params, ...p };
    this._log('Parâmetros alterados', 'config', JSON.stringify(p));
    this._save();
  }

  async resetDemo() {
    localStorage.removeItem(LS_KEY);
    this.db = seedDemo();
    this._log('Dados de demonstração restaurados', 'sistema');
    this._save();
  }
}

// ---------------------------------------------------------------------------
// Seleção do provedor
// ---------------------------------------------------------------------------
let provider;
export async function initStore() {
  if (FIREBASE_CONFIG && FIREBASE_CONFIG.projectId) {
    const { FirebaseProvider } = await import('./firebase-provider.js');
    provider = new FirebaseProvider(FIREBASE_CONFIG);
    await provider.ready;
  } else {
    provider = new DemoProvider();
  }
  return provider;
}
export function store() { return provider; }
