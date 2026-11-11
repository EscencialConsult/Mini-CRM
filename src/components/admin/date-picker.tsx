import { CalendarDays } from "lucide-react";
import { useTranslate } from "ra-core";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  dateFromValue,
  formatDateText,
  parseDateText,
  valueFromDay,
} from "@/lib/dateText";
import { cn } from "@/lib/utils";
import { CalendarGrid } from "@/components/admin/calendar-grid";

export type DatePickerProps = Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "defaultValue" | "type"
> & {
  /** "YYYY-MM-DD", or "YYYY-MM-DDTHH:mm" when `withTime` */
  value: string | null | undefined;
  /** Receives the same format, or "" when cleared */
  onChange: (value: string) => void;
  withTime?: boolean;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * A text field accepting "DD/MM/YYYY[ HH:mm]" (or ISO) with a calendar popover,
 * used instead of the native date inputs.
 */
export const DatePicker = ({
  value,
  onChange,
  onBlur,
  withTime = false,
  disabled,
  readOnly,
  className,
  ...inputProps
}: DatePickerProps) => {
  const translate = useTranslate();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(() => formatDateText(value, withTime));
  // The value this picker last sent, to tell its own changes from outside ones
  const lastValue = React.useRef(value ?? "");

  React.useEffect(() => {
    if ((value ?? "") !== lastValue.current) {
      lastValue.current = value ?? "";
      setText(formatDateText(value, withTime));
    }
  }, [value, withTime]);

  const send = (next: string) => {
    lastValue.current = next;
    if (next !== (value ?? "")) onChange(next);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
    const parsed = parseDateText(event.target.value, withTime);
    if (parsed !== undefined) send(parsed);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const parsed = parseDateText(text, withTime);
    setText(formatDateText(parsed === undefined ? value : parsed, withTime));
    onBlur?.(event);
  };

  const pickDay = (day: Date) => {
    const next = valueFromDay(day, value, withTime);
    send(next);
    setText(formatDateText(next, withTime));
    if (!withTime) setOpen(false);
  };

  const changeTime = (time: string) => {
    const day = dateFromValue(value) ?? new Date();
    if (!TIME_PATTERN.test(time)) return;
    const next = `${valueFromDay(day, "", false)}T${time}`;
    send(next);
    setText(formatDateText(next, withTime));
  };

  const isLocked = disabled || readOnly;

  return (
    <div className={cn("relative", className)}>
      <Input
        {...inputProps}
        type="text"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        readOnly={readOnly}
        autoComplete="off"
        placeholder={
          withTime
            ? translate("crm.date_picker.datetime_placeholder", {
                _: "dd/mm/yyyy hh:mm",
              })
            : translate("crm.date_picker.date_placeholder", {
                _: "dd/mm/yyyy",
              })
        }
        className="pr-10"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isLocked}
            className="absolute right-0.5 top-1/2 size-8 -translate-y-1/2"
            aria-label={translate("crm.date_picker.open", {
              _: "Open the calendar",
            })}
          >
            <CalendarDays />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto space-y-3 p-3">
          <CalendarGrid selected={dateFromValue(value)} onSelect={pickDay} />
          {withTime && (
            <TimeField
              value={value?.slice(11, 16) ?? ""}
              onCommit={changeTime}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

const TimeField = ({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (time: string) => void;
}) => {
  const translate = useTranslate();
  const id = React.useId();
  const [time, setTime] = React.useState(value);
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {translate("crm.date_picker.time", { _: "Time" })}
      </label>
      <Input
        id={id}
        value={time}
        placeholder="hh:mm"
        inputMode="numeric"
        className="h-8 w-24"
        onChange={(event) => {
          setTime(event.target.value);
          onCommit(event.target.value);
        }}
      />
    </div>
  );
};
