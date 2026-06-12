// =============================================================================
// Tela de login — autenticação para cadastro/tratamento (dashboard é público)
// =============================================================================
import { el, frag, campo, toast } from '../ui.js';
import { store } from '../store.js';

export function viewLogin(rerender) {
  const s = store();
  if (s.user) { location.hash = '#/'; return frag(); }

  const inEmail = el('input', { type: 'email', autocomplete: 'username', required: true, placeholder: 'nome@cp2.g12.br' });
  const inSenha = el('input', { type: 'password', autocomplete: 'current-password', required: true, placeholder: '••••••••' });
  const btn = el('button', { class: 'btn primario', type: 'submit' }, 'Entrar');

  const form = el('form', { class: 'login-form', onsubmit: async (e) => {
    e.preventDefault();
    btn.disabled = true; btn.textContent = 'Entrando…';
    try {
      await s.login(inEmail.value, inSenha.value);
      toast(`Bem-vindo(a), ${s.user.nome}.`);
      location.hash = '#/';
    } catch (err) {
      toast(err.message || 'Falha na autenticação.', 'erro');
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  } },
    campo('E-mail', inEmail),
    campo('Senha', inSenha),
    btn,
  );

  const demo = s.mode === 'demo' ? el('div', { class: 'card demo-credenciais' },
    el('h3', {}, 'Usuários de demonstração'),
    el('p', { class: 'sub' }, 'Sistema em modo demonstração — dados fictícios, armazenados apenas neste navegador. Senha de todos: ', el('code', {}, 'cp2demo')),
    el('ul', {},
      el('li', {}, el('code', {}, 'campus.sc2@cp2.demo'), ' — perfil Campus (DIAD São Cristóvão II)'),
      el('li', {}, el('code', {}, 'engenharia@cp2.demo'), ' — perfil Engenharia'),
      el('li', {}, el('code', {}, 'chefia@cp2.demo'), ' — perfil Chefe de Seção'),
      el('li', {}, el('code', {}, 'admin@cp2.demo'), ' — perfil Administrador'),
    )) : null;

  return frag(el('section', { class: 'login-wrap' },
    el('div', { class: 'card login-card' },
      el('h1', {}, 'Acesso restrito'),
      el('p', { class: 'sub' }, 'Cadastro de solicitações, avaliação e alocação exigem autenticação. A consulta à fila e o relatório PDF são públicos.'),
      form),
    demo));
}
