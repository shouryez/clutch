import { Cursor } from "@/components/fx/Cursor";
import { SmoothScroll } from "@/components/fx/SmoothScroll";
import { Agents } from "@/components/landing/Agents";
import { Bento } from "@/components/landing/Bento";
import { BugRadar } from "@/components/landing/BugRadar";
import { CallScene } from "@/components/landing/CallScene";
import { CTA, Numbers } from "@/components/landing/Closing";
import { Hero } from "@/components/landing/Hero";
import { Marquee } from "@/components/landing/Marquee";
import { Nav } from "@/components/landing/Nav";
import { Negotiation } from "@/components/landing/Negotiation";
import { Pricing } from "@/components/landing/Pricing";
import { Product } from "@/components/landing/Product";
import { Stack } from "@/components/landing/Stack";
import { Timeline } from "@/components/landing/Timeline";
import { Touchless } from "@/components/landing/Touchless";

export default function Home() {
  return (
    <main className="custom-cursor relative">
      <SmoothScroll />
      <Cursor />
      <div className="grain" aria-hidden />
      <Nav />
      <Hero />
      <Marquee />
      <Product />
      <Timeline />
      <Agents />
      <CallScene />
      <Negotiation />
      <Touchless />
      <Bento />
      <BugRadar />
      <Stack />
      <Numbers />
      <Pricing />
      <CTA />
    </main>
  );
}
