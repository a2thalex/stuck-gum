export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f1116",
        color: "#f5d76e",
        fontFamily:
          "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "clamp(48px, 10vw, 120px)",
          margin: 0,
          letterSpacing: "-0.02em",
        }}
      >
        Stuck Gum
      </h1>
      <p style={{ marginTop: "16px", fontSize: "16px", color: "#8a93a6" }}>
        hello, world.
      </p>
      <footer
        style={{
          position: "absolute",
          bottom: 16,
          fontSize: "11px",
          color: "#5a6172",
        }}
      >
        next.js · deployed via garbeast claude bridge
      </footer>
    </main>
  );
}
