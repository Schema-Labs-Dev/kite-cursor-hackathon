import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Marquee } from "@/components/landing/marquee";
import { Pillars } from "@/components/landing/pillars";
import { Stats } from "@/components/landing/stats";
import { BuiltOnBase } from "@/components/landing/built-on-base";
import { TestflightCta } from "@/components/landing/testflight-cta";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Pillars />
        <Stats />
        <BuiltOnBase />
        <TestflightCta />
      </main>
      <Footer />
    </>
  );
}
