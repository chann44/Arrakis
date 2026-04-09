import StarMotif from "./StarMotif";

export default function CTASection() {
  return (
    <section
      id="cta"
      className="footer-cta reveal"
      style={{
        position: "relative",
        padding: "10vh var(--container-padding)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        minHeight: "80vh",
        borderBottom: "none",
      }}
    >
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2rem",
        }}
      >
        <StarMotif
          className="text-acid"
          style={{ width: "48px", height: "48px" }}
        />
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(3rem, 6vw, 6rem)",
            color: "var(--text-main)",
          }}
        >
          Initiate Scan.
        </h2>
        <p
          className="panel-desc"
          style={{ fontSize: "1.2rem", textAlign: "center", maxWidth: "560px" }}
        >
          Connect your GitHub repo — 30 seconds. Arrakis builds your dependency
          graph, runs the scanner, and surfaces real findings immediately. No
          pitch. Just signal.
        </p>
        <a
          href="https://github.com/chann44/TGE"
          className="btn btn-primary"
          style={{ marginTop: "1rem" }}
          target="_blank"
          rel="noopener noreferrer"
        >
          Deploy Arrakis Free
        </a>
      </div>
    </section>
  );
}
