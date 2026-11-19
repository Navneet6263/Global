import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: [
      "src/components/ui/**/*.{ts,tsx}",
      "src/components/dashboards/ui.tsx",
      "src/kit/**/*.{ts,tsx}",
    ],
    rules: {
      // These library modules intentionally colocate components with reusable
      // variants and hooks. Application components keep the stricter rule.
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // Screens moved to the new design (Task-style kit, sky theme) must stay that way:
    // small files, Tailwind classes from the kit and tokens only, no old CSS classes.
    files: [
      "src/kit/**/*.{ts,tsx}",
      "src/features/stakeholders/client/**/*.{ts,tsx}",
      "src/routes/client-portal*.tsx",
      "src/features/onboarding/ClientOnboardingPage.tsx",
    ],
    rules: {
      "max-lines": ["error", { max: 400 }],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "server-only", message: "Use a *.server.ts module instead." },
            ...[
              "@/components/ui/button",
              "@/components/ui/input",
              "@/components/ui/textarea",
              "@/components/ui/table",
              "@/components/ui/tabs",
              "@/components/ui/skeleton",
              "@/components/feedback/skeletons",
              "@/components/feedback/error-state",
              "@/components/layout/section",
              "@/components/workspace/kit",
            ].map((name) => ({ name, message: "Use the Sapling kit from @/kit instead." })),
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/(^|[\s:])(bg|text|border|ring|fill|stroke|from|to|via|outline|divide|decoration)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]/]",
          message: "Use the colour names from design/tokens.css (text-ink, bg-brand-soft ...).",
        },
        {
          selector:
            "TemplateElement[value.raw=/(^|[\s:])(bg|text|border|ring|fill|stroke|from|to|via|outline|divide|decoration)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]/]",
          message: "Use the colour names from design/tokens.css (text-ink, bg-brand-soft ...).",
        },
        {
          selector:
            "Literal[value=/(^|[\\s:])(bg|text|border|border-[trblxy]|ring|fill|stroke|from|to|via|outline|divide|decoration|placeholder)-(muted|muted-foreground|card|card-foreground|primary|primary-foreground|foreground|background|border|border-strong|secondary|secondary-foreground|accent|accent-foreground|mint|mint-soft|mint-deep|success|success-soft|success-foreground|info|info-soft|info-foreground|warning|warning-soft|warning-foreground|critical|critical-soft|critical-foreground|review|review-soft|review-foreground|neutral|neutral-soft|neutral-foreground|destructive|destructive-foreground|popover|canvas|white|black)(\\/[0-9]+)?($|\\s)/]",
          message: "Old theme colour. Use the colour names from design/tokens.css.",
        },
        {
          selector:
            "TemplateElement[value.raw=/(^|[\\s:])(bg|text|border|border-[trblxy]|ring|fill|stroke|from|to|via|outline|divide|decoration|placeholder)-(muted|muted-foreground|card|card-foreground|primary|primary-foreground|foreground|background|border|border-strong|secondary|secondary-foreground|accent|accent-foreground|mint|mint-soft|mint-deep|success|success-soft|success-foreground|info|info-soft|info-foreground|warning|warning-soft|warning-foreground|critical|critical-soft|critical-foreground|review|review-soft|review-foreground|neutral|neutral-soft|neutral-foreground|destructive|destructive-foreground|popover|canvas|white|black)(\\/[0-9]+)?($|\\s)/]",
          message: "Old theme colour. Use the colour names from design/tokens.css.",
        },
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: "No raw colours. Use the colour names from design/tokens.css.",
        },
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/(^|\s)client-[a-z]/]",
          message: "Old CSS classes are not allowed here. Use the kit and Tailwind classes.",
        },
        {
          selector:
            "JSXAttribute[name.name='className'] TemplateElement[value.raw=/(^|\s)client-[a-z]/]",
          message: "Old CSS classes are not allowed here. Use the kit and Tailwind classes.",
        },
      ],
    },
  },
  eslintPluginPrettier,
);
