import { Suspense } from "react";
import { DealRoom } from "@/components/app/DealRoom";
import { Loading } from "@/components/app/CommandCenter";

async function Resolve({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DealRoom id={id} />;
}

export default function Page({ params }: PageProps<"/app/deal/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Resolve params={params} />
    </Suspense>
  );
}
