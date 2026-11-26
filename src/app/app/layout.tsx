import { Shell } from "@/components/app/Shell";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return <Shell>{children}</Shell>;
}
