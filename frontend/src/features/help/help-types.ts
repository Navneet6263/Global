import type { NavWorkspace } from "@/config/navigation.types";

export type HelpWorkspace = NavWorkspace | "candidate";
export type GuideQuestion = { question: string; answer: string; keywords?: string };
export type PageGuide = {
  title: string;
  purpose: string;
  steps: readonly string[];
  guardrail: string;
  questions: readonly GuideQuestion[];
};
export type GuideCatalogue = Record<string, PageGuide>;

export function guide(
  title: string,
  purpose: string,
  steps: string[],
  guardrail: string,
  questions: GuideQuestion[] = [],
): PageGuide {
  return { title, purpose, steps, guardrail, questions };
}

export function questionsFor(page: PageGuide): GuideQuestion[] {
  return [
    { question: "What is this page for?", answer: page.purpose, keywords: "why kya kaam purpose" },
    {
      question: "What should I do first?",
      answer: page.steps.map((step, index) => `${index + 1}. ${step}`).join("\n\n"),
      keywords: "start next steps kaise",
    },
    {
      question: "What should I check before acting?",
      answer: page.guardrail,
      keywords: "permission blocked disabled safety",
    },
    ...page.questions,
  ];
}
