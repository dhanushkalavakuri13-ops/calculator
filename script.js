"use strict";

const expressionElement = document.querySelector("#expression");
const resultElement = document.querySelector("#result");
const keypad = document.querySelector("#keypad");
const angleToggle = document.querySelector("#angle-toggle");
const angleLabel = document.querySelector("#angle-label");
const historyList = document.querySelector("#history-list");
const toastElement = document.querySelector("#toast");

let expression = "";
let result = 0;
let justCalculated = false;
let angleMode = "DEG";
let history = [];
let toastTimer;

try {
  const storedHistory = localStorage.getItem("orbit-calculator-history");
  if (storedHistory) {
    const parsedHistory = JSON.parse(storedHistory);
    if (Array.isArray(parsedHistory)) {
      history = parsedHistory
        .filter((item) => typeof item.expression === "string" && typeof item.result === "string")
        .slice(0, 8);
    }
  }
} catch (error) {
  console.error("Unable to load calculator history.", error);
}
renderHistory();

keypad.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const { action, value } = button.dataset;
  if (action) {
    handleAction(action);
  } else if (value !== undefined) {
    appendValue(value);
  }
});

angleToggle.addEventListener("click", () => {
  angleMode = angleMode === "DEG" ? "RAD" : "DEG";
  angleLabel.textContent = angleMode;
  angleToggle.setAttribute("aria-label", `Angle mode: ${angleMode === "DEG" ? "degrees" : "radians"}`);
  updatePreview();
});

document.querySelector("#clear-history").addEventListener("click", () => {
  history = [];
  saveHistory();
  renderHistory();
  showToast("History cleared");
});

document.querySelector("#copy-button").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(String(result));
    showToast("Result copied");
  } catch (error) {
    console.error("Unable to copy calculator result.", error);
    showToast("Clipboard access unavailable");
  }
});

historyList.addEventListener("click", (event) => {
  const item = event.target.closest(".history-item");
  if (!item) return;
  expression = item.dataset.expression;
  result = Number(item.dataset.result);
  justCalculated = true;
  renderDisplay(formatResult(result), expression);
});

document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "Enter" || event.key === "=") {
    event.preventDefault();
    handleAction("calculate");
  } else if (event.key === "Escape") {
    handleAction("clear");
  } else if (event.key === "Backspace") {
    event.preventDefault();
    handleAction("backspace");
  } else if (/^[0-9.]$/.test(event.key)) {
    appendValue(event.key);
  } else if (["+", "-", "*", "/", "^", "(", ")", "%", "!"].includes(event.key)) {
    appendValue(({ "*": "×", "/": "÷", "-": "−" })[event.key] || event.key);
  }
});

function appendValue(value) {
  const startsNewExpression = /^[0-9.]$/.test(value)
    || ["pi", "e", "(", "sin(", "cos(", "tan(", "asin(", "acos(", "atan(", "sqrt(", "log(", "ln("].includes(value);
  if (justCalculated && startsNewExpression) {
    expression = "";
  }
  justCalculated = false;

  if (value === "^2") {
    expression += "^2";
  } else {
    expression += value;
  }
  updatePreview();
}

function handleAction(action) {
  if (action === "calculate") {
    calculate();
  } else if (action === "clear") {
    expression = "";
    result = 0;
    justCalculated = false;
    renderDisplay("0", "Ready when you are");
  } else if (action === "clear-entry") {
    expression = "";
    justCalculated = false;
    renderDisplay("0", "Entry cleared");
  } else if (action === "backspace") {
    expression = expression.slice(0, -1);
    justCalculated = false;
    updatePreview();
  } else if (action === "sign") {
    if (expression) {
      expression = `−(${expression})`;
    } else {
      expression = "−";
    }
    justCalculated = false;
    updatePreview();
  } else if (action === "square-root") {
    if (expression) {
      expression = `sqrt(${expression})`;
    } else {
      expression = "sqrt(";
    }
    justCalculated = false;
    updatePreview();
  }
}

function updatePreview() {
  if (!expression) {
    renderDisplay("0", "Ready when you are");
    return;
  }
  expressionElement.textContent = expression;
  try {
    const value = evaluateExpression(expression, angleMode);
    result = value;
    renderResult(formatResult(value), false);
  } catch {
    renderResult("…", false);
  }
}

function calculate() {
  if (!expression.trim()) return;
  const currentExpression = expression;
  try {
    const value = evaluateExpression(currentExpression, angleMode);
    result = value;
    justCalculated = true;
    const formatted = formatResult(value);
    renderDisplay(formatted, currentExpression);
    history.unshift({ expression: currentExpression, result: formatted });
    history = history.slice(0, 8);
    saveHistory();
    renderHistory();
  } catch (error) {
    resultElement.textContent = error.message;
    resultElement.classList.add("is-error");
    expressionElement.textContent = currentExpression;
    justCalculated = false;
  }
}

function renderDisplay(value, currentExpression) {
  expressionElement.textContent = currentExpression;
  renderResult(value, true);
}

function renderResult(value, animate) {
  resultElement.textContent = value;
  resultElement.classList.remove("is-error", "updated");
  if (animate) {
    void resultElement.offsetWidth;
    resultElement.classList.add("updated");
  }
}

function formatResult(value) {
  if (!Number.isFinite(value)) throw new Error("Result is not finite");
  const normalized = Math.abs(value) < 1e-12 ? 0 : value;
  return Number(normalized.toPrecision(12)).toString();
}

function saveHistory() {
  try {
    localStorage.setItem("orbit-calculator-history", JSON.stringify(history));
  } catch (error) {
    console.error("Unable to save calculator history.", error);
    showToast("Could not save history");
  }
}

function renderHistory() {
  historyList.replaceChildren();
  if (history.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.innerHTML = '<span class="history-empty-icon" aria-hidden="true">↗</span><p>Your calculations will<br />show up here.</p>';
    historyList.append(empty);
    return;
  }

  for (const item of history) {
    const button = document.createElement("button");
    button.className = "history-item";
    button.type = "button";
    button.dataset.expression = item.expression;
    button.dataset.result = item.result;
    const expressionText = document.createElement("span");
    expressionText.className = "history-expression";
    expressionText.textContent = item.expression;
    const resultText = document.createElement("span");
    resultText.className = "history-result";
    resultText.textContent = `= ${item.result}`;
    button.append(expressionText, resultText);
    historyList.append(button);
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toastElement.textContent = message;
  toastElement.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toastElement.classList.remove("is-visible"), 1900);
}

function evaluateExpression(source, mode) {
  const normalized = source
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-")
    .replaceAll("π", "pi");
  const tokens = tokenize(normalized);
  let position = 0;
  const peek = () => tokens[position];
  const consume = () => tokens[position++];
  const expect = (value) => {
    if (consume() !== value) throw new Error("Incomplete expression");
  };

  function parseExpression() {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  function parseTerm() {
    let value = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const operator = consume();
      const right = parseUnary();
      if (operator === "/" && right === 0) throw new Error("Cannot divide by zero");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseUnary() {
    if (peek() === "+") {
      consume();
      return parseUnary();
    }
    if (peek() === "-") {
      consume();
      return -parseUnary();
    }
    return parsePower();
  }

  function parsePower() {
    let value = parsePostfix();
    if (peek() === "^") {
      consume();
      value **= parseUnary();
    }
    return value;
  }

  function parsePostfix() {
    let value = parsePrimary();
    while (peek() === "!" || peek() === "%") {
      const operator = consume();
      if (operator === "!") {
        if (!Number.isInteger(value) || value < 0 || value > 170) {
          throw new Error("Factorial needs a whole number from 0 to 170");
        }
        let factorial = 1;
        for (let index = 2; index <= value; index++) factorial *= index;
        value = factorial;
      } else {
        value /= 100;
      }
    }
    return value;
  }

  function parsePrimary() {
    const token = consume();
    if (token === undefined) throw new Error("Incomplete expression");
    if (token === "(") {
      const value = parseExpression();
      expect(")");
      return value;
    }
    if (token.type === "number") return Number(token.value);
    if (token.type === "constant") return token.value === "pi" ? Math.PI : Math.E;
    if (token.type === "identifier") {
      expect("(");
      const argument = parseExpression();
      expect(")");
      return applyFunction(token.value, argument, mode);
    }
    throw new Error("Check your expression");
  }

  if (tokens.length === 0) throw new Error("Enter an expression");
  const value = parseExpression();
  if (position !== tokens.length) throw new Error("Check your expression");
  if (!Number.isFinite(value)) throw new Error("Result is not finite");
  return value;
}

function tokenize(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const remainder = source.slice(index);
    const numberMatch = remainder.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (numberMatch) {
      tokens.push({ type: "number", value: numberMatch[0] });
      index += numberMatch[0].length;
      continue;
    }

    const wordMatch = remainder.match(/^[a-z]+/i);
    if (wordMatch) {
      const word = wordMatch[0].toLowerCase();
      if (word === "pi" || word === "e") {
        tokens.push({ type: "constant", value: word });
      } else if (["sin", "cos", "tan", "asin", "acos", "atan", "sqrt", "ln", "log"].includes(word)) {
        tokens.push({ type: "identifier", value: word });
      } else {
        throw new Error("Unknown function or constant");
      }
      index += wordMatch[0].length;
      continue;
    }

    const character = source[index];
    if ("+-*/^()%!".includes(character)) {
      tokens.push(character);
      index++;
      continue;
    }
    if (/\s/.test(character)) {
      index++;
      continue;
    }
    throw new Error("Check your expression");
  }
  return tokens;
}

function applyFunction(name, value, mode) {
  const toRadians = mode === "DEG" ? (angle) => (angle * Math.PI) / 180 : (angle) => angle;
  const fromRadians = mode === "DEG" ? (angle) => (angle * 180) / Math.PI : (angle) => angle;
  const functions = {
    sin: () => Math.sin(toRadians(value)),
    cos: () => Math.cos(toRadians(value)),
    tan: () => {
      const angle = toRadians(value);
      if (Math.abs(Math.cos(angle)) < 1e-12) throw new Error("Tangent is undefined here");
      return Math.tan(angle);
    },
    asin: () => fromRadians(Math.asin(value)),
    acos: () => fromRadians(Math.acos(value)),
    atan: () => fromRadians(Math.atan(value)),
    sqrt: () => {
      if (value < 0) throw new Error("Square root needs a non-negative number");
      return Math.sqrt(value);
    },
    ln: () => {
      if (value <= 0) throw new Error("Logarithm needs a positive number");
      return Math.log(value);
    },
    log: () => {
      if (value <= 0) throw new Error("Logarithm needs a positive number");
      return Math.log10(value);
    },
  };
  const result = functions[name]();
  if (!Number.isFinite(result)) throw new Error("Check the function's input");
  return result;
}
