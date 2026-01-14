import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DockLayout from "../../src/components/layout/DockLayout.jsx";

describe("DockLayout", () => {
  it("hides the secondary panel visually when closed", () => {
    render(
      React.createElement(DockLayout, {
        primary: React.createElement("div", null, "Primary"),
        secondary: React.createElement("div", null, "Secondary"),
        isOpen: false,
        dockMode: "right",
      })
    );

    const secondary = screen.getByText("Secondary");
    expect(secondary).not.toBeVisible();
  });

  it("shows the resizer handle when open", () => {
    render(
      React.createElement(DockLayout, {
        primary: React.createElement("div", null, "Primary"),
        secondary: React.createElement("div", null, "Secondary"),
        isOpen: true,
        dockMode: "right",
      })
    );

    expect(screen.getByRole("separator", { name: /resize data panel/i })).toBeInTheDocument();
  });
});
