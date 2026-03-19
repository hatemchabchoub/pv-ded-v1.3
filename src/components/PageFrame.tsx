import type { PropsWithChildren, ReactNode } from "react";

type PageFrameProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  description: string;
  aside?: ReactNode;
}>;

export default function PageFrame({ eyebrow, title, description, aside, children }: PageFrameProps) {
  return (
    <section className="space-y-6">
      <header className="surface-elevated overflow-hidden rounded-[2rem] border border-border bg-card/90 p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            {eyebrow ? <p className="text-sm font-medium text-primary">{eyebrow}</p> : null}
            <h1 className="text-3xl font-semibold text-foreground md:text-4xl">{title}</h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
          </div>
          {aside ? <div className="shrink-0">{aside}</div> : null}
        </div>
      </header>
      {children}
    </section>
  );
}
