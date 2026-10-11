import { PricingCards } from "@/components/PricingCards";
import { pageTitle } from "@/lib/brand";
import { FREE_DAILY_SOLVES, PRO_DAILY_SOLVES } from "@/lib/pricing";

export const metadata = { title: pageTitle("Pricing") };

export default function PricingPage() {
  return (
    <main className="page shell">
      <div className="eyebrow">Pricing</div>
      <h1>Free to start.<br />Pro when exams hit.</h1>
      <p className="lede">Free: every sample lesson in 2D and {FREE_DAILY_SOLVES} AI solves a day. Pro adds the 3D model, saved lessons and up to {PRO_DAILY_SOLVES} AI solves a day.</p>
      <PricingCards />
    </main>
  );
}
