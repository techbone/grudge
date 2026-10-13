import type { Address } from "viem";

export const CHOG_ADDRESS: Address = "0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763";
export const CHOG_TOKEN_ADDRESS: Address = "0x350035555E10d9AfAF1566AaebfCeD5BA6C27777";
export const GRUDGE_ADDRESS = process.env.NEXT_PUBLIC_GRUDGE_ADDRESS as Address | undefined;

export const MAX_ID = 1969;
export const MOVES_PER_DAY = 3;

/** Index = onchain `kind`. */
export const PRANKS = [
  { id: "graffiti", name: "Graffiti", line: "Tag their face." },
  { id: "hat", name: "Hat steal", line: "Yank the hat clean off." },
  { id: "stink", name: "Stink cloud", line: "Let it drift in." },
  { id: "tomato", name: "Tomato", line: "Splat." },
  { id: "googly", name: "Googly eyes", line: "Permanent derp." },
] as const;

export const chogOwnerAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export function isValidId(n: number) {
  return Number.isInteger(n) && n >= 1 && n <= MAX_ID;
}

const ERRORS: Record<string, string> = {
  BadId: "That isn't a Chog id (1–1969).",
  BadKind: "Unknown prank.",
  NotOwner: "You don't hold that Chog.",
  SameOwner: "You can't prank a Chog in your own wallet.",
  OutOfMoves: "This Chog is out of moves today. Back tomorrow.",
  AlreadyPrankedToday: "You already pranked that Chog today.",
  NoPayback: "No open payback against that Chog.",
  EmptySlot: "Nothing to scrub there.",
  AlreadyOffered: "You already offered a truce.",
  BountyOpen: "There's already a bounty on that Chog.",
  TransferFailed: "$CHOG transfer failed. Check balance and approval.",
};

/** Turns a viem/wagmi error into a short sentence for the player. */
export function explainError(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string; cause?: unknown; walk?: (fn: (e: unknown) => boolean) => unknown };
  const found = e?.walk?.((x) => typeof (x as { data?: { errorName?: string } })?.data?.errorName === "string") as
    | { data?: { errorName?: string } }
    | undefined;
  const name = found?.data?.errorName;
  if (name && ERRORS[name]) return ERRORS[name];
  if (e?.shortMessage?.includes("User rejected")) return "Cancelled in wallet.";
  return e?.shortMessage || e?.message || "Something went wrong.";
}

export function timeAgo(unix: number, now: number) {
  const s = Math.max(0, now - unix);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
