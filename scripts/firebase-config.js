// firebase-config.js - VERSÃO CORRIGIDA
const firebaseConfig = {
  apiKey: "AIzaSyBFkjsaD4sp0Wx2Vb5HrISDa2_-UrOfQ_E",
  authDomain: "rotas-ac730.firebaseapp.com",
  projectId: "rotas-ac730",
  storageBucket: "rotas-ac730.firebasestorage.app",
  messagingSenderId: "608855484396",
  appId: "1:608855484396:web:e76211a08e327be05842c9",
};

// Inicializar Firebase (versão compat)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Obter instâncias - VERSÃO COMPAT
const auth = firebase.auth();
const firestore = firebase.firestore;

// Objeto global firebaseDb
window.firebaseDb = {
  auth: auth,
  db: firestore(),

  // Usando sua estrutura existente: /usuarios/{uid}
  rotas: {
    // Coleção de rotas do usuário: /usuarios/{uid}/rotas
    getCollectionRef: function () {
      const user = auth.currentUser;
      if (!user) {
        console.error("Usuário não autenticado");
        throw new Error("Usuário não autenticado");
      }
      return firestore()
        .collection("usuarios")
        .doc(user.uid)
        .collection("rotas");
    },

    get: function () {
      return this.getCollectionRef().get();
    },

    doc: function (id) {
      return this.getCollectionRef().doc(id);
    },

    add: function (data) {
      const docId = Date.now().toString();
      return this.getCollectionRef()
        .doc(docId)
        .set({
          ...data,
          userId: auth.currentUser.uid,
          criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        });
    },
  },

  // Sistema do usuário: /usuarios/{uid}/sistema
  sistema: {
    rotaAtual: {
      getDocRef: function () {
        const user = auth.currentUser;
        if (!user) {
          throw new Error("Usuário não autenticado");
        }
        return firestore()
          .collection("usuarios")
          .doc(user.uid)
          .collection("sistema")
          .doc("rotaAtual");
      },

      get: function () {
        return this.getDocRef().get();
      },

      set: function (data, options = {}) {
        const user = auth.currentUser;
        if (!user) {
          throw new Error("Usuário não autenticado");
        }

        const dataComUsuario = {
          ...data,
          userId: user.uid,
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        };
        return this.getDocRef().set(dataComUsuario, options);
      },

      delete: function () {
        return this.getDocRef().delete();
      },
    },
  },

  // Método para validar usuário
  validarUsuario: function () {
    return new Promise((resolve, reject) => {
      auth.onAuthStateChanged((user) => {
        if (user) {
          // Verificar se o documento do usuário existe
          const userRef = firestore().collection("usuarios").doc(user.uid);
          userRef
            .get()
            .then((doc) => {
              if (doc.exists) {
                resolve(user);
              } else {
                // Criar documento do usuário com os campos que você já tem
                userRef
                  .set({
                    email: user.email,
                    nome: user.displayName || user.email.split("@")[0],
                    ativo: true,
                    role: "user",
                    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                    ultimoAcesso:
                      firebase.firestore.FieldValue.serverTimestamp(),
                  })
                  .then(() => resolve(user))
                  .catch(reject);
              }
            })
            .catch(reject);
        } else {
          reject("Usuário não autenticado");
        }
      });
    });
  },

  // Método para fazer logout
  logout: function () {
    return auth.signOut();
  },

  // Método para obter usuário atual
  getCurrentUser: function () {
    return auth.currentUser;
  },

  // Método para atualizar último acesso
  atualizarAcesso: function () {
    const user = auth.currentUser;
    if (!user) return Promise.reject("Usuário não autenticado");

    return firestore().collection("usuarios").doc(user.uid).update({
      ultimoAcesso: firebase.firestore.FieldValue.serverTimestamp(),
    });
  },
};
