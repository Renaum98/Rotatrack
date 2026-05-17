import { state } from "./state.js";
import {
  mostrarNotificacao,
  fecharModal,
  formatarDataLocal,
  parseDataLocal,
} from "./utils.js";
import { salvarRotaFinalizada } from "./storage.js";
import { renderizarCalendario } from "./calendar.js";
import {
  PRECO_GASOLINA_PADRAO,
  CONSUMO_MEDIO_PADRAO,
  KM_MAX_POR_ROTA,
  VALOR_MAX_POR_ROTA,
  PLATAFORMA_MAX_CHARS,
  NOME_MOTORISTA_MAX_CHARS,
  DURACAO_ROTA_PADRAO_MIN,
} from "./constants.js";

// ============================================
// SALVAR NOVA ROTA (ADAPTADO AO SEU HTML)
// ============================================
export async function salvarNovaRota(event) {
  event.preventDefault();

  // --- TRAVA DE BOTÃO (Evita clique duplo) ---
  const btnSubmit = event.target.querySelector('button[type="submit"]');
  const textoOriginal = btnSubmit ? btnSubmit.textContent : "Salvar";

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Salvando...";
  }

  // 1. Pegar Elementos
  const elData = document.getElementById("inputDataRota");
  const elPlataforma = document.getElementById("plataformaRota");
  const elKm = document.getElementById("kmPercorridoInput");
  const elValor = document.getElementById("valorRota");
  const elMotorista = document.getElementById("selectMotoristaRota"); // <--- NOVO

  try {
    // 2. Validação Básica
    if (!elPlataforma || !elKm || !elValor) {
      throw new Error("Elementos do formulário não encontrados.");
    }

    // 3. Conversão de Valores
    const plataforma = String(elPlataforma.value || "").trim().slice(0, PLATAFORMA_MAX_CHARS);
    const kmPercorridos = parseFloat(String(elKm.value).replace(",", "."));
    const consumoVeiculo = state.consumoMedio || CONSUMO_MEDIO_PADRAO;
    const valorTotal = parseFloat(String(elValor.value).replace(",", "."));

    // Pega o motorista ou define um padrão se der erro
    const motoristaSelecionado = elMotorista
      ? String(elMotorista.value || "").trim().slice(0, NOME_MOTORISTA_MAX_CHARS) || "Motorista 1"
      : "Motorista 1";

    // Validação de valores (NaN, negativos, zerados e fora de bounds plausíveis)
    if (!plataforma) {
      throw new Error("Selecione a plataforma.");
    }
    if (!Number.isFinite(kmPercorridos) || kmPercorridos <= 0 || kmPercorridos > KM_MAX_POR_ROTA) {
      throw new Error(`KM inválido. Informe um valor entre 0 e ${KM_MAX_POR_ROTA}.`);
    }
    if (!Number.isFinite(valorTotal) || valorTotal <= 0 || valorTotal > VALOR_MAX_POR_ROTA) {
      throw new Error(`Valor inválido. Informe um valor entre 0 e ${VALOR_MAX_POR_ROTA}.`);
    }

    // 4. Cálculos Financeiros
    const precoGasolina = state.precoGasolina || PRECO_GASOLINA_PADRAO;
    const litrosGastos = kmPercorridos / consumoVeiculo;
    const custoGasolina = litrosGastos * precoGasolina;
    const lucroLiquido = valorTotal - custoGasolina;

    // 5. Tratamento de Data — valida formato YYYY-MM-DD e descarta datas futuras
    let dataReferencia = new Date();
    if (elData && elData.value) {
      const candidata = parseDataLocal(elData.value);
      if (!candidata) {
        throw new Error("Data inválida.");
      }
      // Bloqueia datas futuras (defesa em profundidade além do input.max)
      const hoje = new Date();
      hoje.setHours(23, 59, 59, 999);
      if (candidata > hoje) {
        throw new Error("Não é possível registrar rotas com data futura.");
      }
      dataReferencia = candidata;
    }

    // Cria intervalo "lógico" de DURACAO_ROTA_PADRAO_MIN minutos entre início e fim
    const dataFim = new Date(dataReferencia);
    const dataInicio = new Date(dataReferencia);
    dataInicio.setMinutes(dataInicio.getMinutes() - DURACAO_ROTA_PADRAO_MIN);

    // 6. Verificação de Edição (Se o form tiver um ID, é edição)
    // Se não tiver ID no form, cria um novo ID baseado no tempo
    const form = event.target;
    const idRota = form.dataset.editingId
      ? parseInt(form.dataset.editingId)
      : Date.now();

    // 7. CRIAÇÃO DO OBJETO FINAL
    const novaRota = {
      id: idRota, // Usa o ID existente (edição) ou novo
      plataforma: plataforma,
      kmPercorridos: kmPercorridos,
      valor: valorTotal,
      consumoUtilizado: consumoVeiculo,
      custoGasolina: parseFloat(custoGasolina.toFixed(2)),
      lucroLiquido: parseFloat(lucroLiquido.toFixed(2)),
      horarioInicio: dataInicio.toISOString(),
      horarioFim: dataFim.toISOString(),
      status: "finalizada",
      userId: window.firebaseDb?.auth?.currentUser?.uid || "offline",
      motorista: motoristaSelecionado, // <--- AQUI ESTÁ A INTEGRAÇÃO CORRETA
      veiculoId: state.veiculoSelecionado?.id || "padrao",
    };

    // 8. Salvar no Firebase/Local
    await salvarRotaFinalizada(novaRota);

    // 9. Atualizar Tela
    renderizarCalendario();

    // 10. Sucesso e Limpeza
    fecharModal("modalRegistrarRota");
    form.reset(); // Limpa o formulário
    delete form.dataset.editingId; // Limpa o modo de edição se existir

    // Resetar data para hoje no input (UX)
    if (elData) {
      elData.value = formatarDataLocal(new Date());
    }

    // Resetar botão submit (texto)
    if (btnSubmit) btnSubmit.textContent = "Salvar Rota";

    mostrarNotificacao(
      `Rota salva! Lucro: R$ ${lucroLiquido.toFixed(2)}`,
      "success",
    );
  } catch (error) {
    console.error(error);
    mostrarNotificacao(error.message || "Erro ao processar rota.", "error");
  } finally {
    // DESBLOQUEIA O BOTÃO SEMPRE
    if (btnSubmit) {
      btnSubmit.disabled = false;
      // Se deu erro, volta o texto original. Se deu certo, o código acima já resetou.
      if (btnSubmit.textContent === "Salvando...") {
        btnSubmit.textContent = textoOriginal;
      }
    }
  }
}

// ============================================
// EXCLUIR ROTA (Mantido igual)
// ============================================
export async function excluirRota(rotaId) {
  try {
    const user = window.firebaseDb?.auth?.currentUser;

    if (state.db && state.db.db && user) {
      await state.db.db
        .collection("usuarios")
        .doc(user.uid)
        .collection("rotas")
        .doc(rotaId.toString())
        .delete();
    } else {
      const rotasLocais = JSON.parse(localStorage.getItem("rotas") || "[]");
      const novasRotas = rotasLocais.filter(
        (r) => r.id.toString() !== rotaId.toString(),
      );
      localStorage.setItem("rotas", JSON.stringify(novasRotas));
      state.rotas = novasRotas;
      import("./ui.js").then((ui) => ui.atualizarListaRotas());
    }

    mostrarNotificacao("Rota excluída!", "success");
  } catch (error) {
    console.error("Erro ao excluir:", error);
    mostrarNotificacao("Erro ao excluir rota.", "error");
  }
}
