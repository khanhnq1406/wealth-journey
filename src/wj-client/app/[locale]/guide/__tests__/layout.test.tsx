/**
 * Tests for Guide Page Layout — SEO metadata structure and children rendering (Task 3)
 *
 * TDD: RED → GREEN → REFACTOR
 * Run: cd src/wj-client && npx jest --testPathPattern="guide/__tests__/layout" --no-coverage
 */

import React from "react";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock JsonLd to render a testable element with the schema data
jest.mock("@/components/seo/JsonLd", () => ({
  JsonLd: ({
    data,
  }: {
    data: Record<string, unknown> | Record<string, unknown>[];
  }) => {
    const schemas = Array.isArray(data) ? data : [data];
    return (
      <>
        {schemas.map((schema, i) => (
          <script
            key={i}
            data-testid={`json-ld-${i}`}
            type="application/ld+json"
            data-schema-type={schema["@type"] as string}
          />
        ))}
      </>
    );
  },
}));

// ---------------------------------------------------------------------------
// Import the Layout default export
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Layout = require("../layout").default as React.ComponentType<{
  children: React.ReactNode;
}>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Guide Page Layout", () => {
  describe("Children rendering", () => {
    it("renders children content inside the layout", () => {
      render(
        <Layout>
          <div data-testid="guide-child">Guide Content</div>
        </Layout>,
      );
      expect(screen.getByTestId("guide-child")).toBeInTheDocument();
      expect(screen.getByText("Guide Content")).toBeInTheDocument();
    });

    it("renders multiple children elements", () => {
      render(
        <Layout>
          <h1 data-testid="guide-title">Guide Title</h1>
          <p data-testid="guide-body">Guide Body</p>
        </Layout>,
      );
      expect(screen.getByTestId("guide-title")).toBeInTheDocument();
      expect(screen.getByTestId("guide-body")).toBeInTheDocument();
    });
  });

  describe("JSON-LD structured data", () => {
    it("renders at least one JSON-LD script tag", () => {
      render(
        <Layout>
          <div>content</div>
        </Layout>,
      );
      const jsonLdElements = screen.getAllByTestId(/^json-ld-/);
      expect(jsonLdElements.length).toBeGreaterThan(0);
    });

    it("includes a HowTo schema type in JSON-LD", () => {
      render(
        <Layout>
          <div>content</div>
        </Layout>,
      );
      const howToElement = screen.getByTestId("json-ld-0");
      expect(howToElement).toHaveAttribute("data-schema-type", "HowTo");
    });

    it("renders JSON-LD as application/ld+json script tags", () => {
      render(
        <Layout>
          <div>content</div>
        </Layout>,
      );
      const jsonLdElement = screen.getByTestId("json-ld-0");
      expect(jsonLdElement.getAttribute("type")).toBe("application/ld+json");
    });
  });

  describe("generateMetadata export", () => {
    it("exports a generateMetadata function", () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const layoutModule = require("../layout");
      expect(typeof layoutModule.generateMetadata).toBe("function");
    });

    it("generateMetadata returns an object with title", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const layoutModule = require("../layout");
      const metadata = await layoutModule.generateMetadata();
      expect(metadata).toHaveProperty("title");
    });

    it("generateMetadata returns an object with description", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const layoutModule = require("../layout");
      const metadata = await layoutModule.generateMetadata();
      expect(metadata).toHaveProperty("description");
    });

    it("metadata title contains guide-related content", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const layoutModule = require("../layout");
      const metadata = await layoutModule.generateMetadata();
      const title =
        typeof metadata.title === "string"
          ? metadata.title
          : (metadata.title as Record<string, string>)?.absolute ||
            (metadata.title as Record<string, string>)?.default ||
            "";
      expect(title.toLowerCase()).toMatch(/guide|hướng dẫn/i);
    });

    it("metadata title contains congdongvang.com branding", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const layoutModule = require("../layout");
      const metadata = await layoutModule.generateMetadata();
      const title =
        typeof metadata.title === "string"
          ? metadata.title
          : (metadata.title as Record<string, string>)?.absolute ||
            (metadata.title as Record<string, string>)?.default ||
            "";
      expect(title).toContain("congdongvang.com");
    });

    it("metadata robots allows indexing", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const layoutModule = require("../layout");
      const metadata = await layoutModule.generateMetadata();
      expect(metadata.robots).toBeDefined();
      expect(metadata.robots.index).toBe(true);
      expect(metadata.robots.follow).toBe(true);
    });

    it("metadata includes openGraph data", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const layoutModule = require("../layout");
      const metadata = await layoutModule.generateMetadata();
      expect(metadata.openGraph).toBeDefined();
      expect(metadata.openGraph.type).toBe("website");
      expect(metadata.openGraph.siteName).toBe("congdongvang.com");
    });

    it("metadata alternates includes canonical URL for /vi/guide", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const layoutModule = require("../layout");
      const metadata = await layoutModule.generateMetadata();
      expect(metadata.alternates).toBeDefined();
      expect(metadata.alternates.canonical).toContain("/vi/guide");
    });

    it("metadata alternates includes both vi and en language links", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const layoutModule = require("../layout");
      const metadata = await layoutModule.generateMetadata();
      expect(metadata.alternates.languages).toBeDefined();
      expect(metadata.alternates.languages.vi).toContain("/vi/guide");
      expect(metadata.alternates.languages.en).toContain("/en/guide");
    });

    it("metadata includes twitter card data", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const layoutModule = require("../layout");
      const metadata = await layoutModule.generateMetadata();
      expect(metadata.twitter).toBeDefined();
      expect(metadata.twitter.card).toBe("summary_large_image");
    });
  });
});
