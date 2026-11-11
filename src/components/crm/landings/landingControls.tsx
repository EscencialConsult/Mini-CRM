import { ImagePlus, X } from "lucide-react";
import { useDataProvider, useNotify, useTranslate } from "ra-core";
import { useId, useState, type ChangeEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { LandingContent } from "./pagina/schema.ts";
import type { CrmDataProvider } from "../providers/dataProvider";

export interface PatchOptions {
  /** Edits with the same key in a row are undone together, like typing */
  mergeKey?: string;
}

export type PatchLanding = (
  recipe: (draft: LandingContent) => void,
  options?: PatchOptions,
) => void;

/**
 * An error shows once the person leaves the field, never while typing; once
 * shown, it goes away as soon as the value is valid again.
 */
const useBlurError = (error?: string) => {
  const [isShown, setIsShown] = useState(false);
  if (isShown && !error) setIsShown(false);
  return {
    visibleError: isShown ? error : undefined,
    onBlur: () => setIsShown(!!error),
  };
};

export const TextField = ({
  label,
  value,
  onChange,
  multiline,
  rows = 3,
  hint,
  error,
  placeholder,
  disabled,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Text shown before the input, like the host before a landing's path */
  prefix?: string;
}) => {
  const id = useId();
  const messageId = `${id}-message`;
  const { visibleError, onBlur } = useBlurError(error);
  const message = visibleError ?? hint;
  const inputProps = {
    id,
    value,
    placeholder,
    disabled,
    onBlur,
    "aria-invalid": visibleError ? true : undefined,
    "aria-describedby": message ? messageId : undefined,
  };
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea
          {...inputProps}
          rows={rows}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <div className="flex items-center gap-1">
          {prefix && (
            <span className="min-w-0 shrink truncate text-sm text-muted-foreground">
              {prefix}
            </span>
          )}
          <Input
            {...inputProps}
            className="min-w-0 basis-40 grow"
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      )}
      {message && (
        <p
          id={messageId}
          className={cn(
            "text-xs",
            visibleError ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
};

/** Radix does not accept an empty value, so "nothing chosen" has its own. */
const NOTHING = "__nothing";

export const PickField = ({
  label,
  value,
  onChange,
  choices,
  emptyLabel,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  choices: { value: string; label: string }[];
  /** Offers "nothing": it comes back as "" */
  emptyLabel?: string;
  hint?: string;
}) => {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || (emptyLabel ? NOTHING : value)}
        onValueChange={(next) => onChange(next === NOTHING ? "" : next)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {emptyLabel && <SelectItem value={NOTHING}>{emptyLabel}</SelectItem>}
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
};

export const SwitchField = ({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="mt-0.5"
      />
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
};

/** One choice among a few, all in sight. */
export const Segmented = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) => (
  <div className="space-y-1.5">
    <p className="text-sm font-medium">{label}</p>
    <div role="group" aria-label={label} className="flex gap-1">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={option.value === value ? "default" : "outline"}
          aria-pressed={option.value === value}
          className="flex-1"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  </div>
);

/** Free text with suggestions: the CRM creates the tags that do not exist. */
export const TagsField = ({
  label,
  hint,
  value,
  onChange,
  suggestions,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (value: string[]) => void;
  suggestions: string[];
}) => {
  const translate = useTranslate();
  const id = useId();
  const [text, setText] = useState("");
  const add = () => {
    const name = text.trim();
    if (name && !value.includes(name)) onChange([...value, name]);
    setText("");
  };
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border bg-muted py-0.5 pl-2.5 pr-1 text-xs"
            >
              {tag}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-background"
                aria-label={`${translate("ra.action.remove")}: ${tag}`}
                onClick={() => onChange(value.filter((item) => item !== tag))}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={text}
        list={`${id}-tags`}
        onChange={(event) => setText(event.target.value)}
        onBlur={add}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add();
          }
        }}
      />
      <datalist id={`${id}-tags`}>
        {suggestions
          .filter((name) => !value.includes(name))
          .map((name) => (
            <option key={name} value={name} />
          ))}
      </datalist>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
};

export const ColorField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => {
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-12 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
      />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );
};

/** An image is uploaded, or pasted as a link; both end up as a public URL. */
export const ImageField = ({
  label,
  value,
  onChange,
  readOnly,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** The example editor has nowhere to upload to */
  readOnly?: boolean;
  hint?: string;
}) => {
  const translate = useTranslate();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const inputId = useId();
  const [isUploading, setIsUploading] = useState(false);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsUploading(true);
    try {
      onChange(await dataProvider.subirImagenLanding(file));
    } catch {
      notify("resources.landings.editor.upload_error", { type: "error" });
    } finally {
      setIsUploading(false);
    }
  };
  const canUpload = !isUploading && !readOnly;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex items-center gap-2">
        {value && (
          <img
            src={value}
            alt=""
            className="size-9 shrink-0 rounded border object-cover"
          />
        )}
        <Input
          id={inputId}
          value={value}
          placeholder="https://"
          className="min-w-0"
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0 whitespace-nowrap"
          disabled={!canUpload}
          asChild={canUpload}
        >
          {canUpload ? (
            <label className="cursor-pointer">
              <ImagePlus />
              {translate("resources.landings.editor.upload")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                onChange={upload}
              />
            </label>
          ) : (
            <span>
              <ImagePlus />
              {translate("resources.landings.editor.upload")}
            </span>
          )}
        </Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
};

export const EditorSection = ({
  title,
  help,
  children,
  className,
}: {
  title: string;
  help?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section className={cn("space-y-3", className)}>
    <div className="space-y-0.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
    {children}
  </section>
);
