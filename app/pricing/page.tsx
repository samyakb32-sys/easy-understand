import { PricingCards } from "@/components/PricingCards";
import { pageTitle } from "@/lib/brand";
import { FREE_DAILY_SOLVES, PRO_DAILY_SOLVES } from "@/lib/pricing";

export const metadata = { title: pageTitle("Pricing"), description: "Free sample lessons and solves every day, with Pro plans for unlimited practice, 3D models and saved history." };

export default function PricingPage() {
  return (
    <div className="app-shell">
      <main className="page">
        <div className="screen-heading">
          <div className="eyebrow">MAKE EXAM PREP CALMER</div>
          <h1>A plan for every<br />kind of deadline.</h1>
          <p>Start free with every sample lesson and {FREE_DAILY_SOLVES} AI solves a day. Upgrade for up to {PRO_DAILY_SOLVES} solves a day, rotatable 3D models and saved study history.</p>
        </div>
        <PricingCards />
      </main>
    </div>
  );
}
