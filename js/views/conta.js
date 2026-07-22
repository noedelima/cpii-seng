// =============================================================================
// Meu espaço — painel pessoal: dados do acesso, foto de perfil, minhas
// atividades, minhas ausências (informativo — registro oficial no SouGov) e
// troca de senha. (v1.20 — plano Equipe)
// =============================================================================
import { el, frag, campo, select, toast, confirmar, fmtData, badgeStatus } from '../ui.js';
import { roleNome, campusNome, TIPOS_AUSENCIA, tipoAusenciaNome, faseCurta, statusChamadoNome, statusChamadoCor } from '../config.js';
import { fiscaisDe } from '../calc.js';
import { avatar, reduzirFoto } from '../avatar.js';
import { store } from '../store.js';
import { campiDoUsuario, can } from '../auth.js';
import { api } from '../api.js';

export function viewConta() {
  const s = store();
  const user = s.user;
  if (!user) { location.hash = '#/login'; return frag(); }

  const prof = s.profissionalDoUsuario ? s.profissionalDoUsuario(user) : null;
  const campiU = campiDoUsuario(user);

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

  // Checagem (somente leitura) da camada de API: exercita /api/me — valida o ID
  // token (RS256) e a leitura de usuarios/{uid} sob as Security Rules do usuário.
  const apiVal = el('span', { class: 'linha-valor' }, 'verificando…');
  const apiLinha = el('div', { class: 'linha-info' }, el('span', { class: 'linha-rotulo' }, 'Camada de API'), apiVal);
  if (s.mode === 'firebase') {
    api.me()
      .then((d) => { apiVal.textContent = (d && d.uid === user.uid) ? 'conectada ✓ — /api/me sob as Security Rules' : 'conectada ✓'; })
      .catch(() => { apiVal.textContent = 'indisponível neste endereço (ativa no Azure SWA)'; });
  } else {
    apiVal.textContent = 'modo demonstração (sem API)';
  }

  // ---------------- foto de perfil (grava no profissional vinculado) ----------
  let cartaoFoto = null;
  if (prof) {
    const previa = el('div', { class: 'foto-previa' }, avatar(prof.nome, prof.fotoUrl, 96));
    const inFile = el('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: async () => {
      const f = inFile.files[0];
      if (!f) return;
      try {
        const blob = await reduzirFoto(f, 256);
        const url = await s.uploadFotoPerfil(blob);
        await s.atualizarMeuProfissional({ fotoUrl: url }, 'Foto de perfil atualizada');
        toast('Foto de perfil atualizada.');
      } catch (err) { toast(err.message || 'Falha ao enviar a foto.', 'erro'); }
    } });
    cartaoFoto = el('section', { class: 'card' },
      el('h2', {}, 'Foto de perfil'),
      el('div', { class: 'foto-linha' }, previa,
        el('div', { class: 'foto-acoes' },
          el('button', { class: 'btn', onclick: () => inFile.click() }, prof.fotoUrl ? 'Trocar foto' : 'Enviar foto'),
          prof.fotoUrl ? el('button', { class: 'btn ghost sm', onclick: async () => {
            const ok = await confirmar('Remover a foto?', 'Você volta a ser exibido pelo avatar de iniciais.', { ok: 'Remover' });
            if (!ok) return;
            try { await s.removerFotoPerfil(); await s.atualizarMeuProfissional({ fotoUrl: null }, 'Foto de perfil removida'); toast('Foto removida.'); }
            catch (err) { toast(err.message || 'Falha ao remover.', 'erro'); }
          } }, 'Remover') : null,
          inFile)),
      el('p', { class: 'nota' }, 'Visível somente para usuários autenticados — nunca nas páginas públicas.'));
  }

  // ---------------- minhas ausências (informativo — SouGov é o oficial) --------
  let cartaoAusencias = null;
  if (prof) {
    const ausencias = (prof.ausencias || []).slice().sort((a, b) => a.inicio - b.inicio);
    const itens = ausencias.map(a2 => el('div', { class: 'linha-info' },
      el('span', { class: 'linha-rotulo' }, tipoAusenciaNome(a2.tipo)),
      el('span', { class: 'linha-valor' }, `${fmtData(a2.inicio)} a ${fmtData(a2.fim)}${a2.obs ? ` — ${a2.obs}` : ''} `,
        el('button', { class: 'sel-rm', title: 'Remover', 'aria-label': 'Remover ausência', onclick: async () => {
          const ok = await confirmar('Remover este registro?', 'O período deixa de contar na disponibilidade da equipe.', { ok: 'Remover', perigo: true });
          if (!ok) return;
          await s.atualizarMeuProfissional({ ausencias: ausencias.filter(x => x.id !== a2.id) }, 'Ausência removida');
          toast('Registro removido.');
        } }, '✕'))));
    const selTipo = select(TIPOS_AUSENCIA, { placeholder: 'Tipo…' });
    const inIni = el('input', { type: 'date' });
    const inFim = el('input', { type: 'date' });
    const inObs = el('input', { type: 'text', maxlength: 120, placeholder: 'Observação (opcional — não inclua dados de saúde)' });
    cartaoAusencias = el('section', { class: 'card' },
      el('h2', {}, 'Minhas ausências ', el('span', { class: 'sub' }, '(previsão — informativo)')),
      itens.length ? el('div', {}, itens) : el('p', { class: 'sub' }, 'Nenhuma ausência registrada.'),
      el('div', { class: 'form-grid' },
        el('div', { class: 'form-linha' }, campo('Tipo *', selTipo), campo('Início *', inIni), campo('Fim *', inFim)),
        campo('Observação', inObs),
        el('button', { class: 'btn', onclick: async () => {
          if (!selTipo.value || !inIni.value || !inFim.value) { toast('Preencha tipo, início e fim.', 'erro'); return; }
          const ini = new Date(inIni.value + 'T00:00:00').getTime();
          const fim = new Date(inFim.value + 'T23:59:59').getTime();
          if (fim < ini) { toast('O fim deve ser depois do início.', 'erro'); return; }
          const nova = { id: 'a' + Date.now().toString(36), tipo: selTipo.value, inicio: ini, fim,
            obs: inObs.value.trim(), registradoPor: user.nome, em: Date.now() };
          await s.atualizarMeuProfissional({ ausencias: [...(prof.ausencias || []), nova] },
            `Ausência registrada — ${tipoAusenciaNome(nova.tipo)}`);
          toast('Ausência registrada.');
        } }, 'Registrar ausência')),
      el('p', { class: 'nota' }, 'Controle informativo da seção — o registro oficial é feito no SouGov.'));
  }

  // ---------------- minhas atividades (consolidado) ---------------------------
  let cartaoAtividades = null;
  if (prof && can(user, 'verInterno')) {
    const internas = s.getInternas();
    const itens = [];
    s.listDemandas().forEach(d => {
      if (['concluido', 'cancelado', 'nao-enquadrado', 'excluido'].includes(d.status)) return;
      const i = internas[d.id] || {};
      const { titulares, substitutos } = fiscaisDe(i);
      const papeis = [];
      if (titulares.includes(prof.id)) papeis.push('fiscal titular');
      if (substitutos.includes(prof.id)) papeis.push('fiscal substituto');
      if ((i.equipePlanejamento || []).includes(prof.id)) papeis.push('planejamento');
      if (papeis.length) itens.push(el('a', { class: 'ativ-item', href: `#/demanda/${d.id}` },
        el('span', { class: 'ativ-titulo' }, d.objeto || d.id),
        el('span', { class: 'ativ-meta' }, papeis.join(' · ')),
        badgeStatus(d.status),
        d.status === 'atendimento' && d.fase ? el('span', { class: 'fase-badge' }, faseCurta(d.fase)) : null));
    });
    (s.listChamados ? s.listChamados() : []).forEach(c2 => {
      if (c2.status === 'atendimento' && (c2.atendentes || []).includes(prof.id)) {
        itens.push(el('a', { class: 'ativ-item', href: `#/chamado/${c2.id}` },
          el('span', { class: 'ativ-titulo' }, c2.assunto || c2.id),
          el('span', { class: 'ativ-meta' }, 'chamado · responsável'),
          el('span', { class: `badge ${statusChamadoCor(c2.status)}` }, statusChamadoNome(c2.status))));
      }
    });
    cartaoAtividades = el('section', { class: 'card' },
      el('h2', {}, 'Minhas atividades ', el('span', { class: 'sub' }, `(${itens.length})`)),
      itens.length ? el('div', { class: 'ativ-lista' }, itens)
        : el('p', { class: 'sub' }, 'Nenhuma atividade atribuída no momento.'));
  }

  return frag(
    el('section', { class: 'hero' }, el('div', {},
      el('h1', {}, 'Meu espaço'),
      el('p', { class: 'sub' }, 'Seus dados, atividades, ausências e preferências de acesso.'))),
    el('div', { class: 'detalhe-grid' },
      el('div', { class: 'col' },
        el('section', { class: 'card' },
          el('h2', {}, 'Dados do acesso'),
          linha('Nome', user.nome),
          linha('E-mail', user.email),
          linha('Perfil', roleNome(user.role)),
          campiU.length ? linha(campiU.length > 1 ? 'Campi' : 'Campus', campiU.map(campusNome).join(', ')) : null,
          prof ? linha('Profissional vinculado', `${prof.nome} — ${prof.cargo} · ${prof.area}`) : null,
          apiLinha,
        ),
        cartaoAtividades),
      el('div', { class: 'col' },
        cartaoFoto,
        cartaoAusencias,
        el('section', { class: 'card' },
          el('h2', {}, 'Trocar senha'),
          form))));
}

const linha = (rotulo, valor) => el('div', { class: 'linha-info' },
  el('span', { class: 'linha-rotulo' }, rotulo), el('span', { class: 'linha-valor' }, valor));
