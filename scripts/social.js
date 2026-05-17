import { state } from "./state.js";
import { mostrarNotificacao, escapeHtml, criarLogger } from "./utils.js";

const log = criarLogger("social");

// ============================================
// RESUMO PÚBLICO
// ============================================
export async function atualizarResumoPublico(todasRotas) {
  const user = window.firebaseDb?.auth?.currentUser;
  if (!user || !state.db?.db) return;

  const hoje = new Date();
  const mesRef = `${hoje.getFullYear()}-${(hoje.getMonth() + 1).toString().padStart(2, "0")}`;

  const rotasMes = todasRotas.filter((r) => {
    const d = new Date(r.horarioInicio);
    return (
      `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}` === mesRef
    );
  });

  const resumo = {
    mesRef,
    totalRotas: rotasMes.length,
    totalKm: parseFloat(rotasMes.reduce((s, r) => s + (r.kmPercorridos || 0), 0).toFixed(1)),
    totalGanhos: parseFloat(rotasMes.reduce((s, r) => s + (r.valor || 0), 0).toFixed(2)),
    atualizadoEm: window.firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await state.db.db
      .collection("usuarios").doc(user.uid)
      .collection("sistema").doc("resumoPublico")
      .set(resumo);
  } catch (e) {
    log.error("Erro ao atualizar resumo público", e);
  }
}

// ============================================
// AMIGOS (CRUD)
// ============================================
async function buscarUsuarioPorEmail(email) {
  if (!state.db?.db) return null;
  try {
    const snap = await state.db.db
      .collection("usuarios")
      .where("email", "==", email.toLowerCase().trim())
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { uid: doc.id, nome: doc.data().nome || email, email: doc.data().email };
  } catch (e) {
    log.error("Erro ao buscar usuário", e);
    return null;
  }
}

export async function removerAmigo(amigoUid) {
  const user = window.firebaseDb?.auth?.currentUser;
  if (!user || !state.db?.db) return false;
  try {
    await state.db.db
      .collection("usuarios").doc(user.uid)
      .collection("amigos").doc(amigoUid)
      .delete();
    return true;
  } catch (e) {
    log.error("Erro ao remover amigo", e);
    return false;
  }
}

export async function carregarAmigos() {
  const user = window.firebaseDb?.auth?.currentUser;
  if (!user || !state.db?.db) return [];
  try {
    const snap = await state.db.db
      .collection("usuarios").doc(user.uid)
      .collection("amigos").get();
    return snap.docs.map((doc) => doc.data());
  } catch (e) {
    log.error("Erro ao carregar amigos", e);
    return [];
  }
}

async function carregarResumoAmigo(amigoUid) {
  if (!state.db?.db) return null;
  try {
    const doc = await state.db.db
      .collection("usuarios").doc(amigoUid)
      .collection("sistema").doc("resumoPublico")
      .get();
    return doc.exists ? doc.data() : null;
  } catch (e) {
    log.error("Erro ao carregar resumo do amigo", e);
    return null;
  }
}

// ============================================
// SOLICITAÇÕES DE AMIZADE
// ============================================
export async function enviarSolicitacao(email) {
  const user = window.firebaseDb?.auth?.currentUser;
  if (!user || !state.db?.db) return { success: false, message: "Não autenticado." };

  // Valida formato de email antes de bater no Firestore
  const normalizado = String(email || "").toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) {
    return { success: false, message: "Email inválido." };
  }

  if (normalizado === user.email.toLowerCase()) {
    return { success: false, message: "Você não pode adicionar a si mesmo." };
  }

  try {
    const destinatario = await buscarUsuarioPorEmail(normalizado);
    if (!destinatario) {
      return { success: false, message: "Nenhum usuário cadastrado com este email." };
    }

    const amigoDoc = await state.db.db
      .collection("usuarios").doc(user.uid)
      .collection("amigos").doc(destinatario.uid).get();
    if (amigoDoc.exists) {
      return { success: false, message: `${destinatario.nome} já é seu amigo.` };
    }

    const jaEnviou = await state.db.db
      .collection("usuarios").doc(destinatario.uid)
      .collection("solicitacoes").doc(user.uid).get();
    if (jaEnviou.exists) {
      return { success: false, message: "Solicitação já enviada. Aguarde a resposta." };
    }

    const reversa = await state.db.db
      .collection("usuarios").doc(user.uid)
      .collection("solicitacoes").doc(destinatario.uid).get();
    if (reversa.exists) {
      return { success: false, message: `${destinatario.nome} já te enviou uma solicitação. Aceite abaixo.` };
    }

    await state.db.db
      .collection("usuarios").doc(destinatario.uid)
      .collection("solicitacoes").doc(user.uid)
      .set({
        de: {
          uid: user.uid,
          nome: user.displayName || user.email.split("@")[0],
          email: user.email,
        },
        status: "pendente",
        criadoEm: window.firebase.firestore.FieldValue.serverTimestamp(),
      });

    return { success: true, message: `Solicitação enviada para ${destinatario.nome}!` };
  } catch (e) {
    log.error("Erro ao enviar solicitação", e);
    return { success: false, message: "Erro de conexão. Tente novamente." };
  }
}

async function carregarSolicitacoesPendentes() {
  const user = window.firebaseDb?.auth?.currentUser;
  if (!user || !state.db?.db) return [];
  try {
    const snap = await state.db.db
      .collection("usuarios").doc(user.uid)
      .collection("solicitacoes")
      .where("status", "==", "pendente")
      .get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    log.error("Erro ao carregar solicitações", e);
    return [];
  }
}

async function aceitarSolicitacao(solicitacao) {
  const user = window.firebaseDb?.auth?.currentUser;
  if (!user || !state.db?.db) return false;

  try {
    const myDoc = await state.db.db.collection("usuarios").doc(user.uid).get();
    const myNome = myDoc.data()?.nome || user.displayName || user.email.split("@")[0];
    const ts = window.firebase.firestore.FieldValue.serverTimestamp();
    const batch = state.db.db.batch();

    batch.set(
      state.db.db.collection("usuarios").doc(user.uid).collection("amigos").doc(solicitacao.de.uid),
      { uid: solicitacao.de.uid, nome: solicitacao.de.nome, email: solicitacao.de.email, adicionadoEm: ts },
    );

    // Cross-write na lista do remetente (deve ser permitido pelas regras do Firestore)
    batch.set(
      state.db.db.collection("usuarios").doc(solicitacao.de.uid).collection("amigos").doc(user.uid),
      { uid: user.uid, nome: myNome, email: user.email, adicionadoEm: ts },
    );

    batch.delete(
      state.db.db.collection("usuarios").doc(user.uid).collection("solicitacoes").doc(solicitacao.de.uid),
    );

    await batch.commit();
    return true;
  } catch (e) {
    log.error("Erro ao aceitar solicitação", e);
    return false;
  }
}

async function recusarSolicitacao(solicitacaoId) {
  const user = window.firebaseDb?.auth?.currentUser;
  if (!user || !state.db?.db) return false;
  try {
    await state.db.db
      .collection("usuarios").doc(user.uid)
      .collection("solicitacoes").doc(solicitacaoId)
      .delete();
    return true;
  } catch (e) {
    log.error("Erro ao recusar solicitação", e);
    return false;
  }
}

// ============================================
// RENDERIZAÇÃO
// ============================================
async function renderizarSolicitacoes() {
  const container = document.getElementById("socialSolicitacoesList");
  const card = document.getElementById("cardSolicitacoes");
  if (!container || !card) return;

  const solicitacoes = await carregarSolicitacoesPendentes();

  if (solicitacoes.length === 0) {
    card.style.display = "none";
    return;
  }

  card.style.display = "block";
  container.innerHTML = solicitacoes
    .map((s) => {
      const nome = s.de.nome || s.de.email || "";
      const inicial = escapeHtml((nome[0] || "?").toUpperCase());
      return `
        <div class="social-solicitacao-card">
          <div class="social-amigo-header">
            <div class="social-avatar">${inicial}</div>
            <div class="social-amigo-info">
              <h4>${escapeHtml(s.de.nome)}</h4>
              <p>${escapeHtml(s.de.email)}</p>
            </div>
          </div>
          <div class="social-solicitacao-actions">
            <button class="btn-aceitar-solicitacao" data-uid="${escapeHtml(s.de.uid)}">
              <span class="material-symbols-outlined">check</span>
              Aceitar
            </button>
            <button class="btn-recusar-solicitacao" data-uid="${escapeHtml(s.de.uid)}">
              <span class="material-symbols-outlined">close</span>
              Recusar
            </button>
          </div>
        </div>`;
    })
    .join("");

  container.querySelectorAll(".btn-aceitar-solicitacao").forEach((btn) => {
    btn.onclick = async () => {
      const s = solicitacoes.find((x) => x.de.uid === btn.dataset.uid);
      btn.disabled = true;
      const ok = await aceitarSolicitacao(s);
      if (ok) {
        mostrarNotificacao(`${s.de.nome} agora é seu amigo!`, "success");
        renderizarPaginaSocial();
      } else {
        mostrarNotificacao("Erro ao aceitar. Tente novamente.", "error");
        btn.disabled = false;
      }
    };
  });

  container.querySelectorAll(".btn-recusar-solicitacao").forEach((btn) => {
    btn.onclick = async () => {
      const s = solicitacoes.find((x) => x.de.uid === btn.dataset.uid);
      btn.disabled = true;
      const ok = await recusarSolicitacao(s.de.uid);
      if (ok) {
        mostrarNotificacao("Solicitação recusada.", "success");
        renderizarSolicitacoes();
      } else {
        mostrarNotificacao("Erro ao recusar. Tente novamente.", "error");
        btn.disabled = false;
      }
    };
  });
}

export async function renderizarPaginaSocial() {
  renderizarSolicitacoes();

  const container = document.getElementById("socialAmigosList");
  if (!container) return;

  container.innerHTML = `<div class="social-loading"><div class="spinner-loading"></div></div>`;

  const amigos = await carregarAmigos();

  if (amigos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-outlined">group</span>
        <p>Nenhum amigo adicionado ainda</p>
      </div>`;
    return;
  }

  const hoje = new Date();
  const mesRef = `${hoje.getFullYear()}-${(hoje.getMonth() + 1).toString().padStart(2, "0")}`;
  const resumos = await Promise.all(amigos.map((a) => carregarResumoAmigo(a.uid)));

  container.innerHTML = amigos
    .map((amigo, i) => {
      const resumo = resumos[i];
      const mesAtivo = resumo?.mesRef === mesRef;
      const totalRotas = mesAtivo ? Number(resumo.totalRotas ?? 0) : 0;
      const totalKm = mesAtivo ? Number(resumo.totalKm ?? 0).toFixed(1) : "0.0";
      const nomeBase = amigo.nome || amigo.email || "";
      const inicial = escapeHtml((nomeBase[0] || "?").toUpperCase());

      return `
        <div class="social-amigo-card">
          <div class="social-amigo-header">
            <div class="social-avatar">${inicial}</div>
            <div class="social-amigo-info">
              <h4>${escapeHtml(amigo.nome)}</h4>
              <p>${escapeHtml(amigo.email)}</p>
            </div>
            <button class="social-btn-remover" data-uid="${escapeHtml(amigo.uid)}" title="Remover amigo">
              <span class="material-symbols-outlined">person_remove</span>
            </button>
          </div>
          <div class="social-amigo-stats">
            <div class="social-stat">
              <span class="material-symbols-outlined">local_shipping</span>
              <div>
                <strong>${totalRotas}</strong>
                <span>rotas</span>
              </div>
            </div>
            <div class="social-stat">
              <span class="material-symbols-outlined">speed</span>
              <div>
                <strong>${totalKm} km</strong>
                <span>percorridos</span>
              </div>
            </div>
          </div>
          ${!mesAtivo ? '<p class="social-sem-dados">Sem atividade registrada este mês</p>' : ""}
        </div>`;
    })
    .join("");

  container.querySelectorAll(".social-btn-remover").forEach((btn) => {
    btn.onclick = async () => {
      btn.disabled = true;
      const ok = await removerAmigo(btn.dataset.uid);
      if (ok) {
        mostrarNotificacao("Amigo removido.", "success");
        renderizarPaginaSocial();
      } else {
        mostrarNotificacao("Erro ao remover. Tente novamente.", "error");
        btn.disabled = false;
      }
    };
  });
}
