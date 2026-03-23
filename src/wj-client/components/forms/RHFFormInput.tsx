"use client";

import { useController, UseControllerProps } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormInput, FormInputProps } from "./FormInput";
import { translateValidationMessage } from "@/lib/utils/error-translator";

interface RHFFormInputProps
  extends Omit<FormInputProps, "error" | "value" | "onChange" | "onBlur" | "name" | "defaultValue">,
    Omit<UseControllerProps, "control"> {
  control: any; // Control type causes generic issues with RHF, using any as workaround
}

/**
 * React Hook Form compatible wrapper for FormInput
 * Uses useController to integrate with react-hook-form
 * Translates Zod validation error messages via the 'validation' namespace
 */
export const RHFFormInput = ({
  control,
  name,
  rules,
  shouldUnregister,
  defaultValue,
  disabled,
  ...inputProps
}: RHFFormInputProps) => {
  const tValidation = useTranslations("validation");
  const {
    field: { onChange, onBlur, value, ref },
    fieldState: { error },
  } = useController({
    name,
    control,
    rules,
    shouldUnregister,
    defaultValue,
    disabled,
  });

  const translatedError = translateValidationMessage(tValidation, error?.message);

  return (
    <FormInput
      {...inputProps}
      ref={ref}
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      error={translatedError}
      disabled={disabled}
    />
  );
};
