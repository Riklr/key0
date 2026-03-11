import { CreditCard, UserPlus, ShieldCheck } from "lucide-react";

const cards = [
  {
    icon: CreditCard,
    heading: "More payment rails",
    body: "Move beyond crypto-only checkout with familiar payment methods that bring more buyers into the flow.",
    chips: ["Visa", "Mastercard", "UPI"],
  },
  {
    icon: UserPlus,
    heading: "Agent onboarding",
    body: "Give new agents a faster path into your platform with smoother setup, discovery, and first-payment flows.",
  },
  {
    icon: ShieldCheck,
    heading: "Agent authentication",
    body: "Add stronger identity and trust signals so authenticated agents can access the right endpoints with confidence.",
  },
];

export default function ValueProps() {
  return (
    <section className="bg-[#1a1a1a] py-20 text-white md:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block font-body text-smfont-medium uppercase tracking-[0.28em] text-[#b5b5b5]">
            Coming soon
          </span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl lg:text-5xl">
            What&apos;s next for Key2A
          </h2>
          <p className="mx-auto mt-4 max-w-2xl font-body text-base leading-relaxed text-[#c7c7c7] md:text-lg">
          Everything an agent needs to pay, onboard, and be trusted.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.heading}
                className="rounded-card bg-[#1a1a1a] p-7 shadow-neu-dark transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-neu-dark-hover md:p-8"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-inner bg-[#1a1a1a] shadow-neu-inset-deep-dark">
                  <Icon size={22} className="text-white" strokeWidth={2} />
                </div>

                <h3 className="font-display text-xl font-bold leading-snug text-white md:text-2xl">
                  {card.heading}
                </h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-[#c7c7c7] md:text-base">
                  {card.body}
                </p>

                {card.chips && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    {card.chips.map((chip) => (
                      <span
                        key={chip}
                        className="inline-flex items-center rounded-button bg-[#262626] px-3.5 py-2 font-body text-xs font-medium uppercase tracking-wide text-white shadow-neu-inset-deep-dark"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
