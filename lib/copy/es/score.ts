/**
 * Dutch copy for the TSG score's five dimensions (UI_SPEC.md §5's own
 * table: dimension, wat het meet). Same split as the rest of lib/copy/es:
 * TsgScoreDimension is a calculation-layer type (types.ts), so the label
 * and the one-line "wat het meet" answer live here, keyed by a Record that
 * fails to compile if a dimension is ever added without a translation.
 */

import type { TsgScoreDimension } from "../../rules/es/types";

export const TSG_SCORE_DIMENSION_COPY_NL: Readonly<
  Record<TsgScoreDimension, { label: string; description: string }>
> = {
  cashflow: {
    label: "Cashflow",
    description: "Kan de belegger het dragen?",
  },
  debtResilience: {
    label: "Schuldbestendigheid",
    description: "Houdt het stand bij tegenwind?",
  },
  returnVsRequirement: {
    label: "Rendement",
    description: "Wordt het risico beloond?",
  },
  feasibility: {
    label: "Haalbaarheid",
    description: "Kan deze deal überhaupt?",
  },
  dataCertainty: {
    label: "Datazekerheid",
    description: "Hoe stevig staan de cijfers?",
  },
};

/** Report order - UI_SPEC.md §5's own table order. */
export const TSG_SCORE_DIMENSION_ORDER: readonly TsgScoreDimension[] = [
  "cashflow",
  "debtResilience",
  "returnVsRequirement",
  "feasibility",
  "dataCertainty",
];
