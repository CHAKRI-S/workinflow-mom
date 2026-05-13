export const JURISTIC_TYPES = [
  "COMPANY_LTD",
  "PUBLIC_CO",
  "LIMITED_PARTNERSHIP",
  "ORDINARY_PARTNERSHIP",
  "SHOP",
  "PERSON_GROUP",
  "FOUNDATION",
  "ASSOCIATION",
  "JOINT_VENTURE",
  "OTHER_JURISTIC",
  "INDIVIDUAL",
] as const;

export const INDIVIDUAL_TITLES = [
  "MR",
  "MRS",
  "MISS",
  "KHUN",
  "NONE",
  "OTHER",
] as const;

export type JuristicType = (typeof JURISTIC_TYPES)[number];
export type IndividualTitle = (typeof INDIVIDUAL_TITLES)[number];

export const JURISTIC_TYPE_OPTIONS = [
  { value: "COMPANY_LTD", labelTh: "บริษัทจำกัด" },
  { value: "PUBLIC_CO", labelTh: "บริษัทมหาชนจำกัด" },
  { value: "LIMITED_PARTNERSHIP", labelTh: "ห้างหุ้นส่วนจำกัด" },
  { value: "ORDINARY_PARTNERSHIP", labelTh: "ห้างหุ้นส่วนสามัญ" },
  { value: "SHOP", labelTh: "ร้านค้า" },
  { value: "PERSON_GROUP", labelTh: "คณะบุคคล" },
  { value: "FOUNDATION", labelTh: "มูลนิธิ" },
  { value: "ASSOCIATION", labelTh: "สมาคม" },
  { value: "JOINT_VENTURE", labelTh: "กิจการร่วมค้า" },
  { value: "OTHER_JURISTIC", labelTh: "นิติบุคคลอื่นๆ" },
  { value: "INDIVIDUAL", labelTh: "บุคคลธรรมดา" },
] as const satisfies readonly { value: JuristicType; labelTh: string }[];

export const INDIVIDUAL_TITLE_OPTIONS = [
  { value: "MR", labelTh: "นาย" },
  { value: "MRS", labelTh: "นาง" },
  { value: "MISS", labelTh: "นางสาว" },
  { value: "KHUN", labelTh: "คุณ" },
  { value: "NONE", labelTh: "ไม่มี" },
  { value: "OTHER", labelTh: "อื่นๆ" },
] as const satisfies readonly { value: IndividualTitle; labelTh: string }[];

export interface CustomerDisplayNameInput {
  name: string;
  juristicType?: JuristicType | string | null;
  individualTitle?: IndividualTitle | string | null;
  individualTitleOther?: string | null;
}

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isJuristicType(value: unknown): value is JuristicType {
  return (
    typeof value === "string" &&
    (JURISTIC_TYPES as readonly string[]).includes(value)
  );
}

function isIndividualTitle(value: unknown): value is IndividualTitle {
  return (
    typeof value === "string" &&
    (INDIVIDUAL_TITLES as readonly string[]).includes(value)
  );
}

export function getJuristicTypeLabelTh(type?: string | null): string {
  if (!isJuristicType(type)) return "";
  return (
    JURISTIC_TYPE_OPTIONS.find((option) => option.value === type)?.labelTh ?? ""
  );
}

export function getIndividualTitleLabelTh(title?: string | null): string {
  if (!isIndividualTitle(title)) return "";
  return (
    INDIVIDUAL_TITLE_OPTIONS.find((option) => option.value === title)?.labelTh ?? ""
  );
}

export function formatCustomerDisplayName(input: CustomerDisplayNameInput): string {
  const name = cleanName(input.name);
  const juristicType = isJuristicType(input.juristicType)
    ? input.juristicType
    : "OTHER_JURISTIC";

  if (!name) return "";

  switch (juristicType) {
    case "COMPANY_LTD":
      return `บริษัท ${name} จำกัด`;
    case "PUBLIC_CO":
      return `บริษัท ${name} จำกัด (มหาชน)`;
    case "LIMITED_PARTNERSHIP":
      return `ห้างหุ้นส่วนจำกัด ${name}`;
    case "ORDINARY_PARTNERSHIP":
      return `ห้างหุ้นส่วนสามัญ ${name}`;
    case "SHOP":
      return `ร้าน ${name}`;
    case "PERSON_GROUP":
      return `คณะบุคคล ${name}`;
    case "FOUNDATION":
      return `มูลนิธิ ${name}`;
    case "ASSOCIATION":
      return `สมาคม ${name}`;
    case "JOINT_VENTURE":
      return `กิจการร่วมค้า ${name}`;
    case "INDIVIDUAL": {
      const title = isIndividualTitle(input.individualTitle)
        ? input.individualTitle
        : "NONE";
      if (title === "NONE") return name;
      if (title === "OTHER") {
        const customTitle = cleanName(input.individualTitleOther ?? "");
        return customTitle ? `${customTitle} ${name}` : name;
      }

      const label = getIndividualTitleLabelTh(title);
      return label ? `${label} ${name}` : name;
    }
    case "OTHER_JURISTIC":
      return name;
  }
}
