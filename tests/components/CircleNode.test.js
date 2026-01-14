import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
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

  it("fires name edit callback when the label is clicked", () => {
    const onNameEdit = vi.fn();
    const data = { id: "A", value: 0, onNameEdit, canEditName: true };
    renderWithProviders(
      React.createElement(CircleNode, { data })
    );

    fireEvent.click(screen.getByRole("button", { name: /rename a/i }));
    expect(onNameEdit).toHaveBeenCalledWith(expect.anything(), "A");
  });

  it("renders an inline input when editing the name", () => {
    const onNameDraftChange = vi.fn();
    const onNameCommit = vi.fn();
    const onNameCancel = vi.fn();
    const data = {
      id: "A",
      value: 0,
      isEditingName: true,
      nameDraft: "Beta",
      onNameDraftChange,
      onNameCommit,
      onNameCancel,
    };
    renderWithProviders(
      React.createElement(CircleNode, { data })
    );

    const input = screen.getByRole("textbox", { name: /edit name for a/i });
    expect(input).toHaveValue("Beta");
    fireEvent.change(input, { target: { value: "Gamma" } });
    expect(onNameDraftChange).toHaveBeenCalledWith("Gamma");
  });

  it("shows connection handles when the node is active", () => {
    const data = { id: "A", value: 0, isNameActive: true };
    const { container } = renderWithProviders(
      React.createElement(CircleNode, { data })
    );

    const sourceHandles = container.querySelectorAll(".node-handle--source");
    expect(sourceHandles.length).toBe(4);
    sourceHandles.forEach((handle) => {
      expect(handle).toHaveStyle({ opacity: "0.5" });
    });
    const targetHandles = container.querySelectorAll(".node-handle--target");
    expect(targetHandles.length).toBe(4);
    expect(container.querySelector(".node-handle--area")).toBeNull();
  });
});
