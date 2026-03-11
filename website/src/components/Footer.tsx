import { Github } from "lucide-react";

import { Footer as SiteFooter } from "@/components/ui/footer";

const mainLinks = [
  { label: "How it Works", href: "#how-it-works" },
  { label: "Docs", href: "#" },
  { label: "FAQs", href: "#" },
];

const legalLinks = [
  { label: "Privacy", href: "#" },
  { label: "Terms", href: "#" },
];

const socialLinks = [
  {
    icon: <Github className="h-5 w-5" />,
    href: "#",
    label: "GitHub",
  },
];

export default function Footer() {
  return (
    <SiteFooter
      logo={null}
      brandName="Key2A"
      socialLinks={socialLinks}
      mainLinks={mainLinks}
      legalLinks={legalLinks}
      copyright={{
        text: `© ${new Date().getFullYear()} Key2A`,
        license: "All rights reserved",
      }}
    />
  );
}
