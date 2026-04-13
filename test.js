const handler = require("./api/index.js");

const req = {};
const res = {
  statusCode: null,
  headers: {},
  body: null,
  setHeader(k, v) { this.headers[k] = v; },
  status(code) { this.statusCode = code; return this; },
  send(body) { console.log(`Status: ${this.statusCode}`); console.log(`Body: ${body}`); },
  json(body) { console.log(`Status: ${this.statusCode}`); console.log(`Body:`, JSON.stringify(body)); },
};

handler(req, res).catch(console.error);
