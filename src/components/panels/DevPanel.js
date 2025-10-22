import React from "react";

export default function DevPanel({ features, setFeatures }) {
  const entries = Object.entries(features);

  const children = entries.map(([key, value]) => {
    if (typeof value === "boolean") {
      return React.createElement(
        "label",
        { key, className: "block text-sm mb-2" },
        React.createElement("input", {
          type: "checkbox",
          className: "mr-2",
          checked: Boolean(value),
          onChange: (event) =>
            setFeatures((previous) => ({
              ...previous,
              [key]: event.target.checked,
            })),
        }),
        key,
      );
    }

    return React.createElement(
      "label",
      { key, className: "block text-sm mb-2" },
      React.createElement(
        "span",
        { className: "mr-2 inline-block w-36" },
        key,
      ),
      React.createElement("input", {
        type: "number",
        className: "w-28 border rounded px-2 py-1",
        value: Number(value),
        onChange: (event) =>
          setFeatures((previous) => ({
            ...previous,
            [key]: Number(event.target.value),
          })),
      }),
    );
  });

  return React.createElement(
    "div",
    { className: "rounded-2xl shadow p-4 border w-full" },
    React.createElement(
      "div",
      { className: "text-lg font-bold mb-2" },
      "Dev Panel (feature flags)",
    ),
    ...children,
  );
}
