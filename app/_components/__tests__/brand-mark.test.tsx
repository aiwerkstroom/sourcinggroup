// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BRAND_MARK_COLOURS, BrandIcon, BrandMark } from "../brand-mark";

/**
 * Golden test for the Yield & Stone brand mark.
 *
 * Two things carry real weight here and the rest is structure:
 *
 *  1. THE MASK ID. The icon carves its house out of the stone with an
 *     SVG <mask>, referenced by id, and ids are document-global. Two
 *     copies of the mark on one page with a hardcoded id would both
 *     resolve to whichever mask came first. That is invisible today
 *     (the masks are identical) and becomes a real bug the moment one
 *     instance differs or the first is removed. The multi-instance test
 *     below is the one that would have caught the supplied asset's
 *     hardcoded id="i-house".
 *  2. THE NAME IS TEXT. Not an image, not an SVG <text> - real DOM text,
 *     so it is selectable, searchable and readable by a screen reader.
 *     Asserted by reading textContent, which a picture of words could
 *     never satisfy.
 *
 * The Space Grotesk 700 rendering itself is checked in
 * app/__tests__/site-nav-navigation.test.ts, against computed styles in
 * a real browser - jsdom does not load fonts or resolve CSS variables
 * from a stylesheet, so it cannot answer that question honestly.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

function maskIdsIn(container: HTMLElement): string[] {
  return [...container.querySelectorAll("mask")].map((m) => m.getAttribute("id") ?? "");
}
function maskRefsIn(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[mask]")].map((el) => {
    const raw = el.getAttribute("mask") ?? "";
    return /url\(#(.+)\)/.exec(raw)?.[1] ?? "";
  });
}

describe("the mark renders as an icon plus real text", () => {
  it("draws the icon as inline SVG", () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("viewBox")).toBe("0 0 160 160");
    // Decorative: the accessible name comes from the text beside it, so
    // announcing the artwork too would just say everything twice.
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
  });

  it("sets the name as real text, not as an image or SVG <text>", () => {
    const { container } = render(<BrandMark />);
    expect(container.textContent).toContain("Yield & Stone");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("text")).toBeNull();
  });

  it("gives the closing full stop its own span, in the brand gold", () => {
    const { container } = render(<BrandMark />);
    const spans = [...container.querySelectorAll("span")];
    const dot = spans.find((s) => s.textContent === ".");
    expect(dot, "the mark must end in its own full-stop span").toBeDefined();
    expect(dot!.style.color.replace(/\s/g, "")).toBe("rgb(185,145,82)"); // #B99152
    // The full text still reads as the mark, stop included.
    expect(container.textContent).toBe("Yield & Stone.");
  });

  it("lines the two halves up with inline-flex and em spacing, so they scale together", () => {
    const { container } = render(<BrandMark />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("inline-flex");
    expect(wrapper.className).toContain("items-center");
    // Gap and icon height in em, not px: one font-size drives both.
    expect(wrapper.className).toContain("gap-[0.55em]");
    expect(container.querySelector("svg")!.getAttribute("class")).toContain("h-[1.55em]");
  });

  it("sets the wordmark in the heading face at 700 with the brand's negative tracking", () => {
    const { container } = render(<BrandMark />);
    // Queried by class, not by text: the outer wrapper has the same
    // textContent, so a text-based find would return that instead.
    const name = container.querySelector(".font-heading") as HTMLElement | null;
    expect(name, "the wordmark span must carry the heading face").not.toBeNull();
    expect(name!.textContent).toBe("Yield & Stone.");
    expect(name!.className).toContain("font-bold");
    expect(name!.className).toContain("tracking-[-0.02em]");
  });
});

describe("the mask id is unique per instance - the trap in the supplied asset", () => {
  it("two marks on one page get two different mask ids", () => {
    const { container } = render(
      <>
        <BrandMark />
        <BrandMark />
      </>,
    );
    const ids = maskIdsIn(container);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size, `mask ids collided: ${ids.join(", ")}`).toBe(2);
  });

  it("each instance's path references its OWN mask, not the first one in the document", () => {
    const { container } = render(
      <>
        <BrandMark />
        <BrandMark />
      </>,
    );
    const ids = maskIdsIn(container);
    const refs = maskRefsIn(container);
    expect(refs).toHaveLength(2);
    // Pairwise: instance n's path points at instance n's mask.
    expect(refs[0]).toBe(ids[0]);
    expect(refs[1]).toBe(ids[1]);
    expect(refs[0]).not.toBe(refs[1]);
  });

  it("holds for the icon on its own too, and when mixed with the full mark", () => {
    const { container } = render(
      <>
        <BrandIcon />
        <BrandMark />
        <BrandIcon tone="onDark" />
      </>,
    );
    const ids = maskIdsIn(container);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(maskRefsIn(container)).toEqual(ids);
  });
});

describe("the dark-ground variant", () => {
  it("turns the stone and the name light, and leaves the gold alone", () => {
    const { container } = render(<BrandMark tone="onDark" />);

    const stone = container.querySelector("path[mask]") as SVGPathElement;
    expect(stone.getAttribute("fill")).toBe(BRAND_MARK_COLOURS.stoneLight);

    const name = container.querySelector(".font-heading") as HTMLElement;
    expect(name.style.color.replace(/\s/g, "")).toBe("rgb(246,244,241)"); // #F6F4F1

    // The one constant of the mark, in both tones.
    expect(container.querySelector("circle")!.getAttribute("fill")).toBe(BRAND_MARK_COLOURS.gold);
    const dot = [...container.querySelectorAll("span")].find((s) => s.textContent === ".")!;
    expect(dot.style.color.replace(/\s/g, "")).toBe("rgb(185,145,82)");
  });

  it("the light variant is the default, with the dark stone and the ink wordmark", () => {
    const { container } = render(<BrandMark />);
    expect((container.querySelector("path[mask]") as SVGPathElement).getAttribute("fill")).toBe(
      BRAND_MARK_COLOURS.stoneDark,
    );
    const name = container.querySelector(".font-heading") as HTMLElement;
    expect(name.style.color.replace(/\s/g, "")).toBe("rgb(29,27,26)"); // #1D1B1A
  });
});

describe("the inlined geometry matches the standalone asset", () => {
  /**
   * The component inlines the artwork (it has to, for per-instance ids
   * and the tone variant), while public/logo-icoon.svg stays the
   * canonical file for the favicon and anything outside React. Two copies
   * of the same drawing can drift; this is what stops them.
   */
  const assetSvg = readFileSync(path.join(REPO_ROOT, "public/logo-icoon.svg"), "utf8");
  const iconSvg = readFileSync(path.join(REPO_ROOT, "app/icon.svg"), "utf8");
  const componentSrc = readFileSync(
    path.join(REPO_ROOT, "app/_components/brand-mark.tsx"),
    "utf8",
  );

  const STONE_PATH =
    "M92 34 C56 39 34 72 37 111 C39 145 62 162 95 163 C126 164 157 153 166 126 C177 92 158 57 129 43 C117 37 105 33 92 34 Z";
  const HOUSE_PATH = "M86 162 L86 133 L102 118 L118 133 L118 162 Z";
  const GROUP_TRANSFORM = "translate(-8.35,4.0) scale(0.858)";

  it.each([
    ["public/logo-icoon.svg", () => assetSvg],
    ["app/icon.svg", () => iconSvg],
    ["app/_components/brand-mark.tsx", () => componentSrc],
  ])("%s carries the same stone, house and transform", (_name, get) => {
    const src = get();
    expect(src).toContain(STONE_PATH);
    expect(src).toContain(HOUSE_PATH);
    expect(src).toContain(GROUP_TRANSFORM);
    expect(src).toContain('cx="144" cy="27" r="13"');
  });

  it("all three use the same two brand colours", () => {
    for (const src of [assetSvg, iconSvg, componentSrc]) {
      expect(src).toContain(BRAND_MARK_COLOURS.stoneDark);
      expect(src).toContain(BRAND_MARK_COLOURS.gold);
    }
  });
});
