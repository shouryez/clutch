import { Suspense } from "react";
import { PhoneCall } from "@/components/call/PhoneCall";


async function Resolve({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PhoneCall id={id} />;
}

export default function Page({ params }: PageProps<"/call/[id]">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-ink" />}>
      <Resolve params={params} />
    </Suspense>
  );
}
