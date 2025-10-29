import React from "react";

export default function DevPanel({
  features,
  setFeatures,
  selectOptions = {},
  themePreset,
}) {
  const isCausion = themePreset === "causion";
  const entries = Object.entries(features);

  if (!isCausion) {
    const basicChildren = entries.map(([key, value]) => {
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
          key
        );
      }

      if (typeof value === "string" && Array.isArray(selectOptions[key])) {
        return React.createElement(
          "label",
          { key, className: "block text-sm mb-2" },
          React.createElement(
            "span",
            { className: "mr-2 inline-block w-36" },
            key
          ),
          React.createElement(
            "select",
            {
              className: "border rounded px-2 py-1",
              value,
              onChange: (event) =>
                setFeatures((previous) => ({
                  ...previous,
                  [key]: event.target.value,
                })),
            },
            selectOptions[key].map((option) =>
              React.createElement(
                "option",
                { key: option.value, value: option.value },
                option.label
              )
            )
          )
        );
      }

      return React.createElement(
        "label",
        { key, className: "block text-sm mb-2" },
        React.createElement(
          "span",
          { className: "mr-2 inline-block w-36" },
          key
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
        })
      );
    });

    return React.createElement(
      "div",
      { className: "rounded-2xl shadow p-4 border w-full" },
      React.createElement(
        "div",
        { className: "text-lg font-bold mb-2" },
        "Dev Panel (feature flags)"
      ),
      ...basicChildren
    );
  }

  const themedChildren = entries.map(([key, value]) => {
    if (typeof value === "boolean") {
      return React.createElement(
        "label",
        {
          key,
          className: "flex items-center justify-between gap-2 text-sm",
        },
        React.createElement(
          "span",
          { className: "causion-label font-medium" },
          key
        ),
        React.createElement("input", {
          type: "checkbox",
          className: "causion-checkbox",
          checked: Boolean(value),
          onChange: (event) =>
            setFeatures((previous) => ({
              ...previous,
              [key]: event.target.checked,
            })),
        })
      );
    }

    if (typeof value === "string" && Array.isArray(selectOptions[key])) {
      return React.createElement(
        "label",
        {
          key,
          className: "flex items-center justify-between gap-3 text-sm",
        },
        React.createElement(
          "span",
          { className: "causion-label text-xs font-medium" },
          key
        ),
        React.createElement(
          "select",
          {
            className: "causion-field text-sm flex-1",
            value,
            onChange: (event) =>
              setFeatures((previous) => ({
                ...previous,
                [key]: event.target.value,
              })),
          },
          selectOptions[key].map((option) =>
            React.createElement(
              "option",
              { key: option.value, value: option.value },
              option.label
            )
          )
        )
      );
    }

    return React.createElement(
      "label",
      {
        key,
        className: "flex items-center justify-between gap-3 text-sm",
      },
      React.createElement(
        "span",
        { className: "causion-label text-xs font-medium" },
        key
      ),
      React.createElement("input", {
        type: "number",
        className: "causion-field text-sm flex-1",
        value: Number(value),
        onChange: (event) =>
          setFeatures((previous) => ({
            ...previous,
            [key]: Number(event.target.value),
          })),
      })
    );
  });

  return React.createElement(
    "div",
    { className: "causion-panel p-4 w-full flex flex-col gap-3" },
    React.createElement(
      "div",
      { className: "h-heading text-lg" },
      "Dev Panel (feature flags)"
    ),
    ...themedChildren
  );
}
