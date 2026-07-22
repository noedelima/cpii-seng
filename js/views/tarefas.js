// =============================================================================
// Tarefas da seção — kanban (v1.22): trabalho que não é demanda/chamado.
// Colunas por situação, arrastar-e-soltar (com setas como alternativa) e
// criação rápida. Fora da pontuação do art. 11 (contagem própria).
// =============================================================================
import { el, campo, select, toast, confirmar, fmtData, abreviarNome } from '../ui.js';
import { avatar } from '../avatar.js';
import { can } from '../auth.js';

export const SITUACOES_TAREFA = [
  { id: 'aberta', nome: 'Abertas' },
  { id: 'andamento', nome: 'Em andamento' },
  { id: 'concluida', nome: 'Concluídas' },
];

export function cardTarefas(s, user, rerender, { apenasProf = null } = {}) {
  const tarefas = (s.listTarefas ? s.listTarefas() : [])
    .filter(t => t.situacao !== 'cancelada')
    .filter(t => !apenasProf || (t.responsaveis || []).includes(apenasProf))
    .sort((a, b) => (a.prazo || Infinity) - (b.prazo || Infinity) || (b.atualizadoEm || 0) - (a.atualizadoEm || 0));
  const profs = (s.listProfissionais() || []).filter(p => p.ativo !== false);
  const nomeProf = (pid) => (profs.find(p => p.id === pid) || {}).nome || '—';
  const mover = async (t, sit) => {
    await s.atualizarTarefa(t.id, { situacao: sit }, `Tarefa "${t.titulo}" → ${sit}`);
    toast('Tarefa atualizada.');
  };

  const cartao = (t) => {
    const vencida = t.prazo && t.prazo < Date.now() && t.situacao !== 'concluida';
    const idx = SITUACOES_TAREFA.findIndex(x => x.id === t.situacao);
    const node = el('div', { class: 'kb-card', draggable: 'true' },
      el('div', { class: 'kb-titulo' }, t.titulo),
      el('div', { class: 'kb-meta' },
        (t.responsaveis || []).map(pid => avatar(nomeProf(pid), (profs.find(p => p.id === pid) || {}).fotoUrl, 22)),
        (t.responsaveis || []).length ? el('span', { class: 'sub' }, t.responsaveis.map(pid => abreviarNome(nomeProf(pid))).join(', ')) : null,
        t.prazo ? el('span', { class: `sub${vencida ? ' ref-acima' : ''}` }, ` · até ${fmtData(t.prazo)}`) : null),
      el('div', { class: 'kb-acoes' },
        idx > 0 ? el('button', { class: 'kb-seta', title: 'Mover para a coluna anterior', onclick: () => mover(t, SITUACOES_TAREFA[idx - 1].id) }, '←') : null,
        idx < SITUACOES_TAREFA.length - 1 ? el('button', { class: 'kb-seta', title: 'Mover para a próxima coluna', onclick: () => mover(t, SITUACOES_TAREFA[idx + 1].id) }, '→') : null,
        can(user, 'excluir') ? el('button', { class: 'kb-seta perigo', title: 'Cancelar tarefa', onclick: async () => {
          const ok = await confirmar('Cancelar tarefa?', `“${t.titulo}” sai do quadro (fica registrada como cancelada).`, { ok: 'Cancelar tarefa', perigo: true });
          if (ok) await mover(t, 'cancelada');
        } }, '✕') : null));
    node.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', t.id));
    return node;
  };

  const coluna = (sit) => {
    const col = el('div', { class: 'kb-col' },
      el('h3', { class: 'sub-titulo' }, sit.nome, ' ', el('span', { class: 'sub' }, String(tarefas.filter(t => t.situacao === sit.id).length))),
      tarefas.filter(t => t.situacao === sit.id).map(cartao));
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('kb-sobre'); });
    col.addEventListener('dragleave', () => col.classList.remove('kb-sobre'));
    col.addEventListener('drop', (e) => {
      e.preventDefault(); col.classList.remove('kb-sobre');
      const id = e.dataTransfer.getData('text/plain');
      const t = tarefas.find(x => x.id === id);
      if (t && t.situacao !== sit.id) mover(t, sit.id);
    });
    return col;
  };

  // criação rápida
  const inTitulo = el('input', { type: 'text', maxlength: 140, placeholder: 'Nova tarefa…' });
  const selResp = select(profs.map(p => ({ id: p.id, nome: abreviarNome(p.nome) })), { placeholder: 'Responsável…' });
  const inPrazo = el('input', { type: 'date' });
  const criar = el('div', { class: 'kb-nova' }, inTitulo, selResp, inPrazo,
    el('button', { class: 'btn sm', onclick: async () => {
      if (!inTitulo.value.trim()) { toast('Dê um título à tarefa.', 'erro'); return; }
      await s.criarTarefa({ titulo: inTitulo.value.trim(), situacao: 'aberta',
        responsaveis: selResp.value ? [selResp.value] : [],
        prazo: inPrazo.value ? new Date(inPrazo.value + 'T23:59:59').getTime() : null,
        criadoPor: user.nome });
      inTitulo.value = ''; selResp.value = ''; inPrazo.value = '';
      toast('Tarefa criada.');
    } }, 'Criar'));

  return el('section', { class: 'card' },
    el('h2', {}, apenasProf ? 'Minhas tarefas' : 'Tarefas da seção ',
      apenasProf ? null : el('span', { class: 'sub' }, '(fora da pontuação do art. 11 — arraste entre colunas)')),
    apenasProf ? null : criar,
    el('div', { class: 'kb-grid' }, SITUACOES_TAREFA.map(coluna)));
}
