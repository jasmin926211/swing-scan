import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageSquareText, Phone } from "lucide-react";
import { ContactForm } from "@/components/ContactForm";
import { PageHero } from "@/components/marketing";
import { CONTACT } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact us — CandleTrade",
  description: "Questions, feedback or a bug to report: get in touch with the CandleTrade team.",
};

export default function Contact() {
  return (
    <main>
      <PageHero
        eyebrow="Contact us"
        title="Talk to us"
        intro="Questions about a forecast, an idea for a feature or something that looks wrong: send us a message and we’ll get back to you."
      />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-6 lg:grid-cols-5">
        <aside className="space-y-6 lg:col-span-2">
          <ContactItem icon={Mail} label="Email">
            <a href={`mailto:${CONTACT.email}`} className="font-medium hover:underline">
              {CONTACT.email}
            </a>
          </ContactItem>
          <ContactItem icon={Phone} label="Phone">
            <a href={`tel:${CONTACT.phone}`} className="font-medium hover:underline">
              {CONTACT.phoneDisplay}
            </a>
          </ContactItem>
          <ContactItem icon={MessageSquareText} label="Before you write">
            <span className="text-ink-2">
              Many trading questions are answered in the{" "}
              <Link href="/#faq" className="font-medium text-ink hover:underline">
                FAQ
              </Link>
              . For a bug, include the stock symbol and the page you were on.
            </span>
          </ContactItem>
        </aside>
        <div className="lg:col-span-3">
          <ContactForm />
        </div>
      </div>
    </main>
  );
}

function ContactItem({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wash">
        <Icon className="h-4 w-4 text-ink-2" />
      </span>
      <div className="text-sm">
        <p className="text-xs text-ink-3">{label}</p>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  );
}
