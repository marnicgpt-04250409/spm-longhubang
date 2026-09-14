export const SCHOOL_OPTIONS = [
  "SMK PB",
  "SMK PA",
  "SMK PBP1",
  "SMK SEKSYEN 4",
  "SMJK KATHOLIK",
  "坤成独中",
  "其他",
] as const;

export type SchoolOption = (typeof SCHOOL_OPTIONS)[number];

export function isSchoolOption(value: string): value is SchoolOption {
  return (SCHOOL_OPTIONS as readonly string[]).includes(value);
}

export function schoolSelectValue(value?: string | null): string {
  if (!value) return "";
  return isSchoolOption(value) ? value : "其他";
}
