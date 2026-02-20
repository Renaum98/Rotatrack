import { state } from "./state.js";
import { mostrarNotificacao, fecharModal } from "./utils.js";
import { salvarRotaFinalizada } from "./storage.js";
import { renderizarCalendario } from "./calendar.js";

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
    const plataforma = elPlataforma.value;
    const kmPercorridos = parseFloat(elKm.value.replace(",", ".")) || 0;
    const consumoVeiculo = state.consumoMedio || 10;
    const valorTotal = parseFloat(elValor.value.replace(",", ".")) || 0;

    // Pega o motorista ou define um padrão se der erro
    const motoristaSelecionado = elMotorista
      ? elMotorista.value
      : "Motorista 1";

    // Validação de valores zerados
    if (kmPercorridos === 0 || valorTotal === 0) {
      throw new Error("Preencha o KM e o Valor corretamente.");
    }

    // 4. Cálculos Financeiros
    const precoGasolina = state.precoGasolina || 6.35;
    const litrosGastos = kmPercorridos / consumoVeiculo;
    const custoGasolina = litrosGastos * precoGasolina;
    const lucroLiquido = valorTotal - custoGasolina;

    // 5. Tratamento de Data
    let dataReferencia = new Date();
    if (elData && elData.value) {
      const partes = elData.value.split("-");
      // O input date retorna YYYY-MM-DD. O Date() usa mês 0-11.
      const ano = parseInt(partes[0]);
      const mes = parseInt(partes[1]) - 1;
      const dia = parseInt(partes[2]);
      dataReferencia.setFullYear(ano);
      dataReferencia.setMonth(mes);
      dataReferencia.setDate(dia);
    }

    // Ajuste de horário para não virar o dia por fuso horário
    const dataFim = new Date(dataReferencia);
    const dataInicio = new Date(dataReferencia);
    // Subtrai 30 min só para ter um intervalo lógico, opcional
    dataInicio.setMinutes(dataInicio.getMinutes() - 30);

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
      const hoje = new Date();
      const ano = hoje.getFullYear();
      const mes = String(hoje.getMonth() + 1).padStart(2, "0");
      const dia = String(hoje.getDate()).padStart(2, "0");
      elData.value = `${ano}-${mes}-${dia}`;
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
  if (!confirm("Tem certeza que deseja excluir esta rota?")) return;

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
