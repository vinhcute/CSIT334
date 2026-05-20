import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PaginationControls } from "../src/components/PaginationControls.js";

describe("pagination controls", () => {
  it("renders page text and previous/next labels", () => {
    const html = renderToStaticMarkup(
      <PaginationControls
        currentPage={2}
        label="Example pagination"
        onNext={() => {}}
        onPrevious={() => {}}
        totalPages={5}
      />,
    );

    expect(html).toContain("Previous");
    expect(html).toContain("Next");
    expect(html).toContain("Page 2 of 5");
  });

  it("disables previous on first page and next on last page", () => {
    const firstPageHtml = renderToStaticMarkup(
      <PaginationControls
        currentPage={1}
        label="First page pagination"
        onNext={() => {}}
        onPrevious={() => {}}
        totalPages={3}
      />,
    );
    const lastPageHtml = renderToStaticMarkup(
      <PaginationControls
        currentPage={3}
        label="Last page pagination"
        onNext={() => {}}
        onPrevious={() => {}}
        totalPages={3}
      />,
    );

    expect(firstPageHtml).toContain("disabled");
    expect(lastPageHtml).toContain("disabled");
  });
});
