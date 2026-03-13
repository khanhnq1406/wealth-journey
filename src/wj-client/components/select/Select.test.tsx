import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithIntl as render } from "@/test-utils";
import { Select } from "./Select";

/**
 * These tests demonstrate the bug where option selection fails after typing to filter.
 *
 * ROOT CAUSE: When the user types to filter options and then clicks an option,
 * the input's onBlur event fires before the option's onClick event. The current
 * implementation doesn't properly handle this sequence, causing the dropdown to
 * close or the selection to fail.
 *
 * Note: In jsdom (test environment), these tests may pass because the event
 * sequencing differs from real browsers. The bug manifests in actual browsers
 * (Chrome, Firefox, Safari) where blur fires before mousedown/click on options.
 */

describe("Select - Option Selection After Typing", () => {
  it("should allow selecting an option after typing to filter", async () => {
    const options = [
      { value: "apple", label: "Apple" },
      { value: "banana", label: "Banana" },
      { value: "cherry", label: "Cherry" },
    ];

    const handleChange = jest.fn();
    render(
      <Select
        options={options}
        value=""
        onChange={handleChange}
        placeholder="Select a fruit"
      />
    );

    const input = screen.getByRole("combobox");

    // Type to filter options
    fireEvent.change(input, { target: { value: "ban" } });

    // Wait for dropdown to appear and filter to apply
    await waitFor(() => {
      expect(screen.getByText("Banana")).toBeInTheDocument();
    });

    // Click on the filtered option
    const bananaOption = screen.getByText("Banana");
    fireEvent.click(bananaOption);

    // Verify the selection was made
    expect(handleChange).toHaveBeenCalledWith("banana");
  });

  it("should not interfere with option clicks when blur event fires", async () => {
    const options = [
      { value: "1", label: "Option 1" },
      { value: "2", label: "Option 2" },
    ];

    const handleChange = jest.fn();
    render(
      <Select
        options={options}
        value=""
        onChange={handleChange}
      />
    );

    const input = screen.getByRole("combobox");

    // Focus the input
    input.focus();
    fireEvent.change(input, { target: { value: "Option" } });

    // Wait for options to appear
    await waitFor(() => {
      expect(screen.getByText("Option 1")).toBeInTheDocument();
    });

    // Click option (blur will fire before click)
    const option1 = screen.getByText("Option 1");
    fireEvent.click(option1);

    // Selection should still work
    expect(handleChange).toHaveBeenCalledWith("1");
  });

  it("should maintain dropdown state when typing and then clicking option", async () => {
    const options = [
      { value: "apple", label: "Apple" },
      { value: "apricot", label: "Apricot" },
      { value: "avocado", label: "Avocado" },
    ];

    const handleChange = jest.fn();
    const { container } = render(
      <Select
        options={options}
        value=""
        onChange={handleChange}
        placeholder="Select a fruit"
      />
    );

    const input = screen.getByRole("combobox");

    // Type to filter options
    fireEvent.change(input, { target: { value: "ap" } });

    // Wait for dropdown to appear and filter to apply
    await waitFor(() => {
      expect(screen.getByText("Apple")).toBeInTheDocument();
      expect(screen.getByText("Apricot")).toBeInTheDocument();
    });

    // The dropdown should be open (verify by checking if options are visible)
    const appleOption = screen.getByText("Apple");
    expect(appleOption).toBeInTheDocument();

    // Click on the filtered option
    fireEvent.click(appleOption);

    // Verify the selection was made
    expect(handleChange).toHaveBeenCalledWith("apple");
  });

  /**
   * This test more closely simulates real browser behavior where mousedown
   * fires before click, and blur can interfere with option selection.
   *
   * EXPECTED: Test should FAIL initially, demonstrating the bug.
   * AFTER FIX: Test should PASS when using relatedTarget in handleBlur.
   */
  it("should handle option selection when blur fires during click sequence", async () => {
    const options = [
      { value: "red", label: "Red" },
      { value: "green", label: "Green" },
      { value: "blue", label: "Blue" },
    ];

    const handleChange = jest.fn();
    render(
      <Select
        options={options}
        value=""
        onChange={handleChange}
        placeholder="Select a color"
      />
    );

    const input = screen.getByRole("combobox");

    // Focus and type to filter
    input.focus();
    fireEvent.change(input, { target: { value: "gre" } });

    // Wait for dropdown to appear
    await waitFor(() => {
      expect(screen.getByText("Green")).toBeInTheDocument();
    });

    // Simulate real browser click sequence:
    // 1. Mousedown on option (triggers focus loss from input)
    // 2. Blur event on input
    // 3. Click event on option
    const greenOption = screen.getByText("Green");

    // Fire mousedown first (as happens in real browsers)
    fireEvent.mouseDown(greenOption);

    // Then fire blur on input (as happens when focus moves)
    fireEvent.blur(input);

    // Finally fire click on the option
    fireEvent.click(greenOption);

    // The selection should work even with blur firing
    expect(handleChange).toHaveBeenCalledWith("green");
  });
});
