/**
 * Utility functions for question handling and validation
 *
 * Features:
 * - Evaluate formulas with built-in Math
 * - Display formula results as:
 *     • Integers
 *     • Simplified fractions (e.g. \( \frac{7}{3} \))
 *     • Simplified radicals (e.g. \( 2\sqrt{3} \), \( \frac{1}{2}\sqrt{5} \))
 * - Exact fraction detection for integer arithmetic
 */

function valuesAreEqual(a, b, epsilon = 1e-10) {
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < epsilon;
  }
  return a === b;
}

function resolveExclusionValue(exclusion, allVars) {
  if (typeof exclusion !== 'string') return exclusion;

  if (allVars[exclusion] !== undefined) {
    return allVars[exclusion];
  }

  const numEx = Number(exclusion);
  if (!isNaN(numEx)) return numEx;

  try {
    return evaluateJSExpression(exclusion, allVars);
  } catch (e) {
    return undefined;
  }
}

function validateVariableValue(value, constraints, allVars) {
  if (!constraints) return true;

  if (constraints.exclude) {
    for (const exclusion of constraints.exclude) {
      const resolvedExclusion = resolveExclusionValue(exclusion, allVars);
      if (resolvedExclusion !== undefined && valuesAreEqual(value, resolvedExclusion)) {
        return false;
      }
    }
  }

  return true;
}

function generateVariableValue(key, constraints, allVars, maxAttempts = 50) {
  // Handle textValue: pick a random string from the array
  if (constraints.textValue && Array.isArray(constraints.textValue)) {
    return constraints.textValue[Math.floor(Math.random() * constraints.textValue.length)];
  }

  let attempts = 0;
  let value;

  do {
    if (Array.isArray(constraints.values)) {
      // Pick from predefined values
      value = constraints.values[Math.floor(Math.random() * constraints.values.length)];
    } else if (typeof constraints.min === "number" && typeof constraints.max === "number") {
      // Generate within range
      value = Math.floor(Math.random() * (constraints.max - constraints.min + 1)) + constraints.min;
    } else {
      // Fallback
      value = constraints.default !== undefined ? constraints.default : 0;
    }

    attempts++;
  } while (!validateVariableValue(value, constraints, allVars) && attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    console.warn(`Could not generate valid value for variable ${key} after ${maxAttempts} attempts`);
    return constraints.default !== undefined ? constraints.default : 0;
  }

  return value;
}

/* -----------------------------
   Math Helpers
   ----------------------------- */

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

function binomialCoefficient(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - k + i)) / i;
  }
  return result;
}

function formatExpandedTerm(coef, xExp, yExp = 0, xSymbol = 'x', ySymbol = null) {
  const absCoef = Math.abs(coef);
  const factors = [];

  if (absCoef !== 1 || (xExp === 0 && yExp === 0)) {
    factors.push(String(absCoef));
  }

  if (xExp > 0) {
    factors.push(`${xSymbol}${xExp === 1 ? '' : `^{${xExp}}`}`);
  }

  if (ySymbol && yExp > 0) {
    factors.push(`${ySymbol}${yExp === 1 ? '' : `^{${yExp}}`}`);
  }

  return factors.join('');
}

function expandBinomial(a, b, n, xSymbol = 'x', ySymbol = null) {
  const terms = [];

  for (let k = 0; k <= n; k++) {
    const coef = binomialCoefficient(n, k) * Math.pow(a, n - k) * Math.pow(b, k);
    const monomial = formatExpandedTerm(coef, n - k, ySymbol ? k : 0, xSymbol, ySymbol);
    const sign = coef < 0 ? '-' : '+';

    if (terms.length === 0) {
      terms.push(sign === '-' ? `-${monomial}` : monomial);
    } else {
      terms.push(`${sign} ${monomial}`);
    }
  }

  return `\\( ${terms.join(' ')} \\)`;
}

function evaluateJSExpression(expression, variables = {}) {
  const helpers = {
    sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    abs: Math.abs, pow: Math.pow, log: Math.log, ln: Math.log,
    exp: Math.exp, min: Math.min, max: Math.max,
    round: Math.round, floor: Math.floor, ceil: Math.ceil,
    binomialCoefficient,
    expandBinomial,
    PI: Math.PI, E: Math.E,
  };

  const helperNames = Object.keys(helpers);
  const fnArgs = ['vars', ...helperNames, 'Math'];
  const fnBody = `with(vars){ return (${expression}); }`;
  const fn = new Function(...fnArgs, fnBody);

  const fnArgValues = [variables, ...helperNames.map(n => helpers[n]), Math];
  return fn(...fnArgValues);
}

/**
 * Try to parse a simple arithmetic expression (for exact fraction detection)
 */
function tryParseIntegerDivision(formula, vars) {
  if (!formula) return null;

  // Match only a single top-level division such as a/b or (x + 1)/(y - 2).
  // Nested divisions inside larger sums must not be mistaken for the whole value.
  let depth = 0;
  let slashIndex = -1;
  for (let i = 0; i < formula.length; i++) {
    const ch = formula[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === '/' && depth === 0) {
      if (slashIndex !== -1) return null;
      slashIndex = i;
    }
  }

  if (slashIndex === -1) return null;

  const numExpr = formula.slice(0, slashIndex).trim();
  const denExpr = formula.slice(slashIndex + 1).trim();
  if (!numExpr || !denExpr) return null;

  try {
    const num = evaluateJSExpression(numExpr, vars);
    const den = evaluateJSExpression(denExpr, vars);

    if (Number.isInteger(num) && Number.isInteger(den) && den !== 0) {
      return { n: num, d: den };
    }
  } catch (e) {
    // ignore
  }

  return null;
}

/**
 * Detect simplified radical: k * sqrt(m) or (p/q) * sqrt(m)
 */
function detectSimplifiedRadical(value, maxM = 200, maxDen = 100, eps = 1e-10) {
  if (!isFinite(value) || value === 0) return null;

  const sign = value < 0 ? "-" : "";
  const absVal = Math.abs(value);

  for (let m = 2; m <= maxM; m++) {
    const sqrtM = Math.sqrt(m);
    if (Math.abs(sqrtM - Math.round(sqrtM)) < 1e-12) continue; // perfect square → skip

    const kFloat = absVal / sqrtM;
    const frac = approximateFraction(kFloat, maxDen, eps);
    if (!frac) continue;

    let coeff = frac.n;      // positive
    let den = frac.d;

    let radical = m;
    for (let i = 2; i * i <= radical; i++) {
      while (radical % (i * i) === 0) {
        coeff *= i;
        radical /= (i * i);
      }
    }

    const g = gcd(coeff, den);
    coeff /= g;
    den /= g;

    const candidate = (coeff / den) * Math.sqrt(m);
    if (Math.abs(candidate - absVal) > eps) continue;

    // Build string
    let coeffStr = "";
    if (coeff !== 1 || den !== 1) {
      coeffStr = den === 1 ? String(coeff) : `\\frac{${coeff}}{${den}}`;
    }

    const radicalStr = radical === 1 ? "" : `\\sqrt{${radical}}`;

    // Omit 1 in front of radical (but keep - if negative)
    if (coeff === 1 && radical !== 1) coeffStr = "";

    const expr = coeffStr + radicalStr;

    return sign + (expr || "1");   // "1" only if everything collapsed (should not happen)
  }
  return null;
}

function approximateFraction(x, maxDenominator = 1000, eps = 1e-12) {
  if (!isFinite(x)) return null;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a = [];
  let q = x;
  for (let i = 0; i < 20; i++) {
    const ai = Math.floor(q);
    a.push(ai);
    const frac = q - ai;
    if (frac < eps) break;
    q = 1 / frac;
  }

  let num0 = 1, den0 = 0;
  let num1 = a[0], den1 = 1;
  if (a.length === 1) {
    const g = gcd(num1, den1);
    return { n: sign * (num1 / g), d: den1 / g };
  }
  for (let i = 1; i < a.length; i++) {
    const num2 = a[i] * num1 + num0;
    const den2 = a[i] * den1 + den0;
    if (den2 > maxDenominator) break;
    num0 = num1; den0 = den1;
    num1 = num2; den1 = den2;
  }
  const g = gcd(Math.abs(num1), den1);
  const approxN = sign * (num1 / g);
  const approxD = den1 / g;
  if (Math.abs(approxN / approxD - x) < eps) {
    return { n: approxN, d: approxD };
  }
  return null;
}

/**
 * Main display formatter — now detects exact fractions from formulas
 * @param {number} num - The numeric value to format
 * @param {string|null} formula - The formula string (for exact fraction detection)
 * @param {object|null} vars - Variable context for formula evaluation
 * @param {string} format - Display format: 'auto' (default), 'fraction', 'decimal', 'radical'
 */
function formatNumberForDisplay(num, formula = null, vars = null, format = 'auto') {
  if (num === null || num === undefined || !isFinite(num)) return String(num);

  // 1. Exact integer (always display as integer regardless of format)
  if (Math.abs(num - Math.round(num)) < 1e-10) return String(Math.round(num));

  // 2. EXPLICIT DECIMAL FORMAT - force decimal display
  if (format === 'decimal') {
    let s = num.toFixed(12);
    s = s.replace(/0+$/, "");            // strip trailing zeros
    if (s.endsWith(".")) s = s.slice(0, -1);
    return s === "" ? "0" : s;
  }

  // 3. EXPLICIT FRACTION FORMAT - force fraction (even if approximate)
  if (format === 'fraction') {
    // Try exact fraction first
    if (formula && vars) {
      const exact = tryParseIntegerDivision(formula, vars);
      if (exact) {
        let n = exact.n;
        let d = exact.d;
        const g = gcd(Math.abs(n), d);
        n /= g;
        d /= g;
        if (d < 0) { n = -n; d = -d; }
        if (d === 1) return String(n);
        return `\\frac{${n}}{${d}}`;
      }
    }
    // Fall back to approximate fraction
    const frac = approximateFraction(num, 1000, 1e-12);
    if (frac) {
      let {n, d} = frac;
      if (d < 0) { n = -n; d = -d; }
      if (d === 1) return String(n);
      return `\\frac{${n}}{${d}}`;
    }
    // If fraction approximation fails, still return decimal
    let s = num.toFixed(12);
    s = s.replace(/0+$/, "");
    if (s.endsWith(".")) s = s.slice(0, -1);
    return s === "" ? "0" : s;
  }

  // 4. EXPLICIT RADICAL FORMAT - force radical detection
  if (format === 'radical') {
    const radical = detectSimplifiedRadical(num);
    if (radical) return radical;
    // Fall back to decimal if no radical found
    let s = num.toFixed(12);
    s = s.replace(/0+$/, "");
    if (s.endsWith(".")) s = s.slice(0, -1);
    return s === "" ? "0" : s;
  }

  // 5. AUTO FORMAT (default behavior) - try fraction, then radical, then decimal
  // Exact fraction from integer division like (a*d + c)/b
  if (formula && vars) {
    const exact = tryParseIntegerDivision(formula, vars);
    if (exact) {
      let n = exact.n;
      let d = exact.d;
      const g = gcd(Math.abs(n), d);
      n /= g;
      d /= g;
      if (d < 0) { n = -n; d = -d; }
      if (d === 1) return String(n);
      return `\\frac{${n}}{${d}}`;   // ← inner only
    }
  }

  // Simplified radical  (cleaned & inner only)
  const radical = detectSimplifiedRadical(num);
  if (radical) return radical;

  // Approximate clean fraction (fallback)
  const frac = approximateFraction(num, 1000, 1e-12);
  if (frac && frac.d !== 1) {
    let {n, d} = frac;
    if (d < 0) { n = -n; d = -d; }
    return `\\frac{${n}}{${d}}`;
  }

  // Clean decimal as last resort
  let s = num.toFixed(12);
  s = s.replace(/0+$/, "");            // strip trailing zeros
  if (s.endsWith(".")) s = s.slice(0, -1);
  return s === "" ? "0" : s;
}

/* -----------------------------
   Main Variable Generation
   ----------------------------- */

function buildQuestionVariablesAttempt(questionTemplate) {
  const vars = {};
  const displayVars = {};
  const generationErrors = [];
  const variableDefinitions = questionTemplate.variables || {};

  // Pass 1: Base variables (textValue, direct numbers, min/max/values, …)
  for (const [key, constraints] of Object.entries(variableDefinitions)) {
    if (typeof constraints === "number") {
      vars[key] = constraints;
      continue;
    }

    if (!constraints) continue;

    if (Object.prototype.hasOwnProperty.call(constraints, "value")) {
      const message = `Invalid variable schema for "${key}": "value" is not supported. Use "values" instead.`;
      generationErrors.push({
        type: "invalid_variable_schema",
        key,
        message
      });
      console.error(message);

      // Keep generation stable while marking this question as schema-invalid for graphing.
      vars[key] = constraints.default !== undefined ? constraints.default : 0;
      continue;
    }

    // textValue → random string (e.g. names, units, …)
    if (constraints.textValue && Array.isArray(constraints.textValue)) {
      const value = constraints.textValue[Math.floor(Math.random() * constraints.textValue.length)];
      vars[key] = value;
      displayVars[key] = value;               // strings are displayed as-is
      continue;
    }

    // Skip formulas for Pass 2
    if (constraints.formula) continue;

    // Normal numeric variable
    vars[key] = generateVariableValue(key, constraints, vars);
  }

  // ==================================================================
  // Pass 2: Evaluate formula variables (repeat until no change – handles dependencies)
  // ==================================================================
  let maxFormulaPasses = 10;
  let changed = true;
  while (changed && maxFormulaPasses--) {
    changed = false;
    for (const [key, constraints] of Object.entries(variableDefinitions)) {
      if (vars[key] !== undefined) continue;   // already computed

      if (constraints.formula) {
        try {
          const value = evaluateJSExpression(constraints.formula, vars);
          if (value !== undefined && value !== null && !(typeof value === "number" && !isFinite(value))) {
            vars[key] = value;
            if (!validateVariableValue(value, constraints, vars)) {
              generationErrors.push({
                type: "excluded_formula_value",
                key,
                value,
                message: `Formula variable "${key}" generated an excluded value: ${value}`
              });
            }
            changed = true;
          }
        } catch (e) {
          // dependency not ready yet → will try again next loop
        }
      }
    }
  }

  // Final fallback – if a formula still isn't resolved → NaN / error (optional)
  for (const [key, constraints] of Object.entries(variableDefinitions)) {
    if (constraints.formula && vars[key] === undefined) {
      console.error(`Formula for "${key}" could not be resolved: ${constraints.formula}`);
      vars[key] = NaN;
    }
  }

  // ==================================================================
  // Build display values – now works for base vars AND formula vars
  // ==================================================================
  for (const [key, constraints] of Object.entries(variableDefinitions)) {
    if (displayVars[key] !== undefined) continue;   // textValue already done

    const value = vars[key];

    if (typeof value === "number" && isFinite(value)) {
      const formulaForExact = constraints.formula || null;   // only formula vars get exact fraction detection
      const format = constraints.format || 'auto';           // get explicit format or default to 'auto'
      displayVars[key] = formatNumberForDisplay(value, formulaForExact, vars, format);
    } else {
      displayVars[key] = String(value);
    }
  }

  Object.defineProperty(vars, "__display", {
    value: displayVars,
    enumerable: false,
    configurable: true,
    writable: true,
  });

  Object.defineProperty(vars, "__errors", {
    value: generationErrors,
    enumerable: false,
    configurable: true,
    writable: true,
  });

  // DEBUG – you can keep or remove
  console.log("Final vars:", vars);
  console.log("Final displayVars:", displayVars);

  return vars;
}

function generateQuestionVariables(questionTemplate) {
  const maxAttempts = 100;
  let lastVars = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const vars = buildQuestionVariablesAttempt(questionTemplate);
    lastVars = vars;

    const retryableErrors = (vars.__errors || []).filter(error =>
      error?.type === "excluded_formula_value"
    );

    if (retryableErrors.length === 0) {
      return vars;
    }
  }

  console.warn(
    `Could not generate valid formula values after ${maxAttempts} attempts for question ${questionTemplate?.id || "(unknown)"}`
  );
  return lastVars || buildQuestionVariablesAttempt(questionTemplate);
}

/**
 * Replace {var} with display value if available
 */
function replaceTemplateVariables(text, variables) {
  if (!text || !variables) return text;

  const replacements = {};
  const keys = Object.keys(variables).filter(k => k !== '__display' && k !== '__errors');

  console.log('replaceTemplateVariables called with:', { text, varsKeys: keys, displayVars: variables.__display }); // DEBUG

  for (const key of keys) {
    const display = variables.__display?.[key];
    const varValue = variables[key];
    console.log(`Processing key "${key}": display="${display}", varValue="${varValue}"`); // DEBUG
    replacements[key] = display !== undefined && display !== '' ? display : String(variables[key]);
    console.log(`  -> replacements["${key}"] = "${replacements[key]}"`); // DEBUG
  }

  const sorted = Object.entries(replacements).sort((a, b) => b[0].length - a[0].length);

  let result = text;
  for (const [key, value] of sorted) {
    const regex = new RegExp(`\\{${escapeRegExp(key)}\\}`, "g");
    console.log(`Replacing {${key}} with "${value}"`); // DEBUG
    result = result.replace(regex, value);
  }

  return result;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* Export */
window.QuestionUtils = {
  validateVariableValue,
  generateVariableValue,
  generateQuestionVariables,
  replaceTemplateVariables,
};