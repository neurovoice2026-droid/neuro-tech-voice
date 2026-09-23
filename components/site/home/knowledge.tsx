import { Frame, PillLink } from "@/components/site/product/primitives";
import { HOME, KB_THRESHOLD } from "@/lib/pages/home";
import { cn } from "@/lib/utils";
import { HomeHeading } from "./heading";
import { KnowledgeStage } from "./knowledge-stage";
import { TYPE } from "./type";
import "./knowledge.css";

/* ------------------------------------------------------------------ *
 * #knowledge — will it know my prices, and what happens when it doesn't?
 *
 * A server component: the heading, the honest line under the stage and
 * a plain list of every question and answer for assistive tech (the
 * stage itself is a picture, hidden from it). Only the copy the stage
 * shows is handed to the client, so the rest of the site's copy never
 * reaches its chunk.
 * ------------------------------------------------------------------ */

export function Knowledge() {
  const k = HOME.kb;
  const docName = (id: string | null) => k.room.docs.find((d) => d.id === id)?.name;

  return (
    <section id="knowledge" aria-labelledby="knowledge-title" className="scroll-mt-28">
      <Frame>
        <HomeHeading
          id="knowledge-title"
          align="center"
          eyebrow={k.eyebrow}
          title={k.title}
          sub={k.sub}
          action={
            <PillLink href={k.link.href} variant="secondary" size="sm">
              {k.link.label}
            </PillLink>
          }
        />

        <div className="sr-only">
          <h3>{k.room.sample}</h3>
          <ul>
            {k.questions.map((q) => {
              const doc = docName(q.doc);
              return (
                <li key={q.id}>
                  {k.room.caller}: {q.ask} {k.room.agent}: {q.answer} (
                  {doc ? `${k.room.foundIn} ${doc}` : k.room.missingOutcome})
                </li>
              );
            })}
          </ul>
        </div>

        <KnowledgeStage
          room={k.room}
          questions={k.questions}
          sequence={k.sequence}
          threshold={KB_THRESHOLD}
          className="mt-10 lg:mt-12"
        />

        <div className="mt-6 flex flex-col items-center text-center">
          <p className={TYPE.body}>{k.limits.title}</p>
          <p className={cn(TYPE.meta, "mt-1 max-w-[560px] text-pretty")}>{k.limits.honest}</p>
        </div>
      </Frame>
    </section>
  );
}
