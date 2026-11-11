import { addMonths, isSameDay, isSameMonth, isToday } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocaleState, useTranslate } from "ra-core";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getMonthGridDays } from "@/lib/getMonthGridDays";
import { cn } from "@/lib/utils";

interface CalendarGridProps {
  selected?: Date;
  onSelect: (day: Date) => void;
}

// A Monday, to list the weekday names from Monday to Sunday
const FIRST_MONDAY = new Date(2024, 0, 1);

/** A month of days to pick from, Monday first. */
export const CalendarGrid = ({ selected, onSelect }: CalendarGridProps) => {
  const translate = useTranslate();
  const [locale] = useLocaleState();
  const [month, setMonth] = useState(() => selected ?? new Date());

  const weekdays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(
        new Date(
          FIRST_MONDAY.getFullYear(),
          FIRST_MONDAY.getMonth(),
          FIRST_MONDAY.getDate() + index,
        ),
      ),
    );
  }, [locale]);
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(month);
  const dayLabel = new Intl.DateTimeFormat(locale, { dateStyle: "full" });

  return (
    <div className="w-64 space-y-2">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setMonth((current) => addMonths(current, -1))}
          aria-label={translate("crm.date_picker.previous_month", {
            _: "Previous month",
          })}
        >
          <ChevronLeft />
        </Button>
        <span className="text-sm font-medium capitalize" aria-live="polite">
          {monthLabel}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setMonth((current) => addMonths(current, 1))}
          aria-label={translate("crm.date_picker.next_month", {
            _: "Next month",
          })}
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((weekday, index) => (
          <span
            key={index}
            aria-hidden
            className="text-xs font-medium text-muted-foreground"
          >
            {weekday}
          </span>
        ))}
        {getMonthGridDays(month).map((day) => {
          const isSelected = selected != null && isSameDay(day, selected);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              aria-label={dayLabel.format(day)}
              aria-pressed={isSelected}
              className={cn(
                "h-8 rounded-md text-sm transition-colors hover:bg-accent active:scale-[0.97]",
                !isSameMonth(day, month) && "text-muted-foreground/50",
                isToday(day) && "font-semibold ring-1 ring-ring",
                isSelected &&
                  "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};
