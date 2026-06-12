// =============================================================================
// Administração — usuários e parâmetros do sistema
// =============================================================================
import { el, frag, campo, select, toast, confirmar } from '../ui.js';
import { ROLES, CAMPI, roleNome, campusNome } from '../config.js';
import { store } from '../store.js';
import { can } from '../auth.js';

export function viewAdmin(rerender) {
  const s = store();
  const user = s.user;
  if (!user || (!can(user, 'usuarios') && !can(user, 'params'))) { location.hash = '#/login'; return frag(); }

  const params = s.getParams();
  const filhos = [];

  // ---- Parâmetros -------------------------------------------------------------
  if (can(user, 'params')) {
    const inAno = el('input', { type: 'number', min: 2024, max: 2100, value: params.anoPlano });
    const inValorRef = el('input', { type: 'number', min: 0, step: 0.01, value: params.valorRef });
    const inPesoGUT = el('input', { type: 'number', min: 0, max: 1, step: 0.05, value: params.pesoGUT });
    const inPesoPxC = el('input', { type: 'number', min: 0, max: 1, step: 0.05, value: params.pesoPxC });
    const inLimite = el('input', { type: 'number', min: 1, max: 20, value: params.limitePontos });
    filhos.push(el('section', { class: 'card' },
      el('h2', {}, 'Parâmetros do sistema'),
      el('form', { class: 'form-grid', onsubmit: async (e) => {
        e.preventDefault();
        const pg = +inPesoGUT.value, pp = +inPesoPxC.value;
        if (Math.abs(pg + pp - 1) > 0.001) { toast('Os pesos devem somar 1,00.', 'erro'); return; }
        await s.setParams({ anoPlano: +inAno.value, valorRef: +inValorRef.value, pesoGUT: pg, pesoPxC: pp, limitePontos: +inLimite.value });
        toast('Parâmetros salvos. As prioridades são recalculadas automaticamente.');
      } },
        el('div', { class: 'form-linha' },
          campo('Ano do Plano (IDs novos)', inAno),
          campo('Valor de referência — art. 75, I, Lei 14.133/2021 (R$)', inValorRef, 'Atualizado anualmente por decreto. Base das faixas de valor e dos pontos do art. 11.')),
        el('div', { class: 'form-linha' },
          campo('Peso do GUT', inPesoGUT), campo('Peso do Prazo×Custo', inPesoPxC)),
        campo('Limite de pontos por profissional (art. 12)', inLimite),
        el('button', { class: 'btn primario' }, 'Salvar parâmetros'))));
  }

  // ---- Usuários ------------------------------------------------------------------
  if (can(user, 'usuarios')) {
    const usuarios = s.listUsuarios();
    const profissionais = s.listProfissionais();
    const formWrap = el('div', {});

    function abrirForm(u = {}) {
      const inNome = el('input', { type: 'text', required: true, maxlength: 80, value: u.nome || '' });
      const inEmail = el('input', { type: 'email', required: true, maxlength: 120, value: u.email || '', ...(u.uid ? { disabled: true } : {}) });
      const selRole = select(ROLES, { value: u.role || '', required: true });
      const selCampus = select(CAMPI, { value: u.campus || '', placeholder: '— (não se aplica) —' });
      const selProf = select(profissionais.map(p => ({ id: p.id, nome: p.nome })), { value: u.profissionalId || '', placeholder: '— vincular a profissional (opcional) —' });
      const ckAtivo = el('input', { type: 'checkbox', ...((u.ativo ?? true) ? { checked: true } : {}) });
      const inSenha = s.mode === 'demo' && !u.uid ? el('input', { type: 'text', value: 'cp2demo', maxlength: 40 }) : null;
      const inUid = s.mode === 'firebase' && !u.uid ? el('input', { type: 'text', required: true, placeholder: 'UID criado no console do Firebase' }) : null;

      formWrap.replaceChildren(el('section', { class: 'card' },
        el('h2', {}, u.uid ? `Editar — ${u.nome}` : 'Novo usuário'),
        s.mode === 'firebase' && !u.uid ? el('p', { class: 'nota' }, 'Produção: crie antes a credencial em Authentication → Users no console do Firebase e cole o UID aqui (ver firebase/SETUP.md).') : null,
        el('form', { class: 'form-grid', onsubmit: async (e) => {
          e.preventDefault();
          try {
            await s.salvarUsuario({
              ...(u.uid ? { uid: u.uid } : (inUid ? { uid: inUid.value.trim() } : {})),
              nome: inNome.value.trim(), email: inEmail.value.trim(),
              role: selRole.value, campus: selRole.value === 'campus' ? selCampus.value : (selCampus.value || null),
              profissionalId: selProf.value || null, ativo: ckAtivo.checked,
              ...(inSenha ? { senha: inSenha.value } : {}),
            });
            toast('Usuário salvo.');
            formWrap.replaceChildren();
          } catch (err) { toast(err.message, 'erro'); }
        } },
          el('div', { class: 'form-linha' }, campo('Nome *', inNome), campo('E-mail *', inEmail)),
          el('div', { class: 'form-linha' }, campo('Perfil *', selRole, 'Campus: envia solicitações. Engenharia: trata demandas. Chefe: funções gerenciais. Administrador: usuários e parâmetros.'), campo('Campus (perfil Campus)', selCampus)),
          el('div', { class: 'form-linha' }, campo('Profissional vinculado', selProf, 'Habilita o filtro “minhas atribuições”.'), inUid ? campo('UID (Firebase) *', inUid) : (inSenha ? campo('Senha (demo)', inSenha) : el('div', {}))),
          el('label', { class: 'chip-check' }, ckAtivo, ' Ativo'),
          el('div', { class: 'form-acoes' },
            el('button', { class: 'btn ghost', type: 'button', onclick: () => formWrap.replaceChildren() }, 'Fechar'),
            el('button', { class: 'btn primario' }, 'Salvar')))));
      formWrap.scrollIntoView({ behavior: 'smooth' });
    }

    filhos.push(el('section', { class: 'card' },
      el('div', { class: 'card-cab' },
        el('h2', {}, `Usuários (${usuarios.length})`),
        el('button', { class: 'btn primario sm', onclick: () => abrirForm() }, '+ Novo usuário')),
      el('div', { class: 'tabela-wrap' }, el('table', { class: 'tabela' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Nome'), el('th', {}, 'E-mail'), el('th', {}, 'Perfil'), el('th', {}, 'Campus'), el('th', {}, 'Situação'), el('th', {}, ''))),
        el('tbody', {}, usuarios.map(u => el('tr', {},
          el('td', {}, u.nome),
          el('td', { class: 'mono' }, u.email),
          el('td', {}, roleNome(u.role)),
          el('td', {}, u.campus ? campusNome(u.campus) : '—'),
          el('td', {}, u.ativo === false ? 'Inativo' : 'Ativo'),
          el('td', {}, el('button', { class: 'btn ghost sm', onclick: () => abrirForm(u) }, 'Editar'))))))),
      formWrap));
  }

  // ---- Modo demonstração: reinício dos dados -----------------------------------------
  if (s.mode === 'demo') {
    filhos.push(el('section', { class: 'card' },
      el('h2', {}, 'Modo demonstração'),
      el('p', { class: 'sub' }, 'Os dados ficam apenas neste navegador (localStorage). Para ativar a produção com Firebase, siga o guia firebase/SETUP.md do repositório.'),
      el('button', { class: 'btn perigo ghost', onclick: async () => {
        const ok = await confirmar('Restaurar dados de demonstração?', 'Todas as alterações feitas neste navegador serão perdidas.', { ok: 'Restaurar', perigo: true });
        if (ok) { await s.resetDemo(); toast('Dados de demonstração restaurados.'); }
      } }, 'Restaurar dados de demonstração')));
  }

  return frag(
    el('section', { class: 'hero' }, el('div', {},
      el('h1', {}, 'Administração'),
      el('p', { class: 'sub' }, 'Cadastro de usuários e parâmetros de cálculo.'))),
    ...filhos);
}
