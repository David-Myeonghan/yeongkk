const TAGS = new Set(["kind", "type", "status"]);
const WRAPPERS = new Set(["TSAsExpression", "TSSatisfiesExpression", "TSTypeAssertion", "TSNonNullExpression"]);

function wrapped(node) {
  if (!WRAPPERS.has(node.type)) return undefined;
  return node.expression;
}

function memberName(node) {
  const p = node.property;
  if (node.computed) return p.type === "Literal" && typeof p.value === "string" ? p.value : undefined;
  return p.type === "Identifier" || p.type === "PrivateIdentifier" ? p.name : undefined;
}

function isTagged(node) {
  const inner = wrapped(node);
  if (inner !== undefined) return isTagged(inner);
  if (node.type === "ChainExpression") return isTagged(node.expression);
  if (node.type === "MemberExpression") {
    const name = memberName(node);
    return name !== undefined && TAGS.has(name);
  }
  if (node.type === "Identifier") return TAGS.has(node.name);
  if (node.type === "TemplateLiteral") {
    const [only] = node.expressions;
    return node.expressions.length === 1 && node.quasis.every((q) => q.value.raw === "") && only !== undefined && isTagged(only);
  }
  if (node.type === "LogicalExpression") {
    return (node.operator === "??" || node.operator === "||") && (isTagged(node.left) || isTagged(node.right));
  }
  return false;
}

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      noSwitch: "상태 분기는 ts-pattern match().exhaustive() 로 씁니다",
    },
  },
  create(context) {
    return {
      SwitchStatement(node) {
        if (isTagged(node.discriminant)) context.report({ node, messageId: "noSwitch" });
      },
    };
  },
};
