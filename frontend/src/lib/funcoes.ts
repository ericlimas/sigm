export const FUNCOES_ORCAMENTARIAS: Record<string, string> = {
  "01": "Legislativa",
  "02": "Judiciaria",
  "03": "Essencial a Justica",
  "04": "Administracao",
  "05": "Defesa Nacional",
  "06": "Seguranca Publica",
  "07": "Relacoes Exteriores",
  "08": "Assistencia Social",
  "09": "Previdencia Social",
  "10": "Saude",
  "11": "Trabalho",
  "12": "Educacao",
  "13": "Cultura",
  "14": "Direitos da Cidadania",
  "15": "Urbanismo",
  "16": "Habitacao",
  "17": "Saneamento",
  "18": "Gestao Ambiental",
  "19": "Ciencia e Tecnologia",
  "20": "Agricultura",
  "21": "Organizacao Agraria",
  "22": "Industria",
  "23": "Comercio e Servicos",
  "24": "Comunicacoes",
  "25": "Energia",
  "26": "Transporte",
  "27": "Desporto e Lazer",
  "28": "Encargos Especiais",
};

export function nomeFuncao(codigo: string): string {
  return FUNCOES_ORCAMENTARIAS[codigo] ?? codigo;
}

export const MESES_ABREV = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];
