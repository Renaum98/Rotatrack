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

  // MÁGICA 1: Puxa o número e separa o resto do texto
  const numMatch = restoOriginal.match(/(\d+)(.*)/);
  const numero = numMatch ? numMatch[1] : "";
  let line2 = "";

  // MÁGICA 2: Captura só o primeiro bloco após o número (ex: "Apto 2") e ignora o resto
  if (numMatch && numMatch[2]) {
    const sujo = numMatch[2].replace(/^[,\s\-]+/, "").trim();
    line2 = sujo.split(",")[0].trim();
  }

  const line1 = numero ? `${logradouro}, ${numero}` : logradouro;

  return { line1, line2 };
}

// ── Versão sem âncora: separa com base no primeiro número ──
function splitAddressLines(fullAddress) {
  const s = String(fullAddress || "").trim();

  const numMatch = s.match(/(\d+)(.*)/);
  if (!numMatch) return { line1: s, line2: "" };

  const numero = numMatch[1];
  const posNumero = s.indexOf(numMatch[0]);

  const rua = s
    .slice(0, posNumero)
    .replace(/[,\s]+$/, "")
    .trim();

  let line2 = numMatch[2].replace(/^[,\s\-]+/, "").trim();
  line2 = line2.split(",")[0].trim(); // Isola o complemento

  return { line1: `${rua}, ${numero}`, line2 };
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
  let dataDoArquivo = new Date(); // <-- Mémoria para guardar a data

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
    let totalApenasAbrev = 0;
    let totalSuspeitos = 0;
    let totalResgatados = 0;
    const listaSuspeitos = [];

    const linhasProcessadas = [];
    const ruasValidadasPlanilha = new Set();

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
        // MÁGICA: Confia 100% no ViaCEP! Ignora o texto do cliente e pega só o número.
        ({ line1, line2 } = padronBuildAndSplit(origAddr, via.logradouro));
        ruasValidadasPlanilha.add(via.logradouro);
        status = "ok";
        totalCorrigidos++;
      } else {
        // Só vai para o resgate da planilha se o CEP for inválido ou não existir
        status = "sem_cep";
      }

      // Pega o bairro (prioriza o ViaCEP, se não tiver, usa a planilha)
      let bairroCorreto = "";
      if (via && via.bairro) {
        bairroCorreto = via.bairro;
      } else if (bairroCol >= 0) {
        bairroCorreto = String(row[bairroCol] || "").trim();
      }

      // Salva tudo na memória
      linhasProcessadas.push({
        original: origAddr,
        cep: cepClean,
        viaCep: via ? via.logradouro : null,
        line1,
        line2,
        status,
        linhaOriginal: i + 2,
        bairro: bairroCorreto,
        estado: estadoCorreto, // Agora ele acha a variável sem problemas!
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

        if (!resgatado) {
          const abbr = padronApplyAbbr(item.original);

          if (item.viaCep) {
            const numMatch = abbr.match(/(\d+)(.*)/);

            if (numMatch) {
              item.line1 = `${item.viaCep}, ${numMatch[1]}`;
              let linha2Suja = numMatch[2].replace(/^[,\s\-]+/, "").trim();
              item.line2 = linha2Suja.split(",")[0].trim();
            } else {
              item.line1 = item.viaCep;
              item.line2 = "";
            }

            item.status = "ok";
            totalResgatados++;
            totalCorrigidos++;
          } else {
            const separacaoFallback = splitAddressLines(abbr);
            item.line1 = separacaoFallback.line1;
            item.line2 = separacaoFallback.line2;

            totalSuspeitos++;
            listaSuspeitos.push({
              linha: item.linhaOriginal,
              cep: item.cep,
              original: item.original,
              viaCep: "CEP Inválido/Não encontrado",
            });
          }
        }
      }
    }

    const agrupadas = agruparEnderecos(linhasProcessadas);

    // ========================================================
    // Montar planilha final (SEM LAT/LNG, COM COMPLEMENTO SEPARADO)
    // ========================================================
    processedRows = [
      [
        "Address Line 1", // Rua, Número, Bairro (Tudo na mesma linha)
        "Address Line 2", // Complemento (Ex: Apto 2)
        "Zip", // CEP isolado em sua própria coluna
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

      // 4. Formata o CEP com o tracinho (ex: 03011-000)
      let cepFormatado = item.cep;
      if (cepFormatado && cepFormatado.length === 8) {
        cepFormatado = `${cepFormatado.slice(0, 5)}-${cepFormatado.slice(5)}`;
      }

      // 5. MÁGICA: Junta a Rua/Número com o Bairro que veio na sua planilha
      let linha1ComBairro = item.line1;
      if (item.bairro) {
        // Se a planilha original tinha bairro, ele adiciona (Ex: Rua Miller, 297, Brás)
        linha1ComBairro = `${item.line1}, ${item.bairro}`;
      }

      // 6. Adiciona a linha na planilha final
      processedRows.push([
        linha1ComBairro, // Address Line 1 (Ex: Rua Maria Marcolina, 204, Brás)
        item.line2, // Address Line 2 (Ex: Loja 2)
        cepFormatado, // Zip (Ex: 03011-000)
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

    // 1. Cria a planilha (ws) com os nossos dados finais
    const ws = XLSX.utils.aoa_to_sheet(processedRows);

    // 2. Ajusta a largura visual das colunas no Excel
    const colWidths = processedRows[0].map((_, ci) => ({
      wch: Math.max(
        ...processedRows.map((r) => String(r[ci] || "").length),
        10,
      ),
    }));
    ws["!cols"] = colWidths;

    // 3. Cria o arquivo (wb) e joga a planilha lá dentro
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Paradas");

    // 4. Usa a data original do documento que fizemos upload
    // (Se a variável dataDoArquivo não existir, ele usa a de hoje por segurança)
    const dataUsada =
      typeof dataDoArquivo !== "undefined" && dataDoArquivo
        ? dataDoArquivo
        : new Date();
    const dia = String(dataUsada.getDate()).padStart(2, "0");
    const mes = String(dataUsada.getMonth() + 1).padStart(2, "0");
    const ano = dataUsada.getFullYear();

    // 5. Nome final formatado
    const nomeArquivo = `${dia}-${mes}-${ano}-Rotatrack.xlsx`;

    // 6. Faz o download!
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
