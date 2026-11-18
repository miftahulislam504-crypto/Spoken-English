import { ApiError } from './http.js';
const bad = (d) => { throw new ApiError(400, 'invalid_input', undefined, d); };
export const obj = (x, name) => (x && typeof x === 'object' && !Array.isArray(x) ? x : bad(`${name} must be an object`));
export const str = (x, name, { max = 200, min = 0 } = {}) => (typeof x === 'string' && x.length >= min && x.length <= max ? x : bad(`${name} is invalid`));
export const int = (x, name, min, max) => (Number.isInteger(x) && x >= min && x <= max ? x : bad(`${name} is invalid`));
export const num = (x, name, min, max) => (typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? x : bad(`${name} is invalid`));
export const bool = (x, name) => (typeof x === 'boolean' ? x : bad(`${name} must be true or false`));
export const oneOf = (x, name, list) => (list.includes(x) ? x : bad(`${name} is invalid`));
export const id = (x) => (typeof x === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(x) ? x : bad('id is invalid'));
export const date = (x, name) => {
  if (x === null || x === undefined) return null;
  const t = typeof x === 'string' ? Date.parse(x) : NaN;
  return Number.isNaN(t) ? bad(`${name} is invalid`) : new Date(t).toISOString();
};
