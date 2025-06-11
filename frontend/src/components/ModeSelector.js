import React from "react";

export default function ModeSelector({ onSelect }) {
  const modos = [
    { id: "sandbox",  label: "Sandbox" },
    { id: "campaign", label: "Campaña" },
    { id: "seasonal", label: "Campaña Temporal" }
  ];

  return (
    <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "2rem" }}>
      {modos.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          style={{
            padding: "0.5rem 1.25rem",
            background: "#92400e",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
