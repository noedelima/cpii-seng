// =============================================================================
// Minha conta — dados do usuário e troca de senha pela própria interface
// =============================================================================
import { el, frag, campo, toast } from '../ui.js';
import { roleNome, campusNome } from '../config.js';
import { store } from '../store.js';

export function viewConta() {
  const s = store();
  const user = s.user;
  if (!user) { location.hash = '#/login'; return frag(); }

  const prof = s.profissionalDoUsuario ? s.profissionalDoUsuario(user) : null;

  const inAtual = el('input', { type: 'password', autocomplete: 'current-password', required: true });
  const inNova = el('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: 6 });
  const inConf = el('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: 6 });
  const btn = el('button', { class: 'btn primario' }, 'Alterar senha');

  const form = el('form', { class: 'form-grid', onsubmit: async (e) => {
    e.preventDefault();
    if (inNova.value !== inConf.value) { toast('A confirmação não confere com a nova senha.', 'erro'); return; }
    if (inNova.value === inAtual.value) { toast('A nova senha deve ser diferente da atual.', 'erro'); return; }
    btn.disabled = true; btn.textContent = 'Alterando…';
    try {
      await s.trocarSenha(inAtual.value, inNova.value);
      toast('Senha alterada com sucesso.');
      inAtual.value = inNova.value = inConf.value = '';
    } catch (err) {
      toast(err.message || 'Não foi possível alterar a senha.', 'erro');
    }
    btn.disabled = false; btn.textContent = 'Alterar senha';
  } },
    campo('Senha atual', inAtual),
    el('div', { class: 'form-linha' },
      campo('Nova senha', inNova, 'Mínimo de 6 caracteres.'),
      campo('Confirmar nova senha', inConf)),
    btn,
  );

  return frag(
    el('section', { class: 'hero' }, el('div', {},
      el('h1', {}, 'Minha conta'),
      el('p', { class: 'sub' }, 'Dados do seu acesso e troca de senha.'))),
    el('div', { class: 'detalhe-grid' },
      el('section', { class: 'card' },
        el('h2', {}, 'Dados do acesso'),
        linha('Nome', user.nome),
        linha('E-mail', user.email),
        linha('Perfil', roleNome(user.role)),
        user.campus ? linha('Campus', campusNome(user.campus)) : null,
        prof ? linha('Profissional vinculado', `${prof.nome} — ${prof.cargo} · ${prof.area}`) : null,
      ),
      el('section', { class: 'card' },
        el('h2', {}, 'Trocar senha'),
        form)));
}

const linha = (rotulo, valor) => el('div', { class: 'linha-info' },
  el('span', { class: 'linha-rotulo' }, rotulo), el('span', { class: 'linha-valor' }, valor));
