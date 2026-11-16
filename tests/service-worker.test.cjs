const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function worker({ fetch = async () => new Response("asset"), caches = {} } = {}) {
  const listeners = {};
  vm.runInNewContext(fs.readFileSync(require.resolve("../service-worker.js"), "utf8"), {
    self: { location: { origin: "https://perfi.test" }, addEventListener: (name, handler) => { listeners[name] = handler; } },
    URL, fetch, caches,
  });
  return listeners;
}

test("video and partial requests bypass the service worker cache", () => {
  const listeners = worker();
  for (const request of [
    { destination: "video", headers: new Headers() },
    { destination: "", headers: new Headers({ Range: "bytes=0-1023" }) },
  ]) {
    listeners.fetch({ request: { method: "GET", url: "https://perfi.test/public/clip.mp4", ...request },
      respondWith: () => assert.fail("Video requests must use the browser network stack") });
  }
});

test("cache storage errors do not discard successful responses", async () => {
  const listeners = worker({ caches: { open: async () => ({ put: async () => { throw new Error("quota exceeded"); } }) } });
  let result;
  listeners.fetch({ request: new Request("https://perfi.test/styles.css"), respondWith: value => { result = value; } });
  assert.equal(await (await result).text(), "asset");
});

test("offline About navigation returns its own cached page", async () => {
  let matched;
  const listeners = worker({ fetch: async () => { throw new Error("offline"); },
    caches: { match: async path => { matched = path; return new Response("About Perfi"); } } });
  let result;
  listeners.fetch({ request: { method: "GET", url: "https://perfi.test/about.html", headers: new Headers(), mode: "navigate" },
    respondWith: value => { result = value; } });
  assert.equal(await (await result).text(), "About Perfi");
  assert.equal(matched, "./about.html");
});

test("protected offline pages never fall back to a cached dashboard", async () => {
  let matched;
  const listeners = worker({ fetch: async () => { throw new Error("offline"); },
    caches: { match: async path => { matched = path; return new Response("Reconnect"); } } });
  let result;
  listeners.fetch({ request: { method: "GET", url: "https://perfi.test/dashboard", headers: new Headers(), mode: "navigate" },
    respondWith: value => { result = value; } });
  assert.equal(await (await result).text(), "Reconnect");
  assert.equal(matched, "./offline.html");
});
