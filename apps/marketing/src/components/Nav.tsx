export default function Nav() {
  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        padding: "2rem var(--container-padding)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 100,
      }}
    >
      <div className="logo">ARRAKIS</div>
      <div
        style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
      >
        <div className="status-dot" />
        <span className="meta-label">SYS.ONLINE // OP.READY</span>
      </div>
    </nav>
  );
}
