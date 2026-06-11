const UNIDADES = ["", "um", "dois", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = [
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos",
];

function trincaPorExtenso(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";

  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];

  if (centena > 0) partes.push(CENTENAS[centena]);

  if (resto > 0) {
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      const dezena = Math.floor(resto / 10);
      const unidade = resto % 10;
      partes.push(unidade > 0 ? `${DEZENAS[dezena]} e ${UNIDADES[unidade]}` : DEZENAS[dezena]);
    }
  }

  return partes.join(" e ");
}

function escalaTrinca(trinca: number, indiceEscala: number): string {
  if (indiceEscala === 0) return "";
  if (indiceEscala === 1) return "mil";
  if (indiceEscala === 2) return trinca === 1 ? "milhão" : "milhões";
  if (indiceEscala === 3) return trinca === 1 ? "bilhão" : "bilhões";
  return "";
}

/** Converte um numero inteiro nao negativo para sua forma por extenso em portugues */
export function numeroPorExtenso(valorInteiro: number): string {
  if (valorInteiro === 0) return "zero";

  const trincas: number[] = [];
  let resto = valorInteiro;
  while (resto > 0) {
    trincas.unshift(resto % 1000);
    resto = Math.floor(resto / 1000);
  }

  const totalTrincas = trincas.length;
  const partes = trincas
    .map((trinca, indice) => {
      if (trinca === 0) return null;
      const indiceEscala = totalTrincas - 1 - indice;
      const textoEscala = escalaTrinca(trinca, indiceEscala);
      if (indiceEscala === 1 && trinca === 1) return textoEscala; // "mil", nao "um mil"
      const textoTrinca = trincaPorExtenso(trinca);
      return textoEscala ? `${textoTrinca} ${textoEscala}` : textoTrinca;
    })
    .filter((parte): parte is string => parte !== null);

  if (partes.length === 1) return partes[0];

  const ultima = partes[partes.length - 1];
  const restantes = partes.slice(0, -1);
  return `${restantes.join(", ")} e ${ultima}`;
}

/** Converte um valor monetario para sua forma por extenso em portugues, ex: "Cento e setenta e nove reais e quarenta e seis centavos" */
export function valorPorExtenso(valor: number): string {
  const valorAbs = Math.round(Math.abs(valor) * 100) / 100;
  const reais = Math.floor(valorAbs);
  const centavos = Math.round((valorAbs - reais) * 100);

  const reaisTexto = reais > 0 ? `${numeroPorExtenso(reais)} ${reais === 1 ? "real" : "reais"}` : "";
  const centavosTexto = centavos > 0 ? `${numeroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}` : "";

  let texto: string;
  if (reaisTexto && centavosTexto) texto = `${reaisTexto} e ${centavosTexto}`;
  else if (reaisTexto) texto = `${reaisTexto} e zero centavos`;
  else if (centavosTexto) texto = `zero real e ${centavosTexto}`;
  else texto = "zero real";

  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
