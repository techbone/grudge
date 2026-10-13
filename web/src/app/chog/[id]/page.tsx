import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RapSheet } from "@/components/rap-sheet";
import { chogLabel } from "@/lib/chogs";

function parse(id: string) {
  const n = Number(id);
  return Number.isInteger(n) && n >= 1 && n <= 1969 ? n : null;
}

export async function generateMetadata({ params }: PageProps<"/chog/[id]">): Promise<Metadata> {
  const n = parse((await params).id);
  return { title: n ? `${chogLabel(n)} · Grudge` : "Grudge" };
}

async function Sheet({ params }: { params: PageProps<"/chog/[id]">["params"] }) {
  const n = parse((await params).id);
  if (!n) notFound();
  return <RapSheet id={n} />;
}

export default function ChogPage({ params }: PageProps<"/chog/[id]">) {
  return (
    <Suspense fallback={null}>
      <Sheet params={params} />
    </Suspense>
  );
}
