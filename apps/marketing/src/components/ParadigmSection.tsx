import StarMotif from "./StarMotif";

const paradigms = [
  {
    icon: <StarMotif className="text-acid" />,
    title: "Open, Not Opaque",
    desc: "Arrakis is fully open-source and self-hosted. No vendor lock-in, no black-box scanners. Audit the auditor. The code is yours.",
  },
  {
    icon: <StarMotif className="text-clay" />,
    title: "Graph, Not Lists",
    desc: "We don't just check your direct deps. We build the full transitive graph so risks buried 5 levels deep are just as visible as the top-level ones.",
  },
  {
    icon: <StarMotif style={{ color: "var(--text-main)" }} />,
    title: "Day One, Not Sprint 12",
    desc: "Connect your repo, get findings immediately. No configuration sprints, no professional services engagement. Actionable results in under 5 minutes.",
  },
];

export default function ParadigmSection() {
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
        <span className="meta-label">[04] Paradigm Shift</span>
      </div>

      <div
        className="grid-3"
        style={{ background: "transparent", border: "none" }}
      >
        {paradigms.map((p, i) => (
          <div
            key={i}
            style={{
              border: "1px solid var(--grid-line-strong)",
              background: "var(--bg)",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              padding: "2.5rem 2rem",
            }}
          >
            {p.icon}
            <h3 className="panel-title">{p.title}</h3>
            <p className="panel-desc">{p.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
