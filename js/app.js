// =============================================================================
// SENG Demandas — Shell da aplicação e roteador (hash-based, compatível Pages)
// =============================================================================
import { el, toast } from './ui.js';
import { APP } from './config.js';
import { initStore, store } from './store.js';
import { can } from './auth.js';
import { EMBLEMA } from './logos.js';
import { viewInicio } from './views/inicio.js';
import { viewChamadosHub } from './views/chamados-hub.js';
import { viewLogin } from './views/login.js';
import { viewDemanda } from './views/demanda.js';
import { viewProfissionais } from './views/profissionais.js';
import { viewAdmin } from './views/admin.js';
import { viewConta } from './views/conta.js';
import { viewAjuda } from './views/ajuda.js';
import { viewNotificacoes } from './views/notificacoes.js';
import { viewChamadoNovo } from './views/chamado-novo.js';
import { viewChamado } from './views/chamado.js';

const main = document.getElementById('app');
const header = document.getElementById('cabecalho');
const rodape = document.getElementById('rodape');

// ---- Tema claro/escuro -------------------------------------------------------
function temaAtual() { return document.documentElement.dataset.tema; }
function alternarTema() {
  const novo = temaAtual() === 'escuro' ? 'claro' : 'escuro';
  document.documentElement.dataset.tema = novo;
  localStorage.setItem('seng-tema', novo);
  renderHeader();
}

// ---- Cabeçalho -----------------------------------------------------------------
function renderHeader() {
  const s = store();
  const user = s.user;
  const rota = location.hash || '#/';
  const navlink = (href, txt) => el('a', { href, class: `nav-link ${rota === href ? 'ativo' : ''}` }, txt);

  const nav = el('nav', { class: 'nav', 'aria-label': 'Navegação principal' },
    navlink('#/', 'Início'),
    navlink('#/chamados', 'Chamados'),
    user && can(user, 'verInterno') ? navlink('#/profissionais', 'Profissionais') : null,
    user && (can(user, 'usuarios') || can(user, 'params')) ? navlink('#/admin', 'Administração') : null,
    navlink('#/ajuda', 'Ajuda'),
  );

  const naoLidas = (user && typeof s.listNotificacoes === 'function') ? s.listNotificacoes().filter(n => !n.lida).length : 0;
  const sino = user ? el('a', {
    class: `btn icone notif-sino${naoLidas ? ' tem' : ''} ${rota === '#/notificacoes' ? 'ativo' : ''}`,
    href: '#/notificacoes', 'aria-label': naoLidas ? `Notificações — ${naoLidas} não lida(s)` : 'Notificações',
    title: naoLidas ? `Notificações — ${naoLidas} não lida(s)` : 'Notificações',
  }, '\u{1F514}', naoLidas ? el('span', { class: 'notif-badge' }, naoLidas > 99 ? '99+' : String(naoLidas)) : null) : null;

  const acoes = el('div', { class: 'header-acoes' },
    el('button', { class: 'btn icone', title: 'Alternar tema claro/escuro', 'aria-label': 'Alternar tema',
      onclick: alternarTema }, temaAtual() === 'escuro' ? '☀' : '☾'),
    user
      ? el('div', { class: 'user-box' },
          sino,
          el('a', { class: 'user-nome', href: '#/conta', title: 'Minha conta — dados e troca de senha' }, user.nome),
          el('button', { class: 'btn ghost sm', onclick: async () => { await s.logout(); toast('Sessão encerrada.'); location.hash = '#/'; } }, 'Sair'))
      : el('a', { class: 'btn ghost sm', href: '#/login' }, 'Entrar'),
  );

  const partes = [
    el('div', { class: 'header-inner' },
      el('a', { class: 'marca', href: '#/' },
        el('img', { src: EMBLEMA, alt: 'Brasão do Colégio Pedro II', width: 40, height: 33 }),
        el('div', { class: 'marca-texto' },
          el('strong', {}, APP.nome),
          el('span', {}, APP.orgao))),
      nav, acoes),
  ];
  if (s.mode === 'demo') {
    partes.push(el('div', { class: 'faixa-demo', role: 'note' },
      'Modo demonstração — dados fictícios armazenados apenas neste navegador. ',
      el('a', { href: 'https://github.com/' + (window.__REPO || '') + '/blob/main/firebase/SETUP.md', target: '_blank', rel: 'noopener' }, 'Como ativar a produção')));
  }
  header.replaceChildren(...partes);
}

// ---- Roteador --------------------------------------------------------------------
const rotas = [
  { re: /^#\/$/, view: viewInicio },
  { re: /^#\/login$/, view: viewLogin },
  // Unificado: a Nova Solicitação deixou de existir como entrada própria — o
  // chamado é a única porta. Redireciona links/marcadores antigos.
  { re: /^#\/nova$/, view: () => { location.hash = '#/chamado-novo'; return document.createDocumentFragment(); } },
  { re: /^#\/demanda\/([\w-]+)$/, view: viewDemanda },
  { re: /^#\/profissionais$/, view: viewProfissionais },
  { re: /^#\/admin$/, view: viewAdmin },
  { re: /^#\/conta$/, view: viewConta },
  { re: /^#\/ajuda$/, view: viewAjuda },
  { re: /^#\/notificacoes$/, view: viewNotificacoes },
  { re: /^#\/chamados$/, view: viewChamadosHub },
  { re: /^#\/chamado-novo$/, view: viewChamadoNovo },
  { re: /^#\/chamado\/([\w-]+)$/, view: viewChamado },
];

let renderAgendado = false;
function render() {
  if (renderAgendado) return;
  renderAgendado = true;
  // queueMicrotask (e não rAF/setTimeout): rAF é pausado e timers são
  // severamente limitados em abas em segundo plano; microtasks executam
  // sempre — navegação e atualizações funcionam mesmo com a aba oculta.
  queueMicrotask(() => {
    renderAgendado = false;
    const hash = location.hash || '#/';
    const rota = rotas.find(r => r.re.test(hash));
    renderHeader();
    main.replaceChildren();
    if (!rota) { location.hash = '#/'; return; }
    const m = hash.match(rota.re);
    try {
      main.append(rota.view(render, m[1]));
    } catch (e) {
      console.error(e);
      main.append(el('section', { class: 'card' }, el('h1', {}, 'Erro inesperado'), el('p', {}, String(e?.message || e))));
    }
    main.focus({ preventScroll: true });
  });
}

// ---- Rodapé -------------------------------------------------------------------------
function renderRodape() {
  rodape.replaceChildren(
    el('div', { class: 'rodape-inner' },
      el('span', {}, `${APP.orgao} · ${APP.setor}`),
      el('span', {}, APP.portaria),
      el('span', { class: 'sub' }, `v${APP.versao} — dashboard público; cadastro e tratamento exigem autenticação.`)));
}

// ---- Inicialização --------------------------------------------------------------------
(async function boot() {
  main.append(el('div', { class: 'carregando' }, 'Carregando o sistema…'));
  try {
    const provider = await initStore();
    provider.subscribe(render);
    window.addEventListener('hashchange', render);
    renderRodape();
    render();
  } catch (e) {
    console.error(e);
    main.replaceChildren(el('section', { class: 'card' },
      el('h1', {}, 'Falha ao iniciar'),
      el('p', {}, 'Não foi possível carregar a camada de dados. Verifique a configuração do Firebase (js/firebase-config.js) ou recarregue a página.'),
      el('p', { class: 'sub mono' }, String(e?.message || e))));
  }
})();
