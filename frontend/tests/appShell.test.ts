import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App.js";

describe("app shell", () => {
  it("exports the root app component", () => {
    const element = createElement(App);

    expect(element.type).toBe(App);
  });
});
