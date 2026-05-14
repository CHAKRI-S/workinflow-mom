import { describe, expect, it } from "vitest";
import {
  getThaiAddressFieldOptions,
  searchThaiAddresses,
} from "@/lib/locations/thai-addresses";

describe("Thai address master data helper", () => {
  it("finds subdistrict rows by province, district, and query", () => {
    const result = searchThaiAddresses({
      province: "ชลบุรี",
      district: "บ้านบึง",
      q: "บ้านบึง",
      limit: 10,
    });

    expect(result.items).toContainEqual({
      subdistrict: "บ้านบึง",
      district: "บ้านบึง",
      province: "ชลบุรี",
      postalCode: "20170",
    });
  });

  it("returns distinct field options for cascading selects", () => {
    const provinces = getThaiAddressFieldOptions("province", {});
    expect(provinces).toContain("กรุงเทพมหานคร");
    expect(provinces).toContain("ชลบุรี");

    const districts = getThaiAddressFieldOptions("district", {
      province: "ชลบุรี",
    });
    expect(districts).toContain("บ้านบึง");

    const subdistricts = getThaiAddressFieldOptions("subdistrict", {
      province: "ชลบุรี",
      district: "บ้านบึง",
    });
    expect(subdistricts).toContain("บ้านบึง");

    const postalCodes = getThaiAddressFieldOptions("postalCode", {
      province: "ชลบุรี",
      district: "บ้านบึง",
      subdistrict: "บ้านบึง",
    });
    expect(postalCodes).toContain("20170");
  });

  it("caps search results at the requested limit", () => {
    const result = searchThaiAddresses({ limit: 3 });
    expect(result.items).toHaveLength(3);
  });
});
