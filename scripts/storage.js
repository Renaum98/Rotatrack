import { state } from "./state.js";
import { mostrarNotificacao } from "./utils.js";
import { atualizarListaRotas } from "./ui.js";

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
