// =============================================================================
// SENG Demandas — Camada de dados
// Dois provedores intercambiáveis:
//   • DemoProvider     → localStorage com dados fictícios (modo demonstração)
//   • FirebaseProvider → Firebase Auth + Firestore (produção)  [firebase-provider.js]
// A aplicação consome apenas a API do `store`, indiferente ao provedor.
// Toda modificação gera entrada no LOG DE AUDITORIA (visível só ao administrador).
// =============================================================================
import { PARAMS_DEFAULT, CATEGORIAS_CHAMADO, STATUS_CHAMADO_ABERTO, slaChamado } from './config.js';
import { calcularTransparencia } from './calc.js';
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
    if (!this.db || this.db._v !== 3) { this.db = seedDemo(); this._save(); }
    this.db.logs = this.db.logs || [];
    this.db.notificacoes = this.db.notificacoes || []; // inbox pessoal (não destrutivo)
    this.db.chamados = this.db.chamados || [];
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
  // --- Chamados (intake da SENG) ---
  listChamados() {
    if (!this.user) return [];
    const r = this.user.role;
    if (['engenharia', 'chefe', 'codir', 'admin'].includes(r)) return this.db.chamados;
    if (r === 'campus') {
      const campi = (Array.isArray(this.user.campi) && this.user.campi.length) ? this.user.campi : (this.user.campus ? [this.user.campus] : []);
      return this.db.chamados.filter(c => campi.includes(c.campus));
    }
    return [];
  }
  getChamado(id) { return (this.db.chamados || []).find(c => c.id === id) || null; }
  async criarChamado(c) {
    const ano = new Date().getFullYear();
    const seq = Math.max(0, ...this.db.chamados.filter(x => x.ano === ano && x.campus === c.campus).map(x => x.seq || 0)) + 1;
    const id = `CH${ano}${c.campus}${String(seq).padStart(3, '0')}`;
    const cat = CATEGORIAS_CHAMADO.find(k => k.id === c.categoria);
    const now = Date.now();
    this.db.chamados.push({ ...c, id, ano, seq, status: 'aberto', aberturaEm: now, atualizadoEm: now, prazoLimite: now + (cat ? cat.slaDias : 15) * 86400000, historico: c.historico || [this._ev('Chamado aberto')] });
    this._log('Chamado aberto', id, c.assunto || '');
    this._save(); return id;
  }
  async atualizarChamado(id, patch, evento) {
    const c = this.getChamado(id); if (!c) throw new Error('Chamado não encontrado.');
    Object.assign(c, patch, { atualizadoEm: Date.now() });
    if (evento) (c.historico = c.historico || []).push(this._ev(evento));
    this._log('Chamado atualizado', id, evento || Object.keys(patch).join(', '));
    this._save();
  }
  // Demo: anexo como data URL (limitado, pois vai para o localStorage).
  async uploadAnexoChamado(chamadoId, campus, file) {
    if ((file.size || 0) > 1.5 * 1024 * 1024)
      throw new Error('No modo demonstração, anexos são limitados a ~1,5 MB.');
    const url = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result); fr.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
      fr.readAsDataURL(file);
    });
    return { nome: file.name, path: `demo/${chamadoId}/${Date.now()}`, url, tipo: file.type || '', tamanho: file.size || 0, ts: Date.now(), por: this.user?.nome || 'Demo' };
  }
  // Miniatura no modo demonstração: dataURL local (blob pequeno).
  async uploadThumbChamado(chamadoId, campus, blob) {
    const url = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result); fr.onerror = () => reject(new Error('Falha ao gerar miniatura.'));
      fr.readAsDataURL(blob);
    });
    return { path: `demo/${chamadoId}/thumb_${Date.now()}`, url };
  }
  async removerAnexoChamado() { /* demo: nada a remover no storage */ }
  // Demandas (unificação): no modo demo, mesmos mecanismos dos chamados.
  async uploadAnexoDemanda(demandaId, campus, file, onProgress) {
    return this.uploadAnexoChamado(demandaId, campus, file, onProgress);
  }
  async uploadThumbDemanda(demandaId, campus, blob) {
    return this.uploadThumbChamado(demandaId, campus, blob);
  }
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
  // Arquivo morto: exclusão recuperável (soft-delete) por 30 dias.
  async arquivarDemanda(id) {
    const d = this.getDemanda(id); if (!d) throw new Error('Demanda não encontrada.');
    if (['atendimento', 'concluido'].includes(d.status))
      throw new Error('Demandas em atendimento ou concluídas não podem ser excluídas.');
    Object.assign(d, { statusAnterior: d.status, status: 'excluido', excluidoEm: Date.now(), atualizadoEm: Date.now() });
    (d.historico = d.historico || []).push(this._ev('Demanda enviada ao arquivo morto (excluída)'));
    this._log('Demanda arquivada (excluída)', id, d.objeto || '');
    this._save();
  }
  async resgatarDemanda(id) {
    const d = this.getDemanda(id); if (!d) throw new Error('Demanda não encontrada.');
    Object.assign(d, { status: d.statusAnterior || 'recebido', atualizadoEm: Date.now() });
    delete d.statusAnterior; delete d.excluidoEm; delete d.expurgarEm;
    (d.historico = d.historico || []).push(this._ev('Demanda resgatada do arquivo morto'));
    this._log('Demanda resgatada', id, d.objeto || '');
    this._save();
  }
  async purgarExcluidos(dias = 30) {
    const limite = Date.now() - dias * 86400000;
    const expirados = this.db.demandas.filter(d => d.status === 'excluido' && (d.excluidoEm || 0) < limite);
    if (!expirados.length) return 0;
    const ids = new Set(expirados.map(d => d.id));
    expirados.forEach(d => { delete this.db.internas[d.id]; this._log('Demanda removida definitivamente (arquivo morto expirado)', d.id, d.objeto || ''); });
    this.db.demandas = this.db.demandas.filter(d => !ids.has(d.id));
    this._save();
    return expirados.length;
  }
  _ev(texto) { return { ts: Date.now(), user: this.user ? this.user.nome : 'Sistema', acao: texto }; }

  // --- Dados internos (alocação) — como nas rules: só perfis internos leem ---
  getInternas() {
    return ['engenharia', 'chefe', 'codir', 'admin'].includes(this.user?.role) ? this.db.internas : {};
  }
  async setInterna(id, patch) {
    this.db.internas[id] = { ...(this.db.internas[id] || {}), ...patch };
    this._log('Alocação atualizada', id, Object.keys(patch).join(', '));
    this._save();
  }

  // --- Notificações (inbox pessoal) ---------------------------------------
  // Diretório de roteamento (sem nomes): uid, papel, ativo, e — para quem é
  // profissional ativo — id do profissional (pid) e disciplina (disc).
  getDiretorio() {
    const porEmail = {};
    (this.db.profissionais || []).forEach(p => { if (p.email) porEmail[p.email.toLowerCase()] = p; });
    return (this.db.usuarios || []).map(u => {
      const p = porEmail[(u.email || '').toLowerCase()];
      const profAtivo = p && p.ativo !== false;
      const campi = Array.isArray(u.campi) && u.campi.length ? u.campi : (u.campus ? [u.campus] : []);
      return { uid: u.uid, role: u.role, ativo: u.ativo !== false, pid: profAtivo ? p.id : null, disc: profAtivo ? p.area : null, campi };
    });
  }
  listNotificacoes() {
    if (!this.user) return [];
    return (this.db.notificacoes || []).filter(n => n.para === this.user.uid).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  }
  async criarNotificacoes(itens) {
    if (!this.user || !Array.isArray(itens) || !itens.length) return;
    const base = Date.now();
    itens.forEach((it, i) => this.db.notificacoes.push({
      id: 'n' + base.toString(36) + i.toString(36) + Math.random().toString(36).slice(2, 6),
      para: it.para, de: this.user.uid, deNome: this.user.nome || '',
      tipo: it.tipo, demandaId: it.demandaId, objeto: it.objeto || '', texto: it.texto || '',
      link: it.link || '', criadoEm: base, lida: false,
    }));
    if (this.db.notificacoes.length > 5000) this.db.notificacoes = this.db.notificacoes.slice(-5000);
    this._save();
  }
  async marcarNotificacaoLida(id) {
    const n = (this.db.notificacoes || []).find(x => x.id === id && x.para === this.user?.uid);
    if (n && !n.lida) { n.lida = true; this._save(); }
  }
  async marcarTodasLidas() {
    let mud = false;
    (this.db.notificacoes || []).forEach(n => { if (n.para === this.user?.uid && !n.lida) { n.lida = true; mud = true; } });
    if (mud) this._save();
  }
  // Limpeza automática do próprio inbox: remove avisos JÁ LIDOS com mais de `dias`
  // (não lidos são preservados) e mantém no máximo 300 mais recentes.
  async purgarNotificacoes(dias = 30) {
    if (!this.user) return 0;
    const meu = this.user.uid;
    const limite = Date.now() - dias * 86400000;
    const antes = this.db.notificacoes.length;
    const outras = this.db.notificacoes.filter(n => n.para !== meu);
    let minhas = this.db.notificacoes.filter(n => n.para === meu)
      .filter(n => !(n.lida && (n.criadoEm || 0) < limite))
      .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
    if (minhas.length > 300) minhas = minhas.slice(0, 300);
    this.db.notificacoes = [...outras, ...minhas];
    const rem = antes - this.db.notificacoes.length;
    if (rem) this._save();
    return rem;
  }

  // --- Meu espaço (v1.20): foto de perfil e autoatendimento (modo demonstração) ---
  async uploadFotoPerfil(blob) {
    return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  }
  async removerFotoPerfil() { /* demo: nada a remover no storage */ }
  async atualizarMeuProfissional(patch, evento) {
    const prof = this.profissionalDoUsuario(this.user);
    if (!prof) throw new Error('Nenhum profissional vinculado ao seu e-mail.');
    const i = this.db.profissionais.findIndex(x => x.id === prof.id);
    this.db.profissionais[i] = { ...this.db.profissionais[i], ...patch };
    this._log(evento || 'Perfil do profissional atualizado', prof.nome, Object.keys(patch).join(', '));
    this._save();
  }

  // --- Profissionais ---
  listProfissionais() { return this.user ? this.db.profissionais : []; }
  getTransparencia() { return calcularTransparencia(this.db.chamados || [], slaChamado, STATUS_CHAMADO_ABERTO); }
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
