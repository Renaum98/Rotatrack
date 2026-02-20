// ============================================
// ESTADO GLOBAL DA APLICAÇÃO
// ============================================

export const state = {
  db: null,
  rotas: [],
  rotaAtual: null,
  veiculoSelecionado: null,
  precoGasolina: 6.35,
  meta: {
    diaria: 0,
    dias: 0,
  },
  chartInstance: null,
  listenerUnsubscribe: null,
};
