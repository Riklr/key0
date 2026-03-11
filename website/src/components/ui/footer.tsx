import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface FooterProps {
  logo: ReactNode;
  brandName: string;
  socialLinks: Array<{
    icon: ReactNode;
    href: string;
    label: string;
  }>;
  mainLinks: Array<{
    href: string;
    label: string;
  }>;
  legalLinks: Array<{
    href: string;
    label: string;
  }>;
  copyright: {
    text: string;
    license?: string;
  };
}

export function Footer({
  logo,
  brandName,
  socialLinks,
  mainLinks,
  legalLinks,
  copyright,
}: FooterProps) {
  return (
    <footer className="bg-[#1a1a1a] py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="rounded-card bg-[#1a1a1a] p-8 shadow-neu-dark md:p-12">
          <div className="md:flex md:items-start md:justify-between">
            <a
              href="/"
              className="flex items-center gap-x-3"
              aria-label={brandName}
            >
              {logo}
              <span className="font-display text-xl font-bold text-white">
                {brandName}
              </span>
            </a>
            <ul className="mt-6 flex list-none space-x-3 md:mt-0">
              {socialLinks.map((link, i) => (
                <li key={i}>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-10 w-10 rounded-full !bg-[#1a1a1a] !text-white shadow-neu-inset-deep-dark hover:-translate-y-0.5 hover:!bg-[#1f1f1f] [&_svg]:!text-white"
                    asChild
                  >
                    <a href={link.href} target="_blank" aria-label={link.label}>
                      {link.icon}
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8 border-t border-white/[0.08] pt-6 md:mt-6 md:pt-8 lg:grid lg:grid-cols-10">
            <nav className="lg:col-[4/11] lg:mt-0">
              <ul className="-mx-2 -my-1 flex list-none flex-wrap lg:justify-end">
                {mainLinks.map((link, i) => (
                  <li key={i} className="mx-2 my-1 shrink-0">
                    <a
                      href={link.href}
                      className="font-body text-sm text-white underline-offset-4 transition-colors duration-300 ease-out hover:text-[#b5b5b5] hover:underline"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-6 lg:col-[4/11] lg:mt-0">
              <ul className="-mx-3 -my-1 flex list-none flex-wrap lg:justify-end">
                {legalLinks.map((link, i) => (
                  <li key={i} className="mx-3 my-1 shrink-0">
                    <a
                      href={link.href}
                      className="font-body text-sm text-[#b5b5b5] underline-offset-4 transition-colors duration-300 ease-out hover:text-white hover:underline"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6 whitespace-nowrap font-body text-sm leading-6 text-[#b5b5b5] lg:col-[1/4] lg:row-[1/3] lg:mt-0">
              <div>{copyright.text}</div>
              {copyright.license && <div>{copyright.license}</div>}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
