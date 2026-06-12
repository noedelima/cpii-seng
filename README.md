# SENG Demandas — Colégio Pedro II

Sistema de gerenciamento de demandas de obras e serviços de engenharia da
**Seção de Engenharia (SENG/DECOF)** do Colégio Pedro II, em atendimento à
**Portaria nº 7503/REITORIA/CPII, de 24/11/2025**.

Substitui o formulário anual por **cadastro contínuo**: os campi registram
solicitações a qualquer tempo, a SENG faz a triagem e a avaliação **GUT**
(Gravidade, Urgência e Tendência), o **CODIR** aprova a fila e o sistema
controla a alocação de profissionais com a pontuação dos arts. 11–13.

## Funcionalidades
- **Dashboard público** (sem login): resumo clicável por status, gráficos por
  campus/tipo, fila priorizada com filtros e busca.
- **Relatório PDF efêmero** em papel timbrado, com data/hora de geração —
  baixa na hora, nada fica armazenado. Versão pública omite profissionais.
- **Cadastro contínuo de solicitações** pelos campi (Prefeito/DIAD e
  delegados), com máximo de campos de seleção, indicação de projeto
  existente × necessidade de contratação e sinalização de emergência.
- **Avaliação GUT** com as mesmas escalas do modelo em PowerBI da SENG,
  faixas de valor/prazo, **fator de ajuste** com justificativa (deliberação
  CODIR), caixa de **aprovação do CODIR** e fluxo completo de **status**
  (Recebido → Em análise → Em diligência → Aguardando CODIR → Na fila →
  Em atendimento → Concluído, além de Suspenso, Cancelado e Não enquadrado).
- **Trava funcional**: demandas em atendimento não podem ser excluídas nem
  ter classificação alterada (interface **e** Security Rules).
- **Profissionais**: cadastro, alocação de Fiscal Técnico Titular/Substituto e
  equipes de planejamento, contabilização automática de pontos (art. 11),
  limite de 6 pontos (art. 12) e monitor do art. 13.
- **Perfis**: Campus, Engenharia, Chefe de Seção e Administrador.
- Identidade visual CP2, **temas claro/escuro**, responsivo e acessível.

## Arquitetura
SPA estática (ES Modules, sem build) publicada no **GitHub Pages**.
Backend em **Firebase Auth + Cloud Firestore** com regras de segurança
restritivas (`firebase/firestore.rules`). Sem configuração de Firebase, o
sistema roda em **modo demonstração** (dados fictícios em `localStorage`),
com usuários de teste exibidos na tela de login.

```
index.html            shell + CSP
css/app.css           design system (temas claro/escuro)
js/config.js          domínio: campi, status, escalas GUT, papéis
js/calc.js            GUT, faixas, prioridade, pontos art. 11, arts. 12–13
js/store.js           camada de dados (demo) + seleção de provedor
js/firebase-provider.js  provedor de produção (Auth + Firestore)
js/seed.js            dados fictícios do modo demonstração
js/views/*.js         dashboard, login, solicitação, demanda, profissionais, admin
js/pdf.js             relatório PDF efêmero (papel timbrado, jsPDF sob demanda)
firebase/             Security Rules + guia de ativação (SETUP.md)
```

## Produção
Siga **[firebase/SETUP.md](firebase/SETUP.md)** (~15 min): criar projeto
Firebase, ativar e-mail/senha, publicar as rules, criar perfis e colar a
config em `js/firebase-config.js`. A `apiKey` Web do Firebase não é segredo;
o controle de acesso é feito pelas Security Rules.

## Cálculo de priorização
`GUT = G×U×T` (escalas 1–5) · `ScoreValor` 1–5 por faixas múltiplas do valor
de referência do art. 75-I da Lei 14.133/2021 (parametrizável) ·
`ScorePrazo` 3/2/1 · `Prazo×Custo = (V/5 + P/3)/2` ·
**Prioridade = 0,75·(GUT/125) + 0,25·(Prazo×Custo) + ajuste CODIR**.
Pontos de complexidade conforme art. 11 (+1 para bem tombado), com
contabilização por profissional e alertas dos limites dos arts. 12 e 13.

---
Desenvolvido para a SENG/DECOF · Colégio Pedro II · 2026.
