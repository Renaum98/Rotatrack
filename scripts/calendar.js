import { state } from "./state.js";

let dataAtualCalendario = new Date();
// Permite cancelar os listeners do calendário se inicializar for chamado de novo
let calendarioListenersAbort = null;

export function inicializarCalendario() {
  renderizarCalendario();

  const btnPrev = document.getElementById("btnPrevMonth");
  const btnNext = document.getElementById("btnNextMonth");
  if (!btnPrev || !btnNext) return;

  // Cancela listeners anteriores (se inicializarCalendario for chamado mais de uma vez)
  if (calendarioListenersAbort) calendarioListenersAbort.abort();
  calendarioListenersAbort = new AbortController();
  const { signal } = calendarioListenersAbort;

  btnPrev.addEventListener(
    "click",
    () => {
      dataAtualCalendario.setMonth(dataAtualCalendario.getMonth() - 1);
      renderizarCalendario();
    },
    { signal },
  );

  btnNext.addEventListener(
    "click",
    () => {
      dataAtualCalendario.setMonth(dataAtualCalendario.getMonth() + 1);
      renderizarCalendario();
    },
    { signal },
  );
}

export function renderizarCalendario() {
  const grid = document.getElementById("calendarGrid");
  const titulo = document.getElementById("calendarTitle");
  
  if (!grid || !titulo) return;

  grid.innerHTML = ""; 

  const ano = dataAtualCalendario.getFullYear();
  const mes = dataAtualCalendario.getMonth(); 

  // Título
  const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(dataAtualCalendario);
  titulo.textContent = `${nomeMes} ${ano}`;

  // --- LÓGICA AJUSTADA PARA COMEÇAR NA SEGUNDA-FEIRA ---
  
  // 1. Pega o dia da semana do dia 1 do mês (0=Dom, 1=Seg, ..., 6=Sab)
  let diaSemanaPrimeiroDia = new Date(ano, mes, 1).getDay();
  
  // 2. Converte para o padrão onde Segunda é 0 e Domingo é 6
  // Se for Domingo (0), vira 7. Depois subtrai 1.
  // Seg(1)->0, Ter(2)->1, ..., Sab(6)->5, Dom(0)->6
  if (diaSemanaPrimeiroDia === 0) {
      diaSemanaPrimeiroDia = 7;
  }
  const espacosVazios = diaSemanaPrimeiroDia - 1;

  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date();
  
  // Mapa de Rotas
  const rotasPorDia = {};
  if (state.rotas && Array.isArray(state.rotas)) {
      state.rotas.forEach(rota => {
          if (!rota.horarioInicio) return;
          const d = new Date(rota.horarioInicio);
          const chave = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          if (rotasPorDia[chave]) {
              rotasPorDia[chave]++;
          } else {
              rotasPorDia[chave] = 1;
          }
      });
  }

  // Monta tudo num fragmento, depois insere de uma vez no grid (1 reflow só)
  const frag = document.createDocumentFragment();

  // 1. Espaços vazios (até o primeiro dia do mês — começo na segunda)
  for (let i = 0; i < espacosVazios; i++) {
    const vazio = document.createElement("div");
    vazio.classList.add("calendar-day", "faded");
    frag.appendChild(vazio);
  }

  // 2. Dias do Mês
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const elDia = document.createElement("div");
    elDia.classList.add("calendar-day");

    if (dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear()) {
      elDia.classList.add("today");
    }

    const spanNumero = document.createElement("span");
    spanNumero.textContent = dia;
    elDia.appendChild(spanNumero);

    const chaveDia = `${ano}-${mes}-${dia}`;
    if (rotasPorDia[chaveDia]) {
      const badge = document.createElement("div");
      badge.classList.add("day-badge");
      badge.textContent = rotasPorDia[chaveDia];
      elDia.appendChild(badge);
    }

    frag.appendChild(elDia);
  }

  grid.appendChild(frag);
}