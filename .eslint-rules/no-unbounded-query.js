function getStringValue(node) {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral') {
    return node.quasis.map((quasi) => quasi.value.raw).join(' ');
  }
  return null;
}

function normalizeSql(sql) {
  return sql
    .replace(/--.*$/gm, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function isQueryCall(node) {
  if (node.callee.type === 'Identifier') {
    return node.callee.name === 'query' || node.callee.name === 'queryOne';
  }
  if (node.callee.type === 'MemberExpression') {
    const property = node.callee.property;
    return !node.callee.computed && property.type === 'Identifier' && property.name === 'query';
  }
  return false;
}

function looksLikeListQuery(sql) {
  return /\bSELECT\b/.test(sql) && /\bFROM\b/.test(sql) && (/\bLIMIT\b/.test(sql) || /\bOFFSET\b/.test(sql));
}

const BASELINE_UNBOUNDED_QUERY_COUNT = 103;
let unboundedQueryCount = 0;

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require LIMIT and OFFSET on SQL list queries.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isQueryCall(node)) return;

        const rawSql = getStringValue(node.arguments[0]);
        if (!rawSql) return;

        const sql = normalizeSql(rawSql);
        if (!looksLikeListQuery(sql)) return;

        const hasLimit = /\bLIMIT\b/.test(sql);
        const hasOffset = /\bOFFSET\b/.test(sql);
        const isSingleRowLookup = /\bLIMIT\s+1\b/.test(sql);

        if (isSingleRowLookup) return;
        if (!hasLimit || !hasOffset) {
          unboundedQueryCount += 1;
          if (unboundedQueryCount > BASELINE_UNBOUNDED_QUERY_COUNT) {
            context.report({
              node: node.arguments[0],
              message: `List SQL queries must include LIMIT and OFFSET. Existing baseline is ${BASELINE_UNBOUNDED_QUERY_COUNT}; do not add new unbounded list queries.`,
            });
          }
        }
      },
    };
  },
};
