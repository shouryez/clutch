import { Suspense } from "react";
import { SignView } from "@/components/app/SignView";

async function Resolve({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SignView id={id} />;
}

export default function Page({ params }: PageProps<"/sign/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bone" />}>
      <Resolve params={params} />
    </Suspense>
  );
}
