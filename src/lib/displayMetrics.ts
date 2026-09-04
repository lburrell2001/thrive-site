// Advance widths for Bai Jamjuree, measured from the actual font faces.
//
// A heading line is sized to fill a known width, which means knowing how wide
// its own letters are. Character count cannot do it — a W is more than twice
// an I — and neither can one table, because weight changes the widths: at 200
// some glyphs are 20% narrower than at 700. So there is a table per weight,
// and the two heading lines are measured at the weight each is actually set
// in.
//
// Captured in headless Chrome against the same self-hosted faces the page
// loads, with the heading's letter-spacing baked in. Summing a table predicts
// a real rendered string to within 0.6%.
//
// These are tied to the face. Change --font-display and every table here has
// to be re-measured, or every heading will be mis-sized.

const ADVANCE_BY_WEIGHT: Record<number, Record<string, number>> = {
  200: {
    A: 0.626, B: 0.645, C: 0.643, D: 0.657, E: 0.583, F: 0.559, G: 0.667,
    H: 0.674, I: 0.237, J: 0.561, K: 0.603, L: 0.543, M: 0.778, N: 0.673,
    O: 0.679, P: 0.607, Q: 0.681, R: 0.633, S: 0.610, T: 0.561, U: 0.675,
    V: 0.614, W: 0.824, X: 0.592, Y: 0.603, Z: 0.569, 0: 0.629, 1: 0.340,
    2: 0.539, 3: 0.573, 4: 0.560, 5: 0.581, 6: 0.589, 7: 0.475, 8: 0.603,
    9: 0.593, ' ': 0.243, '&': 0.617, '.': 0.205, ',': 0.197, "'": 0.169, '-': 0.398,
    '—': 0.730, ':': 0.205, '/': 0.505, '!': 0.257, '?': 0.548, '(': 0.286, ')': 0.286,
  },
  300: {
    A: 0.635, B: 0.652, C: 0.650, D: 0.664, E: 0.590, F: 0.566, G: 0.674,
    H: 0.683, I: 0.244, J: 0.568, K: 0.615, L: 0.550, M: 0.785, N: 0.680,
    O: 0.686, P: 0.614, Q: 0.689, R: 0.640, S: 0.617, T: 0.568, U: 0.682,
    V: 0.623, W: 0.833, X: 0.600, Y: 0.611, Z: 0.572, 0: 0.636, 1: 0.347,
    2: 0.546, 3: 0.580, 4: 0.570, 5: 0.588, 6: 0.596, 7: 0.482, 8: 0.610,
    9: 0.600, ' ': 0.250, '&': 0.631, '.': 0.211, ',': 0.205, "'": 0.175, '-': 0.386,
    '—': 0.737, ':': 0.211, '/': 0.511, '!': 0.263, '?': 0.555, '(': 0.295, ')': 0.295,
  },
  400: {
    A: 0.644, B: 0.659, C: 0.657, D: 0.671, E: 0.597, F: 0.573, G: 0.681,
    H: 0.691, I: 0.251, J: 0.575, K: 0.627, L: 0.557, M: 0.792, N: 0.687,
    O: 0.693, P: 0.621, Q: 0.697, R: 0.647, S: 0.624, T: 0.575, U: 0.689,
    V: 0.631, W: 0.841, X: 0.608, Y: 0.619, Z: 0.575, 0: 0.643, 1: 0.354,
    2: 0.553, 3: 0.587, 4: 0.580, 5: 0.595, 6: 0.603, 7: 0.489, 8: 0.617,
    9: 0.607, ' ': 0.257, '&': 0.644, '.': 0.217, ',': 0.213, "'": 0.181, '-': 0.374,
    '—': 0.744, ':': 0.217, '/': 0.517, '!': 0.269, '?': 0.561, '(': 0.303, ')': 0.303,
  },
  500: {
    A: 0.655, B: 0.668, C: 0.666, D: 0.680, E: 0.606, F: 0.582, G: 0.690,
    H: 0.702, I: 0.260, J: 0.584, K: 0.642, L: 0.566, M: 0.801, N: 0.696,
    O: 0.702, P: 0.630, Q: 0.706, R: 0.656, S: 0.634, T: 0.584, U: 0.698,
    V: 0.642, W: 0.852, X: 0.618, Y: 0.629, Z: 0.584, 0: 0.652, 1: 0.363,
    2: 0.562, 3: 0.596, 4: 0.593, 5: 0.604, 6: 0.612, 7: 0.498, 8: 0.626,
    9: 0.616, ' ': 0.266, '&': 0.660, '.': 0.224, ',': 0.225, "'": 0.190, '-': 0.383,
    '—': 0.753, ':': 0.224, '/': 0.527, '!': 0.276, '?': 0.570, '(': 0.315, ')': 0.315,
  },
  600: {
    A: 0.667, B: 0.678, C: 0.676, D: 0.690, E: 0.616, F: 0.592, G: 0.700,
    H: 0.712, I: 0.270, J: 0.593, K: 0.656, L: 0.576, M: 0.811, N: 0.706,
    O: 0.712, P: 0.640, Q: 0.716, R: 0.666, S: 0.643, T: 0.594, U: 0.708,
    V: 0.652, W: 0.863, X: 0.628, Y: 0.639, Z: 0.594, 0: 0.662, 1: 0.373,
    2: 0.571, 3: 0.605, 4: 0.605, 5: 0.613, 6: 0.622, 7: 0.508, 8: 0.636,
    9: 0.626, ' ': 0.276, '&': 0.677, '.': 0.230, ',': 0.237, "'": 0.200, '-': 0.393,
    '—': 0.763, ':': 0.230, '/': 0.537, '!': 0.282, '?': 0.579, '(': 0.327, ')': 0.327,
  },
  700: {
    A: 0.678, B: 0.687, C: 0.685, D: 0.699, E: 0.625, F: 0.601, G: 0.709,
    H: 0.723, I: 0.279, J: 0.602, K: 0.671, L: 0.585, M: 0.820, N: 0.715,
    O: 0.721, P: 0.649, Q: 0.725, R: 0.675, S: 0.653, T: 0.603, U: 0.717,
    V: 0.663, W: 0.874, X: 0.638, Y: 0.649, Z: 0.603, 0: 0.671, 1: 0.382,
    2: 0.580, 3: 0.614, 4: 0.618, 5: 0.622, 6: 0.631, 7: 0.517, 8: 0.645,
    9: 0.635, ' ': 0.285, '&': 0.693, '.': 0.237, ',': 0.249, "'": 0.209, '-': 0.402,
    '—': 0.772, ':': 0.237, '/': 0.547, '!': 0.289, '?': 0.588, '(': 0.339, ')': 0.339,
  },
};

/** Weights the two display lines are set in. */
export interface HeadingWeights {
  line1: number;
  line2: number;
}

/**
 * The document's heading weights. Single source of truth: the renderer sets
 * these inline so measurement and rendering can never disagree.
 */
export const HEADING_WEIGHTS: HeadingWeights = { line1: 700, line2: 500 };

/** Nearest weight we hold a table for. */
function tableFor(weight: number): Record<string, number> {
  const available = Object.keys(ADVANCE_BY_WEIGHT).map(Number);
  const nearest = available.reduce((best, w) =>
    Math.abs(w - weight) < Math.abs(best - weight) ? w : best,
  );
  return ADVANCE_BY_WEIGHT[nearest];
}

/** Width of  set in the display face at , in em. */
export function displayWidthEm(text: string, weight: number = HEADING_WEIGHTS.line2): number {
  const table = tableFor(weight);
  const fallback = table.O ?? 0.72;
  const width = [...text.toUpperCase()].reduce(
    (total, character) => total + (table[character] ?? fallback),
    0,
  );
  // Guard against a divide-by-zero downstream on an empty heading.
  return Math.max(1, width);
}
