const stats = [
  {
    label: "Open Source Ecosystem",
    num: "4M+",
    title: "Packages Tracked",
    desc: "Audit found transitive exposure across npm. Playbook prioritized lockfile analysis. Scanner deployed automated CVE matching.",
    numClass: "",
  },
  {
    label: "Active Repositories",
    num: (
      <>
        87<span style={{ fontSize: "0.5em" }}>%</span>
      </>
    ),
    title: "Risk Reduction",
    desc: "Audit found untracked transitive deps. Playbook mapped full graph analysis. Scanner deployed OSV integration. 87% of flagged issues resolved.",
    numClass: "text-clay",
  },
  {
    label: "Security Teams",
    num: (
      <>
        <span style={{ fontSize: "0.5em" }}>{"<"}</span>5
        <span style={{ fontSize: "0.5em" }}>min</span>
      </>
    ),
    title: "Time to First Finding",
    desc: "Audit found 3-day manual triage cycle. Playbook designed automated scan pipeline. Scanner deployed. Reduced to under 5 minutes.",
    numClass: "",
  },
];

export default function StatsSection() {
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
        <span className="meta-label">[03] Telemetry</span>
        <h2>What Gets Possible</h2>
      </div>

      <div className="stats-grid">
        {stats.map((s, i) => (
          <div key={i} className="stat-item">
            <div className="meta-label" style={{ marginBottom: "1rem" }}>
              {s.label}
            </div>
            <div className={`stat-num ${s.numClass}`}>{s.num}</div>
            <h4
              className="panel-title"
              style={{ marginBottom: "0.5rem", marginTop: "0.5rem" }}
            >
              {s.title}
            </h4>
            <p className="panel-desc">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
