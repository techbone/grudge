import data from "@/data/chogs.json";

export type ChogMeta = { id: number; name: string; traits: Record<string, string> };

const chogs = data as ChogMeta[];

export function getChog(id: number): ChogMeta | undefined {
  return chogs[id - 1];
}

/** "CHOG #1462" → "#1462". Token ids and art numbers differ, so we show both where it matters. */
export function chogLabel(id: number) {
  const name = getChog(id)?.name;
  return name && name !== "CHOG" ? name : `Chog #${id}`;
}

export function portraitSrc(id: number) {
  return `/chogs/384/${id}.webp`;
}
