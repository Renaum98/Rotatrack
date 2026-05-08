import { state } from "./state.js";
import { mostrarNotificacao } from "./utils.js";
import { atualizarListaRotas } from "./ui.js";

// ============================================
// CONFIGURAÇÕES GLOBAIS (FIRESTORE SYNC)
// ============================================
export async function carregarConfiguracoes() {
  const user = window.firebaseDb?.auth?.currentUser;
  if (!user || !state.db?.db) return;

  try {
    const doc = await state.db.db
      .collection("usuarios")
      .doc(user.uid)
      .collection("sistema")
      .doc("configuracoes")
      .get();

    if (doc.exists) {
      const data = doc.data();

      if (data.precoGasolina != null) {
        state.precoGasolina = data.precoGasolina;
        localStorage.setItem("precoGasolina", data.precoGasolina);
        const input = document.getElementById("inputPrecoGasolina");
        if (input) input.value = data.precoGasolina.toFixed(2);
      }

      if (data.consumoMedio != null) {
        state.consumoMedio = data.consumoMedio;
        localStorage.setItem("consumoMedio", data.consumoMedio);
        const input = document.getElementById("inputConsumoMedio");
        if (input) input.value = data.consumoMedio.toFixed(1);
      }

      if (data.meta != null) {
        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${(hoje.getMonth() + 1).toString().padStart(2, "0")}`;

        if (data.meta.mesRef === mesAtual) {
          state.meta = data.meta;
          localStorage.setItem("metaMensal", JSON.stringify(data.meta));
          const inputDiaria = document.getElementById("inputMetaDiaria");
          const inputDias = document.getElementById("inputMetaDias");
          if (inputDiaria) inputDiaria.value = data.meta.diaria || "";
          if (inputDias) inputDias.value = data.meta.dias || "";
          import("./ui.js").then((ui) => {
            if (ui.atualizarGraficoMeta) ui.atualizarGraficoMeta();
          });
        }
      }
    }
  } catch (error) {
    console.error("Erro ao carregar configurações:", error);
  }
}

export async function salvarConfiguracoes(dados) {
  const user = window.firebaseDb?.auth?.currentUser;
  if (!user || !state.db?.db) return;

  try {
    await state.db.db
      .collection("usuarios")
      .doc(user.uid)
      .collection("sistema")
      .doc("configuracoes")
      .set(
        {
          ...dados,
          atualizadoEm:
            window.firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  } catch (error) {
    console.error("Erro ao salvar configuração:", error);
  }
}

// ============================================
// SINCRONIZAÇÃO EM TEMPO REAL (SUBCOLEÇÃO)
// ============================================
export function carregarDados() {
  if (state.listenerUnsubscribe) {
    return;
  }

  const user = window.firebaseDb?.auth?.currentUser;

  if (!state.db || !state.db.db || !user) {
    carregarDadosLocal();
    return;
  }

  carregarConfiguracoes();

  try {
    // --- CORREÇÃO DE HIERARQUIA ---
    // Agora acessamos: usuarios -> ID_DO_USER -> rotas
    // Não precisamos mais do .where('userId') porque já estamos dentro da pasta do usuário!

    state.listenerUnsubscribe = state.db.db
      .collection("usuarios") // 1. Entra em usuarios
      .doc(user.uid) // 2. Entra no documento do usuário atual
      .collection("rotas") // 3. Entra na subcoleção rotas
      .orderBy("horarioInicio", "desc")
      .onSnapshot(
        (snapshot) => {
          const rotasAtualizadas = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              horarioInicio: data.horarioInicio?.toDate
                ? data.horarioInicio.toDate().toISOString()
                : data.horarioInicio || new Date().toISOString(),
              horarioFim: data.horarioFim?.toDate
                ? data.horarioFim.toDate().toISOString()
                : data.horarioFim || new Date().toISOString(),
            };
          });

          state.rotas = rotasAtualizadas;
          localStorage.setItem("rotas", JSON.stringify(state.rotas));
          atualizarListaRotas();
        },
        (error) => {
          console.error("Erro no listener:", error);
          mostrarNotificacao("Erro de conexão. Usando modo offline.", "error");
          carregarDadosLocal();
        },
      );
  } catch (error) {
    console.error("Erro ao iniciar listener:", error);
    carregarDadosLocal();
  }
}

// ... carregarDadosLocal continua igual ...
export function carregarDadosLocal() {
  const rotasSalvas = localStorage.getItem("rotas");
  if (rotasSalvas) {
    try {
      state.rotas = JSON.parse(rotasSalvas);
      atualizarListaRotas();
    } catch (e) {
      console.error("Erro ao ler localStorage", e);
    }
  }
}

// ============================================
// SALVAR ROTA (NA SUBCOLEÇÃO)
// ============================================
export async function salvarRotaFinalizada(rota) {
  try {
    const docId = rota.id.toString();
    const user = window.firebaseDb?.auth?.currentUser; // Pega o usuário atual

    if (!user && state.db) {
      throw new Error("Usuário não identificado para salvar online.");
    }

    const rotaParaSalvar = {
      ...rota,
      horarioInicio: window.firebase.firestore.Timestamp.fromDate(
        new Date(rota.horarioInicio),
      ),
      horarioFim: window.firebase.firestore.Timestamp.fromDate(
        new Date(rota.horarioFim),
      ),
      timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
    };

    delete rotaParaSalvar.id;

    if (state.db && state.db.db) {
      // --- CORREÇÃO DE HIERARQUIA NO SALVAR ---
      // Salva em: usuarios -> ID_DO_USER -> rotas -> ID_DA_ROTA
      await state.db.db
        .collection("usuarios")
        .doc(user.uid)
        .collection("rotas")
        .doc(docId)
        .set(rotaParaSalvar);
    } else {
      const rotasLocais = JSON.parse(localStorage.getItem("rotas") || "[]");
      rotasLocais.unshift(rota);
      localStorage.setItem("rotas", JSON.stringify(rotasLocais));
      state.rotas = rotasLocais;
      atualizarListaRotas();
    }
  } catch (error) {
    console.error("Erro ao salvar rota:", error);
    mostrarNotificacao("Erro ao salvar. Verifique sua conexão.", "error");
    throw error;
  }
}

// ============================================
// EXCLUIR ROTA (NA SUBCOLEÇÃO)
// ============================================
// ATENÇÃO: Se você tiver a função excluirRota no routes.js, ela precisa ser atualizada também.
// Vou deixar aqui uma versão compatível caso você queira importar daqui,
// ou você pode ajustar no seu routes.js seguindo a mesma lógica do caminho .collection('usuarios')...
export function pararSincronizacao() {
  if (state.listenerUnsubscribe) {
    state.listenerUnsubscribe();
    state.listenerUnsubscribe = null;
  }
}
