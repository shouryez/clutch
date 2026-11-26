import { Suspense } from "react";
import { AccountView } from "@/components/app/AccountView";
import { Loading } from "@/components/app/CommandCenter";

async function Resolve({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccountView id={id} />;
}

export default function Page({ params }: PageProps<"/app/accounts/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Resolve params={params} />
    </Suspense>
  );
}
