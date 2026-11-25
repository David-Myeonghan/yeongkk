const UNSAFE = /[\u2028\u2029<]/g;

export function receiveScript(reply: string): string {
  const literal = JSON.stringify(reply).replace(UNSAFE, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return `window.__YK_BRIDGE__&&window.__YK_BRIDGE__.receive(${literal});true;`;
}
