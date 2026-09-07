import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronRight, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { usePageHelp } from "./help-state";
import { questionsFor, type GuideQuestion } from "./help-types";

export default function HelpConversation() {
  const help = usePageHelp()!;
  const [search, setSearch] = useState("");
  const [conversation, setConversation] = useState<GuideQuestion[]>([]);
  const latest = useRef<HTMLDivElement>(null);
  const topics = help.guide ? questionsFor(help.guide) : [];
  const filtered = topics.filter((topic) =>
    `${topic.question} ${topic.answer} ${topic.keywords ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  useEffect(() => {
    latest.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [conversation]);

  const ask = (topic: GuideQuestion) => {
    setConversation((current) => [...current.slice(-5), topic]);
    setSearch("");
  };
  return (
    <>
      <div className="flex shrink-0 items-center gap-3 border-b bg-emerald-50/50 px-5 py-3">
        <BookOpen className="size-4 text-emerald-700" aria-hidden />
        <label htmlFor="page-learning-mode" className="flex-1 cursor-pointer">
          <span className="block text-sm font-medium">Learning mode</span>
          <span className="text-xs text-muted-foreground">Page hints and sidebar explanations</span>
        </label>
        <Switch id="page-learning-mode" checked={help.enabled} onCheckedChange={help.setEnabled} />
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <div className="rounded-2xl rounded-tl-sm bg-secondary/70 p-4 text-sm leading-6">
          {help.guide?.purpose ?? help.purpose}
          <p className="mt-2 text-xs text-muted-foreground">
            Choose a question below. This is an authored guide, not an AI assistant or live support
            chat.
          </p>
        </div>
        {help.error ? (
          <div role="alert" className="text-sm">
            The guide could not load. Your work is unaffected.{" "}
            <Button variant="link" onClick={help.retry}>
              Retry guide
            </Button>
          </div>
        ) : null}
        {!help.guide && !help.error ? (
          <p role="status" className="text-xs text-muted-foreground">
            Loading topics…
          </p>
        ) : null}
        <div
          role="log"
          aria-label="Page help conversation"
          aria-live="polite"
          aria-relevant="additions"
          className="space-y-4"
        >
          {conversation.map((topic, index) => (
            <div key={`${index}:${topic.question}`} className="space-y-2">
              <p className="ml-6 rounded-2xl rounded-tr-sm bg-emerald-100 px-4 py-3 text-sm text-emerald-950">
                <span className="sr-only">Your question: </span>
                {topic.question}
              </p>
              <p className="mr-2 whitespace-pre-line rounded-2xl rounded-tl-sm bg-secondary/70 px-4 py-3 text-sm leading-6">
                <span className="sr-only">Page guide: </span>
                {topic.answer}
              </p>
            </div>
          ))}
        </div>
        <div ref={latest} />
        <div className="space-y-2">
          <label htmlFor="page-help-search" className="text-xs font-medium">
            Find a help topic
          </label>
          <div className="relative">
            <Search className="absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden />
            <Input
              id="page-help-search"
              className="pl-9"
              placeholder="e.g. first step, consent, branch"
              value={search}
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {filtered.map((topic) => (
            <button
              type="button"
              key={topic.question}
              onClick={() => ask(topic)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left text-xs leading-5 transition-colors hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600"
            >
              {topic.question}
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          ))}
          {help.guide && !filtered.length ? (
            <p className="rounded-xl bg-secondary/60 p-3 text-xs leading-5">
              No matching topic on this page. Try another word, or ask your manager/administrator
              for help with this specific case. Do not paste private candidate details here.
            </p>
          ) : null}
        </div>
      </div>
      <p className="flex shrink-0 items-start gap-2 border-t px-5 py-3 text-[11px] leading-5 text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Help stays in this browser. No candidate records, passwords or OTPs are requested or sent to
        a chat service.
      </p>
    </>
  );
}
