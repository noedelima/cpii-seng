// =============================================================================
// Nova solicitação de demanda (perfis: campus, engenharia, chefe)
// Maximiza campos de seleção; texto livre apenas onde indispensável.
// =============================================================================
import { el, frag, campo, select, toast } from '../ui.js';
import { CAMPI, TIPOS_DEMANDA, PROJETO_EXISTE, ESPECIALIDADES, PRAZOS, precisaEtapaProjeto } from '../config.js';
import { store } from '../store.js';
import { can, campiDoUsuario } from '../auth.js';

export function viewSolicitacao() {
  const s = store();
  const user = s.user;
  if (!user || !can(user, 'criar')) { location.hash = '#/login'; return frag(); }

  const ehCampus = user.role === 'campus';
  const meusCampi = campiDoUsuario(user);
  const opcoesCampus = ehCampus ? CAMPI.filter(c => meusCampi.includes(c.id)) : CAMPI;
  const fixoCampus = ehCampus && meusCampi.length === 1 ? meusCampi[0] : null;

  const selCampus = select(opcoesCampus, { value: fixoCampus || '', required: true, ...(fixoCampus ? { disabled: true } : {}) });
  const inLocal = el('input', { type: 'text', maxlength: 160, placeholder: 'Ex.: Bloco B, 2º pavimento, salas 201–204' });
  const selTipo = select(TIPOS_DEMANDA.filter(t => !t.oculto), { required: true });
  const selProjeto = select(PROJETO_EXISTE, { required: true });
  const selTombado = select([{ id: 'sim', nome: 'Sim' }, { id: 'nao', nome: 'Não' }, { id: 'ns', nome: 'Não sei informar' }], { required: true });
  const selPrazo = select(PRAZOS, { placeholder: 'Sem previsão definida' });
  const inValor = el('input', { type: 'number', min: 0, step: 'any', placeholder: 'Ex.: 250000 (opcional)' });
  const inSuap = el('input', { type: 'text', maxlength: 25, placeholder: 'Ex.: 23040.001234/2026-11 (se houver)' });
  const inObjeto = el('input', { type: 'text', maxlength: 120, required: true, placeholder: 'Resumo do objeto — ex.: Reforma do telhado da quadra' });
  const inDesc = el('textarea', { rows: 5, maxlength: 4000, required: true, placeholder: 'Descreva o problema/necessidade, o objetivo e o resultado esperado.' });
  const ckEmergencial = el('input', { type: 'checkbox' });

  const espChecks = ESPECIALIDADES.map(e2 => {
    const c = el('input', { type: 'checkbox', value: e2 });
    return el('label', { class: 'chip-check' }, c, ' ' + e2);
  });

  const btn = el('button', { class: 'btn primario', type: 'submit' }, 'Registrar solicitação');

  const form = el('form', { class: 'form-grid', onsubmit: async (e) => {
    e.preventDefault();
    const especialidades = espChecks.map(l => l.querySelector('input')).filter(c => c.checked).map(c => c.value);
    if (!especialidades.length) { toast('Selecione ao menos uma especialidade.', 'erro'); return; }
    btn.disabled = true; btn.textContent = 'Registrando…';
    try {
      const id = await s.criarDemanda({
        campus: fixoCampus || selCampus.value,
        local: inLocal.value.trim(),
        tipoDemanda: selTipo.value,
        projetoExiste: selProjeto.value,
        etapa: precisaEtapaProjeto({ tipoDemanda: selTipo.value, projetoExiste: selProjeto.value }) ? 'projeto' : null,
        tombado: selTombado.value,
        prazoEstimado: selPrazo.value || null,
        valorEstimado: inValor.value ? Number(inValor.value) : null,
        processoSuap: inSuap.value.trim(),
        objeto: inObjeto.value.trim(),
        descricao: inDesc.value.trim(),
        emergencial: ckEmergencial.checked,
        especialidades,
        status: 'recebido',
        solicitante: { nome: user.nome, email: user.email },
        historico: [{ ts: Date.now(), user: user.nome, acao: 'Solicitação registrada' }],
      });
      toast(`Solicitação ${id} registrada.`);
      location.hash = `#/demanda/${id}`;
    } catch (err) {
      toast(err.message || 'Erro ao registrar.', 'erro');
      btn.disabled = false; btn.textContent = 'Registrar solicitação';
    }
  } },
    el('div', { class: 'form-linha' },
      campo('Campus / unidade *', selCampus, fixoCampus ? 'Definido pelo seu perfil.' : (ehCampus ? 'Selecione entre os campi vinculados ao seu perfil.' : null)),
      campo('Localização no campus', inLocal)),
    el('div', { class: 'form-linha' },
      campo('Tipo de demanda *', selTipo),
      campo('Projeto já existe? *', selProjeto, 'Se não existir, a demanda inclui a contratação do projeto.')),
    el('div', { class: 'form-linha' },
      campo('Imóvel tombado / patrimônio histórico? *', selTombado),
      campo('Previsão de prazo desejada', selPrazo)),
    el('div', { class: 'form-linha' },
      campo('Valor estimado (R$)', inValor, 'Se conhecido — ajuda na priorização.'),
      campo('Processo SUAP', inSuap)),
    campo('Objeto resumido *', inObjeto),
    campo('Especialidades envolvidas *', el('div', { class: 'chips' }, espChecks)),
    campo('Descrição completa *', inDesc),
    el('label', { class: 'chip-check destaque-emergencial' }, ckEmergencial,
      ' Serviço emergencial — risco iminente à segurança de pessoas ou ao patrimônio (art. 11, §5º)'),
    el('div', { class: 'form-acoes' },
      el('a', { class: 'btn ghost', href: '#/' }, 'Cancelar'), btn),
  );

  return frag(el('section', { class: 'card pagina-form' },
    el('h1', {}, 'Nova solicitação de demanda'),
    el('p', { class: 'sub' }, 'Cadastro contínuo — a solicitação entra como “Recebido” e será triada pela Seção de Engenharia. Atividades de manutenção predial não são atendidas pela SENG (art. 18 da Portaria 7503/2025).'),
    form));
}
