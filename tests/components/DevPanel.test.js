import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DevPanel from "../../src/components/panels/DevPanel.js";

describe("DevPanel", () => {
  it("renders boolean and numeric feature controls", () => {
    const features = { flag: true, limit: 42 };
    const setFeatures = () => {};

    render(React.createElement(DevPanel, { features, setFeatures }));

    expect(screen.getByText("Dev Panel (feature flags)")).toBeInTheDocument();
    expect(screen.getByText("flag")).toBeInTheDocument();
    expect(screen.getByText("limit")).toBeInTheDocument();
    expect(screen.getByDisplayValue(42)).toBeInTheDocument();

    expect(screen.getByLabelText("flag").getAttribute("type")).toBe("checkbox");
    expect(screen.getByDisplayValue(42).getAttribute("type")).toBe("number");
  });
});
