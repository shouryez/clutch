import { Suspense } from "react";
import { ValueReceipt } from "@/components/app/ValueReceipt";

export const metadata = { title: "Your value receipt · Helpdeck" };

async function Resolve({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ValueReceipt id={id} />;
}

export default function Page({ params }: PageProps<"/value/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bone" />}>
      <Resolve params={params} />
    </Suspense>
  );
}
