import { Suspense } from "react";
import { HelpdeckApp } from "@/components/helpdeck/HelpdeckApp";


async function Resolve({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HelpdeckApp id={id} />;
}

export default function Page({ params }: PageProps<"/helpdeck/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f5f2]" />}>
      <Resolve params={params} />
    </Suspense>
  );
}
