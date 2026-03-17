// Tableau-10 inspired palette — bright enough for dark bg with screen blend
const PALETTE = [
  '#4e79a7',
  '#f28e2b',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc948',
  '#b07aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ac',
];

const clientColorCache = new Map<string, string>();

export function getClientColor(clientName: string, allClients: string[]): string {
  if (clientColorCache.has(clientName)) {
    return clientColorCache.get(clientName)!;
  }
  const index = allClients.indexOf(clientName);
  const color = PALETTE[index % PALETTE.length];
  clientColorCache.set(clientName, color);
  return color;
}

export function buildClientColors(clientNames: string[]): Map<string, string> {
  const map = new Map<string, string>();
  clientNames.forEach((name, i) => {
    map.set(name, PALETTE[i % PALETTE.length]);
  });
  return map;
}

export { PALETTE };
