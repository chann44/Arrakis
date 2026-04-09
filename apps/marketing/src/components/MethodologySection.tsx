const steps = [
  {
    num: "01",
    title: "Connect",
    desc: "Link your GitHub repo. Arrakis extracts dependency manifests across npm, pip, go, and more. No code changes, no agents, no CI required — just a repo connection.",
  },
  {
    num: "02",
    title: "Graph",
    desc: "We build a full dependency graph — direct and transitive. Every package, every version, every relationship mapped. You see exactly what your app depends on.",
  },
  {
    num: "03",
    title: "Scan",
    desc: "Our scanner runs CVE and OSV databases, checks for suspicious install scripts, flags dependency confusion risks, and scores each package on a risk matrix.",
  },
  {
    num: "04",
    title: "Report",
    desc: "Get a clean, actionable risk report. Prioritized findings, remediation suggestions, and change tracking over time. We stick around as your dependencies evolve.",
  },
];

export default function MethodologySection() {
  return (
    <section
      id="methodology"
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
      <div className="method-wrapper">
        <div className="method-sticky reveal">
          <span className="meta-label">[02] Operational Protocol</span>
          <h2
            className="display-text"
            style={{
              fontSize: "clamp(3rem, 5vw, 6rem)",
              marginTop: "1rem",
              lineHeight: 1.1,
            }}
          >
            How We
            <br />
            Work
          </h2>
        </div>

        <div className="method-steps">
          {steps.map((step) => (
            <div key={step.num} className="step reveal">
              <div className="step-num">{step.num}</div>
              <h3
                className="panel-title text-clay"
                style={{ marginBottom: "1rem" }}
              >
                {step.title}
              </h3>
              <p className="panel-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
