import React from "react";
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../setup/test-env.js";
import CircleNode from "../../src/components/nodes/CircleNode.js";

describe("CircleNode do() badge and halo", () => {
  it("renders a subtle do() badge when doActive is true", () => {
    const data = { id: "X", value: 0, min: -10, max: 10, doActive: true };
    renderWithProviders(React.createElement(CircleNode, { data }));
    const badge = screen.getByTitle("do() intervention");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("aria-label", "do() intervention");
    expect(screen.getByText("do()"));
  });
});
