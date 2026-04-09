import StarMotif from "./StarMotif";

export default function HeroSection() {
  return (
    <section
      className="hero"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, 1fr)",
        gap: "2rem",
        alignItems: "end",
        paddingBottom: "5vh",
        paddingTop: "20vh",
        position: "relative",
        padding: "20vh var(--container-padding) 5vh",
        minHeight: "100vh",
        borderBottom: "1px solid var(--grid-line)",
      }}
    >
      <div
        className="monumental-vertical"
        style={{
          position: "absolute",
          right: "var(--container-padding)",
          bottom: "5vh",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(6rem, 18vw, 22rem)",
          lineHeight: 1,
          color: "rgba(255, 255, 255, 0.03)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
        }}
      >
        Security
      </div>

      <div
        className="hero-content reveal"
        style={{
          gridColumn: "1 / 8",
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
          paddingBottom: "2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <StarMotif className="text-clay" />
          <span className="meta-label">For developers, not auditors</span>
        </div>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(4rem, 8vw, 9rem)",
            lineHeight: 1.05,
            color: "var(--text-main)",
          }}
        >
          Know
          <br />
          What
          <br />
          You Run.
        </h1>

        <p className="panel-desc" style={{ maxWidth: "480px", fontSize: "1rem" }}>
          Arrakis audits your open-source dependencies, surfaces real vulnerabilities,
          and flags risky packages — before they reach production.
        </p>

        <div className="btn-group">
          <a href="#cta" className="btn btn-primary">
            Get Started Free
          </a>
          <a href="#methodology" className="btn btn-secondary">
            See How It Works
          </a>
        </div>
      </div>
    </section>
  );
}
