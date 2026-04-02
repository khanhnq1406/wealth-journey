import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { DraggableWatchlistTable } from "../components/DraggableWatchlistTable";
import { WatchlistItem } from "@/gen/protobuf/v1/watchlist";
import { InvestmentType } from "@/gen/protobuf/v1/investment";

const messages = {
  prices: {
    watchlist: {
      column: {
        symbol: "Symbol",
        price: "Price",
        change: "Change",
        type: "Type",
        note: "Note",
      },
    },
  },
};

const items: WatchlistItem[] = [
  {
    id: 1,
    symbol: "AAPL",
    name: "Apple Inc.",
    assetType: InvestmentType.INVESTMENT_TYPE_STOCK,
    currentPrice: 150,
    priceChangePercent: 1.5,
    priceChange: 2.25,
    buyPrice: 0,
    sellPrice: 0,
    currency: "USD",
    sortOrder: 1,
    note: "",
    createdAt: 0,
  },
  {
    id: 2,
    symbol: "GOOG",
    name: "Alphabet",
    assetType: InvestmentType.INVESTMENT_TYPE_STOCK,
    currentPrice: 2800,
    priceChangePercent: -0.5,
    priceChange: -14,
    buyPrice: 0,
    sellPrice: 0,
    currency: "USD",
    sortOrder: 2,
    note: "Watch closely",
    createdAt: 0,
  },
];

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("DraggableWatchlistTable (SortableList refactor)", () => {
  it("renders all items with symbols visible", () => {
    render(
      <Wrapper>
        <DraggableWatchlistTable
          items={items}
          onReorderCommit={jest.fn()}
          onDelete={jest.fn()}
        />
      </Wrapper>
    );
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("GOOG")).toBeInTheDocument();
  });

  it("renders drag handles", () => {
    render(
      <Wrapper>
        <DraggableWatchlistTable
          items={items}
          onReorderCommit={jest.fn()}
          onDelete={jest.fn()}
        />
      </Wrapper>
    );
    const handles = screen.getAllByLabelText("Drag to reorder");
    expect(handles).toHaveLength(2);
  });

  it("renders delete buttons for each item", () => {
    render(
      <Wrapper>
        <DraggableWatchlistTable
          items={items}
          onReorderCommit={jest.fn()}
          onDelete={jest.fn()}
        />
      </Wrapper>
    );
    expect(
      screen.getByLabelText("Remove AAPL from watchlist")
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Remove GOOG from watchlist")
    ).toBeInTheDocument();
  });
});
