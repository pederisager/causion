import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import DataVisualizationPanel from "../../src/components/panels/DataVisualizationPanel.js";

function renderPanel(allVars, values) {
  return render(
    React.createElement(DataVisualizationPanel, {
      allVars,
      values,
    })
  );
}

describe("DataVisualizationPanel", () => {
  const allVars = new Set(["A", "B", "C"]);

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows axis controls and scatterplot when visualization is toggled on", () => {
    const { getByRole, getByText } = renderPanel(allVars, {
      A: 0,
      B: 0,
      C: 0,
    });

    const toggle = getByRole("button", { name: /visualize data/i });
    expect(toggle).toBeInTheDocument();
    expect(getByText(/turn on visualization/i)).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(getByRole("combobox", { name: /x axis/i })).toBeInTheDocument();
    expect(getByRole("combobox", { name: /y axis/i })).toBeInTheDocument();
    expect(getByText(/points update/i)).toBeInTheDocument();
  });

  it("records samples only when tracked values change", () => {
    const { container, getByRole, rerender } = renderPanel(allVars, {
      A: 0,
      B: 0,
      C: 0,
    });

    const toggle = getByRole("button", { name: /visualize data/i });
    fireEvent.click(toggle);

    const countCircles = () => container.querySelectorAll("circle").length;

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(countCircles()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(countCircles()).toBe(1);

    rerender(
      React.createElement(DataVisualizationPanel, {
        allVars,
        values: { A: 1, B: 0, C: 0 },
      })
    );

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(countCircles()).toBe(2);

    rerender(
      React.createElement(DataVisualizationPanel, {
        allVars,
        values: { A: 1, B: 2, C: 0 },
      })
    );

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(countCircles()).toBe(3);
  });

  it("clears samples and resets when axes change", () => {
    const { container, getByRole, rerender } = renderPanel(allVars, {
      A: 0,
      B: 0,
      C: 0,
    });

    const clearButton = getByRole("button", { name: /clear/i });
    expect(clearButton).toBeDisabled();

    const toggle = getByRole("button", { name: /visualize data/i });
    fireEvent.click(toggle);

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(clearButton).not.toBeDisabled();

    const countCircles = () => container.querySelectorAll("circle").length;
    expect(countCircles()).toBeGreaterThan(0);

    fireEvent.click(clearButton);
    expect(countCircles()).toBe(0);
    expect(clearButton).toBeDisabled();

    rerender(
      React.createElement(DataVisualizationPanel, {
        allVars,
        values: { A: 1, B: 0, C: 0 },
      })
    );

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(countCircles()).toBeGreaterThan(0);

    const xSelect = getByRole("combobox", { name: /x axis/i });
    fireEvent.change(xSelect, { target: { value: "C" } });

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(countCircles()).toBe(1);
  });
});
