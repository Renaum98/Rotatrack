import { state } from "./state.js";
import { mostrarNotificacao, baixarRelatorioCSV } from "./utils.js";
import {
  mudarPagina,
  atualizarListaRotas,
  atualizarPaginaFinanceiro,
  atualizarPerfilUsuario,
} from "./ui.js";
import { carregarDados, carregarDadosLocal } from "./storage.js";
import { salvarNovaRota } from "./routes.js";
import { inicializarCalendario } from "./calendar.js";

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
  carregarDados();

  // Inicializa Tema (Dark/Light) se existir a função
  inicializarTema();
}

function inicializarModoOffline() {
  configurarEventListeners();
  carregarDadosLocal();
  inicializarTema();
}

// ============================================
// TEMA (Dark/Light)
// ============================================
function inicializarTema() {
  const toggle = document.getElementById("toggleTema");
  const temaSalvo = localStorage.getItem("theme");

  if (temaSalvo === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    if (toggle) toggle.checked = true;
  } else {
    document.documentElement.setAttribute("data-theme", "light");
    if (toggle) toggle.checked = false;
  }

  if (toggle) {
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);

    newToggle.addEventListener("change", (e) => {
      if (e.target.checked) {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.setAttribute("data-theme", "light");
        localStorage.setItem("theme", "light");
      }
    });
  }
}

// ============================================
// CONFIGURAÇÃO DE EVENT LISTENERS
// ============================================
function configurarEventListeners() {
  // 1. Preço Gasolina
  const inputGasolina = document.getElementById("inputPrecoGasolina");
  if (inputGasolina) {
    const precoSalvo = localStorage.getItem("precoGasolina");
    // Se não tiver salvo, usa 6.35 como padrão
    state.precoGasolina = precoSalvo ? parseFloat(precoSalvo) : 6.35;
    inputGasolina.value = state.precoGasolina.toFixed(2);

    inputGasolina.addEventListener("change", (e) => {
      let novoPreco = parseFloat(e.target.value);
      if (isNaN(novoPreco) || novoPreco <= 0) novoPreco = 6.35;

      state.precoGasolina = novoPreco;
      localStorage.setItem("precoGasolina", novoPreco);
      mostrarNotificacao(`Gasolina: R$ ${novoPreco.toFixed(2)}`, "success");
    });
  }

  // B. MÉDIA KM/L (NOVO CÓDIGO AQUI)
  const inputConsumo = document.getElementById("inputConsumoMedio");
  if (inputConsumo) {
    const consumoSalvo = localStorage.getItem("consumoMedio");
    // Se não tiver salvo, usa 10.0 como padrão
    state.consumoMedio = consumoSalvo ? parseFloat(consumoSalvo) : 10.0;
    inputConsumo.value = state.consumoMedio.toFixed(1);

    inputConsumo.addEventListener("change", (e) => {
      let novoConsumo = parseFloat(e.target.value);
      if (isNaN(novoConsumo) || novoConsumo <= 0) novoConsumo = 10.0;

      state.consumoMedio = novoConsumo;
      localStorage.setItem("consumoMedio", novoConsumo);
      mostrarNotificacao(
        `Média ajustada: ${novoConsumo.toFixed(1)} km/l`,
        "success",
      );
    });
  }

  // =========================================================
  // 2. SISTEMA DE CLIQUES (MODAL, EDITAR, EXCLUIR)
  // =========================================================
  document.addEventListener("click", (e) => {
    // --- CASO 1: ABRIR MODAL (NOVA ROTA) ---
    // --- CASO 1: ABRIR MODAL (NOVA ROTA) ---
    const btnAbrir = e.target.closest("#btnRegistrarRota");
    if (btnAbrir) {
      e.preventDefault();

      // Limpeza Preventiva
      const form = document.getElementById("formRegistrarRota");
      if (form) {
        form.reset();
        delete form.dataset.editingId;
        const btnSubmit = form.querySelector('button[type="submit"]');
        if (btnSubmit) btnSubmit.textContent = "Salvar Rota";
      }

      // Abre o Modal
      const modal = document.getElementById("modalRegistrarRota");
      if (modal) {
        modal.classList.add("active");
        modal.style.display = "flex";
      }

      // Preenche Data de Hoje e BLOQUEIA FUTURO
      const inputData = document.getElementById("inputDataRota");
      if (inputData) {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, "0");
        const dia = String(hoje.getDate()).padStart(2, "0");

        const hojeFormatado = `${ano}-${mes}-${dia}`;

        inputData.value = hojeFormatado; // Define data padrão
        inputData.max = hojeFormatado; // <--- BLOQUEIA DATAS FUTURAS
      }

      atualizarSelectMotoristas();

      return;
    }

    // --- CASO 2: BOTÃO CANCELAR (FECHAR MODAL) ---
    const btnCancelar =
      e.target.closest("#btnCancelarRegistro") ||
      e.target.closest("#btnCancelarRota");
    if (btnCancelar) {
      e.preventDefault();

      const modal = document.getElementById("modalRegistrarRota");
      if (modal) {
        modal.classList.remove("active");
        modal.style.display = "none";
      }

      const form = document.getElementById("formRegistrarRota");
      if (form) {
        form.reset();
        delete form.dataset.editingId;
        const btnSubmit = form.querySelector('button[type="submit"]');
        if (btnSubmit) btnSubmit.textContent = "Salvar Rota";
      }
      return;
    }

    // --- CASO 3: BOTÃO EXCLUIR (X) ---
    const btnExcluir = e.target.closest(".btn-excluir");
    if (btnExcluir) {
      const id = btnExcluir.dataset.id;
      if (confirm("Deseja realmente apagar esta rota?")) {
        import("./routes.js").then((mod) => {
          if (mod.excluirRota) {
            mod.excluirRota(id);
          } else {
            console.error("Função excluirRota não encontrada em routes.js");
          }
        });
      }
      return;
    }

    // --- CASO 4: BOTÃO EDITAR (LÁPIS) ---
    const btnEditar = e.target.closest(".btn-editar");
    if (btnEditar) {
      const id = btnEditar.dataset.id;
      const rota = state.rotas.find((r) => r.id.toString() === id.toString());

      if (rota) {
        // 1. Preenche o formulário
        const elPlataforma = document.getElementById("plataformaRota");
        const elKm = document.getElementById("kmPercorridoInput");
        const elConsumo = document.getElementById("consumoInput");
        const elValor = document.getElementById("valorRota");
        const elData = document.getElementById("inputDataRota");
        // Preenche o motorista (NOVO)
        const elMotorista = document.getElementById("selectMotoristaRota");

        if (elPlataforma) elPlataforma.value = rota.plataforma;
        if (elKm) elKm.value = rota.kmPercorridos;
        if (elConsumo) elConsumo.value = rota.consumoUtilizado || 10;
        if (elValor) elValor.value = rota.valor;

        // Garante que o select tem os motoristas carregados antes de setar o valor
        atualizarSelectMotoristas();
        if (elMotorista && rota.motorista) {
          elMotorista.value = rota.motorista;
        }

        // Converter Data ISO para Input Date
        if (elData && rota.horarioInicio) {
          const d = new Date(rota.horarioInicio);
          const ano = d.getFullYear();
          const mes = String(d.getMonth() + 1).padStart(2, "0");
          const dia = String(d.getDate()).padStart(2, "0");
          elData.value = `${ano}-${mes}-${dia}`;
        }

        // 2. Marca o formulário como "Modo Edição"
        const form = document.getElementById("formRegistrarRota");
        form.dataset.editingId = id;

        // 3. Muda texto do botão
        const btnSubmit = form.querySelector('button[type="submit"]');
        if (btnSubmit) btnSubmit.textContent = "Atualizar Rota";

        // 4. Abre Modal
        const modal = document.getElementById("modalRegistrarRota");
        if (modal) {
          modal.classList.add("active");
          modal.style.display = "flex";
        }
      }
      return;
    }
  });

  // =========================================================
  // 3. SALVAR ROTA (SUBMIT GLOBAL)
  // =========================================================
  document.removeEventListener("submit", handleSubmitRota);
  document.addEventListener("submit", handleSubmitRota);

  // 4. Navegação
  document.querySelectorAll(".menu-item_link").forEach((link) => {
    link.addEventListener("click", (e) => {
      const pagina = link.getAttribute("data-pagina");
      if (pagina) {
        mudarPagina(e, pagina);
        if (pagina === "financeiro") atualizarPaginaFinanceiro();
        if (pagina === "config") atualizarPerfilUsuario();
      }
    });
  });

  // 5. Fechar Modais (Overlay/ESC)
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
        // Limpa form ao clicar fora
        const form = document.getElementById("formRegistrarRota");
        if (form) {
          form.reset();
          delete form.dataset.editingId;
          const btnSubmit = form.querySelector('button[type="submit"]');
          if (btnSubmit) btnSubmit.textContent = "Salvar Rota";
        }
      }
    };
  });

  // ============================================
  // CONFIGURAÇÃO DE MOTORISTAS (ATUALIZADA)
  // ============================================
  const inputM1 = document.getElementById("configMotorista1");
  const inputM2 = document.getElementById("configMotorista2");
  const btnSalvarNomes = document.getElementById("btnSalvarNomes");

  // Variáveis dos Selects (Rota e Financeiro)
  const selectRota = document.getElementById("selectMotoristaRota");
  const selectFiltroFin = document.getElementById("filtroMotoristaFin"); // NOVO DO FINANCEIRO

  // 1. Carregar nomes salvos nos inputs ao iniciar
  const m1Salvo = localStorage.getItem("nomeMotorista1") || "";
  const m2Salvo = localStorage.getItem("nomeMotorista2") || "";

  if (inputM1) inputM1.value = m1Salvo;
  if (inputM2) inputM2.value = m2Salvo;

  // FUNÇÃO GLOBAL: Atualiza TODOS os Selects de Motorista
  window.atualizarSelectMotoristas = function () {
    const nome1 = localStorage.getItem("nomeMotorista1") || "Motorista 1";
    const nome2 = localStorage.getItem("nomeMotorista2") || "Motorista 2";

    // 1. Select do Modal de Registrar Rota
    if (selectRota) {
      selectRota.innerHTML = `
            <option value="${nome1}">${nome1}</option>
            <option value="${nome2}">${nome2}</option>
        `;
    }

    // 2. Select do Filtro Financeiro
    if (selectFiltroFin) {
      const valorAtual = selectFiltroFin.value;
      selectFiltroFin.innerHTML = `
            <option value="todos">Todos</option>
            <option value="${nome1}">${nome1}</option>
            <option value="${nome2}">${nome2}</option>
        `;
      // Tenta manter a seleção anterior se possível
      if (
        valorAtual &&
        (valorAtual === "todos" || valorAtual === nome1 || valorAtual === nome2)
      ) {
        selectFiltroFin.value = valorAtual;
      }
    }
  };

  atualizarSelectMotoristas(); // Chama ao iniciar

  // 2. Salvar novos nomes
  if (btnSalvarNomes) {
    btnSalvarNomes.addEventListener("click", () => {
      const n1 = inputM1.value.trim() || "";
      const n2 = inputM2.value.trim() || "";

      localStorage.setItem("nomeMotorista1", n1);
      localStorage.setItem("nomeMotorista2", n2);

      atualizarSelectMotoristas();
      mostrarNotificacao("Nomes atualizados!", "success");
    });
  }

  // 6. Filtros e Exportação
  configurarFiltrosExtras();

  // 7. Logout
  configurarLogout();
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

    const metaSalva = localStorage.getItem("metaMensal");
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
          localStorage.removeItem("metaMensal");
          inputDiaria.value = "";
          inputDias.value = "";
        }
      } catch (e) {}
    }

    const salvar = () => {
      state.meta = {
        diaria: parseFloat(inputDiaria.value) || 0,
        dias: parseFloat(inputDias.value) || 0,
        mesRef: obterMes(),
      };
      localStorage.setItem("metaMensal", JSON.stringify(state.meta));
      import("./ui.js").then((ui) => ui.atualizarGraficoMeta());
    };

    inputDiaria.oninput = salvar;
    inputDias.oninput = salvar;
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
