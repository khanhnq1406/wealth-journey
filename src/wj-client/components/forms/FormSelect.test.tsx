import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RHFFormSelect as FormSelect } from "./RHFFormSelect";
import { useForm } from "react-hook-form";

/**
 * Integration tests for FormSelect component with React Hook Form.
 *
 * These tests verify that the blur event fix (using relatedTarget) works
 * correctly in the React Hook Form context when users type to filter options
 * and then click to select.
 *
 * Context: This is Task 3 of 5 tasks to fix the bug where users cannot select
 * options in FormSelect when typing to search.
 */

describe("FormSelect - Integration", () => {
  it("should allow selecting options after typing in form context", async () => {
    const onSubmit = jest.fn();

    const TestComponent = () => {
      const { control, handleSubmit } = useForm({
        defaultValues: { fruit: "" },
      });

      return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormSelect
            name="fruit"
            control={control}
            label="Select Fruit"
            placeholder="Select a fruit"
            options={[
              { value: "1", label: "Apple" },
              { value: "2", label: "Banana" },
              { value: "3", label: "Cherry" },
            ]}
          />
          <button type="submit">Submit</button>
        </form>
      );
    };

    render(<TestComponent />);

    const input = screen.getByRole("combobox", { name: /select a fruit/i });

    // Type to filter
    fireEvent.change(input, { target: { value: "ban" } });

    // Wait for filtered options
    await waitFor(() => {
      expect(screen.getByText("Banana")).toBeInTheDocument();
    });

    // Click the option - this is the key test: verifies blur doesn't interfere
    const bananaOption = screen.getByText("Banana");
    fireEvent.click(bananaOption);

    // Verify selection was made by checking the input value
    await waitFor(() => {
      expect(input).toHaveValue("Banana");
    });

    // Submit and verify value
    const submitButton = screen.getByText("Submit");
    fireEvent.click(submitButton);

    // The form should have the selected value (string value)
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { fruit: "2" },
        expect.any(Object),
      );
    });
  });

  it("should properly handle number values from FormSelect", async () => {
    const onSubmit = jest.fn();

    const TestComponent = () => {
      const { control, handleSubmit } = useForm({
        defaultValues: { walletId: "" },
      });

      return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormSelect
            name="walletId"
            control={control}
            label="Select Wallet"
            placeholder="Choose a wallet"
            options={[
              { value: "101", label: "Wallet A" },
              { value: "102", label: "Wallet B" },
              { value: "103", label: "Wallet C" },
            ]}
          />
          <button type="submit">Submit</button>
        </form>
      );
    };

    render(<TestComponent />);

    const input = screen.getByRole("combobox", { name: /choose a wallet/i });

    // Type to filter
    fireEvent.change(input, { target: { value: "wallet b" } });

    // Wait for filtered options
    await waitFor(() => {
      expect(screen.getByText("Wallet B")).toBeInTheDocument();
    });

    // Click the option
    const walletOption = screen.getByText("Wallet B");
    fireEvent.click(walletOption);

    // Verify selection was made
    await waitFor(() => {
      expect(input).toHaveValue("Wallet B");
    });

    // Submit and verify the number value is correctly sent
    const submitButton = screen.getByText("Submit");
    fireEvent.click(submitButton);

    // FormSelect keeps string values
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { walletId: "102" },
        expect.any(Object),
      );
    });
  });

  it("should handle blur event correctly when clicking option after typing", async () => {
    const handleChange = jest.fn();

    const TestComponent = () => {
      const { control, watch } = useForm({
        defaultValues: { color: "" },
      });

      const value = watch("color");

      return (
        <div>
          <FormSelect
            name="color"
            control={control}
            label="Select Color"
            placeholder="Pick a color"
            options={[
              { value: "red", label: "Red" },
              { value: "green", label: "Green" },
              { value: "blue", label: "Blue" },
            ]}
          />
          <div data-testid="selected-value">{value || "none"}</div>
        </div>
      );
    };

    render(<TestComponent />);

    const input = screen.getByRole("combobox", { name: /pick a color/i });

    // Focus and type to filter
    input.focus();
    fireEvent.change(input, { target: { value: "gre" } });

    // Wait for filtered options
    await waitFor(() => {
      expect(screen.getByText("Green")).toBeInTheDocument();
    });

    // Simulate the click sequence that causes the blur bug:
    // 1. Mousedown on option
    // 2. Blur on input
    // 3. Click on option
    const greenOption = screen.getByText("Green");
    fireEvent.mouseDown(greenOption);
    fireEvent.blur(input);
    fireEvent.click(greenOption);

    // Verify the value was selected despite blur firing
    await waitFor(() => {
      expect(screen.getByTestId("selected-value")).toHaveTextContent("green");
    });
  });

  it("should allow selecting first matching option when filtering results in single option", async () => {
    const onSubmit = jest.fn();

    const TestComponent = () => {
      const { control, handleSubmit } = useForm({
        defaultValues: { item: "" },
      });

      return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormSelect
            name="item"
            control={control}
            label="Select Item"
            placeholder="Choose an item"
            options={[
              { value: "unique", label: "Unique Item" },
              { value: "other", label: "Other Item" },
            ]}
          />
          <button type="submit">Submit</button>
        </form>
      );
    };

    render(<TestComponent />);

    const input = screen.getByRole("combobox", { name: /choose an item/i });

    // Type a unique filter that results in single option
    fireEvent.change(input, { target: { value: "unique" } });

    // Wait for filtered options
    await waitFor(() => {
      expect(screen.getByText("Unique Item")).toBeInTheDocument();
    });

    // Click the option
    const option = screen.getByText("Unique Item");
    fireEvent.click(option);

    // Verify selection
    await waitFor(() => {
      expect(input).toHaveValue("Unique Item");
    });

    // Submit and verify
    const submitButton = screen.getByText("Submit");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { item: "unique" },
        expect.any(Object),
      );
    });
  });

  it("should work with disableFilter option in form context", async () => {
    const onSubmit = jest.fn();

    const TestComponent = () => {
      const { control, handleSubmit } = useForm({
        defaultValues: { category: "" },
      });

      return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormSelect
            name="category"
            control={control}
            label="Select Category"
            placeholder="Pick a category"
            searchable={false}
            options={[
              { value: "1", label: "Food" },
              { value: "2", label: "Transport" },
              { value: "3", label: "Entertainment" },
            ]}
          />
          <button type="submit">Submit</button>
        </form>
      );
    };

    render(<TestComponent />);

    const input = screen.getByRole("combobox", { name: /pick a category/i });

    // With disableFilter, typing should not filter but still allow selection
    fireEvent.change(input, { target: { value: "xyz" } });

    // All options should still be visible
    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument();
      expect(screen.getByText("Transport")).toBeInTheDocument();
    });

    // Click an option
    const foodOption = screen.getByText("Food");
    fireEvent.click(foodOption);

    // Verify selection
    await waitFor(() => {
      expect(input).toHaveValue("Food");
    });

    // Submit and verify
    const submitButton = screen.getByText("Submit");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { category: "1" },
        expect.any(Object),
      );
    });
  });
});
