type CaseStudy = {
  title: string;
  services: string[];
  body: string;
};

const caseStudies: Record<string, CaseStudy> = {
  "st-john-baptist-church": {
    title: "St. John Baptist Church — Website Redesign",
    services: [
      "UX Design",
      "Website Design",
      "Graphic Design",
      "Content Writing",
    ],
    body: `
St. John Baptist Church in Amarillo, TX needed a website that felt warm, modern, and easy to navigate for both visitors and long-time members.

I focused on simplifying the structure around what people look for most: service times, ministries, giving, and upcoming events. The design uses large, legible type and clear calls-to-action, with imagery that reflects real people and real moments in the church.

The result is a mobile-first site that supports the church’s mission to lead people to Christ, while making it much easier for new visitors to feel welcomed in before they ever step in the building.
    `,
  },

  tckt: {
    title: "TCKT — Seamless Movie Ticketing Experience",
    services: ["UX Design", "UI Design", "Brand Design", "Product Concept"],
    body: `
TCKT started as a question: why is buying movie tickets still so clunky?

The concept brings multiple theater apps together into one smooth, swipeable interface. Users can:
• Browse movies by theater or mood
• See showtimes and seat availability at a glance
• Buy tickets without jumping between apps
• Track loyalty points in one place

I mapped user flows, designed wireframes, and built high-fidelity screens that focus on legibility and ease-of-use. The interface leans into bold typography, simple iconography, and soft gradients that feel cinematic without getting in the way of the task.

TCKT is a good example of how I like to work: identify a specific friction point, then design a visual + UX system that actually solves it.
    `,
  },

  brewhaus: {
    title: "BrewHaus — Cozy Coffee Brand Identity",
    services: [
      "Brand Identity",
      "Logo Design",
      "Packaging Exploration",
      "Social Graphics",
    ],
    body: `
BrewHaus is a fictional coffee brand I created to explore cozy, neighborhood café vibes with a bold, illustrative twist.

The goal was to design a visual identity that would feel just as comfortable on a bag of beans as it would on a café window or Instagram post. I built out:

• A primary logotype and supporting wordmark
• A warm, saturated color palette grounded in rich oranges and deep blues
• Coffee bag packaging concepts that use simple shapes and playful layouts
• Social graphics that highlight the brand’s personality and product stories

The design leans into a balance of structure and play: strong typography and grids paired with soft curves and friendly illustration moments. This project is part of a larger series of concept brands I create to stretch my visual language and show the kind of work I want to do more of for clients.
    `,
  },

  // you can add safespace, squeeze-shop, dj-mastamind, curl-and-co here next
};

type Props = {
  params: { slug: string };
};

export default function CaseStudyPage({ params }: Props) {
  const study = caseStudies[params.slug];

  if (!study) {
    return (
      <div className="page">
        <main className="hero">
          <div className="wrapper">
            <p>Project coming soon.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="site-header">
        <div className="wrapper site-header-inner">
          <div className="logo-lockup">
            <span className="logo-mark" />
            <span>Thrive Creative Studios</span>
          </div>

          <nav className="nav-links">
            <a href="/">Home</a>
            <a href="/work">Work</a>
            <a href="/services">Services</a>
            <a href="/contact" className="nav-cta">
              Let&apos;s work
            </a>
          </nav>
        </div>
      </header>

      <main className="hero">
        <div className="wrapper">
          <div className="hero-tag">Case Study</div>
          <h1 className="hero-title">{study.title}</h1>

          <div style={{ margin: "16px 0 8px", fontSize: 13, fontWeight: 600 }}>
            Services
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: 13 }}>
            {study.services.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>

          <div
            style={{
              marginTop: 20,
              fontSize: 15,
              lineHeight: 1.7,
              maxWidth: 640,
              whiteSpace: "pre-line",
            }}
          >
            {study.body.trim()}
          </div>
        </div>
      </main>
    </div>
  );
}
