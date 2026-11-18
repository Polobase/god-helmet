import { expect, test } from "bun:test";
import { deriveNamespace, TOOLCHAIN_NAMESPACE, UUID_V5_RE, uuidv5 } from "./uuid.ts";

test("matches the RFC 4122 v5 reference vector", () => {
  // Python: uuid.uuid5(uuid.NAMESPACE_DNS, "python.org") == 886313e1-3b8a-5372-9b90-0c9aee199e5d
  expect(uuidv5("python.org", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe("886313e1-3b8a-5372-9b90-0c9aee199e5d");
});

test("repo namespace is derived as documented", () => {
  expect(deriveNamespace()).toBe(TOOLCHAIN_NAMESPACE);
});

test("deterministic, version 5, distinct per name", () => {
  const a = uuidv5("proof/part/amp/unit/1");
  expect(a).toMatch(UUID_V5_RE);
  expect(uuidv5("proof/part/amp/unit/1")).toBe(a);
  expect(uuidv5("proof/part/amp/unit/2")).not.toBe(a);
});
