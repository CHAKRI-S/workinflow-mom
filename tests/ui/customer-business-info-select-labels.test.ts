import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const businessInfoSource = readFileSync(
  join(repoRoot, "src/components/forms/business-info-section.tsx"),
  "utf8",
);

describe("customer business info select labels", () => {
  it("renders Thai display labels for selected enum values instead of raw codes", () => {
    expect(businessInfoSource).toContain("function getCountryLabel");
    expect(businessInfoSource).toContain("getJuristicTypeLabelTh");
    expect(businessInfoSource).toContain("getIndividualTitleLabelTh");
    expect(businessInfoSource).toContain("getCountryLabel(selectedCountry)");
    expect(businessInfoSource).toContain("getJuristicTypeLabelTh(selectedJuristicType)");
    expect(businessInfoSource).toContain("getIndividualTitleLabelTh(selectedIndividualTitle)");
  });

  it("keeps Thai option text in the dropdown list", () => {
    expect(businessInfoSource).toContain("ไทย (TH)");
    expect(businessInfoSource).toContain("ต่างประเทศ (Other)");
    expect(businessInfoSource).toContain("labelTh");
  });
});
