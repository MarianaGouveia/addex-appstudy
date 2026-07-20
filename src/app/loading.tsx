"use client";

export default function Loading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.9rem",
        backgroundColor: "var(--background, #0b1220)",
        color: "var(--foreground, #ffffff)",
      }}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="addex-loading-spinner" />
      <p style={{ margin: 0, fontSize: "0.95rem", opacity: 0.88 }}>
        Loading...
      </p>

      <style jsx>{`
        .addex-loading-spinner {
          width: 42px;
          height: 42px;
          border-radius: 999px;
          border: 4px solid rgba(255, 255, 255, 0.2);
          border-top-color: #4fa3ff;
          animation: addex-spin 0.85s linear infinite;
        }

        @keyframes addex-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
