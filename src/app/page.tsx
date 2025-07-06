import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { About } from "@/components/about";
import { Footer } from "@/components/footer";
import { Pricing } from "@/components/pricing";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col" id="home">
      <Navbar />
      <div className="flex-1">
        <Hero />
        <About />
        <Pricing />
      </div>
      <Footer />
    </main>
  );
}
