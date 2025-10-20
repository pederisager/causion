/**
 * Parse a textual structural causal model (SCM) specification into
 * coefficient maps keyed by variable name.
 *
 * The parser accepts assignments separated by new lines or semicolons. Each
 * right-hand side may include constants, `error`, and linear terms such as
 * `0.5*A`. Variables that appear only as parents are automatically hoisted into
 * the returned model with empty parent lists so that downstream code can
 * assume every symbol has an entry.
 *
 * @param {string} text - Raw SCM specification provided by the user.
 * @returns {{
 *   model: Map<string, { parents: Record<string, number>, constant: number }>,
 *   allVars: Set<string>
 * }} Parsed coefficients organised by variable.
 * @throws {Error} If a line cannot be parsed or contains duplicate variables.
 */
export function parseSCM(text) {
  const lines = String(text || "")
    .split(/[;\n]/)
    .map((line) => line.trim())
    .filter(Boolean);

  const model = new Map();
  const allVars = new Set();

  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (!match) {
      throw new Error(`Cannot parse: "${line}"`);
    }

    const child = match[1];
    const rhs = match[2];
    const normalised = rhs.replace(/-/g, "+ -");
    const terms = normalised
      .split("+")
      .map((term) => term.trim())
      .filter(Boolean);

    const parents = {};
    let constant = 0;

    for (const term of terms) {
      if (/^error$/i.test(term)) continue;

      if (/^[+-]?\d*\.?\d+(e[+-]?\d+)?$/i.test(term)) {
        constant += parseFloat(term);
        continue;
      }

      const star = term.indexOf("*");
      let coefficient = 1;
      let variable = term;

      if (star !== -1) {
        coefficient = parseFloat(term.slice(0, star));
        variable = term.slice(star + 1).trim();
      }

      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable)) {
        throw new Error(`Unsupported term: "${term}" in line "${line}"`);
      }

      parents[variable] = (parents[variable] ?? 0) + (Number.isNaN(coefficient) ? 1 : coefficient);
    }

    if (model.has(child)) {
      throw new Error(`Duplicate definition for ${child}`);
    }

    model.set(child, { parents, constant, derived: false });
    allVars.add(child);
    Object.keys(parents).forEach((parent) => allVars.add(parent));
  }

  for (const variable of allVars) {
    if (!model.has(variable)) {
      model.set(variable, { parents: {}, constant: 0, derived: true });
    }
  }

  return { model, allVars };
}
