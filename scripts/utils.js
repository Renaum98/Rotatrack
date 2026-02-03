import { state } from "./state.js";

// ============================================
// FORMATAÇÃO E UTILITÁRIOS (ADICIONADO)
// ============================================
export function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// ============================================
// MODAIS (ADICIONADO - O QUE FALTAVA)
// ============================================
export function abrirModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "flex";
    // Garante que o display seja flex para centralizar,
    // se o seu CSS usar outro display, ajuste aqui.
  }
}

export function fecharModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "none";
  }
}

// ============================================
// SISTEMA DE NOTIFICAÇÕES
// ============================================
export function mostrarNotificacao(mensagem, tipo = "info") {
  // Remover notificações antigas
  document.querySelectorAll(".notificacao").forEach((n) => n.remove());

  const notificacao = document.createElement("div");
  notificacao.className = `notificacao notificacao-${tipo}`;
  notificacao.textContent = mensagem;
  notificacao.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${
      tipo === "success"
        ? "#10b981"
        : tipo === "error"
          ? "#ef4444"
          : tipo === "warning"
            ? "#f59e0b"
            : "#667eea"
    };
    color: white;
    padding: 15px 20px;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 9999;
    animation: slideIn 0.3s ease;
    font-family: 'Montserrat', sans-serif;
    font-weight: 500;
    max-width: 300px;
  `;

  document.body.appendChild(notificacao);

  setTimeout(() => {
    notificacao.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notificacao.remove(), 300);
  }, 3000);
}

// ============================================
// ESTILOS DINÂMICOS (SEU CÓDIGO ORIGINAL)
// ============================================
if (!document.querySelector("#notificacao-styles")) {
  const style = document.createElement("style");
  style.id = "notificacao-styles";
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// ============================================
// EXPORTAÇÃO DE DADOS (CSV) (SEU CÓDIGO ORIGINAL)
// ============================================
export function baixarRelatorioCSV(rotasFiltradas = null) {
  // Se passou uma lista (array), usa ela. Se não, usa todas do state.
  const rotasParaExportar = Array.isArray(rotasFiltradas)
    ? rotasFiltradas
    : state.rotas;

  if (!rotasParaExportar || rotasParaExportar.length === 0) {
    mostrarNotificacao("Não há dados neste período para exportar.", "warning");
    return;
  }

  // 1. Cabeçalho do CSV
  const cabecalho = [
    "Data",
    "Hora Inicio",
    "Hora Fim",
    "Plataforma",
    "KM Percorrido",
    "Consumo (Km/L)",
    "Valor Bruto (R$)",
    "Custo Gasolina (R$)",
    "Lucro Liquido (R$)",
    "Duração (min)",
  ];

  // 2. Processar linhas
  const linhas = rotasParaExportar.map((rota) => {
    const inicio = new Date(rota.horarioInicio);
    const fim = rota.horarioFim ? new Date(rota.horarioFim) : new Date();

    const formatarNumero = (val) => (val || 0).toFixed(2).replace(".", ",");
    const formatarKm = (val) => (val || 0).toFixed(1).replace(".", ",");

    let km = 0;
    if (rota.kmPercorridos !== undefined && rota.kmPercorridos !== null) {
      km = Number(rota.kmPercorridos);
    } else if (rota.kmFinal && rota.kmInicial) {
      km = Number(rota.kmFinal) - Number(rota.kmInicial);
    }

    return [
      inicio.toLocaleDateString("pt-BR"),
      inicio.toLocaleTimeString("pt-BR"),
      fim.toLocaleTimeString("pt-BR"),
      rota.plataforma || "Outros",
      formatarKm(km),
      formatarKm(rota.consumoUtilizado),
      formatarNumero(rota.valor),
      formatarNumero(rota.custoGasolina),
      formatarNumero(rota.lucroLiquido),
      rota.duracaoMinutos || 0,
    ].join(";");
  });

  // 3. Montar CSV
  const csvContent = "\uFEFF" + [cabecalho.join(";"), ...linhas].join("\n");

  // 4. Download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const hoje = new Date().toISOString().split("T")[0];
  link.setAttribute("href", url);
  link.setAttribute("download", `rotas_export_${hoje}.csv`);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  mostrarNotificacao(
    `Exportado ${rotasParaExportar.length} rotas com sucesso!`,
    "success",
  );
}
