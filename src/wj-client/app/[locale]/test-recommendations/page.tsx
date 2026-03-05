"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormNumberInput } from "@/components/forms/FormNumberInput";

/**
 * Test page for number recommendations feature
 * Navigate to /test-recommendations to test
 */
export default function TestRecommendationsPage() {
  const { control, watch, handleSubmit } = useForm({
    defaultValues: {
      amount: "",
    },
  });

  const [submittedValue, setSubmittedValue] = useState<number | null>(null);
  const currentValue = watch("amount");

  const onSubmit = (data: any) => {
    setSubmittedValue(data.amount);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">
          Number Recommendations Test
        </h1>
        <p className="text-gray-600 mb-8">
          Type a number to see recommendations (e.g., "12", "1", "123")
        </p>

        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Test: Default (recommendations enabled) */}
            <FormNumberInput
              name="amount"
              control={control}
              label="Amount (with recommendations)"
              suffix="VND"
              placeholder="Enter amount"
              helperText="Type a number to see suggestions below"
            />

            <div className="mt-4 p-4 bg-blue-50 rounded">
              <h3 className="font-semibold text-sm mb-2">Current Value:</h3>
              <p className="text-lg font-mono">
                {currentValue || "(empty)"}
              </p>
            </div>

            {submittedValue !== null && (
              <div className="mt-4 p-4 bg-green-50 rounded">
                <h3 className="font-semibold text-sm mb-2">Submitted Value:</h3>
                <p className="text-lg font-mono">
                  {submittedValue}
                </p>
              </div>
            )}

            <button
              type="submit"
              className="mt-6 w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition"
            >
              Submit
            </button>
          </form>
        </div>

        {/* Test cases */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Test Cases</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="font-mono">Input: "12"</span>
              <span className="text-gray-600">
                → 12,000 | 120K | 1.2M | 12M | 120M | 1.2B
              </span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="font-mono">Input: "1"</span>
              <span className="text-gray-600">
                → 1,000 | 10,000 | 100K | 1M | 10M | 100M
              </span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="font-mono">Input: "123"</span>
              <span className="text-gray-600">
                → 123,000 | 1.2M | 12.3M | 123M | 1.2B
              </span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="font-mono">Input: "12.5"</span>
              <span className="text-gray-600">
                → (no recommendations - decimal)
              </span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="font-mono">Input: "0"</span>
              <span className="text-gray-600">
                → (no recommendations - zero)
              </span>
            </div>
            <div className="flex justify-between pb-2">
              <span className="font-mono">Input: "-12"</span>
              <span className="text-gray-600">
                → -12,000 | -120K | -1.2M | -12M | -120M | -1.2B
              </span>
            </div>
          </div>
        </div>

        {/* Keyboard navigation hints */}
        <div className="mt-4 bg-yellow-50 rounded-lg shadow p-6">
          <h3 className="font-semibold mb-2">Keyboard Navigation:</h3>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li><kbd className="px-2 py-1 bg-white rounded border">Tab</kbd> - Move to first chip</li>
            <li><kbd className="px-2 py-1 bg-white rounded border">Arrow keys</kbd> - Navigate between chips</li>
            <li><kbd className="px-2 py-1 bg-white rounded border">Enter</kbd> or <kbd className="px-2 py-1 bg-white rounded border">Space</kbd> - Select chip</li>
            <li><kbd className="px-2 py-1 bg-white rounded border">Escape</kbd> - Hide recommendations</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
