/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ConfigItem } from '../../shared/types.js';

const ALLOWED_FUNCTIONS = ['empty', 'notEmpty', 'contains', 'startsWith', 'endsWith', 'length', 'matches'];

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const char = expr[i];
    if (char === ' ') {
      i++;
      continue;
    }
    if (char === '(' || char === ')') {
      tokens.push(char);
      i++;
      continue;
    }
    if (char === '!' && expr[i + 1] === '=') {
      tokens.push('!=');
      i += 2;
      continue;
    }
    if (char === '!' && expr[i + 1] !== '=') {
      tokens.push('!');
      i++;
      continue;
    }
    if (char === '=' && expr[i + 1] === '=') {
      tokens.push('==');
      i += 2;
      continue;
    }
    if (char === '>' && expr[i + 1] === '=') {
      tokens.push('>=');
      i += 2;
      continue;
    }
    if (char === '<' && expr[i + 1] === '=') {
      tokens.push('<=');
      i += 2;
      continue;
    }
    if (char === '>' && expr[i + 1] !== '=') {
      tokens.push('>');
      i++;
      continue;
    }
    if (char === '<' && expr[i + 1] !== '=') {
      tokens.push('<');
      i++;
      continue;
    }
    if (char === '&' && expr[i + 1] === '&') {
      tokens.push('&&');
      i += 2;
      continue;
    }
    if (char === '|' && expr[i + 1] === '|') {
      tokens.push('||');
      i += 2;
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      let j = i + 1;
      let str = '';
      while (j < expr.length && expr[j] !== quote) {
        if (expr[j] === '\\' && j + 1 < expr.length) {
          str += expr[j + 1];
          j += 2;
        } else {
          str += expr[j];
          j++;
        }
      }
      tokens.push(`"${str}"`);
      i = j + 1;
      continue;
    }
    if (/[a-zA-Z_$]/.test(char)) {
      let j = i;
      while (j < expr.length && /[a-zA-Z0-9_$.]/.test(expr[j])) {
        j++;
      }
      tokens.push(expr.slice(i, j));
      i = j;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let j = i;
      while (j < expr.length && /[0-9.]/.test(expr[j])) {
        j++;
      }
      tokens.push(expr.slice(i, j));
      i = j;
      continue;
    }
    throw new Error(`Unexpected character: ${char} at position ${i}`);
  }
  return tokens;
}

function getConfigValue(configs: ConfigItem[], key: string): string {
  const item = configs.find((c) => c.key === key);
  return item?.value ?? '';
}

function parseValue(token: string, configs: ConfigItem[]): any {
  if (token.startsWith('"') && token.endsWith('"')) {
    return token.slice(1, -1);
  }
  if (!isNaN(Number(token)) && token !== '') {
    return Number(token);
  }
  if (token === 'true') return true;
  if (token === 'false') return false;
  if (token === 'null') return null;
  if (token === 'undefined') return undefined;
  return getConfigValue(configs, token);
}

function callFunction(name: string, args: any[]): any {
  switch (name) {
    case 'empty':
      return !args[0] || String(args[0]).length === 0;
    case 'notEmpty':
      return !!args[0] && String(args[0]).length > 0;
    case 'contains':
      return String(args[0] ?? '').includes(String(args[1] ?? ''));
    case 'startsWith':
      return String(args[0] ?? '').startsWith(String(args[1] ?? ''));
    case 'endsWith':
      return String(args[0] ?? '').endsWith(String(args[1] ?? ''));
    case 'length':
      return String(args[0] ?? '').length;
    case 'matches':
      try {
        return new RegExp(String(args[1] ?? '')).test(String(args[0] ?? ''));
      } catch {
        return false;
      }
    default:
      throw new Error(`Unknown function: ${name}`);
  }
}

export function evaluateCondition(condition: string, configs: ConfigItem[]): boolean {
  if (!condition || !condition.trim()) {
    return true;
  }

  const tokens = tokenize(condition);
  let pos = 0;

  function peek(): string | undefined {
    return tokens[pos];
  }

  function consume(): string | undefined {
    return tokens[pos++];
  }

  function parseExpression(): any {
    return parseOr();
  }

  function parseOr(): any {
    let left = parseAnd();
    while (peek() === '||') {
      consume();
      const right = parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  function parseAnd(): any {
    let left = parseUnary();
    while (peek() === '&&') {
      consume();
      const right = parseUnary();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  function parseUnary(): any {
    if (peek() === '!') {
      consume();
      const operand = parseUnary();
      return !operand;
    }
    return parseComparison();
  }

  function parseComparison(): any {
    const left = parsePrimary();
    const op = peek();
    if (op === '==' || op === '!=' || op === '>' || op === '<' || op === '>=' || op === '<=') {
      consume();
      const right = parsePrimary();
      switch (op) {
        case '==':
          return left == right;
        case '!=':
          return left != right;
        case '>':
          return left > right;
        case '<':
          return left < right;
        case '>=':
          return left >= right;
        case '<=':
          return left <= right;
      }
    }
    return left;
  }

  function parsePrimary(): any {
    const token = consume();
    if (token === undefined) {
      throw new Error('Unexpected end of expression');
    }
    if (token === '(') {
      const result = parseExpression();
      if (consume() !== ')') {
        throw new Error('Expected closing parenthesis');
      }
      return result;
    }
    if (ALLOWED_FUNCTIONS.includes(token) && peek() === '(') {
      consume();
      const args: any[] = [];
      if (peek() !== ')') {
        args.push(parseExpression());
        while (peek() === ',') {
          consume();
          args.push(parseExpression());
        }
      }
      if (consume() !== ')') {
        throw new Error('Expected closing parenthesis for function call');
      }
      return callFunction(token, args);
    }
    return parseValue(token, configs);
  }

  try {
    const result = parseExpression();
    return Boolean(result);
  } catch {
    return false;
  }
}

export function validateCondition(condition: string): { valid: boolean; error?: string } {
  if (!condition || !condition.trim()) {
    return { valid: true };
  }
  try {
    tokenize(condition);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Invalid condition' };
  }
}
