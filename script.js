"use strict";


function evaluateExpression(source) {
  const text = source.replace(/\s+/g, "");
  let position = 0;
  function primary() {
    if (text[position] === "(") {
      position++;
      const value = expression();
      if (text[position++] !== ")") throw new Error("Close the parentheses.");
      return value;
    }
    const number = text.slice(position).match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (!number) throw new Error("Enter a valid expression.");
    position += number[0].length;
    return Number(number[0]);
  }
  function power() {
    const value = primary();
    if (text[position] !== "^") return value;
    position++;
    return Math.pow(value, unary());
  }
  function unary() {
    if (text[position] === "+") { position++; return unary(); }
    if (text[position] === "-") { position++; return -unary(); }
    return power();
  }
  function term() {
    let value = unary();
    while (text[position] === "*" || text[position] === "/") {
      const operator = text[position++];
      const next = unary();
      if (operator === "/" && next === 0) throw new Error("Cannot divide by zero.");
      value = operator === "*" ? value * next : value / next;
    }
    return value;
  }
  function expression() {
    let value = term();
    while (text[position] === "+" || text[position] === "-") {
      const operator = text[position++];
      const next = term();
      value = operator === "+" ? value + next : value - next;
    }
    return value;
  }
  const answer = expression();
  if (position !== text.length) throw new Error("Check the numbers and operators.");
  if (!Number.isFinite(answer)) throw new Error("The result is outside the supported real-number range.");
  return answer;
}

function scientificValue(kind, value) {
  const radians = value * Math.PI / 180;
  switch (kind) {
    case "sqrt":
      if (value < 0) throw new Error("Square root needs a non-negative number.");
      return Math.sqrt(value);
    case "square": return value * value;
    case "sin": return Math.sin(radians);
    case "cos": return Math.cos(radians);
    case "tan":
      if (Math.abs(Math.cos(radians)) < 1e-12) throw new Error("Tangent is undefined at this angle.");
      return Math.tan(radians);
    default: throw new Error("Unknown function.");
  }
}

// All length factors use metres; all weight factors use kilograms.
const unitGroups = {
  length: { m: ["Metres", 1], km: ["Kilometres", 1000], cm: ["Centimetres", .01], mm: ["Millimetres", .001], ft: ["Feet", .3048], in: ["Inches", .0254] },
  weight: { kg: ["Kilograms", 1], g: ["Grams", .001], lb: ["Pounds", .45359237] },
  temperature: { C: ["Celsius", 1], F: ["Fahrenheit", 1], K: ["Kelvin", 1] }
};
function convertUnits(value, category, from, to) {
  if (category === "temperature") {
    const celsius = from === "F" ? (value - 32) * 5 / 9 : from === "K" ? value - 273.15 : value;
    return to === "F" ? celsius * 9 / 5 + 32 : to === "K" ? celsius + 273.15 : celsius;
  }
  return value * unitGroups[category][from][1] / unitGroups[category][to][1];
}
function convertCurrency(amount, rate) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a non-negative amount.");
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Enter a positive exchange rate.");
  return amount * rate;
}
function format(value) {
  if (!Number.isFinite(value)) throw new Error("The result is outside the supported range.");
  // Round display output to 12 significant digits, keeping tiny values meaningful.
  return String(Number(value.toPrecision(12)));
}

// Connect page elements to the functions above.
const get = id => document.getElementById(id);
const display = get("display");
let freshResult = false;
function report(action) {
  get("message").textContent = "";
  try { action(); } catch (error) { get("message").textContent = error.message; }
}
function showMode(mode) {
  const calculator = mode === "basic" || mode === "scientific";
  get("calculatorPanel").hidden = !calculator;
  get("scientificKeys").hidden = mode !== "scientific";
  get("angleHint").hidden = mode !== "scientific";
  get("unitsPanel").hidden = mode !== "units";
  get("currencyPanel").hidden = mode !== "currency";
  get("modeLabel").textContent = { basic: "Basic Calculator", scientific: "Scientific Mode", units: "Unit Conversion", currency: "Currency Conversion" }[mode];
  get("message").textContent = "";
  closeMenu();
}
function closeMenu() {
  get("subMenu").hidden = true;
  get("menuButton").setAttribute("aria-expanded", "false");
}
get("menuButton").addEventListener("click", () => {
  get("subMenu").hidden = !get("subMenu").hidden;
  get("menuButton").setAttribute("aria-expanded", String(!get("subMenu").hidden));
});
get("subMenu").addEventListener("click", event => {
  const button = event.target.closest("button[data-mode]");
  if (button) showMode(button.dataset.mode);
});
document.addEventListener("click", event => {
  if (!event.target.closest(".navigation")) closeMenu();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeMenu();
});
function calculate() {
  report(() => { display.value = format(evaluateExpression(display.value)); freshResult = true; });
}
get("calculatorPanel").addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  report(() => {
    if (button.dataset.value !== undefined) {
      const value = button.dataset.value;
      if ((freshResult || display.value === "0") && /^[\d.(]$/.test(value)) display.value = "";
      display.value += value;
      freshResult = false;
    } else if (button.dataset.action === "clear") {
      display.value = "0"; freshResult = false;
    } else if (button.dataset.action === "delete") {
      display.value = display.value.slice(0, -1) || "0"; freshResult = false;
    } else if (button.dataset.action === "equals") {
      calculate();
    } else if (button.dataset.function) {
      display.value = format(scientificValue(button.dataset.function, evaluateExpression(display.value)));
      freshResult = true;
    }
  });
});
display.addEventListener("input", () => { freshResult = false; get("message").textContent = ""; });
display.addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === "=") { event.preventDefault(); calculate(); }
  if (event.key === "Escape") { display.value = "0"; freshResult = false; get("message").textContent = ""; }
});

function updateUnitOptions() {
  const entries = Object.entries(unitGroups[get("unitType").value]);
  for (const id of ["unitFrom", "unitTo"]) {
    get(id).replaceChildren(...entries.map(([value, [label]]) => new Option(label, value)));
  }
  get("unitTo").selectedIndex = 1;
  get("unitResult").textContent = "";
}
get("unitType").addEventListener("change", updateUnitOptions);
for (const id of ["unitAmount", "unitFrom", "unitTo"]) {
  get(id).addEventListener("input", () => { get("unitResult").textContent = ""; });
}
get("unitForm").addEventListener("submit", event => {
  event.preventDefault();
  report(() => {
    get("unitResult").textContent = "";
    const value = get("unitAmount").valueAsNumber;
    if (!Number.isFinite(value)) throw new Error("Enter a valid value.");
    const from = get("unitFrom").value, to = get("unitTo").value;
    const answer = convertUnits(value, get("unitType").value, from, to);
    get("unitResult").textContent = `${format(value)} ${from} = ${format(answer)} ${to}`;
  });
});

function updateRateLabel() {
  const from = get("currencyFrom").value, to = get("currencyTo").value;
  const sameCurrency = from === to;
  get("rateLabel").textContent = `Exchange rate: 1 ${from} equals how many ${to}?`;
  get("exchangeRate").value = sameCurrency ? "1" : "";
  get("exchangeRate").readOnly = sameCurrency;
  get("currencyResult").textContent = "";
}
get("currencyFrom").addEventListener("change", updateRateLabel);
get("currencyTo").addEventListener("change", updateRateLabel);
for (const id of ["currencyAmount", "exchangeRate"]) {
  get(id).addEventListener("input", () => { get("currencyResult").textContent = ""; });
}
get("currencyForm").addEventListener("submit", event => {
  event.preventDefault();
  report(() => {
    get("currencyResult").textContent = "";
    const amount = get("currencyAmount").valueAsNumber;
    const answer = convertCurrency(amount, get("exchangeRate").valueAsNumber);
    get("currencyResult").textContent = `${format(amount)} ${get("currencyFrom").value} = ${format(answer)} ${get("currencyTo").value}`;
  });
});
updateUnitOptions();
updateRateLabel();
