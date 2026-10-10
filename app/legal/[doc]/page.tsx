import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PAID_PLANS, rupees } from "@/lib/pricing";

/**
 * DRAFT policies, written to match how the site actually works so they can be used for the Razorpay activation
 * review. They are NOT legal advice: have them checked, and fill in the business details before going live.
 */
const BUSINESS = "EasyUnderstand (operated by [your registered business name], [address], India)";
const CONTACT = "[support email]";

const DOCS: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: "Terms of Service",
    body: [
      `These terms apply to your use of ${BUSINESS}. By creating an account or paying, you agree to them.`,
      "The service teaches Engineering Graphics & Design by drawing solutions step by step. Solutions are generated with the help of AI and calculation code and may contain mistakes. Check them against your textbook and your teacher's instructions before using them in an exam or an assignment. We do not guarantee marks or results.",
      "You are responsible for your account. You must not share your account, copy the service in bulk, or attempt to bypass the daily limits or paid features.",
      "Free accounts have a daily limit on AI solves. Pro plans unlock 3D models, saved lessons and a higher fair-use limit. We may change features or prices for future purchases; changes never affect a period you have already paid for.",
      `Subscriptions renew automatically every month or year at the price shown when you subscribed (${rupees(PAID_PLANS.pro_monthly.amountPaise)} per month or ${rupees(PAID_PLANS.pro_yearly.amountPaise)} per year, at the time of writing) until you cancel. The Exam pack is a one-time payment of ${rupees(PAID_PLANS.exam.amountPaise)} for ${PAID_PLANS.exam.accessDays} days of Pro and does not renew.`,
      "Payments are processed by Razorpay. We never see or store your card, UPI or bank details.",
      "To the extent permitted by law, our liability is limited to the amount you paid for the service in the 3 months before the claim.",
      `Questions: ${CONTACT}.`,
    ],
  },
  privacy: {
    title: "Privacy Policy",
    body: [
      `${BUSINESS} collects only what it needs to run the service.`,
      "Account: your email address (and your name and picture if you sign in with Google), handled by our sign-in provider, Supabase.",
      "Your problems: photos or text you upload are sent to our AI provider, Anthropic, to read the problem, and are not kept by us after solving. If you are a Pro student, the resulting lesson (title and drawing steps, not your photo) is saved to your history.",
      "Payments: handled by Razorpay. We receive the payment and subscription identifiers, the plan, the amount and the date. We do not receive your card, UPI or bank details.",
      "We use these providers only to run the service and do not sell your data. We use essential cookies to keep you signed in.",
      `You can ask us to delete your account and data at any time: ${CONTACT}.`,
    ],
  },
  refunds: {
    title: "Refund and Cancellation Policy",
    body: [
      "Cancel any time: open Account and choose Cancel subscription. Renewals stop immediately and you keep Pro until the end of the period you already paid for. We do not charge a cancellation fee.",
      "Subscriptions: if you were charged for a renewal by mistake, or the service was unusable because of a problem on our side, write to us within 7 days of the charge and we will refund it.",
      `Exam pack: one-time. If you have not used any Pro feature, you can ask for a refund within 7 days of buying it. After that it is non-refundable, because access has been provided.`,
      "Refunds go back to the original payment method and normally reach your account within 5-7 working days after we approve them.",
      `To request a refund, email ${CONTACT} from your account email with the payment date.`,
    ],
  },
  contact: {
    title: "Contact",
    body: [`${BUSINESS}`, `Support and refund requests: ${CONTACT}. We aim to reply within 2 working days.`],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  const d = DOCS[doc];
  return d ? { title: `${d.title} · EasyUnderstand 製図` } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = DOCS[doc];
  if (!d) notFound();
  return (
    <main className="lesson wrap">
      <Link href="/" className="muted text-sm no-underline">← Back</Link>
      <h1>{d.title}</h1>
      <p className="callout info mt-4">Draft: this text has not been reviewed by a lawyer and still contains placeholders in [square brackets].</p>
      <div className="mt-6 grid max-w-3xl gap-4 text-[#c3d2e0]">{d.body.map((p, i) => <p key={i}>{p}</p>)}</div>
    </main>
  );
}
