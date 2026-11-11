import * as React from "react";
import clsx from "clsx";
import type { InputProps } from "ra-core";
import { useInput, FieldTitle } from "ra-core";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { DatePicker } from "@/components/admin/date-picker";
import { InputHelperText } from "@/components/admin/input-helper-text";

/**
 * Date and time picker input for editing datetime values with timezone support.
 *
 * Use `<DateTimeInput>` for timestamps like "created at", "updated at", or scheduled events.
 * Renders a native browser datetime-local picker. Expects and returns ISO 8601 formatted strings
 * (e.g. '2025-11-17T10:10:32.390Z'), automatically converting other formats like Date objects or timestamps.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/datetimeinput/ DateTimeInput documentation}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/datetime-local MDN documentation for input type="datetime-local"}
 *
 * @example
 * import {
 *   Edit,
 *   SimpleForm,
 *   DateTimeInput,
 *   TextInput,
 * } from '@/components/admin';
 *
 * const EventEdit = () => (
 *   <Edit>
 *     <SimpleForm>
 *       <TextInput source="title" />
 *       <DateTimeInput source="starts_at" />
 *       <DateTimeInput source="ends_at" />
 *     </SimpleForm>
 *   </Edit>
 * );
 */
export const DateTimeInput = ({
  className,
  defaultValue,
  format = formatDateTime,
  parse = convertDateStringToISO,
  label,
  helperText,
  onBlur,
  source,
  resource,
  validate,
  disabled,
  readOnly,
  ...rest
}: DateTimeInputProps) => {
  const { field, id, isRequired } = useInput({
    defaultValue,
    onBlur,
    resource,
    source,
    validate,
    disabled,
    readOnly,
    format,
    parse,
    ...rest,
  });

  return (
    <FormField id={id} className={className} name={field.name}>
      {label !== false && (
        <FormLabel>
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={isRequired}
          />
        </FormLabel>
      )}
      <FormControl>
        <DatePicker
          withTime
          ref={field.ref}
          name={field.name}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          disabled={disabled}
          readOnly={readOnly}
          className={clsx("ra-input", `ra-input-${source}`)}
        />
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};

export type DateTimeInputProps = Omit<InputProps, "defaultValue"> & {
  defaultValue?: string | number | Date;
} & Omit<React.ComponentProps<"input">, "defaultValue" | "type" | "onChange">;

const leftPad =
  (nb = 2) =>
  (value: number) =>
    ("0".repeat(nb) + value).slice(-nb);
const leftPad4 = leftPad(4);
const leftPad2 = leftPad(2);

/**
 * @param {Date} value value to convert
 * @returns {String} A standardized datetime (yyyy-MM-ddThh:mm), to be passed to an <input type="datetime-local" />
 */
const convertDateToString = (value: Date) => {
  if (!(value instanceof Date) || isNaN(value.getDate())) return "";
  const yyyy = leftPad4(value.getFullYear());
  const MM = leftPad2(value.getMonth() + 1);
  const dd = leftPad2(value.getDate());
  const hh = leftPad2(value.getHours());
  const mm = leftPad2(value.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
};

// yyyy-MM-ddThh:mm
const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * Converts a date from the dataProvider, with timezone, to a date string
 * without timezone for use in an <input type="datetime-local" />.
 *
 * @param {Date | String} value date string or object
 */
const formatDateTime = (value: string | Date) => {
  // null, undefined and empty string values should not go through convertDateToString
  // otherwise, it returns undefined and will make the input an uncontrolled one.
  if (value == null || value === "") {
    return "";
  }

  if (value instanceof Date) {
    return convertDateToString(value);
  }
  // valid dates should not be converted
  if (dateTimeRegex.test(value)) {
    return value;
  }

  return convertDateToString(new Date(value));
};

// converts a date string entered usinf a datetime-local input
// into an ISO date using the browser timezone
const convertDateStringToISO = (date: string) => {
  if (!date) return null;
  const localDate = new Date(date);
  return localDate.toISOString();
};
