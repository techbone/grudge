import { Suspense } from "react";
import { PrankRoom } from "@/components/prank-room";

async function WithTarget({ searchParams }: { searchParams: PageProps<"/prank">["searchParams"] }) {
  const { target } = await searchParams;
  const t = Number(Array.isArray(target) ? target[0] : target);
  return <PrankRoom initialTarget={Number.isInteger(t) && t >= 1 && t <= 1969 ? t : undefined} />;
}

export default function PrankPage({ searchParams }: PageProps<"/prank">) {
  return (
    <Suspense fallback={null}>
      <WithTarget searchParams={searchParams} />
    </Suspense>
  );
}
