const PADRON_ABBR = [
  [/^R\s+/i, "Rua "],
  [/\bR\.\s*/gi, "Rua "],
  [/^Av\s+/i, "Avenida "],
  [/\bAv\.\s*/gi, "Avenida "],
  [/^Al\s+/i, "Alameda "],
  [/\bAl\.\s*/gi, "Alameda "],
  [/\bTrav\.\s*/gi, "Travessa "],
  [/^Trav\s+/i, "Travessa "],
  [/\bEst\.\s*/gi, "Estrada "],
  [/\bRod\.\s*/gi, "Rodovia "],
  [/\bPça\b\s*/gi, "Praça "],
  [/\bPç\.\s*/gi, "Praça "],
  [/\bLgo\b\s*/gi, "Largo "],
  [/\bCond\.\s*/gi, "Condomínio "],
  [/\bBl\.\s*/gi, "Bloco "],
  [/\bApt\.\s*/gi, "Apartamento "],
  [/\bApto\b\s*/gi, "Apartamento "],
  [/\bSl\.\s*/gi, "Sala "],
  [/\bDr\.?\s+/gi, "Doutor "],
  [/\bDra\.?\s+/gi, "Doutora "],
  [/\bProf\.\s*/gi, "Professor "],
  [/\bProfa\.\s*/gi, "Professora "],
  [/\bEng\.\s*/gi, "Engenheiro "],
  [/\bMin\.\s*/gi, "Ministro "],
  [/\bMin\s+/gi, "Ministro "],
  [/\bCel\.\s*/gi, "Coronel "],
  [/\bCap\.\s*/gi, "Capitão "],
  [/\bPres\.\s*/gi, "Presidente "],
  [/\bSen\.\s*/gi, "Senador "],
  [/\bDep\.\s*/gi, "Deputado "],
  [/\bVer\.\s*/gi, "Vereador "],
  [/\bGov\.\s*/gi, "Governador "],
  [/\bCons\.\s*/gi, "Conselheiro "],
  [/\bAlm\.\s*/gi, "Almirante "],
  [/\bBrig\.\s*/gi, "Brigadeiro "],
];

const PALAVRAS_IGNORADAS = new Set([
  "rua",
  "avenida",
  "alameda",
  "travessa",
  "estrada",
  "rodovia",
  "praça",
  "largo",
  "via",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "a",
  "o",
  "em",
  "com",
]);

// ── Abreviações ──
function padronApplyAbbr(address) {
  let s = String(address || "");
  for (const [rx, rep] of PADRON_ABBR) s = s.replace(rx, rep);
  return s.replace(/\s{2,}/g, " ").trim();
}

// ── Formatação Visual (Primeira letra maiúscula, expande abreviações) ──
function formatarNomeBonito(endereco) {
  // 1. Expande as abreviações (r -> Rua, dr -> Doutor)
  let expandido = padronApplyAbbr(endereco);

  // 2. Transforma em Title Case (Rua Doutor Euclides Barros)
  return expandido.replace(/\w\S*/g, function (txt) {
    const min = txt.toLowerCase();
    // Ignora preposições para não ficar "Rua De São Paulo"
    if (["de", "da", "do", "das", "dos", "e"].includes(min)) {
      return min;
    }
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

// ── Normaliza string para comparação ──
function normalizar(str) {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Validação cruzada ViaCEP vs endereço original ──
function logradouroParece(original, viaLogradouro) {
  const origNorm = normalizar(original);
  const viaNorm = normalizar(viaLogradouro);

  const palavrasVia = viaNorm
    .split(/\s+/)
    .filter((p) => p.length > 3 && !PALAVRAS_IGNORADAS.has(p));

  if (palavrasVia.length === 0) return true;
  return palavrasVia.some((p) => origNorm.includes(p));
}

// ── Validação ESTRITA para resgate interno usando a própria planilha ──
function logradouroPareceEstrito(original, ruaBoa) {
  const origNorm = normalizar(original);
  const boaNorm = normalizar(ruaBoa);

  const palavrasBoa = boaNorm
    .split(/\s+/)
    .filter((p) => p.length > 2 && !PALAVRAS_IGNORADAS.has(p));

  if (palavrasBoa.length === 0) return false;

  return palavrasBoa.every((p) => origNorm.includes(p));
}

// ── Monta endereço e separa extraindo um complemento limpo ──
function padronBuildAndSplit(original, logradouro) {
  const origNorm = normalizar(original);
  const viaNorm = normalizar(logradouro);

  const palavrasChave = viaNorm
    .split(/\s+/)
    .filter((p) => p.length > 3 && !PALAVRAS_IGNORADAS.has(p));

  let fimLogradouro = 0;
  for (const palavra of palavrasChave) {
    const idx = origNorm.indexOf(palavra);
    if (idx >= 0) {
      fimLogradouro = Math.max(fimLogradouro, idx + palavra.length);
    }
  }

  const restoOriginal = original.slice(fimLogradouro).trim();

  let numero = "";
  let line2 = "";
  let compAntes = "";
  let compDepois = "";

  // MÁGICA 1: Procura a primeira vírgula
  const idxVirgula = restoOriginal.indexOf(",");

  if (idxVirgula !== -1) {
    compAntes = restoOriginal.slice(0, idxVirgula).trim(); // Ex: "fashionelas box 106"
    const aposVirgula = restoOriginal.slice(idxVirgula + 1).trim();

    // Pega os primeiros dígitos logo após a vírgula
    const numMatch = aposVirgula.match(/^(\d+)(.*)/);
    if (numMatch) {
      numero = numMatch[1]; // Ex: "55"
      compDepois = numMatch[2]
        .replace(/^[,\s\-]+/, "")
        .trim()
        .split(",")[0]
        .trim(); // Ex: "próximo a zelo"
    }
  }

  // MÁGICA 2: Fallback (se não tiver vírgula, corta no primeiro número)
  if (!numero) {
    const numMatch = restoOriginal.match(/(.*?)(\d+)(.*)/);
    if (numMatch) {
      compAntes = numMatch[1].replace(/^[,\s\-]+/, "").trim();
      numero = numMatch[2];
      compDepois = numMatch[3]
        .replace(/^[,\s\-]+/, "")
        .trim()
        .split(",")[0]
        .trim();
    }
  }

  const line1 = numero ? `${logradouro}, ${numero}` : logradouro;

  // Montagem do Complemento: Salva o texto que estava antes do número (se houver) e o de depois
  if (compAntes && numero) {
    line2 = compAntes;
    if (compDepois && compDepois.length > 1) {
      line2 += ` (${compDepois})`; // Junta tudo: "fashionelas box 106 (próximo a zelo)"
    }
  } else {
    line2 = compDepois;
  }

  return { line1, line2 };
}

// ── Versão sem âncora: separa com base no primeiro número ──
function splitAddressLines(fullAddress) {
  const s = String(fullAddress || "").trim();

  let rua = "";
  let numero = "";
  let line2 = "";

  const idxVirgula = s.indexOf(",");

  if (idxVirgula !== -1) {
    rua = s.slice(0, idxVirgula).trim(); // Tudo antes da vírgula
    const aposVirgula = s.slice(idxVirgula + 1).trim();

    const numMatch = aposVirgula.match(/^(\d+)(.*)/);
    if (numMatch) {
      numero = numMatch[1];
      line2 = numMatch[2]
        .replace(/^[,\s\-]+/, "")
        .trim()
        .split(",")[0]
        .trim();
      return { line1: `${rua}, ${numero}`, line2 };
    }
  }

  // Fallback (não tem vírgula, corta no primeiro número)
  const numMatch = s.match(/(.*?)(\d+)(.*)/);
  if (numMatch) {
    rua = numMatch[1].replace(/[,\s\-]+$/, "").trim();
    numero = numMatch[2];
    line2 = numMatch[3]
      .replace(/^[,\s\-]+/, "")
      .trim()
      .split(",")[0]
      .trim();
    return { line1: `${rua}, ${numero}`, line2 };
  }

  return { line1: s, line2: "" };
}

// ── ViaCEP com cache ──
const padronCepCache = {};
async function padronFetchViaCEP(rawCep) {
  const cep = String(rawCep).replace(/\D/g, "");
  if (cep.length !== 8) return null;
  if (padronCepCache[cep] !== undefined) return padronCepCache[cep];
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) {
      padronCepCache[cep] = null;
      return null;
    }
    const data = await res.json();
    if (data.erro) {
      padronCepCache[cep] = null;
      return null;
    }
    padronCepCache[cep] = data;
    return data;
  } catch {
    padronCepCache[cep] = null;
    return null;
  }
}

// ── Agrupamento de endereços duplicados ──
function agruparEnderecos(linhas) {
  const mapa = new Map();
  const ordem = [];

  for (const item of linhas) {
    const chave = item.line1
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (mapa.has(chave)) {
      mapa.get(chave).sequencias.push(...item.sequencias);
    } else {
      const entrada = { ...item, sequencias: [...item.sequencias] };
      mapa.set(chave, entrada);
      ordem.push(chave);
    }
  }

  return ordem.map((chave) => mapa.get(chave));
}

// ── Inicialização ──
export function initPadronizador() {
  const dropzone = document.getElementById("padronDropzone");
  const fileInput = document.getElementById("padronFileInput");
  const progress = document.getElementById("padronProgress");
  const bar = document.getElementById("padronBar");
  const label = document.getElementById("padronLabel");
  const btnDownload = document.getElementById("padronBtnDownload");
  const btnRow = document.getElementById("padronBtnRow");
  const btnNovo = document.getElementById("padronBtnNovo");

  if (!dropzone) return;

  let workbook = null;
  let sheetName = "";
  let isXlsx = false;
  let processedRows = [];
  let dataDoArquivo = new Date(); // Mémoria para guardar a data

  if (btnNovo) {
    btnNovo.addEventListener("click", () => {
      dropzone.classList.remove("file-ready");
      dropzone.querySelector('span[class*="material"]').textContent =
        "upload_file";
      document.getElementById("padronDropLabel").textContent =
        "Selecionar arquivo";

      fileInput.value = "";

      progress.style.display = "none";
      btnRow.style.display = "none";
      bar.style.width = "0%";
      label.textContent = "Processando...";

      const suspeitosBox = document.getElementById("padronSuspeitosBox");
      if (suspeitosBox) suspeitosBox.remove();

      const resgatadosBox = document.getElementById("padronResgatadosBox");
      if (resgatadosBox) resgatadosBox.remove();

      workbook = null;
      sheetName = "";
      isXlsx = false;
      processedRows = [];
    });
  }

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () =>
    dropzone.classList.remove("dragover"),
  );
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  function handleFile(file) {
    isXlsx = /\.xlsx?$/i.test(file.name);

    // MÁGICA: Lê a data de modificação embutida no arquivo original!
    dataDoArquivo = new Date(file.lastModified);

    dropzone.classList.add("file-ready");
    dropzone.querySelector('span[class*="material"]').textContent =
      "check_circle";
    document.getElementById("padronDropLabel").textContent = file.name;

    btnRow.style.display = "none";
    processedRows = [];

    const reader = new FileReader();
    if (isXlsx) {
      reader.onload = (e) => parseAndProcess(e.target.result, true);
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => parseAndProcess(e.target.result, false);
      reader.readAsText(file, "utf-8");
    }
  }

  async function parseAndProcess(data, xlsx) {
    let parsedRows;

    if (xlsx) {
      if (!window.XLSX) {
        await loadScript(
          "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
        );
      }
      workbook = XLSX.read(data, { type: "array", cellDates: true });
      sheetName = workbook.SheetNames[0];
      parsedRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        defval: "",
      });
    } else {
      workbook = null;
      parsedRows = parseCsvText(data);
    }

    if (parsedRows.length < 2) {
      label.textContent = "Arquivo vazio ou inválido.";
      return;
    }

    const headers = parsedRows[0].map((h) => String(h).trim());

    const addrCol = headers.findIndex((h) =>
      /destination.?address|endere|logradouro/i.test(h),
    );
    const cepCol = headers.findIndex((h) =>
      /zipcode|zip.?code|postal.?code|cep|zip|postal/i.test(h),
    );
    const seqCol = headers.findIndex((h) => /^sequence$|^seq$/i.test(h));
    const bairroCol = headers.findIndex((h) =>
      /bairro|neighborhood|district/i.test(h),
    );
    const cityCol = headers.findIndex((h) => /^city$|^cidade$/i.test(h));
    const estadoCol = headers.findIndex((h) =>
      /^estado$|^uf$|^state$/i.test(h),
    );

    if (addrCol < 0 || cepCol < 0) {
      label.textContent = "Coluna de endereço ou CEP não encontrada.";
      progress.style.display = "block";
      return;
    }

    progress.style.display = "block";
    bar.style.width = "0%";
    label.textContent = "Iniciando...";

    const dataRows = parsedRows.slice(1);
    const total = dataRows.length;

    let totalCorrigidos = 0;
    let totalSuspeitos = 0;
    let totalResgatados = 0;

    const listaSuspeitos = [];
    const listaResgatados = [];

    const linhasProcessadas = [];
    const ruasValidadasPlanilha = new Set();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const cepClean = String(row[cepCol] || "").replace(/\D/g, "");

      // MÁGICA: Pega o texto bruto e já formata bonito antes de qualquer coisa!
      let origAddrBruto = String(row[addrCol] || "").trim();
      const origAddr = formatarNomeBonito(origAddrBruto);

      const pct = Math.round(((i + 1) / total) * 100);
      bar.style.width = pct + "%";
      label.textContent = `Validando CEPs: ${i + 1} / ${total}`;

      let line1 = "",
        line2 = "",
        status = "";
      const via = await padronFetchViaCEP(cepClean);

      if (via && via.logradouro) {
        // Inteligência de validação cruzada
        if (logradouroParece(origAddr, via.logradouro)) {
          ({ line1, line2 } = padronBuildAndSplit(origAddr, via.logradouro));
          ruasValidadasPlanilha.add(via.logradouro);
          status = "ok";
          totalCorrigidos++;
        } else {
          status = "suspeito";
        }
      } else {
        status = "sem_cep";
      }

      let cidadeCorreta = cityCol >= 0 ? String(row[cityCol] || "").trim() : "";
      if (!cidadeCorreta && via && via.localidade) {
        cidadeCorreta = via.localidade;
      }

      let estadoCorreto = "";
      if (via && via.uf) {
        estadoCorreto = via.uf;
      } else if (estadoCol >= 0) {
        estadoCorreto = String(row[estadoCol] || "").trim();
      }

      let bairroCorreto = "";
      if (via && via.bairro) {
        bairroCorreto = via.bairro;
      } else if (bairroCol >= 0) {
        bairroCorreto = String(row[bairroCol] || "").trim();
      }

      linhasProcessadas.push({
        original: origAddr,
        cep: cepClean,
        viaCep: via ? via.logradouro : null,
        line1,
        line2,
        status,
        linhaOriginal: i + 2,
        bairro: bairroCorreto,
        city: cidadeCorreta,
        estado: estadoCorreto,
        sequencias: seqCol >= 0 ? [String(row[seqCol] || "").trim()] : [],
      });

      if (cepClean.length === 8 && !(cepClean in padronCepCache)) {
        await new Promise((r) => setTimeout(r, 120));
      }
    }

    label.textContent = "Cruzando dados para resgatar erros...";

    for (const item of linhasProcessadas) {
      if (item.status === "suspeito" || item.status === "sem_cep") {
        let resgatado = false;
        let tipoDeResgate = "";

        // Tenta achar na própria planilha
        for (const ruaBoa of ruasValidadasPlanilha) {
          if (logradouroPareceEstrito(item.original, ruaBoa)) {
            const separacao = padronBuildAndSplit(item.original, ruaBoa);
            item.line1 = separacao.line1;
            item.line2 = separacao.line2;

            resgatado = true;
            tipoDeResgate = "Achou na Planilha";
            totalResgatados++;
            totalCorrigidos++;
            break;
          }
        }

        // Se não achou, força pelo CEP
        if (!resgatado) {
          const abbr = padronApplyAbbr(item.original);

          // PLANO C AGORA É SEGURO: Mantém o texto do cliente e apenas tenta formatar
          const separacaoFallback = splitAddressLines(abbr);
          item.line1 = separacaoFallback.line1;
          item.line2 = separacaoFallback.line2;

          totalSuspeitos++;

          // Define a mensagem de alerta dependendo se o CEP existe ou não
          let avisoViaCep = "";
          if (item.viaCep) {
            avisoViaCep = `CEP divergente aponta para: ${item.viaCep} (Mantido o original)`;
          } else {
            avisoViaCep = "CEP Inválido/Não encontrado";
          }

          // Joga para a Caixa Vermelha para você revisar com calma
          listaSuspeitos.push({
            linha: item.linhaOriginal,
            cep: item.cep,
            original: item.original,
            viaCep: avisoViaCep,
          });
        }

        // Salva para mostrar na tela Laranja
        if (resgatado) {
          listaResgatados.push({
            linha: item.linhaOriginal,
            original: item.original,
            resultado: item.line1,
            motivo: tipoDeResgate,
          });
        }
      }
    }

    const agrupadas = agruparEnderecos(linhasProcessadas);

    // ========================================================
    // Montar planilha final (Padrão Oficial)
    // ========================================================
    processedRows = [
      [
        "Address Line 1", // Rua, Número, Bairro (Tudo na mesma linha)
        "Address Line 2", // Complemento (Ex: Apto 2)
        "City", // Cidade (Substituiu o Zip)
        "Notes", // Recado pro motorista (Nossos pacotes)
      ],
    ];

    for (const item of agrupadas) {
      // 1. Filtra as sequências válidas (remove vazias)
      const sequenciasValidas = item.sequencias.filter(Boolean);

      // 2. Conta a quantidade de pacotes
      const qtdPacotes = sequenciasValidas.length;

      // 3. Formata o texto para a coluna Notes
      let notasParaMotorista = "";
      if (qtdPacotes > 0) {
        notasParaMotorista = `${sequenciasValidas.join(", ")} (Total: ${qtdPacotes})`;
      }

      // 4. Junta a Rua/Número com o Bairro que veio na sua planilha
      let linha1ComBairro = item.line1;
      if (item.bairro) {
        linha1ComBairro = `${item.line1}, ${item.bairro}`;
      }

      // 5. Adiciona a linha na planilha final puxando a CIDADE
      processedRows.push([
        linha1ComBairro, // Address Line 1 (Ex: Rua Maria Marcolina, 204, Brás)
        item.line2, // Address Line 2 (Ex: Loja 2)
        item.city, // City (Ex: São Paulo) <-- A MÁGICA AQUI
        notasParaMotorista, // Notes (Ex: BR260798 (Total: 1))
      ]);
    }

    const totalParadas = agrupadas.length;
    const totalOriginal = linhasProcessadas.length;
    const totalAgrupados = totalOriginal - totalParadas;

    let resumo = `✓ <strong style="color: var(--cor-sucesso, #3182ce); font-size: 1.1em;">${totalParadas} paradas</strong> (${totalAgrupados} agrupadas) &middot; ${totalCorrigidos} corrigidos`;
    if (totalResgatados > 0) resumo += ` (${totalResgatados} resgatados)`;
    if (totalSuspeitos > 0) resumo += ` · ${totalSuspeitos} suspeitos`;

    label.innerHTML = resumo;
    bar.style.width = "100%";
    btnRow.style.display = "flex";

    // ========================================================
    // DESENHAR CAIXA VERMELHA (SUSPEITOS)
    // ========================================================
    const anteriorSuspeitos = document.getElementById("padronSuspeitosBox");
    if (anteriorSuspeitos) anteriorSuspeitos.remove();

    if (listaSuspeitos.length > 0) {
      const box = document.createElement("div");
      box.id = "padronSuspeitosBox";
      Object.assign(box.style, {
        marginTop: "12px",
        background: "rgba(245,101,101,0.06)",
        border: "1px solid rgba(245,101,101,0.25)",
        borderRadius: "10px",
        padding: "12px",
      });

      const titulo = document.createElement("div");
      Object.assign(titulo.style, {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "0.75rem",
        fontWeight: "700",
        color: "#e53e3e",
        fontFamily: "'Montserrat', sans-serif",
        marginBottom: "10px",
      });
      titulo.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px">warning</span> Endereços suspeitos — revise manualmente`;
      box.appendChild(titulo);

      const ul = document.createElement("ul");
      Object.assign(ul.style, {
        listStyle: "none",
        padding: "0",
        margin: "0",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      });

      for (const s of listaSuspeitos) {
        const li = document.createElement("li");
        Object.assign(li.style, {
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          padding: "8px 10px",
          background: "var(--cor-branco)",
          borderRadius: "8px",
          border: "1px solid var(--cor-borda)",
          fontFamily: "'Montserrat', sans-serif",
        });
        li.innerHTML = `
          <span style="font-size:0.7rem;font-weight:700;color:#e53e3e;text-transform:uppercase;letter-spacing:0.5px">
            Linha ${s.linha} · CEP ${s.cep}
          </span>
          <span style="font-size:0.75rem;color:var(--cor-texto-secundario);line-height:1.4">
            ✏ ${s.original}
          </span>
          <span style="font-size:0.75rem;color:var(--cor-texto-secundario);line-height:1.4">
            📍 ViaCEP: ${s.viaCep}
          </span>
        `;
        ul.appendChild(li);
      }

      box.appendChild(ul);
      progress.insertAdjacentElement("afterend", box);
    }

    // ========================================================
    // DESENHAR CAIXA LARANJA (RESGATADOS)
    // ========================================================
    const anteriorResgatados = document.getElementById("padronResgatadosBox");
    if (anteriorResgatados) anteriorResgatados.remove();

    if (listaResgatados.length > 0) {
      const boxResgatados = document.createElement("div");
      boxResgatados.id = "padronResgatadosBox";
      Object.assign(boxResgatados.style, {
        marginTop: "12px",
        background: "rgba(221, 107, 32, 0.06)",
        border: "1px solid rgba(221, 107, 32, 0.3)",
        borderRadius: "10px",
        padding: "12px",
      });

      const tituloResgatados = document.createElement("div");
      Object.assign(tituloResgatados.style, {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "0.75rem",
        fontWeight: "700",
        color: "#dd6b20",
        fontFamily: "'Montserrat', sans-serif",
        marginBottom: "10px",
      });
      tituloResgatados.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px">info</span> Endereços resgatados (Confira antes de exportar)`;
      boxResgatados.appendChild(tituloResgatados);

      const ulResgatados = document.createElement("ul");
      Object.assign(ulResgatados.style, {
        listStyle: "none",
        padding: "0",
        margin: "0",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      });

      for (const r of listaResgatados) {
        const liResgatados = document.createElement("li");
        Object.assign(liResgatados.style, {
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          padding: "8px 10px",
          background: "var(--cor-branco)",
          borderRadius: "8px",
          border: "1px solid var(--cor-borda)",
          fontFamily: "'Montserrat', sans-serif",
        });
        liResgatados.innerHTML = `
          <span style="font-size:0.7rem;font-weight:700;color:#dd6b20;text-transform:uppercase;letter-spacing:0.5px">
            Linha ${r.linha} · ${r.motivo}
          </span>
          <span style="font-size:0.75rem;color:var(--cor-texto-secundario);line-height:1.4">
            ❌ <b>Original:</b> ${r.original}
          </span>
          <span style="font-size:0.75rem;color:var(--cor-texto-secundario);line-height:1.4">
            ✅ <b>Ficou:</b> ${r.resultado}
          </span>
        `;
        ulResgatados.appendChild(liResgatados);
      }

      boxResgatados.appendChild(ulResgatados);

      const boxSuspeitosExistente =
        document.getElementById("padronSuspeitosBox");
      if (boxSuspeitosExistente) {
        boxSuspeitosExistente.insertAdjacentElement("afterend", boxResgatados);
      } else {
        progress.insertAdjacentElement("afterend", boxResgatados);
      }
    }
  }

  // ── Download ──
  btnDownload.addEventListener("click", () => {
    if (!window.XLSX) {
      console.error("XLSX não carregado");
      return;
    }

    const ws = XLSX.utils.aoa_to_sheet(processedRows);

    const colWidths = processedRows[0].map((_, ci) => ({
      wch: Math.max(
        ...processedRows.map((r) => String(r[ci] || "").length),
        10,
      ),
    }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Paradas");

    const dataUsada =
      typeof dataDoArquivo !== "undefined" && dataDoArquivo
        ? dataDoArquivo
        : new Date();
    const dia = String(dataUsada.getDate()).padStart(2, "0");
    const mes = String(dataUsada.getMonth() + 1).padStart(2, "0");
    const ano = dataUsada.getFullYear();

    const nomeArquivo = `${dia}-${mes}-${ano}-rotatrack.xlsx`;

    XLSX.writeFile(wb, nomeArquivo);
  });

  // ── Helpers ──
  function parseCsvText(text) {
    const sep = detectSepChar(text);
    const rows = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const cols = [];
      let cur = "",
        inQ = false;
      for (const c of line) {
        if (c === '"') {
          inQ = !inQ;
        } else if (c === sep && !inQ) {
          cols.push(cur);
          cur = "";
        } else cur += c;
      }
      cols.push(cur);
      rows.push(cols);
    }
    return rows;
  }

  function detectSepChar(text) {
    const line = text.split("\n")[0];
    const counts = { ",": 0, ";": 0, "\t": 0, "|": 0 };
    for (const c of line) if (counts[c] !== undefined) counts[c]++;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
}
