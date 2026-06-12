// Aplica o tema antes da primeira pintura (evita "flash" de tema incorreto).
(function () {
  var salvo = null;
  try { salvo = localStorage.getItem('seng-tema'); } catch (e) {}
  var tema = salvo || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');
  document.documentElement.dataset.tema = tema;
})();
