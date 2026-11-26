import { Suspense } from "react";
import { CallMirror } from "@/components/app/CallMirror";
import { Loading } from "@/components/app/CommandCenter";

async function Resolve({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CallMirror id={id} />;
}

export default function Page({ params }: PageProps<"/app/call/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Resolve params={params} />
    </Suspense>
  );
}
