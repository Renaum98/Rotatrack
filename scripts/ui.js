import { state } from "./state.js";
import { carregarDados } from "./storage.js";
import { renderizarCalendario } from "./calendar.js";

// ============================================
// GERENCIAMENTO DE MODAIS
// ============================================

// NOVA FUNÇÃO: Abre o modal de registro direto
export function abrirModalRegistrarRota() {
  const modal = document.getElementById("modalRegistrarRota");
  if (modal) {
    modal.classList.add("active");
    modal.style.display = "flex"; // Garante abertura visual
  }
}
export function fecharModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    modal.style.display = "none"; // Garante fechamento visual
  }
}
// ============================================
// NAVEGAÇÃO
// ============================================
export function mudarPagina(event, pagina) {
  event.preventDefault();

  // Remove classe active de todas as páginas e links
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".menu-item_link")
    .forEach((l) => l.classList.remove("active"));

  // Adiciona active na página e link atuais
  const pageElement = document.getElementById("page-" + pagina);
  if (pageElement) pageElement.classList.add("active");

  if (event.currentTarget) {
    event.currentTarget.classList.add("active");
  }

  // Lógica específica por página
  if (pagina === "rotas") {
    carregarDados();
  }

  if (pagina === "config") {
    atualizarPerfilUsuario();
  }

  if (pagina === "financeiro") {
    atualizarPaginaFinanceiro();
  }
}
// ============================================
// ATUALIZAÇÃO DA INTERFACE
// ============================================
export function atualizarListaRotas() {
  renderizarCalendario();

  const lista = document.getElementById("rotasList");
  const emptyState = document.getElementById("emptyState");
  const filtroMesInput = document.getElementById("filtroRotasMes");
  const filtroAppInput = document.getElementById("filtroRotasApp");

  // 1. POPULAR FILTRO DE APPS (DINÂMICO)
  if (state.rotas && state.rotas.length > 0 && filtroAppInput) {
    const valorSelecionado = filtroAppInput.value;
    const appsUnicos = [
      ...new Set(state.rotas.map((r) => r.plataforma)),
    ].sort();

    filtroAppInput.innerHTML = `<option value="todas">Todas</option>`;

    appsUnicos.forEach((app) => {
      if (!app) return;
      const option = document.createElement("option");
      option.value = app;
      option.textContent = app;
      filtroAppInput.appendChild(option);
    });

    filtroAppInput.value = valorSelecionado;
  }

  // --- VALIDAÇÃO LISTA VAZIA GERAL ---
  if (!state.rotas || state.rotas.length === 0) {
    lista.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  // --- APLICAÇÃO DOS FILTROS ---
  let rotasExibidas = state.rotas;

  // Filtro 1: Mês
  if (filtroMesInput && filtroMesInput.value) {
    const [anoF, mesF] = filtroMesInput.value.split("-");
    rotasExibidas = rotasExibidas.filter((rota) => {
      const d = new Date(rota.horarioInicio);
      return (
        d.getFullYear().toString() === anoF &&
        (d.getMonth() + 1).toString().padStart(2, "0") === mesF
      );
    });
  }

  // Filtro 2: App
  if (filtroAppInput && filtroAppInput.value !== "todas") {
    rotasExibidas = rotasExibidas.filter(
      (r) => r.plataforma === filtroAppInput.value,
    );
  }

  // --- RESULTADO DOS FILTROS ---
  if (rotasExibidas.length === 0) {
    lista.innerHTML = "";
    if (emptyState) {
      emptyState.style.display = "block";
      emptyState.querySelector("p").textContent =
        "Nenhuma rota encontrada com estes filtros.";
    }
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  // --- RENDERIZAÇÃO DOS CARDS ---
  lista.innerHTML = rotasExibidas
    .map((rota) => {
      const inicio = new Date(rota.horarioInicio);
      const lucroLiquido = rota.lucroLiquido || 0;

      let kmNumerico = Number(rota.kmPercorridos) || 0;
      if (kmNumerico === 0 && rota.kmFinal && rota.kmInicial) {
        kmNumerico = Number(rota.kmFinal) - Number(rota.kmInicial);
      }

      // --- NOVO: LÓGICA DO MOTORISTA ---
      // Pega o nome salvo ou usa "Eu" como padrão para rotas antigas
      const motorista = rota.motorista || "Eu";

      return `
        <div class="rota-card-simples" data-rota-id="${rota.id}">
          
          <div class="motorista-badge">
              ${motorista}
          </div>
          <div class="rota-actions-top">
            

            <button class="btn-mini-action btn-editar" data-id="${rota.id}">
               <span class="material-symbols-outlined">edit</span>
            </button>
            <button class="btn-mini-action btn-excluir" data-id="${rota.id}">
               <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div class="rota-header-row">
            <div class="rota-data-destaque">
                ${inicio.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
            </div>
            <div class="rota-valor-total">
                R$ ${rota.valor?.toFixed(2) || "0.00"}
            </div>
          </div>

          <div class="rota-info-grid">
             <div class="info-item">
               <span class="info-label">Horário</span>
               <span class="info-value">${inicio.toLocaleTimeString("pt-BR", {
                 hour: "2-digit",
                 minute: "2-digit",
               })}</span>
             </div>
             <div class="info-item">
               <span class="info-label">KM</span>
               <span class="info-value">${kmNumerico.toFixed(1)} km</span>
             </div>
             <div class="info-item">
               <span class="info-label">Lucro</span>
               <span class="info-value lucro">R$ ${lucroLiquido.toFixed(2)}</span>
             </div>
             <div class="info-item">
               <span class="info-label">App</span>
               <span class="info-value">${rota.plataforma}</span>
             </div>
          </div>
        </div>
      `;
    })
    .join("");

  // Atualiza gráficos e resumos se as funções existirem no escopo global ou importadas
  if (typeof atualizarGraficoMeta === "function") atualizarGraficoMeta();
  if (typeof atualizarCarouselResumo === "function") atualizarCarouselResumo();
}
// ============================================
// PERFIL DO USUÁRIO
// ============================================
export function atualizarPerfilUsuario() {
  const user = window.firebaseDb?.auth?.currentUser;

  const nomeElement = document.getElementById("profileName");
  const emailElement = document.getElementById("profileEmail");
  const motoristaUm = document.getElementById("configMotorista1").value;
  if (user && nomeElement && emailElement) {
    const nome = motoristaUm || user.displayName || "Usuário";
    const email = user.email;

    nomeElement.textContent = nome;
    emailElement.textContent = email;
  }
}

// ============================================
// FUNÇÃO AUXILIAR DE ANIMAÇÃO (NOVA)
// ============================================
function animarValor(elemento, valorFinal, duracao = 2000) {
  if (!elemento) return;

  let inicioTimestamp = null;
  const valorInicial = 0; // Começa sempre do zero

  const passo = (timestamp) => {
    if (!inicioTimestamp) inicioTimestamp = timestamp;

    // Calcula o progresso (de 0 a 1)
    const progresso = Math.min((timestamp - inicioTimestamp) / duracao, 1);

    // Função de "Easing" (opcional: faz começar rápido e desacelerar no fim)
    // Se quiser linear, use apenas: const valorAtual = progresso * valorFinal;
    const easeOutQuart = 1 - Math.pow(1 - progresso, 4);
    const valorAtual =
      valorInicial + easeOutQuart * (valorFinal - valorInicial);

    // Atualiza o texto na tela
    elemento.textContent = `R$ ${valorAtual.toFixed(2)}`;

    // Se ainda não acabou (progresso < 1), chama o próximo quadro
    if (progresso < 1) {
      window.requestAnimationFrame(passo);
    } else {
      // Garante que o valor final seja exato no fim
      elemento.textContent = `R$ ${valorFinal.toFixed(2)}`;
    }
  };

  window.requestAnimationFrame(passo);
}
// ============================================
// LÓGICA DO FINANCEIRO
// ============================================
export function atualizarPaginaFinanceiro() {
  const inputInicio = document.getElementById("filtroDataInicio");
  const inputFim = document.getElementById("filtroDataFim");
  const selectMotorista = document.getElementById("filtroMotoristaFin"); // <--- NOVO

  // 1. Definir datas padrão se vazio (Mantido igual)
  if (!inputInicio.value || !inputFim.value) {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    const firstDayFormat = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    inputInicio.value = firstDayFormat(primeiroDia);
    inputFim.value = firstDayFormat(ultimoDia);
  }

  const dataInicio = new Date(inputInicio.value + "T00:00:00");
  const dataFim = new Date(inputFim.value + "T23:59:59");

  // Pega o valor do motorista selecionado ("todos", "João", "Maria"...)
  const motoristaFiltro = selectMotorista ? selectMotorista.value : "todos";

  // 3. Filtrar rotas (DATA + MOTORISTA)
  const rotasFiltradas = state.rotas.filter((rota) => {
    // A. Filtro de Data
    const dataRota = new Date(rota.horarioFim || rota.horarioInicio);
    const dentroData = dataRota >= dataInicio && dataRota <= dataFim;

    if (!dentroData) return false;

    // B. Filtro de Motorista (NOVO)
    if (motoristaFiltro !== "todos") {
      // Se a rota não tiver motorista (rotas antigas), consideramos que não bate com o filtro específico
      // Ou, se tiver motorista, tem que ser igual ao selecionado
      const motoristaRota = rota.motorista || "Motorista 1"; // Fallback para antigas se necessário
      if (motoristaRota !== motoristaFiltro) {
        return false;
      }
    }

    return true;
  });

  // 4. Calcular Totais (Mantido igual, mas agora soma só as filtradas)
  let totalFaturamento = 0;
  let totalCustos = 0;
  let totalLucro = 0;
  let totalKm = 0;

  rotasFiltradas.forEach((rota) => {
    const val = parseFloat(rota.valor) || 0;
    const custo = parseFloat(rota.custoGasolina) || 0;
    const lucro = parseFloat(rota.lucroLiquido) || val - custo;

    let km = 0;
    if (rota.kmPercorridos !== undefined && rota.kmPercorridos !== null) {
      km = Number(rota.kmPercorridos);
    } else if (rota.kmFinal && rota.kmInicial) {
      km = Number(rota.kmFinal) - Number(rota.kmInicial);
    }

    totalFaturamento += val;
    totalCustos += custo;
    totalLucro += lucro;
    totalKm += isNaN(km) ? 0 : km;
  });

  // 5. ATUALIZAR DOM (COM ANIMAÇÃO)
  const elLucro = document.getElementById("finLucroLiquido");

  // Se você tiver a função animarValor, use-a. Se não, use textContent direto.
  if (typeof animarValor === "function") {
    animarValor(elLucro, totalLucro, 1000);
  } else {
    elLucro.textContent = `R$ ${totalLucro.toFixed(2)}`;
  }

  document.getElementById("finFaturamento").textContent =
    `R$ ${totalFaturamento.toFixed(2)}`;
  document.getElementById("finCustos").textContent =
    `R$ ${totalCustos.toFixed(2)}`;
  document.getElementById("finKmTotal").textContent =
    `${totalKm.toFixed(1)} km`;

  // Rendimento
  let rendimento = 0;
  if (totalKm > 0) {
    rendimento = totalFaturamento / totalKm;
  }

  const elRendimento = document.getElementById("finRendimento");
  if (elRendimento) {
    elRendimento.textContent = `R$ ${rendimento.toFixed(2)}/km`;
  }

  const elTotalRotas = document.getElementById("finTotalRotasTexto");
  if (elTotalRotas) {
    const qtd = rotasFiltradas.length;
    // Pequeno ajuste visual para mostrar quem está sendo filtrado
    const textoFiltro =
      motoristaFiltro === "todos" ? "" : ` (${motoristaFiltro})`;
    elTotalRotas.innerHTML = `Rotas realizadas${textoFiltro}: <strong>${qtd}</strong>`;
  }
}
function firstDayFormat(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
// ============================================
// CARROSSEL DE RESUMO (HOME)
// ============================================
export function atualizarCarouselResumo() {
  const container = document.getElementById("carouselResumo");
  if (!container || !state.rotas) return;

  // 1. Agrupar dados
  const resumo = {};
  state.rotas.forEach((rota) => {
    const data = new Date(rota.horarioInicio);
    // Ajuste para garantir a chave correta baseada no deslocamento (evita bug de fuso)
    const chave = `${data.getFullYear()}-${(data.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;

    if (!resumo[chave]) {
      resumo[chave] = { qtd: 0, total: 0, dataRef: data };
    }
    resumo[chave].qtd += 1;
    resumo[chave].total += parseFloat(rota.valor) || 0;
  });

  // 2. Ordenar (Crescente: Novembro -> Dezembro -> Janeiro)
  const listaMeses = Object.values(resumo).sort(
    (a, b) => a.dataRef - b.dataRef,
  );

  if (listaMeses.length === 0) {
    container.innerHTML = `<div style="width:100%; text-align:center; padding:10px; font-size:0.7rem; color:#a0aec0;">Sem dados.</div>`;
    return;
  }

  // 3. Renderizar HTML
  container.innerHTML = listaMeses
    .map((item) => {
      const nomeMes = item.dataRef.toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      });

      const agora = new Date();
      const ehAtual =
        item.dataRef.getMonth() === agora.getMonth() &&
        item.dataRef.getFullYear() === agora.getFullYear();
      const classeExtra = ehAtual ? "atual" : "";

      return `
      <div class="resumo-mes-card ${classeExtra}">
        <div class="card-mes-titulo">${nomeMes}</div>
        <div class="card-mes-dados">
           <div>
             <span class="dado-label">Rotas</span>
             <div class="dado-valor">${item.qtd}</div>
           </div>
           <div>
             <span class="dado-label">Total</span>
             <div class="dado-valor money">R$ ${Math.floor(item.total)}</div> 
             </div>
        </div>
      </div>
    `;
    })
    .join("");

  // 4. AUTO-CENTRALIZAR (Lógica mantida)
  setTimeout(() => {
    const cardAtual = container.querySelector(".atual");
    if (cardAtual) {
      const scrollPos =
        cardAtual.offsetLeft -
        container.clientWidth / 2 +
        cardAtual.clientWidth / 2;
      container.scrollTo({
        left: scrollPos,
        behavior: "smooth",
      });
    } else {
      // Se não tiver mês atual, rola para o último (mais recente)
      container.scrollTo({
        left: container.scrollWidth,
        behavior: "smooth",
      });
    }
  }, 100);
}
// ============================================
// LÓGICA DA META MENSAL (KPI)
// ============================================
export function atualizarGraficoMeta() {
  const container = document.getElementById("chartMeta");
  const elTexto = document.getElementById("metaTextoResumo");

  if (!container) return;

  const metaDiaria = state.meta.diaria || 0;
  const diasTrabalho = state.meta.dias || 0;
  const metaTotal = metaDiaria * diasTrabalho;

  const hoje = new Date();
  const mesAtual = (hoje.getMonth() + 1).toString().padStart(2, "0");
  const anoAtual = hoje.getFullYear().toString();

  const lucroAtual = state.rotas
    .filter((rota) => {
      const d = new Date(rota.horarioInicio);
      return (
        (d.getMonth() + 1).toString().padStart(2, "0") === mesAtual &&
        d.getFullYear().toString() === anoAtual
      );
    })
    .reduce((acc, curr) => acc + (parseFloat(curr.lucroLiquido) || 0), 0);

  let porcentagem = 0;
  let falta = 0;

  if (metaTotal > 0) {
    porcentagem = (lucroAtual / metaTotal) * 100;
    falta = metaTotal - lucroAtual;
    if (falta < 0) falta = 0;
    if (porcentagem > 100) porcentagem = 100;
  }

  const valorGrafico = parseFloat(porcentagem.toFixed(1));

  if (metaTotal === 0) {
    elTexto.textContent = "Defina meta diária e dias para ver o progresso.";
  } else if (falta <= 0) {
    elTexto.innerHTML = `<span style="color:#10b981; font-weight:bold;">PARABÉNS!</span> Meta batida!`;
  } else {
    elTexto.innerHTML = `Falta <span style="color:#e53e3e; font-weight:bold;">R$ ${falta.toFixed(2)}</span> para atingir R$ ${metaTotal.toFixed(2)}`;
  }

  const options = {
    series: [valorGrafico],
    chart: {
      height: 300,
      type: "radialBar",
      fontFamily: "Montserrat, sans-serif",
      animations: { enabled: true, easing: "easeinout", speed: 800 },
    },
    plotOptions: {
      radialBar: {
        offsetY: -15,
        startAngle: -135,
        endAngle: 135,
        hollow: {
          margin: 15,
          size: "65%",
          background: "transparent",
        },
        track: {
          background: "#f1f5f9",
          strokeWidth: "100%",
          margin: 0,
        },
        dataLabels: {
          show: true,
          name: {
            offsetY: -10,
            show: true,
            color: "#718096",
            fontSize: "13px",
            fontWeight: 600,
          },
          value: {
            offsetY: 10,
            color: "var(--cor-texto-opaco)",
            fontSize: "30px",
            fontWeight: 700,
            show: true,
            formatter: function (val) {
              return val + "%";
            },
          },
        },
      },
    },
    fill: {
      type: "gradient",
      gradient: {
        shade: "dark",
        type: "horizontal",
        shadeIntensity: 0.5,
        gradientToColors: ["#10b981"],
        inverseColors: true,
        opacityFrom: 1,
        opacityTo: 1,
        stops: [0, 100],
      },
    },
    stroke: { lineCap: "round" },
    colors: ["#667eea"],
    labels: ["Progresso"],
  };

  if (state.chartInstance) {
    state.chartInstance.updateSeries([valorGrafico]);
  } else {
    if (typeof ApexCharts !== "undefined") {
      state.chartInstance = new ApexCharts(container, options);
      state.chartInstance.render();
    }
  }
}
