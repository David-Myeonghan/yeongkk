const TAGS = new Set(["kind", "type", "status"]);

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
        const d = node.discriminant;
        if (d.type !== "MemberExpression") return;
        const name = d.computed
          ? d.property.type === "Literal" && typeof d.property.value === "string"
            ? d.property.value
            : undefined
          : d.property.name;
        if (name !== undefined && TAGS.has(name)) {
          context.report({ node, messageId: "noSwitch" });
        }
      },
    };
  },
};
