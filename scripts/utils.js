import { state } from "./state.js";
import {
  NOTIFICACAO_DURACAO_MS,
  NOTIFICACAO_ANIMACAO_MS,
} from "./constants.js";

// ============================================
// FORMATAÇÃO E UTILITÁRIOS (ADICIONADO)
// ============================================
export function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// Roda uma ação assíncrona com loading state padronizado no botão:
// desabilita, troca texto (opcional) e restaura tudo no `finally`.
// Uso:
//   btn.onclick = () => comBotaoOcupado(btn, "Salvando...", async () => { ... })
export async function comBotaoOcupado(btn, textoOcupado, acao) {
  if (!btn) return acao();
  const textoOriginal = btn.textContent;
  const ficouDesabilitado = btn.disabled;
  btn.disabled = true;
  if (textoOcupado) btn.textContent = textoOcupado;
  try {
    return await acao();
  } finally {
    btn.disabled = ficouDesabilitado;
    if (textoOcupado) btn.textContent = textoOriginal;
  }
}

// ============================================
// LOGGING ESTRUTURADO
// Centraliza console.error/console.warn com um prefixo de contexto
// para facilitar rastrear de onde veio um erro nos logs do navegador.
// ============================================
export function criarLogger(escopo) {
  const prefixo = `[${escopo}]`;
  return {
    info: (msg, ...extras) => console.info(prefixo, msg, ...extras),
    warn: (msg, ...extras) => console.warn(prefixo, msg, ...extras),
    error: (msg, err) => {
      if (err instanceof Error) {
        console.error(prefixo, msg, err.message, err);
      } else if (err !== undefined) {
        console.error(prefixo, msg, err);
      } else {
        console.error(prefixo, msg);
      }
    },
  };
}

// Formata Date como YYYY-MM-DD no fuso local (não usa toISOString — esse vira UTC)
export function formatarDataLocal(date) {
  const d = date instanceof Date ? date : new Date(date);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Parseia YYYY-MM-DD → Date local. Retorna null se inválido (não usa Date(string)
// que tem regras malucas de fuso). Valida overflow (ex.: 2025-02-31 não cola).
export function parseDataLocal(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || "");
  if (!m) return null;
  const ano = parseInt(m[1], 10);
  const mes = parseInt(m[2], 10) - 1;
  const dia = parseInt(m[3], 10);
  const d = new Date(ano, mes, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes || d.getDate() !== dia) {
    return null;
  }
  return d;
}

// Debounce: agrupa chamadas em rajada e só dispara `fn` depois de `ms`
// sem novas chamadas. Útil para inputs que salvam em Firestore a cada tecla.
export function debounce(fn, ms = 400) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// Escapa caracteres perigosos antes de interpolar em innerHTML.
// Use SEMPRE que injetar valores vindos do usuário/Firestore em templates.
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
// SISTEMA DE NOTIFICAÇÕES — estilo em styles/components.css
// ============================================
const TIPOS_NOTIFICACAO = new Set(["info", "success", "error", "warning"]);

export function mostrarNotificacao(mensagem, tipo = "info") {
  if (!TIPOS_NOTIFICACAO.has(tipo)) tipo = "info";
  // Remove qualquer notificação anterior pra não empilhar
  document.querySelectorAll(".notificacao").forEach((n) => n.remove());

  const notificacao = document.createElement("div");
  notificacao.className = `notificacao notificacao-${tipo}`;
  notificacao.setAttribute("role", tipo === "error" ? "alert" : "status");
  notificacao.textContent = mensagem;
  document.body.appendChild(notificacao);

  setTimeout(() => {
    notificacao.classList.add("is-closing");
    setTimeout(() => notificacao.remove(), NOTIFICACAO_ANIMACAO_MS);
  }, NOTIFICACAO_DURACAO_MS);
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
