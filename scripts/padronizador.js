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
  [/\bDr\.\s*/gi, "Doutor "],
  [/\bDra\.\s*/gi, "Doutora "],
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

// ── Normaliza string para comparação (sem acentos, minúsculo, sem pontuação) ──
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

  // Para resgatar, TODAS as palavras principais da rua oficial
  // devem estar contidas no endereço digitado errado.
  return palavrasBoa.every((p) => origNorm.includes(p));
}

// ── Monta endereço e separa em line1 / line2 usando o logradouro como âncora ──
function padronBuildAndSplit(original, logradouro) {
  const origNorm = normalizar(original);
  const viaNorm = normalizar(logradouro);

  const palavrasChave = viaNorm
    .split(/\s+/)
    .filter((p) => p.length > 3 && !PALAVRAS_IGNORADAS.has(p));

  // Passo 1: encontrar onde o logradouro termina no texto original normalizado
  let fimLogradouro = 0;
  for (const palavra of palavrasChave) {
    const idx = origNorm.indexOf(palavra);
    if (idx >= 0) {
      fimLogradouro = Math.max(fimLogradouro, idx + palavra.length);
    }
  }

  const restoOriginal = original.slice(fimLogradouro).trim();
  const posVirgula = restoOriginal.indexOf(",");

  if (posVirgula >= 0) {
    const antesVirgula = restoOriginal.slice(0, posVirgula).trim();
    const aposVirgula = restoOriginal.slice(posVirgula + 1).trim();

    const numMatch = aposVirgula.match(/^(\S+)(.*)/);
    const numero = numMatch ? numMatch[1] : aposVirgula;
    const resto = numMatch ? numMatch[2].replace(/^,\s*/, "").trim() : "";

    const line1 = `${logradouro}, ${numero}`;

    const partesLine2 = [];
    if (antesVirgula) partesLine2.push(antesVirgula);
    if (resto) partesLine2.push(resto);
    const line2 = partesLine2.join(", ");

    return { line1, line2 };
  }

  return { line1: logradouro, line2: restoOriginal.trim() };
}

// ── Versão sem âncora: separa só com base na estrutura do texto ──
function splitAddressLines(fullAddress) {
  const s = String(fullAddress || "").trim();

  const numMatch = s.match(/,\s*(\d+\S*)(.*)/);
  if (!numMatch) return { line1: s, line2: "" };

  const posVirgula = s.indexOf(numMatch[0]);
  const line1 = s
    .slice(0, posVirgula + numMatch[0].length - numMatch[2].length)
    .trim();
  const line2 = numMatch[2].replace(/^,\s*/, "").trim();

  return { line1, line2 };
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

    // === NOVAS COLUNAS: ESTADO E COORDENADAS ===
    const estadoCol = headers.findIndex((h) =>
      /^estado$|^uf$|^state$/i.test(h),
    );
    const latCol = headers.findIndex((h) => /latitude|lat/i.test(h));
    const lngCol = headers.findIndex((h) => /longitude|lng|lon/i.test(h));

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
    let totalApenasAbrev = 0;
    let totalSuspeitos = 0;
    let totalResgatados = 0;
    const listaSuspeitos = [];

    const linhasProcessadas = [];

    // Banco de ruas oficiais da própria planilha
    const ruasValidadasPlanilha = new Set();

    // ========================================================
    // PASSO 1: Validar no ViaCEP e Popular o Banco de Ruas
    // ========================================================
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const cepClean = String(row[cepCol] || "").replace(/\D/g, "");
      const origAddr = String(row[addrCol] || "").trim();

      const pct = Math.round(((i + 1) / total) * 100);
      bar.style.width = pct + "%";
      label.textContent = `Validando CEPs: ${i + 1} / ${total}`;

      let line1 = "",
        line2 = "",
        status = "";
      const via = await padronFetchViaCEP(cepClean);

      if (via && via.logradouro) {
        if (logradouroParece(origAddr, via.logradouro)) {
          // ✅ ViaCEP confirmado
          ({ line1, line2 } = padronBuildAndSplit(origAddr, via.logradouro));
          ruasValidadasPlanilha.add(via.logradouro); // Salva rua boa no banco
          status = "ok";
          totalCorrigidos++;
        } else {
          status = "suspeito"; // Deixa pendente
        }
      } else {
        status = "sem_cep"; // Deixa pendente
      }

      // Pega a cidade (prioriza a planilha, se não tiver, usa o ViaCEP)
      let cidadeCorreta = cityCol >= 0 ? String(row[cityCol] || "").trim() : "";
      if (!cidadeCorreta && via && via.localidade) {
        cidadeCorreta = via.localidade;
      }

      // Pega o estado (prioriza o ViaCEP, se não tiver, usa a planilha)
      let estadoCorreto = "";
      if (via && via.uf) {
        estadoCorreto = via.uf;
      } else if (estadoCol >= 0) {
        estadoCorreto = String(row[estadoCol] || "").trim();
      }

      linhasProcessadas.push({
        original: origAddr,
        cep: cepClean,
        viaCep: via ? via.logradouro : null,
        line1,
        line2,
        status,
        linhaOriginal: i + 2,
        bairro: bairroCol >= 0 ? String(row[bairroCol] || "").trim() : "",
        city: cidadeCorreta, // Cidade inteligente
        estado: estadoCorreto, // Estado inteligente
        lat: latCol >= 0 ? String(row[latCol] || "").trim() : "",
        lng: lngCol >= 0 ? String(row[lngCol] || "").trim() : "",
        sequencias: seqCol >= 0 ? [String(row[seqCol] || "").trim()] : [],
      });

      if (cepClean.length === 8 && !(cepClean in padronCepCache)) {
        await new Promise((r) => setTimeout(r, 120));
      }
    }

    // ========================================================
    // PASSO 2: Resgatar Suspeitos usando o Banco de Ruas
    // ========================================================
    label.textContent = "Cruzando dados para resgatar erros...";

    for (const item of linhasProcessadas) {
      if (item.status === "suspeito" || item.status === "sem_cep") {
        let resgatado = false;

        // Tenta achar a rua digitada dentro das ruas válidas da própria planilha
        for (const ruaBoa of ruasValidadasPlanilha) {
          if (logradouroPareceEstrito(item.original, ruaBoa)) {
            const separacao = padronBuildAndSplit(item.original, ruaBoa);
            item.line1 = separacao.line1;
            item.line2 = separacao.line2;

            resgatado = true;
            totalResgatados++;
            totalCorrigidos++;
            break;
          }
        }

        // Se a própria planilha não salvou ele, aplica o Fallback Textual antigo
        if (!resgatado) {
          const abbr = padronApplyAbbr(item.original);
          const separacaoFallback = splitAddressLines(abbr);
          item.line1 = separacaoFallback.line1;
          item.line2 = separacaoFallback.line2;

          if (item.status === "suspeito") {
            totalSuspeitos++;
            listaSuspeitos.push({
              linha: item.linhaOriginal,
              cep: item.cep,
              original: item.original,
              viaCep: item.viaCep,
            });
          } else {
            totalApenasAbrev++;
          }
        }
      }
    }

    // Segunda passagem: agrupar endereços duplicados
    const agrupadas = agruparEnderecos(linhasProcessadas);

    // ========================================================
    // Montar planilha final (PADRÃO GOOGLE MAPS + CIRCUIT)
    // ========================================================
    processedRows = [
      [
        "Address Line 1", // Endereço completo para o GPS não errar
        "Address Line 2", // Complemento isolado
        "Pacotes", // Pacotes do motorista
        "Latitude", // Eixo Y (Se existir na planilha)
        "Longitude", // Eixo X (Se existir na planilha)
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
        notasParaMotorista = `Pacotes: ${sequenciasValidas.join(", ")} (Total: ${qtdPacotes})`;
      }

      // 4. Formata o CEP com o tracinho (ex: 01001-000) pro Maps ler melhor
      let cepFormatado = item.cep;
      if (cepFormatado && cepFormatado.length === 8) {
        cepFormatado = `${cepFormatado.slice(0, 5)}-${cepFormatado.slice(5)}`;
      }

      // 5. Constrói o endereço blindado: Rua, Número, Cidade, Estado, CEP, País
      const partesEndereco = [
        item.line1,
        item.city,
        item.estado,
        cepFormatado,
        "Brasil", // O país cravado ajuda o Google a nunca mandar pra fora do país
      ];

      // O filter(Boolean) remove espaços vazios caso falte estado ou cidade
      const enderecoCompletoGoogleMaps = partesEndereco
        .filter(Boolean)
        .join(", ")
        .split(",")
        .map((parte) => parte.trim())
        .filter(Boolean)
        .join(", ");

      // 6. Adiciona a linha na planilha final
      processedRows.push([
        enderecoCompletoGoogleMaps, // Address Line 1 (Endereço Completo)
        item.line2, // Address Line 2 (Complemento)
        notasParaMotorista, // Notes (Pacotes)
        item.lat, // Latitude (Se capturada)
        item.lng, // Longitude (Se capturada)
      ]);
    }

    // Resumo
    const totalParadas = agrupadas.length;
    const totalOriginal = linhasProcessadas.length;
    const totalAgrupados = totalOriginal - totalParadas;

    let resumo = `✓ <strong style="color: var(--cor-sucesso, #3182ce); font-size: 1.1em;">${totalParadas} paradas</strong> (${totalAgrupados} agrupadas) &middot; ${totalCorrigidos} corrigidos`;
    if (totalResgatados > 0) resumo += ` (${totalResgatados} resgatados)`;
    if (totalSuspeitos > 0) resumo += ` · ${totalSuspeitos} suspeitos`;

    label.innerHTML = resumo;
    bar.style.width = "100%";
    btnRow.style.display = "flex";

    // ── Exibir suspeitos dinamicamente ──
    const anterior = document.getElementById("padronSuspeitosBox");
    if (anterior) anterior.remove();

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
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, "0");
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const ano = hoje.getFullYear();

    const nomeArquivo = `${dia}-${mes}-${ano}-Rota-Aprimorada.xlsx`;

    // Salva o arquivo com o novo nome
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
