import { ResultatView } from "./resultaat-view";

/**
 * The report's landing point once the wizard has run the engine.
 *
 * Deliberately minimal: UI_SPEC.md §6 lays out a nine-section report and
 * that is its own piece of work. What this page does is prove the chain -
 * four steps in, a real EngineResult out - and show the figures that
 * anchor the golden tests, so a browser walk-through can confirm the same
 * numbers a unit test asserts.
 */
export default function ResultaatPage() {
  return <ResultatView />;
}
