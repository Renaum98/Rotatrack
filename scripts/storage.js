import { state } from "./state.js";
import { mostrarNotificacao, criarLogger } from "./utils.js";
import { atualizarListaRotas } from "./ui.js";
import { atualizarResumoPublico } from "./social.js";

const log = criarLogger("storage");

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
    log.error("Erro ao carregar configurações", error);
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
    log.error("Erro ao salvar configuração", error);
  }
}

// Chaves canônicas do localStorage — uma fonte só, em vez de strings espalhadas
export const LOCAL_KEYS = {
  rotas: "rotas",
  precoGasolina: "precoGasolina",
  consumoMedio: "consumoMedio",
  metaMensal: "metaMensal",
  motorista1: "nomeMotorista1",
  motorista2: "nomeMotorista2",
  tema: "theme",
};

// Persiste uma config tanto no localStorage (acesso rápido/offline) quanto no
// Firestore. JSON é só para valores objetos/arrays; primitivos vão direto.
export function persistirConfig(chave, valor) {
  try {
    const serializado =
      typeof valor === "object" && valor !== null
        ? JSON.stringify(valor)
        : String(valor);
    localStorage.setItem(chave, serializado);
  } catch (e) {
    log.error(`Erro ao salvar ${chave} no localStorage`, e);
  }
  // Mapeia a chave local para o nome do campo no Firestore
  const firestoreKey =
    chave === LOCAL_KEYS.metaMensal ? "meta" : chave;
  salvarConfiguracoes({ [firestoreKey]: valor });
}

// ============================================
// SINCRONIZAÇÃO EM TEMPO REAL (SUBCOLEÇÃO)
// ============================================
// Reconexão automática com backoff exponencial em caso de erro do listener.
// Cancela timers pendentes em pararSincronizacao() para evitar reconexões
// fantasmas após logout.
const MAX_RETRY_ATTEMPTS = 5;
let retryAttempts = 0;
let retryTimer = null;

function agendarReconexao() {
  if (retryAttempts >= MAX_RETRY_ATTEMPTS) {
    log.warn("Reconexão Firestore: máximo de tentativas atingido.");
    return;
  }
  const delay = Math.min(1000 * Math.pow(2, retryAttempts), 30000);
  retryAttempts++;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    // Só re-tenta se ainda há usuário logado e Firestore disponível
    if (window.firebaseDb?.auth?.currentUser && state.db?.db) {
      carregarDados();
    }
  }, delay);
}

// Quando a conexão volta, força reconexão imediata (sem esperar backoff)
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    retryAttempts = 0;
    if (!state.listenerUnsubscribe && window.firebaseDb?.auth?.currentUser) {
      carregarDados();
    }
  });
}

export function carregarDados() {
  const user = window.firebaseDb?.auth?.currentUser;

  if (!state.db || !state.db.db || !user) {
    // Se cair offline depois de já ter um listener ativo, descarta para não vazar
    pararSincronizacao();
    carregarDadosLocal();
    return;
  }

  // Se já existe um listener ativo para o MESMO usuário, não faz nada.
  // Se é de outro usuário (logout + login com outra conta), descarta antes.
  if (state.listenerUnsubscribe) {
    if (state.listenerUserUid === user.uid) {
      return;
    }
    pararSincronizacao();
  }

  carregarConfiguracoes();

  try {
    // --- CORREÇÃO DE HIERARQUIA ---
    // Agora acessamos: usuarios -> ID_DO_USER -> rotas
    // Não precisamos mais do .where('userId') porque já estamos dentro da pasta do usuário!

    state.listenerUserUid = user.uid;
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
          localStorage.setItem(LOCAL_KEYS.rotas, JSON.stringify(state.rotas));
          // Conexão OK — zera contador de retry
          retryAttempts = 0;
          atualizarListaRotas();
          atualizarResumoPublico(rotasAtualizadas);
        },
        (error) => {
          log.error("Erro no listener Firestore", error);
          mostrarNotificacao("Erro de conexão. Tentando reconectar...", "error");
          // Limpa o listener atual e agenda nova tentativa com backoff
          pararSincronizacao();
          carregarDadosLocal();
          agendarReconexao();
        },
      );
  } catch (error) {
    log.error("Erro ao iniciar listener Firestore", error);
    pararSincronizacao();
    carregarDadosLocal();
  }
}

// ... carregarDadosLocal continua igual ...
export function carregarDadosLocal() {
  const rotasSalvas = localStorage.getItem(LOCAL_KEYS.rotas);
  if (rotasSalvas) {
    try {
      state.rotas = JSON.parse(rotasSalvas);
      atualizarListaRotas();
    } catch (e) {
      log.error("Erro ao ler rotas do localStorage", e);
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
    log.error("Erro ao salvar rota", error);
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
    try {
      state.listenerUnsubscribe();
    } catch (e) {
      log.error("Erro ao parar listener", e);
    }
    state.listenerUnsubscribe = null;
    state.listenerUserUid = null;
  }
  // Cancela qualquer reconexão pendente — logout não deve reconectar
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryAttempts = 0;
}
