import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import DataVizPanel from "../../src/components/DataVizPanel.jsx";

function renderPanel(allVars, values, extraProps = {}) {
  return render(
    React.createElement(DataVizPanel, {
      allVars,
      values,
      ...extraProps,
    })
  );
}

describe("DataVizPanel", () => {
  const allVars = new Set(["A", "B", "C"]);

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows axis controls and starts sampling automatically", () => {
    const { getByRole, getByText } = renderPanel(allVars, {
      A: 0,
      B: 0,
      C: 0,
    });

    expect(getByRole("combobox", { name: /x axis/i })).toBeInTheDocument();
    expect(getByRole("combobox", { name: /y axis/i })).toBeInTheDocument();
    expect(getByText(/points update/i)).toBeInTheDocument();
    expect(getByRole("button", { name: /clear/i })).toBeDisabled();
  });

  it("allows selecting control variables", () => {
    const handleControls = vi.fn();
    const { getByLabelText, getByRole } = renderPanel(
      allVars,
      { A: 0, B: 0, C: 0 },
      { controlledVars: [], onControlledVarsChange: handleControls }
    );

    fireEvent.click(getByRole("button", { name: /select/i }));
    const checkbox = getByLabelText("C");
    fireEvent.click(checkbox);

    expect(handleControls).toHaveBeenCalledWith(["C"]);
  });

  it("records samples only when tracked values change", () => {
    const { container, getByRole, rerender } = renderPanel(allVars, {
      A: 0,
      B: 0,
      C: 0,
    });

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
      React.createElement(DataVizPanel, {
        allVars,
        values: { A: 1, B: 0, C: 0 },
      })
    );

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(countCircles()).toBe(2);

    rerender(
      React.createElement(DataVizPanel, {
        allVars,
        values: { A: 1, B: 2, C: 0 },
      })
    );

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(countCircles()).toBe(3);
  });

  it("does not record samples while closed", () => {
    const { container, rerender } = renderPanel(
      allVars,
      { A: 0, B: 0, C: 0 },
      { isOpen: false }
    );

    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(container.querySelectorAll("circle").length).toBe(0);

    rerender(
      React.createElement(DataVizPanel, {
        allVars,
        values: { A: 1, B: 2, C: 3 },
        isOpen: true,
      })
    );

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(container.querySelectorAll("circle").length).toBeGreaterThan(0);
  });

  it("clears samples and resets when axes change", () => {
    const { container, getByRole, rerender } = renderPanel(allVars, {
      A: 0,
      B: 0,
      C: 0,
    });

    const clearButton = getByRole("button", { name: /clear/i });
    expect(clearButton).toBeDisabled();

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
      React.createElement(DataVizPanel, {
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
