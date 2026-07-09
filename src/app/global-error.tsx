"use client";

// Last-resort boundary — catches errors in the root layout itself, so it must
// render its own <html>/<body>.
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
          fontFamily: "system-ui, sans-serif",
          color: "#121212",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ marginTop: 8, maxWidth: 440, color: "#4a4a4a" }}>
          The application ran into an unexpected error. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 32,
            borderRadius: 8,
            background: "#5D5FEF",
            color: "#fff",
            border: "none",
            padding: "10px 24px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
