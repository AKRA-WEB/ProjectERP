// Detects Thai unicode in JSX/string/template literals.
// Exempt: *Th data props (nameTh, labelTh, etc.) and lib/i18n/ files.
const THAI_RE = /[฀-๿]/;
const WHITELISTED_KEYS = new Set([
  'nameTh', 'labelTh', 'valueTh', 'descriptionTh', 'shortNameTh',
  'titleTh', 'name_th', 'label_th', 'value_th', 'description_th',
]);

function hasThai(str) {
  return THAI_RE.test(str);
}

function isWhitelistedProp(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (parent.type === 'Property') {
    const key = parent.key;
    if (key && key.type === 'Identifier' && WHITELISTED_KEYS.has(key.name)) return true;
  }
  return false;
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow hardcoded Thai text — use t() from @/lib/i18n' },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename();
    // Exempt translation source files and PDF legal form routes
    if (
      filename.includes('lib/i18n/') ||
      filename.includes('.eslint-rules/') ||
      filename.endsWith('.pdf/route.tsx') ||
      filename.endsWith('.pdf\\route.tsx')
    ) {
      return {};
    }

    return {
      JSXText(node) {
        if (hasThai(node.value)) {
          context.report({ node, message: 'Hardcoded Thai text. Use t("key") from @/lib/i18n.' });
        }
      },
      Literal(node) {
        if (typeof node.value === 'string' && hasThai(node.value) && !isWhitelistedProp(node)) {
          context.report({ node, message: 'Hardcoded Thai text. Use t("key") from @/lib/i18n.' });
        }
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          if (hasThai(quasi.value.raw) && !isWhitelistedProp(node)) {
            context.report({ node: quasi, message: 'Hardcoded Thai text. Use t("key") from @/lib/i18n.' });
            break;
          }
        }
      },
    };
  },
};
