import StarMotif from "./StarMotif";

export default function ProblemSection() {
  const resources = [
    {
      label: "Resource .01",
      title: "Vulnerabilities",
      desc: "CVEs buried in transitive deps. Known exploits shipping to prod undetected. We map the exact risk score for every package in your graph.",
      titleClass: "",
    },
    {
      label: "Resource .02",
      title: "Supply Chain",
      desc: "Dependency confusion, typosquatting, malicious install scripts. We flag suspicious patterns before they execute on your infrastructure.",
      titleClass: "",
    },
    {
      label: "Resource .03",
      title: "Drift",
      desc: "Packages change silently between releases. New maintainers, dropped signatures, unexpected updates. We track every change over time.",
      titleClass: "text-acid",
    },
  ];

  return (
    <section
      id="problem"
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
      <div className="section-header reveal" style={{ marginBottom: "4rem" }}>
        <span className="meta-label">[01] Threat Surface</span>
        <h2>Every app ships three attack vectors: Dependencies, Supply Chain, and Drift.</h2>
        <p className="panel-desc" style={{ maxWidth: "600px" }}>
          Your existing tools weren&apos;t built to reveal where these are leaking in. We were.
        </p>
      </div>

      <div className="grid-3 reveal">
        {resources.map((r) => (
          <div key={r.label}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="meta-label">{r.label}</span>
              <StarMotif />
            </div>
            <h3 className={`panel-title ${r.titleClass}`}>{r.title}</h3>
            <p className="panel-desc">{r.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
