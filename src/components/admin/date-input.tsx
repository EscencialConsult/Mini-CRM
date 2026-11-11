import * as React from "react";
import type { InputProps } from "ra-core";
import { useInput, FieldTitle, useResourceContext } from "ra-core";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { DatePicker } from "@/components/admin/date-picker";
import { InputHelperText } from "@/components/admin/input-helper-text";
import { cn } from "@/lib/utils";

/**
 * Date picker input for editing date values in "YYYY-MM-DD" format.
 *
 * Use `<DateInput>` for publication dates, deadlines, birthdays, or any date field. Renders
 * a text field (DD/MM/YYYY) with a calendar popover. Automatically handles date parsing
 * from ISO strings, Date objects, or timestamps.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/dateinput/ DateInput documentation}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date MDN documentation for input type="date"}
 *
 * @example
 * import {
 *   Edit,
 *   SimpleForm,
 *   DateInput,
 *   TextInput,
 * } from '@/components/admin';
 *
 * const PostEdit = () => (
 *   <Edit>
 *     <SimpleForm>
 *       <TextInput source="title" />
 *       <DateInput source="published_at" />
 *       <DateInput source="expires_at" />
 *     </SimpleForm>
 *   </Edit>
 * );
 *
 * @example
 * // If the initial value string contains more than a date (e.g. an hour, a timezone),
 * // these details are ignored.
 * <DateInput source="published_at" defaultValue="2021-09-11T20:46:20.000-04:00" />
 * // The input will display '2021-09-11' regardless of the browser timezone.
 *
 * @example
 * // If the initial value is a Date object, DateInput converts it to a string
 * // and ignores the timezone.
 * <DateInput source="published_at" defaultValue={new Date("2021-09-11T20:46:20.000-04:00")} />
 * // The input will display '2021-09-11' regardless of the browser timezone.
 *
 * @example
 * // If you want to manipulate the value from the field to adjust its timezone, use the format prop
 * <DateInput source="published_at" format={value => new Date(value).toISOString().split("T")[0]} />
 * // The input will display the UTC day regardless of the browser timezone.
 *
 * @example
 * // If you want the returned value to be a Date, you must pass a custom parse method
 * // to convert the form value (which is always a date string) back to a Date object.
 * <DateInput source="published_at" parse={val => new Date(val)} />
 */
export const DateInput = (props: DateInputProps) => {
  const {
    className,
    inputClassName,
    defaultValue,
    format = defaultFormat,
    label,
    source,
    helperText,
    validate,
    disabled,
    readOnly,
    ...rest
  } = props;

  const resource = useResourceContext(props);

  const { field, id, isRequired } = useInput({
    defaultValue,
    source,
    validate,
    disabled,
    readOnly,
    format,
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
          ref={field.ref}
          name={field.name}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          disabled={disabled}
          readOnly={readOnly}
          className={cn("ra-input", `ra-input-${source}`, inputClassName)}
        />
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};

export type DateInputProps = InputProps & {
  inputClassName?: string;
} & Omit<React.ComponentProps<"input">, "label" | "defaultValue" | "onChange">;

/**
 * Convert Date object to String, using the local timezone
 *
 * @param {Date} value value to convert
 * @returns {String} A standardized date (yyyy-MM-dd), to be passed to an <input type="date" />
 */
const convertDateToString = (value: Date) => {
  if (!(value instanceof Date) || isNaN(value.getDate())) return "";
  const localDate = new Date(value.getTime());
  const pad = "00";
  const yyyy = localDate.getFullYear().toString();
  const MM = (localDate.getMonth() + 1).toString();
  const dd = localDate.getDate().toString();
  return `${yyyy}-${(pad + MM).slice(-2)}-${(pad + dd).slice(-2)}`;
};

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convert a form state value to a date string for the `<input type="date">` value.
 *
 * Form state values can be anything from:
 * - a string in the "YYYY-MM-DD" format
 * - A valid date string
 * - an ISO date string
 * - a Date object
 * - a Linux timestamp
 * - an empty string
 *
 * When it's not a bare date string (YYYY-MM-DD), the value is converted to
 * this format using the JS Date object.
 * THIS MAY CHANGE THE DATE VALUE depending on the browser locale.
 * For example, the string "09/11/2021" may be converted to "2021-09-10"
 * in Honolulu. This is expected behavior.
 * If this is not what you want, you should provide your own parse method.
 *
 * The output is always a string in the "YYYY-MM-DD" format.
 *
 * @example
 * defaultFormat('2021-09-11'); // '2021-09-11'
 * defaultFormat('09/11/2021'); // '2021-09-11' (may change depending on the browser locale)
 * defaultFormat('2021-09-11T20:46:20.000Z'); // '2021-09-11' (may change depending on the browser locale)
 * defaultFormat(new Date('2021-09-11T20:46:20.000Z')); // '2021-09-11' (may change depending on the browser locale)
 * defaultFormat(1631385980000); // '2021-09-11' (may change depending on the browser locale)
 * defaultFormat(''); // null
 */
const defaultFormat = (value: string | Date | number) => {
  // null, undefined and empty string values should not go through dateFormatter
  // otherwise, it returns undefined and will make the input an uncontrolled one.
  if (value == null || value === "") {
    return null;
  }

  // Date objects should be converted to strings
  if (value instanceof Date) {
    return convertDateToString(value);
  }

  // Valid date strings (YYYY-MM-DD) should be considered as is
  if (typeof value === "string") {
    if (dateRegex.test(value)) {
      return value;
    }
  }

  // other values (e.g., localized date strings, timestamps) need to be converted to Dates first
  return convertDateToString(new Date(value));
};
