import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import rule from "./no-switch-on-kind.js";

RuleTester.describe = describe;
RuleTester.it = it;

const message = "상태 분기는 ts-pattern match().exhaustive() 로 씁니다";

new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } }).run(
  "no-switch-on-kind",
  rule,
  {
    valid: [
      { code: "match(msg).with({ kind: 'a' }, () => 1).exhaustive();" },
      { code: "switch (count) { case 1: break; default: break; }" },
      { code: "switch (msg.payload) { case 1: break; }" },
    ],
    invalid: [
      {
        code: "switch (msg.kind) { case 'a': break; default: break; }",
        errors: [{ message }],
      },
      { code: "switch (event.type) { case 'a': break; }", errors: [{ message }] },
      { code: "switch (job.status) { case 'a': break; }", errors: [{ message }] },
    ],
  },
);
