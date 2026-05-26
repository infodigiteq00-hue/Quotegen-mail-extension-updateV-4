import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { RECORD_CATEGORIES, type RecordCategoryId } from "@/lib/workflow";

export function RecordCategoryTabs({
  active,
  counts,
  onChange,
  className,
}: {
  active: RecordCategoryId;
  counts: Record<RecordCategoryId, number>;
  onChange: (id: RecordCategoryId) => void;
  className?: string;
}) {
  return (
    <Tabs
      value={active}
      onValueChange={(v) => onChange(v as RecordCategoryId)}
      className={cn("w-full", className)}
    >
      <div className="w-full border-b border-border/60 bg-muted/25">
        <TabsList
          className={cn(
            "flex h-12 w-full min-w-0 items-stretch justify-stretch gap-0",
            "rounded-none bg-transparent p-0"
          )}
        >
          {RECORD_CATEGORIES.map((cat) => {
            const n = counts[cat.id] ?? 0;
            return (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className={cn(
                  "group relative flex-1 min-w-0 rounded-none border-0 px-0 py-0",
                  "shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0",
                  "border-r border-border/50 last:border-r-0",
                  "transition-all duration-200 ease-out",
                  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none",
                  "data-[state=inactive]:bg-muted/50 data-[state=inactive]:text-muted-foreground",
                  "data-[state=inactive]:hover:bg-muted/80 data-[state=inactive]:hover:text-foreground"
                )}
              >
                <span className="flex w-full items-center justify-center gap-1.5 py-3 text-[13px] font-medium tracking-[-0.015em]">
                  <span className="truncate">{cat.shortLabel}</span>
                  <span
                    className={cn(
                      "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1.5",
                      "text-[10px] font-semibold tabular-nums transition-colors duration-200",
                      "group-data-[state=active]:bg-primary-foreground/20 group-data-[state=active]:text-primary-foreground",
                      "group-data-[state=inactive]:bg-background/70 group-data-[state=inactive]:text-muted-foreground",
                      n === 0 && "opacity-40"
                    )}
                  >
                    {n}
                  </span>
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
    </Tabs>
  );
}
