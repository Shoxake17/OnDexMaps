import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    rules: {
      // Matn o'zbekcha — apostrof (ko'p so'zda) HTML entity bilan yozish
      // o'qishni qiyinlashtiradi va hech qanday xavfsizlik foydasi yo'q.
      "react/no-unescaped-entities": "off",
      // Sahifa ochilganda ma'lumot yuklash (fetch-on-mount) — odatiy naqsh;
      // bu qoida Suspense/`use()` asosidagi arxitekturani talab qiladi,
      // biz hali shunga o'tmaganmiz.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
