import { state } from "./state.js";
import {
  mostrarNotificacao,
  baixarRelatorioCSV,
  debounce,
  formatarDataLocal,
} from "./utils.js";
import {
  mudarPagina,
  atualizarListaRotas,
  atualizarPaginaFinanceiro,
  atualizarPerfilUsuario,
} from "./ui.js";
import {
  carregarDados,
  carregarDadosLocal,
  pararSincronizacao,
  persistirConfig,
  LOCAL_KEYS,
} from "./storage.js";
import {
  PRECO_GASOLINA_PADRAO,
  CONSUMO_MEDIO_PADRAO,
  NOME_MOTORISTA_MAX_CHARS,
  DEBOUNCE_META_MS,
} from "./constants.js";
import { salvarNovaRota } from "./routes.js";
import { inicializarCalendario } from "./calendar.js";
import { initPadronizador } from "./padronizador.js";
let idParaExcluir = null;

// ============================================
// INICIALIZAÇÃO DO APLICATIVO
// ============================================
function inicializarApp() {
  // Evita rodar inicialização na tela de login
  if (window.location.pathname.endsWith("index.html")) {
    return;
  }

  // Verificar Firebase
  if (!window.firebaseDb || !window.firebaseDb.db) {
    console.error("Firebase não configurado corretamente");
    mostrarNotificacao("Modo offline ativado.", "warning");
    inicializarModoOffline();
    return;
  }

  state.db = window.firebaseDb;
  configurarEventListeners();
  inicializarCalendario();
  initPadronizador();
  carregarDados();

  // Inicializa Tema (Dark/Light) se existir a função
  inicializarTema();

  configurarPromptInstalacao();
}

function configurarPromptInstalacao() {
  const card = document.getElementById("cardInstalarApp");
  const btn = document.getElementById("btnInstalarApp");
  if (!card || !btn) return;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (isStandalone) return;

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    card.style.display = "block";
  });

  btn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === "accepted") card.style.display = "none";
  });

  window.addEventListener("appinstalled", () => {
    card.style.display = "none";
    deferredPrompt = null;
  });
}

function inicializarModoOffline() {
  configurarEventListeners();
  carregarDadosLocal();
  inicializarTema();
  initPadronizador();
  configurarPromptInstalacao();
}

// ============================================
// TEMA (Dark/Light)
// ============================================

// 1. Função auxiliar para mudar a cor da barra
function atualizarCorDaBarra(tema) {
  // Busca a tag diretamente pelo 'name', é mais garantido que usar ID em meta tags
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');

  if (metaThemeColor) {
    const cor = tema === "dark" ? "#1a202c" : "#f1f1f1";
    metaThemeColor.setAttribute("content", cor);
  } else {
    console.warn("Tag meta theme-color não encontrada no HTML.");
  }
}

// AbortController do listener do toggle de tema. inicializarTema é chamado 2x
// (DOMContentLoaded + dentro de inicializarApp); o abort evita listeners duplicados.
let temaToggleAbort = null;

function inicializarTema() {
  const toggle = document.getElementById("toggleTema");
  let temaSalvo = localStorage.getItem(LOCAL_KEYS.tema);

  if (!temaSalvo) {
    const sistemaPedeEscuro =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    temaSalvo = sistemaPedeEscuro ? "dark" : "light";
  }

  if (temaSalvo === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    atualizarCorDaBarra("dark");
    if (toggle) toggle.checked = true;
  } else {
    document.documentElement.setAttribute("data-theme", "light");
    atualizarCorDaBarra("light");
    if (toggle) toggle.checked = false;
  }

  if (!toggle) return;

  if (temaToggleAbort) temaToggleAbort.abort();
  temaToggleAbort = new AbortController();

  toggle.addEventListener(
    "change",
    (e) => {
      const novoTema = e.target.checked ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", novoTema);
      localStorage.setItem(LOCAL_KEYS.tema, novoTema);
      atualizarCorDaBarra(novoTema);
    },
    { signal: temaToggleAbort.signal },
  );
}

// GARANTIA MÁXIMA: Só roda o código depois que o HTML inteiro foi carregado
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarTema);
} else {
  inicializarTema();
}

// ============================================
// HELPERS DE MODAL (compartilhados pelos handlers)
// ============================================
function resetFormRegistrarRota(textoBotao = "Salvar Rota") {
  const form = document.getElementById("formRegistrarRota");
  if (!form) return;
  form.reset();
  delete form.dataset.editingId;
  const btnSubmit = form.querySelector('button[type="submit"]');
  if (btnSubmit) btnSubmit.textContent = textoBotao;
}

function abrirModalPorId(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add("active");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
  // Foca o primeiro elemento interativo para leitores de tela e teclado
  const focusable = modal.querySelector(
    "input:not([type=hidden]), select, textarea, button:not([disabled])",
  );
  if (focusable) {
    // setTimeout pra esperar o modal renderizar antes do foco
    setTimeout(() => focusable.focus(), 50);
  }
}

function fecharModalPorId(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove("active");
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
}

// ESC fecha qualquer modal aberto
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const aberto = document.querySelector(".modal.active");
  if (!aberto) return;
  fecharModalPorId(aberto.id);
  if (aberto.id === "modalRegistrarRota") resetFormRegistrarRota();
  if (aberto.id === "modalConfirmarExclusao") idParaExcluir = null;
});

// ============================================
// CONFIGURAÇÃO DE EVENT LISTENERS (orquestrador)
// ============================================
function configurarEventListeners() {
  configurarPrecoGasolina();
  configurarConsumoMedio();
  configurarCliquesGlobais();
  configurarSubmitRota();
  configurarNavegacao();
  configurarFechamentoOverlay();
  configurarMotoristas();
  configurarModalExclusao();
  configurarFiltrosExtras();
  configurarLogout();
}

function configurarPrecoGasolina() {
  const input = document.getElementById("inputPrecoGasolina");
  if (!input) return;
  const salvo = localStorage.getItem(LOCAL_KEYS.precoGasolina);
  state.precoGasolina = salvo ? parseFloat(salvo) : PRECO_GASOLINA_PADRAO;
  input.value = state.precoGasolina.toFixed(2);

  input.addEventListener("change", (e) => {
    let novo = parseFloat(e.target.value);
    if (isNaN(novo) || novo <= 0) novo = PRECO_GASOLINA_PADRAO;
    state.precoGasolina = novo;
    persistirConfig(LOCAL_KEYS.precoGasolina, novo);
    mostrarNotificacao(`Gasolina: R$ ${novo.toFixed(2)}`, "success");
  });
}

function configurarConsumoMedio() {
  const input = document.getElementById("inputConsumoMedio");
  if (!input) return;
  const salvo = localStorage.getItem(LOCAL_KEYS.consumoMedio);
  state.consumoMedio = salvo ? parseFloat(salvo) : CONSUMO_MEDIO_PADRAO;
  input.value = state.consumoMedio.toFixed(1);

  input.addEventListener("change", (e) => {
    let novo = parseFloat(e.target.value);
    if (isNaN(novo) || novo <= 0) novo = CONSUMO_MEDIO_PADRAO;
    state.consumoMedio = novo;
    persistirConfig(LOCAL_KEYS.consumoMedio, novo);
    mostrarNotificacao(`Média ajustada: ${novo.toFixed(1)} km/l`, "success");
  });
}

function preencherFormularioEdicao(rota) {
  const elPlataforma = document.getElementById("plataformaRota");
  const elKm = document.getElementById("kmPercorridoInput");
  const elConsumo = document.getElementById("consumoInput");
  const elValor = document.getElementById("valorRota");
  const elData = document.getElementById("inputDataRota");
  const elMotorista = document.getElementById("selectMotoristaRota");

  if (elPlataforma) elPlataforma.value = rota.plataforma;
  if (elKm) elKm.value = rota.kmPercorridos;
  if (elConsumo) elConsumo.value = rota.consumoUtilizado || CONSUMO_MEDIO_PADRAO;
  if (elValor) elValor.value = rota.valor;

  atualizarSelectMotoristas();
  if (elMotorista && rota.motorista) elMotorista.value = rota.motorista;
  if (elData && rota.horarioInicio) elData.value = formatarDataLocal(rota.horarioInicio);

  const form = document.getElementById("formRegistrarRota");
  form.dataset.editingId = rota.id;
  const btnSubmit = form.querySelector('button[type="submit"]');
  if (btnSubmit) btnSubmit.textContent = "Atualizar Rota";
}

function configurarCliquesGlobais() {
  document.addEventListener("click", (e) => {
    // Abrir modal de nova rota
    if (e.target.closest("#btnRegistrarRota")) {
      e.preventDefault();
      resetFormRegistrarRota();
      abrirModalPorId("modalRegistrarRota");

      const inputData = document.getElementById("inputDataRota");
      if (inputData) {
        const hojeFormatado = formatarDataLocal(new Date());
        inputData.value = hojeFormatado;
        inputData.max = hojeFormatado;
      }
      atualizarSelectMotoristas();
      return;
    }

    // Cancelar modal
    if (
      e.target.closest("#btnCancelarRegistro") ||
      e.target.closest("#btnCancelarRota")
    ) {
      e.preventDefault();
      fecharModalPorId("modalRegistrarRota");
      resetFormRegistrarRota();
      return;
    }

    // Excluir (abre modal de confirmação)
    const btnExcluir = e.target.closest(".btn-excluir");
    if (btnExcluir) {
      idParaExcluir = btnExcluir.dataset.id;
      abrirModalPorId("modalConfirmarExclusao");
      return;
    }

    // Editar
    const btnEditar = e.target.closest(".btn-editar");
    if (btnEditar) {
      const id = btnEditar.dataset.id;
      const rota = state.rotas.find((r) => r.id.toString() === id.toString());
      if (!rota) return;
      preencherFormularioEdicao(rota);
      abrirModalPorId("modalRegistrarRota");
    }
  });
}

function configurarSubmitRota() {
  document.removeEventListener("submit", handleSubmitRota);
  document.addEventListener("submit", handleSubmitRota);
}

function configurarNavegacao() {
  document.querySelectorAll(".menu-item_link").forEach((link) => {
    link.addEventListener("click", (e) => {
      const pagina = link.getAttribute("data-pagina");
      if (!pagina) return;
      mudarPagina(e, pagina);
      if (pagina === "financeiro") atualizarPaginaFinanceiro();
      if (pagina === "config") atualizarPerfilUsuario();
    });
  });
}

function configurarFechamentoOverlay() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.onclick = (e) => {
      if (e.target !== modal) return;
      fecharModalPorId(modal.id);
      if (modal.id === "modalRegistrarRota") resetFormRegistrarRota();
      if (modal.id === "modalConfirmarExclusao") idParaExcluir = null;
    };
  });
}

function configurarMotoristas() {
  const inputM1 = document.getElementById("configMotorista1");
  const inputM2 = document.getElementById("configMotorista2");
  const btnSalvarNomes = document.getElementById("btnSalvarNomes");
  const selectRota = document.getElementById("selectMotoristaRota");
  const selectFiltroFin = document.getElementById("filtroMotoristaFin");

  if (inputM1) inputM1.value = localStorage.getItem(LOCAL_KEYS.motorista1) || "";
  if (inputM2) inputM2.value = localStorage.getItem(LOCAL_KEYS.motorista2) || "";

  // <option> via createElement: value/textContent não interpretam HTML
  const adicionarOption = (select, value, label) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  };

  window.atualizarSelectMotoristas = function () {
    const nome1 = (localStorage.getItem(LOCAL_KEYS.motorista1) || "Motorista 1").slice(0, NOME_MOTORISTA_MAX_CHARS);
    const nome2 = (localStorage.getItem(LOCAL_KEYS.motorista2) || "Motorista 2").slice(0, NOME_MOTORISTA_MAX_CHARS);

    if (selectRota) {
      selectRota.replaceChildren();
      adicionarOption(selectRota, nome1, nome1);
      adicionarOption(selectRota, nome2, nome2);
    }

    if (selectFiltroFin) {
      const valorAtual = selectFiltroFin.value;
      selectFiltroFin.replaceChildren();
      adicionarOption(selectFiltroFin, "todos", "Todos");
      adicionarOption(selectFiltroFin, nome1, nome1);
      adicionarOption(selectFiltroFin, nome2, nome2);
      if (
        valorAtual &&
        (valorAtual === "todos" || valorAtual === nome1 || valorAtual === nome2)
      ) {
        selectFiltroFin.value = valorAtual;
      }
    }
  };

  atualizarSelectMotoristas();

  if (!btnSalvarNomes) return;
  const limparNome = (raw) =>
    String(raw || "")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, NOME_MOTORISTA_MAX_CHARS);

  btnSalvarNomes.addEventListener("click", () => {
    const n1 = limparNome(inputM1.value) || "Motorista 1";
    const n2 = limparNome(inputM2.value) || "Motorista 2";
    inputM1.value = n1;
    inputM2.value = n2;
    localStorage.setItem(LOCAL_KEYS.motorista1, n1);
    localStorage.setItem(LOCAL_KEYS.motorista2, n2);
    atualizarSelectMotoristas();
    mostrarNotificacao("Nomes atualizados!", "success");
  });
}

function configurarModalExclusao() {
  const btnConfirmar = document.getElementById("btnConfirmarExclusao");
  const btnCancelar = document.getElementById("btnCancelarExclusao");
  const modal = document.getElementById("modalConfirmarExclusao");

  const fechar = () => {
    if (modal) fecharModalPorId(modal.id);
    idParaExcluir = null;
  };

  if (btnConfirmar) {
    btnConfirmar.onclick = () => {
      if (!idParaExcluir) return;
      const id = idParaExcluir;
      fechar();
      import("./routes.js").then((mod) => {
        if (mod.excluirRota) mod.excluirRota(id);
        else console.error("Função excluirRota não encontrada em routes.js");
      });
    };
  }
  if (btnCancelar) btnCancelar.onclick = fechar;
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) fechar();
    };
  }
}

// ============================================
// FUNÇÃO GLOBAL DE SUBMIT (LIGAÇÃO COM ROUTES.JS)
// ============================================
function handleSubmitRota(e) {
  if (
    e.target &&
    (e.target.id === "formRegistrarRota" || e.target.id === "formEncerrarRota")
  ) {
    e.preventDefault();
    salvarNovaRota(e);
  }
}

function configurarFiltrosExtras() {
  // Filtro Mês
  const filtroRotasInput = document.getElementById("filtroRotasMes");
  if (filtroRotasInput) {
    const hoje = new Date();
    const atual = `${hoje.getFullYear()}-${(hoje.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;
    if (!filtroRotasInput.value) filtroRotasInput.value = atual;

    filtroRotasInput.onchange = () => atualizarListaRotas();
  }

  // Filtro App
  const filtroRotasApp = document.getElementById("filtroRotasApp");
  if (filtroRotasApp) {
    filtroRotasApp.onchange = () => atualizarListaRotas();
  }

  // Exportar CSV
  const btnExportar = document.getElementById("btnExportarCSV");
  if (btnExportar && filtroRotasInput) {
    btnExportar.onclick = () => {
      const mesSelecionado = filtroRotasInput.value;
      if (!mesSelecionado) {
        baixarRelatorioCSV();
        return;
      }
      const [anoF, mesF] = mesSelecionado.split("-");
      const filtradas = state.rotas.filter((r) => {
        const d = new Date(r.horarioInicio);
        return (
          d.getFullYear().toString() === anoF &&
          (d.getMonth() + 1).toString().padStart(2, "0") === mesF
        );
      });
      baixarRelatorioCSV(filtradas);
    };
  }

  // Filtro Financeiro
  const btnFiltrarFin = document.getElementById("btnFiltrarFinanceiro");
  if (btnFiltrarFin) {
    btnFiltrarFin.onclick = () => {
      atualizarPaginaFinanceiro();
      mostrarNotificacao("Filtro aplicado!", "success");
    };
  }

  // Metas
  configurarMetas();
}

function configurarLogout() {
  const acaoLogout = () => {
    if (confirm("Tem certeza que deseja sair?")) {
      pararSincronizacao();
      if (window.firebaseDb?.auth) {
        window.firebaseDb.auth.signOut().then(() => {
          window.location.href = "index.html";
        });
      } else {
        window.location.href = "index.html";
      }
    }
  };

  const btn1 = document.getElementById("btnConfigLogout");
  if (btn1) btn1.onclick = acaoLogout;

  const btn2 = document.getElementById("btnLogout");
  if (btn2) btn2.onclick = acaoLogout;
}

function configurarMetas() {
  const inputDiaria = document.getElementById("inputMetaDiaria");
  const inputDias = document.getElementById("inputMetaDias");

  if (inputDiaria && inputDias) {
    const obterMes = () => {
      const h = new Date();
      return `${h.getFullYear()}-${(h.getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;
    };

    const metaSalva = localStorage.getItem(LOCAL_KEYS.metaMensal);
    const mesAtual = obterMes();

    if (metaSalva) {
      try {
        const p = JSON.parse(metaSalva);
        if (p.mesRef === mesAtual) {
          state.meta = p;
          inputDiaria.value = p.diaria || "";
          inputDias.value = p.dias || "";
        } else {
          state.meta = { diaria: 0, dias: 0, mesRef: mesAtual };
          localStorage.removeItem(LOCAL_KEYS.metaMensal);
          inputDiaria.value = "";
          inputDias.value = "";
        }
      } catch (e) {}
    }

    // Atualiza UI imediatamente; persiste (local + Firestore) com debounce
    const persistirMeta = debounce(() => {
      persistirConfig(LOCAL_KEYS.metaMensal, state.meta);
    }, DEBOUNCE_META_MS);
    const onChangeMeta = () => {
      state.meta = {
        diaria: parseFloat(inputDiaria.value) || 0,
        dias: parseFloat(inputDias.value) || 0,
        mesRef: obterMes(),
      };
      import("./ui.js").then((ui) => ui.atualizarGraficoMeta());
      persistirMeta();
    };

    inputDiaria.oninput = onChangeMeta;
    inputDias.oninput = onChangeMeta;
    import("./ui.js").then((ui) => ui.atualizarGraficoMeta());
  }
}

// ============================================
// INICIALIZAÇÃO SEGURA (NO FINAL DO MAIN.JS)
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  // Verifica se estamos na tela de login
  const isLoginPage =
    window.location.pathname.endsWith("index.html") ||
    window.location.pathname.endsWith("/") ||
    window.location.pathname === "/rota-track/";

  // Verificação de Auth
  if (window.firebaseDb && window.firebaseDb.auth) {
    const unsubscribe = window.firebaseDb.auth.onAuthStateChanged((user) => {
      // --- CENÁRIO 1: SUCESSO ---
      if (user && user.emailVerified) {
        if (isLoginPage) {
          window.location.href = "inicio.html";
          return;
        }
        if (!window.appInicializado) {
          window.appInicializado = true;
          inicializarApp();
        }
      }

      // --- CENÁRIO 2: NÃO VERIFICADO ---
      else if (user && !user.emailVerified) {
        console.warn("Email não verificado. Deslogando...");
        window.firebaseDb.auth.signOut();
        if (!isLoginPage) {
          window.location.replace("./index.html");
        }
      }

      // --- CENÁRIO 3: NINGUÉM LOGADO ---
      else {
        if (!isLoginPage) {
          window.location.replace("./index.html");
        }
      }
    });
  } else {
    // Modo Offline
    if (!isLoginPage) inicializarApp();
  }
});
