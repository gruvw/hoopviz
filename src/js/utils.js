export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getRandomThree(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 3);
}

/**
 * Returns a new array with the first element moved to the end.
 * @param {Array} list
 */
const rotate1 = (list) => {
  if (list.length <= 1) return [...list];
  const [first, ...rest] = list;
  return [...rest, first];
}

/**
 * @param {Array} mustInclude - Elements that must be in the result.
 * @param {Array} pool - Elements to draw from if more are needed.
 * @param {number} desiredLength - The target length of the final list.
 *
 * @returns the end of the result, without `mustInclude`
 */
export function listWith(mustInclude, pool, desiredLength) {
  const result = [...mustInclude];

  if (result.length >= desiredLength) return [];

  const available = pool.filter(item => !result.includes(item));

  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  const needed = desiredLength - result.length;
  return available.slice(0, needed);
}

export function makeList(mustInclude, tail) {
  return rotate1(mustInclude.concat(tail));
}
