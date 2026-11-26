import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { promisify } from "node:util";
import { createTriageServer } from "./server.mjs";

test("POST /api/triage — валидация заявки", async (t) => {
  const server = createTriageServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => promisify(server.close).call(server));

  const url = `http://127.0.0.1:${server.address().port}/api/triage`;
  function post(body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  }

  const invalidCases = [
    ["пустое тело", ""],
    ["битый JSON", '{"text":'],
    ["null вместо заявки", "null"],
    ["отсутствует поле text", "{}"],
    ["text содержит null", JSON.stringify({ text: null })],
    ["text содержит число", JSON.stringify({ text: 42 })],
    ["text содержит логическое значение", JSON.stringify({ text: false })],
    ["text содержит объект", JSON.stringify({ text: {} })],
    ["text содержит массив", JSON.stringify({ text: [] })],
    ["пустая строка", JSON.stringify({ text: "" })],
    ["только пробельные символы", JSON.stringify({ text: " \t\n" })],
  ];
  for (const [name, body] of invalidCases) {
    await t.test(name, async () => {
      const response = await post(body);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { status: "invalid_input" });
    });
  }

  await t.test("корректная заявка после ошибок ввода", async () => {
    const response = await post(JSON.stringify({ text: " Когда доставка? " }));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.status, "ready");
    assert.equal(result.topic, "delivery");
  });
});
