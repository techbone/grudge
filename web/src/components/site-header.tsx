"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { isLocal } from "@/lib/chains";
import { setMuted, useMuted } from "@/lib/sfx";
import { WrongNetwork } from "./wrong-network";

const NAV = [
  { href: "/", label: "The Wall" },
  { href: "/prank", label: "Prank" },
  { href: "/feuds", label: "Feuds" },
  { href: "/studio", label: "Studio" },
];

export function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function SiteHeader() {
  const path = usePathname();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const muted = useMuted();

  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-8">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-extrabold tracking-tight">GRUDGE</span>
          {isLocal && <span className="font-mono text-[10px] uppercase text-muted">local fork</span>}
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${path === n.href ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={() => setMuted(!muted)} className="font-mono text-xs text-muted hover:text-ink" aria-pressed={!muted}>
            sound {muted ? "off" : "on"}
          </button>
          {isConnected && address ? (
            <button onClick={() => disconnect()} title="Disconnect" className="rounded-md border-2 border-ink px-3 py-1 font-mono text-xs hover:bg-ink hover:text-paper">
              {short(address)}
            </button>
          ) : (
            <button onClick={() => connect({ connector: injected() })} className="rounded-md border-2 border-ink bg-ink px-3 py-1 text-sm font-semibold text-paper hover:opacity-90">
              Connect
            </button>
          )}
        </div>
      </div>
      <nav className="flex border-t border-line sm:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`flex-1 py-2 text-center text-sm font-semibold ${path === n.href ? "bg-ink text-paper" : "text-muted"}`}>
            {n.label}
          </Link>
        ))}
      </nav>
      <WrongNetwork />
    </header>
  );
}
