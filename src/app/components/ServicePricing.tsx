import Link from "next/link";
import { SERVICE_PRICING, type PriceCard } from "@/lib/servicePricing";
import type { ServiceSlug } from "@/lib/serviceSeo";
import s from "./ServicePricing.module.css";

// The pricing sections on a service page, from servicePricing.ts. Cards sit
// in a row on desktop and stack on phones; add-ons and small print follow.

// "Not included: …" lines get a dash instead of a check, so they never read as included.
function Item({ item, accent }: { item: string; accent: string }) {
  const excluded = /^not included/i.test(item);
  return (
    <li className={excluded ? s.excluded : undefined}>
      <span className={s.check} style={{ color: excluded ? "#999" : accent }} aria-hidden>{excluded ? "—" : "✓"}</span>
      {item}
    </li>
  );
}

function Card({ card, accent, accentText }: { card: PriceCard; accent: string; accentText: string }) {
  const cta = card.cta ?? { label: "Get started", href: "/contact" };
  return (
    <div className={s.card}>
      <span className={s.bar} style={{ background: accent }} />
      <h3 className={s.name}>{card.name}</h3>
      {/* A dollar amount gets the big treatment; "Contact for pricing" stays smaller. */}
      <p className={`${s.price} ${/\$/.test(card.price) ? "" : s.priceText}`}>{card.price}</p>
      {card.scope && <p className={s.scope}>{card.scope}</p>}
      {card.items?.length ? (
        <ul className={s.items}>
          {card.items.map((item) => <Item key={item} item={item} accent={accent} />)}
        </ul>
      ) : null}
      <div className={s.actions}>
        <Link href={cta.href} className={s.btn} style={{ background: accent, color: accentText }}>
          {cta.label} →
        </Link>
        {card.link && (
          <Link href={card.link.href} className={s.link}>{card.link.label} →</Link>
        )}
      </div>
    </div>
  );
}

function AddOn({ card, accent }: { card: PriceCard; accent: string }) {
  return (
    <div className={s.addOn} style={{ borderColor: accent }}>
      <div className={s.addOnHead}>
        <h3 className={s.addOnName}>{card.name}</h3>
        <p className={s.addOnPrice}>{card.price}</p>
        {card.scope && <p className={s.scope}>{card.scope}</p>}
      </div>
      {card.items?.length ? (
        <ul className={`${s.items} ${s.addOnItems}`}>
          {card.items.map((item) => <Item key={item} item={item} accent={accent} />)}
        </ul>
      ) : null}
    </div>
  );
}

export default function ServicePricing({ slug, accent, accentText }: { slug: ServiceSlug; accent: string; accentText: string }) {
  const pricing = SERVICE_PRICING[slug];
  return (
    <>
      {pricing.sections.map((sec, i) => (
        <section
          key={sec.id}
          id={sec.id === "packages" ? "pricing" : sec.id}
          className={`${s.section} ${i % 2 ? s.alt : ""}`}
          style={{ ["--cols" as string]: Math.min(sec.cards.length, 4) }}
        >
          <p className={s.eyebrow}>{i > 0 ? "After launch" : sec.heading === "Pricing" ? "What it costs" : "Pricing"}</p>
          <h2 className={s.heading}>{sec.heading}</h2>
          {sec.intro && <p className={s.intro}>{sec.intro}</p>}
          <div className={s.grid}>
            {sec.cards.map((card) => <Card key={card.name} card={card} accent={accent} accentText={accentText} />)}
          </div>
          {sec.includes && (
            <div className={s.includes}>
              <h3 className={s.addOnName}>{sec.includes.heading}</h3>
              <ul className={`${s.items} ${s.addOnItems}`}>
                {sec.includes.items.map((item) => (
                  <li key={item}>
                    <span className={s.check} style={{ color: accent }} aria-hidden>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sec.addOns?.map((a) => <AddOn key={a.name} card={a} accent={accent} />)}
          {sec.notes?.length ? (
            <div className={s.notes}>
              {sec.notes.map((n) => <p key={n}>{n}</p>)}
            </div>
          ) : null}
        </section>
      ))}
    </>
  );
}
