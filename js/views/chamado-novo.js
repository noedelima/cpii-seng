// =============================================================================
// Abrir chamado — intake da SENG (perfis: campus dono, engenharia, chefe, admin)
// O chamado é a porta de entrada; a SENG faz a triagem e decide o desfecho.
// =============================================================================
import { el, frag, campo, select, toast } from '../ui.js';
import { CAMPI, CATEGORIAS_CHAMADO, URGENCIA_CHAMADO, categoriaChamado } from '../config.js';
import { store } from '../store.js';
import { can, campiDoUsuario } from '../auth.js';
import { notificarChamado } from '../notificacoes.js';

export function viewChamadoNovo() {
  const s = store();
  const user = s.user;
  if (!user || !can(user, 'criar')) { location.hash = '#/login'; return frag(); }

  const ehCampus = user.role === 'campus';
  const meusCampi = campiDoUsuario(user);
  const opcoesCampus = ehCampus ? CAMPI.filter(c => meusCampi.includes(c.id)) : CAMPI;
  const fixoCampus = ehCampus && meusCampi.length === 1 ? meusCampi[0] : null;

  const selCampus = select(opcoesCampus, { value: fixoCampus || '', required: true, ...(fixoCampus ? { disabled: true } : {}) });
  const selCat = select(CATEGORIAS_CHAMADO, { required: true });
  const inAssunto = el('input', { type: 'text', maxlength: 140, required: true, placeholder: 'Resumo — ex.: Vazamento no banheiro do 2º pavimento' });
  const inLocal = el('input', { type: 'text', maxlength: 160, placeholder: 'Bloco, pavimento, sala…' });
  const selUrg = select(URGENCIA_CHAMADO, { value: 'media', placeholder: null });
  const inDesc = el('textarea', { rows: 5, maxlength: 4000, required: true, placeholder: 'Descreva o problema/necessidade e onde ocorre.' });

  // Dica dinâmica: prazo (SLA) estimado da categoria selecionada.
  const dicaSla = el('span', { class: 'campo-hint' }, '');
  const atualizarSla = () => {
    const c = categoriaChamado(selCat.value);
    dicaSla.textContent = c ? `Prazo de triagem estimado: ${c.slaDias} dias corridos.` : '';
  };
  selCat.addEventListener('change', atualizarSla);

  const btn = el('button', { class: 'btn primario', type: 'submit' }, 'Abrir chamado');

  const form = el('form', { class: 'form-grid', onsubmit: async (e) => {
    e.preventDefault();
    btn.disabled = true; btn.textContent = 'Abrindo…';
    try {
      const campus = fixoCampus || selCampus.value;
      const assunto = inAssunto.value.trim();
      const categoria = selCat.value;
      const id = await s.criarChamado({
        campus, categoria, assunto,
        local: inLocal.value.trim(),
        urgencia: selUrg.value || 'media',
        descricao: inDesc.value.trim(),
        autor: { nome: user.nome, email: user.email, uid: user.uid },
        historico: [{ ts: Date.now(), user: user.nome, acao: 'Chamado aberto' }],
      });
      // Notifica os engenheiros/arquitetos da disciplina (ou toda a SENG, se sem disciplina).
      await notificarChamado(s, 'chamado-novo', { id, campus, categoria, assunto });
      toast(`Chamado ${id} aberto.`);
      location.hash = `#/chamado/${id}`;
    } catch (err) {
      toast(err.message || 'Erro ao abrir o chamado.', 'erro');
      btn.disabled = false; btn.textContent = 'Abrir chamado';
    }
  } },
    el('div', { class: 'form-linha' },
      campo('Campus / unidade *', selCampus, fixoCampus ? 'Definido pelo seu perfil.' : (ehCampus ? 'Selecione entre os campi vinculados ao seu perfil.' : null)),
      campo('Assunto / categoria *', selCat, dicaSla)),
    campo('Título do chamado *', inAssunto),
    el('div', { class: 'form-linha' },
      campo('Localização', inLocal),
      campo('Urgência', selUrg, 'Percepção inicial — a SENG confirma na triagem.')),
    campo('Descrição *', inDesc),
    el('div', { class: 'form-acoes' },
      el('a', { class: 'btn ghost', href: '#/chamados' }, 'Cancelar'), btn),
  );

  return frag(el('section', { class: 'card pagina-form' },
    el('h1', {}, 'Abrir chamado'),
    el('p', { class: 'sub' }, 'Solicitação à Seção de Engenharia. O chamado passa por triagem e pode virar demanda de obra, retornar como consultoria/laudo ou ser encaminhado ao setor responsável.'),
    form));
}
