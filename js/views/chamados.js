// =============================================================================
// Painel de chamados — intake da SENG. SENG vê todos; campus vê os do seu campus.
// Ordena por status operacional e prazo (SLA); filtros por situação/campus/categoria.
// =============================================================================
import { el, frag, fmtData, select, debounce, toast } from '../ui.js';
import {
  CAMPI, CATEGORIAS_CHAMADO, STATUS_CHAMADO, STATUS_CHAMADO_ORDEM, STATUS_CHAMADO_ABERTO,
  statusChamadoNome, statusChamadoCor, categoriaChamadoNome, campusNome, slaChamado,
} from '../config.js';
import { store } from '../store.js';
import { can } from '../auth.js';

// Estado dos filtros (persiste durante a sessão de navegação).
const filtro = { situacao: 'triagem', campus: '', categoria: '', texto: '' };
// Filtros do ARQUIVO (recorte próprio — histórico dos encerrados).
const filtroArq = { status: '', campus: '', categoria: '', texto: '' };
// Status terminais (encerrados) — compõem o arquivo.
const TERMINAIS = STATUS_CHAMADO.filter(st => !STATUS_CHAMADO_ABERTO.includes(st.id));

const SLA_ROTULO = {
  'no-prazo': (d) => ({ txt: `no prazo · ${d}d`, cls: 'sla-ok' }),
  'vencendo': (d) => ({ txt: d <= 0 ? 'vence hoje' : `vence em ${d}d`, cls: 'sla-alerta' }),
  'vencido': (d) => ({ txt: `atrasado ${Math.abs(d)}d`, cls: 'sla-vencido' }),
  'pausado': (d) => ({ txt: `pausado · ${d}d`, cls: 'sla-pausado' }),
  'encerrado': () => ({ txt: '—', cls: 'sla-neutro' }),
};

export function viewChamados(rerender, modo = 'ativos') {
  const s = store();
  const user = s.user;
  if (!user) { location.hash = '#/login'; return frag(); }

  const arquivo = modo === 'arquivo';
  const f = arquivo ? filtroArq : filtro;
  // Situações encerradas migraram para o recorte Arquivados.
  if (!arquivo && ['encerrados', 'todos'].includes(filtro.situacao)) filtro.situacao = 'triagem';

  const todos = s.listChamados();
  const ordStatus = (st) => { const i = STATUS_CHAMADO_ORDEM.indexOf(st); return i < 0 ? 99 : i; };

  const filtrados = todos.filter(c => {
    if (arquivo) {
      if (STATUS_CHAMADO_ABERTO.includes(c.status)) return false; // só encerrados
      if (f.status && c.status !== f.status) return false;
    } else {
      if (STATUS_CHAMADO_ABERTO.includes(c.status) === false) return false; // só ativos
      if (f.situacao === 'triagem' && !['aberto', 'triagem', 'diligencia'].includes(c.status)) return false;
      if (f.situacao === 'atendimento' && c.status !== 'atendimento') return false;
      if (f.situacao === 'atraso' && slaChamado(c).estado !== 'vencido') return false;
    }
    if (f.campus && c.campus !== f.campus) return false;
    if (f.categoria && c.categoria !== f.categoria) return false;
    if (f.texto) {
      const q = f.texto.toLowerCase();
      const alvo = `${c.id} ${c.assunto || ''} ${c.local || ''}`.toLowerCase();
      if (!alvo.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => arquivo
    ? (b.atualizadoEm || b.aberturaEm || 0) - (a.atualizadoEm || a.aberturaEm || 0) // histórico: mais recente primeiro
    : (ordStatus(a.status) - ordStatus(b.status)
      || (a.prazoLimite || Infinity) - (b.prazoLimite || Infinity)
      || (b.aberturaEm || 0) - (a.aberturaEm || 0)));

  // --- Filtros ---
  let selPrincipal;
  if (arquivo) {
    selPrincipal = select(TERMINAIS, { value: f.status, placeholder: 'Todos os desfechos' });
    selPrincipal.onchange = () => { f.status = selPrincipal.value; rerender(); };
  } else {
    selPrincipal = select([
      { id: 'triagem', nome: 'Cadastro e triagem' }, { id: 'atendimento', nome: 'Em atendimento' },
      { id: 'ativos', nome: 'Todos os ativos' }, { id: 'atraso', nome: 'Em atraso (SLA)' },
    ], { value: f.situacao, placeholder: null });
    selPrincipal.onchange = () => { f.situacao = selPrincipal.value; rerender(); };
  }

  const selCampus = select(CAMPI, { value: f.campus, placeholder: 'Todos os campi' });
  selCampus.onchange = () => { f.campus = selCampus.value; rerender(); };

  const selCat = select(CATEGORIAS_CHAMADO, { value: f.categoria, placeholder: 'Todas as categorias' });
  selCat.onchange = () => { f.categoria = selCat.value; rerender(); };

  const inBusca = el('input', { type: 'search', placeholder: 'Buscar nº, assunto, local…', value: f.texto });
  inBusca.oninput = debounce(() => { f.texto = inBusca.value.trim(); rerender(); }, 250);

  const filtros = el('div', { class: 'chamados-filtros' },
    el('label', { class: 'campo compacto' }, el('span', { class: 'campo-label' }, arquivo ? 'Desfecho' : 'Situação'), selPrincipal),
    el('label', { class: 'campo compacto' }, el('span', { class: 'campo-label' }, 'Campus'), selCampus),
    el('label', { class: 'campo compacto' }, el('span', { class: 'campo-label' }, 'Categoria'), selCat),
    el('label', { class: 'campo compacto cresce' }, el('span', { class: 'campo-label' }, 'Busca'), inBusca));

  // --- Tabela ---
  let corpo;
  if (!filtrados.length) {
    corpo = el('p', { class: 'vazio' }, arquivo
      ? 'Nenhum chamado arquivado ainda — os encerrados (resolvidos, encaminhados, improcedentes, duplicados, cancelados e convertidos em obra) aparecem aqui.'
      : todos.length
        ? 'Nenhum chamado corresponde aos filtros.'
        : 'Nenhum chamado ainda. Use “Abrir chamado” para registrar a primeira solicitação à Engenharia.');
  } else {
    const linhas = filtrados.map(c => {
      const sla = slaChamado(c);
      const r = (SLA_ROTULO[sla.estado] || SLA_ROTULO.encerrado)(sla.dias);
      return el('a', { class: 'chamado-linha', href: `#/chamado/${c.id}` },
        el('span', { class: 'ch-id mono' }, c.id),
        el('span', { class: 'ch-assunto' },
          el('strong', {}, c.assunto || '(sem assunto)'),
          el('span', { class: 'ch-sub' }, `${categoriaChamadoNome(c.categoria)} · ${campusNome(c.campus)}`)),
        el('span', { class: `badge ${statusChamadoCor(c.status)}` }, statusChamadoNome(c.status)),
        el('span', { class: `ch-sla ${r.cls}` }, r.txt),
        el('span', { class: 'ch-data' }, fmtData(c.atualizadoEm || c.aberturaEm)));
    });
    corpo = el('div', { class: 'chamados-tabela' },
      el('div', { class: 'chamado-linha cabec' },
        el('span', {}, 'Nº'), el('span', {}, 'Assunto'), el('span', {}, 'Status'),
        el('span', {}, 'Prazo (SLA)'), el('span', {}, 'Atualizado')),
      ...linhas);
  }

  const abrir = can(user, 'criar')
    ? el('a', { class: 'btn primario', href: '#/chamado-novo' }, '+ Abrir chamado') : null;

  // Botao de relatorio PDF (efemero) da lista filtrada.
  const btnPdf = el('button', { class: 'btn ghost', onclick: async () => {
    btnPdf.disabled = true; const t = btnPdf.textContent; btnPdf.textContent = 'Gerando…';
    try {
      const { gerarRelatorioChamados } = await import('../pdf.js');
      const desc = [
        arquivo ? (f.status ? `arquivo — desfecho: ${statusChamadoNome(f.status)}` : 'arquivo (encerrados)') : `situação: ${f.situacao}`,
        f.campus && `campus: ${campusNome(f.campus)}`,
        f.categoria && `categoria: ${categoriaChamadoNome(f.categoria)}`,
        f.texto && `busca: “${f.texto}”`,
      ].filter(Boolean).join('; ');
      await gerarRelatorioChamados({ chamados: filtrados, filtros: desc });
      toast('Relatório gerado. Não fica armazenado no sistema.');
    } catch (e) { toast('Falha ao gerar o PDF: ' + (e.message || e), 'erro'); }
    btnPdf.disabled = false; btnPdf.textContent = t;
  } }, 'Baixar PDF');

  // Resumo de SLA (alerta operacional) sobre os chamados ativos visíveis.
  const ativos = todos.filter(c => STATUS_CHAMADO_ABERTO.includes(c.status));
  const nVenc = ativos.filter(c => slaChamado(c).estado === 'vencido').length;
  const nVcndo = ativos.filter(c => slaChamado(c).estado === 'vencendo').length;
  const nPausa = ativos.filter(c => slaChamado(c).estado === 'pausado').length;
  const nPrazo = ativos.length - nVenc - nVcndo - nPausa;
  const pill = (txt, cls, sit) => el('button', { class: `sla-pill ${cls}`, onclick: () => { filtro.situacao = sit; rerender(); } }, txt);
  const resumoSla = (!arquivo && ativos.length) ? el('div', { class: 'sla-resumo' },
    pill(`${nPrazo} no prazo`, 'sla-ok', 'ativos'),
    pill(`${nVcndo} vencendo`, 'sla-alerta', 'ativos'),
    pill(`${nVenc} vencidos`, 'sla-vencido', 'atraso'),
    nPausa ? pill(`${nPausa} em diligência (SLA pausado)`, 'sla-pausado', 'ativos') : null) : null;

  const total = arquivo ? todos.filter(c => !STATUS_CHAMADO_ABERTO.includes(c.status)).length : todos.length;
  return frag(
    el('section', { class: 'hero' }, el('div', {},
      el('h1', {}, arquivo ? 'Arquivo de chamados' : 'Chamados'),
      el('p', { class: 'sub' }, arquivo
        ? 'Histórico dos chamados encerrados — resolvidos, encaminhados, improcedentes, duplicados, cancelados e convertidos em obra.'
        : user.role === 'campus'
          ? 'Solicitações da sua unidade à Seção de Engenharia.'
          : 'Cadastro e triagem da Seção de Engenharia — após a triagem, os chamados em atendimento entram na fila do Painel.')),
      el('div', { class: 'hero-acoes' }, arquivo ? null : abrir, (arquivo ? total : todos.length) ? btnPdf : null)),
    el('section', { class: 'card' }, filtros, resumoSla,
      el('p', { class: 'sub cont' }, `${filtrados.length} de ${total} chamado(s)`),
      corpo));
}
