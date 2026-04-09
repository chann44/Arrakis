const tiers = [
  {
    label: "Tier 01",
    title: "Assessment",
    price: "Free",
    desc: "Connect your repo. Get an instant dependency graph and initial risk scan. No credit card.",
    highlight: false,
  },
  {
    label: "Tier 02 // Recommended",
    title: "Self-Host",
    price: "Open Source",
    desc: "Full platform, self-hosted on your infrastructure. All features, all integrations, complete data ownership.",
    highlight: true,
  },
  {
    label: "Tier 03",
    title: "Managed",
    price: "$199/mo",
    priceSuffix: "",
    desc: "We run Arrakis for you. Managed scanning, alerting, and CI integration for teams that want zero ops overhead.",
    highlight: false,
  },
  {
    label: "Tier 04",
    title: "Enterprise",
    price: "Custom",
    priceSuffix: "",
    desc: "SSO, audit logs, SLAs, dedicated support, custom integrations. Built for orgs with compliance requirements.",
    highlight: false,
  },
];

export default function TiersSection() {
  return (
    <section
      className="reveal"
      style={{
        position: "relative",
        padding: "10vh var(--container-padding)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        borderBottom: "1px solid var(--grid-line)",
      }}
    >
      <div className="section-header" style={{ marginBottom: "3rem" }}>
        <span className="meta-label">[05] Deployment Vectors</span>
        <h2>How To Start</h2>
      </div>

      <div className="tiers">
        {tiers.map((tier, i) => (
          <div
            key={i}
            className="tier-card panel"
            style={tier.highlight ? { borderColor: "var(--clay)" } : {}}
          >
            <span
              className={`meta-label ${tier.highlight ? "text-clay" : ""}`}
            >
              {tier.label}
            </span>
            <h3 className="panel-title">{tier.title}</h3>
            <div className="tier-price">{tier.price}</div>
            <p className="panel-desc">{tier.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
