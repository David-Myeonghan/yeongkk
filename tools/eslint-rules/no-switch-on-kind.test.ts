import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { describe, it } from "vitest";
import rule from "./no-switch-on-kind";

RuleTester.describe = describe;
RuleTester.it = it;

const message = "상태 분기는 ts-pattern match().exhaustive() 로 씁니다";

new RuleTester({ languageOptions: { parser: tseslint.parser, ecmaVersion: 2022, sourceType: "module" } }).run(
  "no-switch-on-kind",
  rule,
  {
    valid: [
      { code: "match(msg).with({ kind: 'a' }, () => 1).exhaustive();" },
      { code: "switch (count) { case 1: break; default: break; }" },
      { code: "switch (msg.payload) { case 1: break; }" },
      { code: "switch (msg.name) { case 'a': break; }" },
      { code: "switch (kinds.length) { case 1: break; }" },
    ],
    invalid: [
      {
        code: "switch (msg.kind) { case 'a': break; default: break; }",
        errors: [{ message }],
      },
      { code: "switch (event.type) { case 'a': break; }", errors: [{ message }] },
      { code: "switch (job.status) { case 'a': break; }", errors: [{ message }] },
      { code: "switch (msg['kind']) { case 'a': break; }", errors: [{ message }] },
      { code: "class A { #kind = 'a'; f() { switch (this.#kind) { case 'a': break; } } }", errors: [{ message }] },
      { code: "switch (msg.kind as string) { case 'a': break; }", errors: [{ message }] },
      { code: "switch (msg.kind satisfies string) { case 'a': break; }", errors: [{ message }] },
      { code: "switch (<string>msg.kind) { case 'a': break; }", errors: [{ message }] },
      { code: "switch (msg.kind!) { case 'a': break; }", errors: [{ message }] },
      { code: "switch (msg?.kind) { case 'a': break; }", errors: [{ message }] },
      { code: "switch ((msg.kind)) { case 'a': break; }", errors: [{ message }] },
      { code: "switch (`${msg.kind}`) { case 'a': break; }", errors: [{ message }] },
      { code: "switch (msg.kind ?? 'x') { case 'a': break; }", errors: [{ message }] },
      { code: "switch (fallback ?? msg.type) { case 'a': break; }", errors: [{ message }] },
      { code: "switch (msg.status || 'x') { case 'a': break; }", errors: [{ message }] },
      { code: "const { kind } = msg; switch (kind) { case 'a': break; }", errors: [{ message }] },
      { code: "switch (type) { case 'a': break; }", errors: [{ message }] },
      { code: "switch ((msg?.kind as string)!) { case 'a': break; }", errors: [{ message }] },
    ],
  },
);
