export interface MovimentoImportado {
  data: Date;
  valor: number;
  tipo: "CREDITO" | "DEBITO";
  historico: string;
}

/**
 * Parser de arquivos OFX (Open Financial Exchange).
 * Extrai os blocos <STMTTRN> presentes no arquivo de extrato bancario.
 */
export function parseOfx(conteudo: string): MovimentoImportado[] {
  const movimentos: MovimentoImportado[] = [];
  const blocos = conteudo.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) ?? [];

  for (const bloco of blocos) {
    const valorStr = extrairTagOfx(bloco, "TRNAMT");
    const dataStr = extrairTagOfx(bloco, "DTPOSTED");
    const memo = extrairTagOfx(bloco, "MEMO") ?? extrairTagOfx(bloco, "NAME") ?? "Lancamento OFX";

    if (!valorStr || !dataStr) continue;

    const valor = Number(valorStr.replace(",", "."));
    const data = parseDataOfx(dataStr);

    movimentos.push({
      data,
      valor: Math.abs(valor),
      tipo: valor >= 0 ? "CREDITO" : "DEBITO",
      historico: memo.trim(),
    });
  }

  return movimentos;
}

function extrairTagOfx(bloco: string, tag: string): string | null {
  const match = bloco.match(new RegExp(`<${tag}>([^<\r\n]*)`, "i"));
  return match ? match[1].trim() : null;
}

function parseDataOfx(valor: string): Date {
  // Formato OFX: AAAAMMDDHHMMSS[.mmm[:TZ]]
  const ano = Number(valor.slice(0, 4));
  const mes = Number(valor.slice(4, 6));
  const dia = Number(valor.slice(6, 8));
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/**
 * Parser basico de arquivos CNAB (retorno bancario), suportando os layouts
 * de largura fixa CNAB400 e CNAB240. Extrai data de ocorrencia e valor dos
 * registros de detalhe (segmento de movimento financeiro).
 */
export function parseCnab(conteudo: string): MovimentoImportado[] {
  const linhas = conteudo
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 240);

  const movimentos: MovimentoImportado[] = [];

  for (const linha of linhas) {
    const tipoRegistro = linha[7];
    if (tipoRegistro !== "3") continue; // segmento de detalhe (movimento)

    const dataStr = linha.substring(137, 145); // AAAAMMDD
    const valorStr = linha.substring(152, 167); // 15 digitos, 2 casas decimais

    if (!/^\d{8}$/.test(dataStr) || !/^\d+$/.test(valorStr)) continue;

    const ano = Number(dataStr.slice(0, 4));
    const mes = Number(dataStr.slice(4, 6));
    const dia = Number(dataStr.slice(6, 8));
    const valor = Number(valorStr) / 100;

    if (valor <= 0) continue;

    movimentos.push({
      data: new Date(Date.UTC(ano, mes - 1, dia)),
      valor,
      tipo: "DEBITO",
      historico: `Lancamento CNAB - ${linha.substring(0, 7).trim()}`,
    });
  }

  return movimentos;
}

export function detectarFormato(conteudo: string): "OFX" | "CNAB" {
  return /<OFX>|<STMTTRN>/i.test(conteudo) ? "OFX" : "CNAB";
}
