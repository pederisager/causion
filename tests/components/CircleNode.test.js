import React from "react";
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../setup/test-env.js";
import CircleNode from "../../src/components/nodes/CircleNode.js";

describe("CircleNode", () => {
  it("renders id label and formatted value", () => {
    const data = { id: "A", value: 12.345, min: -50, max: 50 };
    renderWithProviders(
      React.createElement(CircleNode, { data })
    );

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("12.35")).toBeInTheDocument();

    const circle = screen.getByText("A").parentElement;
    expect(circle).toHaveStyle({ borderRadius: "50%" });
  });
});
