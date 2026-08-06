// categories.js — classifica uma tarefa em uma "sessão" (Carro, Casa, etc.)
// por palavras-chave. Não há IA nem chamada externa: é um classificador
// local simples, então erra em frases ambíguas — dá pra ajustar só esta
// lista sem tocar em mais nada.
//
// A ordem do array É a prioridade de classificação: a primeira categoria
// cujas palavras-chave aparecerem no texto vence. Isso importa quando duas
// categorias têm palavras concorrentes na mesma frase — ex. "pagar o
// documento do carro" tem "pagar"/"documento" (Financeiro) e "carro"
// (Carro); como Carro vem antes na lista, ela ganha.
export const CATEGORIES = [
  {
    id: 'carro',
    label: 'Carro',
    keywords: ['carro', 'oleo', 'pneu', 'revisao', 'ipva', 'licenciamento', 'mecanico', 'oficina', 'gasolina', 'cnh', 'multa', 'freio', 'farol', 'pastilha', 'combustivel'],
    icon: [
      { tag: 'path', attrs: { d: 'M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11' } },
      { tag: 'rect', attrs: { x: '3', y: '11', width: '18', height: '6', rx: '2' } },
      { tag: 'circle', attrs: { cx: '7.5', cy: '17', r: '1.5' } },
      { tag: 'circle', attrs: { cx: '16.5', cy: '17', r: '1.5' } },
    ],
  },
  {
    id: 'saude',
    label: 'Saúde',
    keywords: ['medico', 'dentista', 'remedio', 'farmacia', 'consulta', 'exame', 'academia', 'vacina', 'fisioterapia', 'psicologo', 'saude', 'nutricionista', 'treino'],
    icon: [
      { tag: 'path', attrs: { d: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z' } },
    ],
  },
  {
    id: 'familia',
    label: 'Família',
    keywords: ['filho', 'filha', 'escola', 'aniversario', 'passeio', 'passarinho', 'cachorro', 'gato', 'pet', 'racao', 'veterinario', 'familia', 'crianca', 'criancas', 'bebe'],
    icon: [
      { tag: 'path', attrs: { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' } },
      { tag: 'circle', attrs: { cx: '9', cy: '7', r: '4' } },
      { tag: 'path', attrs: { d: 'M23 21v-2a4 4 0 0 0-3-3.87' } },
      { tag: 'path', attrs: { d: 'M16 3.13a4 4 0 0 1 0 7.75' } },
    ],
  },
  {
    id: 'casa',
    label: 'Casa',
    keywords: ['faxina', 'limpar', 'limpeza', 'arrumar', 'encanador', 'eletricista', 'condominio', 'aluguel', 'jardim', 'quintal', 'geladeira', 'roupa', 'louca', 'casa'],
    icon: [
      { tag: 'path', attrs: { d: 'M3 11l9-8 9 8' } },
      { tag: 'path', attrs: { d: 'M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10' } },
    ],
  },
  {
    id: 'trabalho',
    label: 'Trabalho',
    keywords: ['reuniao', 'relatorio', 'email', 'apresentacao', 'projeto', 'cliente', 'chefe', 'planilha', 'prazo', 'trabalho', 'escritorio', 'entregar'],
    icon: [
      { tag: 'rect', attrs: { x: '2', y: '7', width: '20', height: '14', rx: '2' } },
      { tag: 'path', attrs: { d: 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' } },
    ],
  },
  {
    id: 'mercado',
    label: 'Mercado',
    keywords: ['mercado', 'supermercado', 'feira', 'padaria', 'acougue', 'sacolao', 'compras', 'comprar'],
    icon: [
      { tag: 'circle', attrs: { cx: '9', cy: '21', r: '1' } },
      { tag: 'circle', attrs: { cx: '20', cy: '21', r: '1' } },
      { tag: 'path', attrs: { d: 'M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6' } },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    keywords: ['pagar', 'boleto', 'conta', 'banco', 'fatura', 'imposto', 'cartao', 'financiamento', 'emprestimo', 'documento', 'pix', 'transferencia'],
    icon: [
      { tag: 'line', attrs: { x1: '12', y1: '1', x2: '12', y2: '23' } },
      { tag: 'path', attrs: { d: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' } },
    ],
  },
  // As três abaixo têm keywords vazias de propósito: elas nunca são
  // escolhidas por categorizeTask() (classificador por palavra-chave do
  // texto). Quem as atribui é store.js, como uma sessão de reserva melhor
  // que "Outros" quando a tarefa não bateu com nenhum tema acima mas veio
  // com um período do dia falado (ver time.js) — ex. "de manhã andar de
  // bike" cai em "Manhã" em vez de "Outros".
  {
    id: 'manha',
    label: 'Manhã',
    keywords: [],
    icon: [
      { tag: 'circle', attrs: { cx: '12', cy: '12', r: '5' } },
      { tag: 'line', attrs: { x1: '12', y1: '1', x2: '12', y2: '3' } },
      { tag: 'line', attrs: { x1: '4.22', y1: '4.22', x2: '5.64', y2: '5.64' } },
      { tag: 'line', attrs: { x1: '1', y1: '12', x2: '3', y2: '12' } },
      { tag: 'line', attrs: { x1: '18.36', y1: '5.64', x2: '19.78', y2: '4.22' } },
    ],
  },
  {
    id: 'tarde',
    label: 'Tarde',
    keywords: [],
    icon: [
      { tag: 'circle', attrs: { cx: '12', cy: '12', r: '5' } },
      { tag: 'line', attrs: { x1: '12', y1: '21', x2: '12', y2: '23' } },
      { tag: 'line', attrs: { x1: '18.36', y1: '18.36', x2: '19.78', y2: '19.78' } },
      { tag: 'line', attrs: { x1: '21', y1: '12', x2: '23', y2: '12' } },
      { tag: 'line', attrs: { x1: '4.22', y1: '19.78', x2: '5.64', y2: '18.36' } },
    ],
  },
  {
    id: 'noite',
    label: 'Noite',
    keywords: [],
    icon: [
      { tag: 'path', attrs: { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' } },
    ],
  },
  {
    id: 'outros',
    label: 'Outros',
    keywords: [],
    icon: [
      { tag: 'line', attrs: { x1: '8', y1: '6', x2: '21', y2: '6' } },
      { tag: 'line', attrs: { x1: '8', y1: '12', x2: '21', y2: '12' } },
      { tag: 'line', attrs: { x1: '8', y1: '18', x2: '21', y2: '18' } },
      { tag: 'line', attrs: { x1: '3', y1: '6', x2: '3.01', y2: '6' } },
      { tag: 'line', attrs: { x1: '3', y1: '12', x2: '3.01', y2: '12' } },
      { tag: 'line', attrs: { x1: '3', y1: '18', x2: '3.01', y2: '18' } },
    ],
  },
];

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Usa "(?:^|\s)" / "(?:$|\s)" em vez de "\b" pelo mesmo motivo do time.js:
// \b não reconhece corretamente os limites de palavra acentuada.
const COMPILED = CATEGORIES
  .filter((cat) => cat.keywords.length > 0)
  .map((cat) => ({
    id: cat.id,
    regex: new RegExp('(?:^|\\s)(' + cat.keywords.map(escapeRegExp).join('|') + ')(?:$|\\s)'),
  }));

/**
 * @param {string} text
 * @returns {string} id de uma categoria em CATEGORIES (sempre existe, cai em "outros")
 */
export function categorizeTask(text) {
  const normalized = ` ${normalize(text || '')} `;
  for (const { id, regex } of COMPILED) {
    if (regex.test(normalized)) return id;
  }
  return 'outros';
}
