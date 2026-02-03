document.addEventListener("DOMContentLoaded", function () {
  // --- 1. SELEÇÃO DE ELEMENTOS (CORREÇÃO DE VARIÁVEIS) ---
  const loginForm = document.getElementById("loginForm");
  const loginErro = document.getElementById("loginErro");
  const btnLogin = document.getElementById("btnLogin");

  // Garante que pega o email e a senha (seja id="senha" ou id="password")
  const emailInput = document.getElementById("email");
  const senhaInput =
    document.getElementById("senha") || document.getElementById("password");

  // Se não achar os campos essenciais, para tudo para não dar erro depois
  if (!emailInput || !senhaInput || !loginForm) {
    console.error(
      "Erro crítico: Elementos do formulário não encontrados no HTML.",
    );
    return;
  }

  // --- 2. VERIFICAR SE FIREBASE ESTÁ CARREGADO ---
  if (!window.firebaseDb || !window.firebaseDb.auth) {
    console.error("Firebase não disponível.");
    mostrarErro("Erro no sistema. Recarregue a página.");
    if (btnLogin) btnLogin.disabled = true;
    return;
  }

  // --- 3. VERIFICAÇÃO INICIAL (SEGURANÇA CONTRA LOOP) ---
  const user = window.firebaseDb.auth.currentUser;

  if (user) {
    if (user.emailVerified) {
      // SUCESSO: Usuário verificado. Vai para o app.
      window.location.href = "inicio.html";
      return;
    } else {
      // PENDENTE: Usuário existe mas não verificou. Desloga para limpar estado.
      window.firebaseDb.auth.signOut();
    }
  }

  // ---------------------------------------------------------
  // 4. BOTÃO ENTRAR (LOGIN)
  // ---------------------------------------------------------
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const email = emailInput.value.trim();
    const senha = senhaInput.value;

    if (!email || !senha) {
      mostrarErro("Preencha todos os campos.");
      return;
    }

    btnLogin.disabled = true;
    btnLogin.textContent = "Entrando...";

    window.firebaseDb.auth
      .signInWithEmailAndPassword(email, senha)
      .then((userCredential) => {
        const user = userCredential.user;

        // --- TRAVA DE SEGURANÇA NO LOGIN ---
        if (!user.emailVerified) {
          window.firebaseDb.auth.signOut(); // Chuta pra fora
          mostrarErro(
            "Conta não ativada! Verifique seu email e clique no link enviado.",
          );
          return;
        }

        // Login OK
        window.location.href = "inicio.html";
      })
      .catch((error) => {
        tratarErrosFirebase(error);
      })
      .finally(() => {
        btnLogin.disabled = false;
        btnLogin.textContent = "Entrar";
      });
  });

  // ---------------------------------------------------------
  // 5. FUNÇÕES AUXILIARES
  // ---------------------------------------------------------
  function mostrarErro(mensagem) {
    if (loginErro) {
      loginErro.textContent = mensagem;
      loginErro.style.display = "block";
      setTimeout(() => {
        loginErro.style.display = "none";
      }, 8000);
    } else {
      alert(mensagem); // Fallback caso não tenha div de erro
    }
  }

  function tratarErrosFirebase(error) {
    let mensagem = "Erro ao processar. Tente novamente.";
    switch (error.code) {
      case "auth/invalid-email":
        mensagem = "Email inválido.";
        break;
      case "auth/user-disabled":
        mensagem = "Este usuário foi desativado.";
        break;
      case "auth/user-not-found":
        mensagem = "Email não cadastrado.";
        break;
      case "auth/wrong-password":
        mensagem = "Senha incorreta.";
        break;
      case "auth/email-already-in-use":
        mensagem = "Este email já está em uso.";
        break;
      case "auth/weak-password":
        mensagem = "A senha é muito fraca (mínimo 6 caracteres).";
        break;
      case "auth/too-many-requests":
        mensagem = "Muitas tentativas. Tente novamente mais tarde.";
        break;
      case "auth/invalid-credential":
        mensagem = "Email ou senha incorretos."; // Novo erro comum do Firebase
        break;
      default:
        mensagem = `Erro: ${error.message}`;
    }
    mostrarErro(mensagem);
  }

  // ---------------------------------------------------------
  // 6. BOTÃO CRIAR CONTA (CORRIGIDO)
  // ---------------------------------------------------------
  // Verifica se o botão já existe para não duplicar
  if (!document.getElementById("btnCriarConta")) {
    const btnCriarConta = document.createElement("button");
    btnCriarConta.type = "button";
    btnCriarConta.id = "btnCriarConta";
    btnCriarConta.textContent = "Criar conta";
    btnCriarConta.className = "btn-secundario"; // Certifique-se que essa classe existe no CSS ou mude para 'btn'
    btnCriarConta.style.marginTop = "10px";
    btnCriarConta.style.width = "100%"; // Ajuste visual opcional

    btnCriarConta.addEventListener("click", function () {
      // Usa as variáveis declaradas no topo, que agora são seguras
      const email = emailInput.value.trim();
      const senha = senhaInput.value;

      if (!email || !senha) {
        mostrarErro("Preencha email e senha para criar conta.");
        return;
      }

      if (senha.length < 6) {
        mostrarErro("A senha deve ter pelo menos 6 caracteres.");
        return;
      }

      btnCriarConta.disabled = true;
      btnCriarConta.textContent = "Criando...";

      window.firebaseDb.auth
        .createUserWithEmailAndPassword(email, senha)
        .then((userCredential) => {
          const user = userCredential.user;

          // --- ENVIA EMAIL ---
          user
            .sendEmailVerification()
            .then(() => {
              alert(
                `Conta criada com sucesso!\n\nUm email de confirmação foi enviado para ${email}.\n\nVerifique sua caixa de entrada (e spam) e ative a conta antes de logar.`,
              );

              // Logout forçado
              window.firebaseDb.auth.signOut();

              // Limpa campos
              emailInput.value = "";
              senhaInput.value = "";
            })
            .catch((err) => {
              console.error(err);
              mostrarErro(
                "Conta criada, mas falha ao enviar email. Tente logar para reenviar.",
              );
            });
        })
        .catch((error) => {
          tratarErrosFirebase(error);
        })
        .finally(() => {
          btnCriarConta.disabled = false;
          btnCriarConta.textContent = "Criar conta";
        });
    });

    loginForm.appendChild(btnCriarConta);
  }
});
