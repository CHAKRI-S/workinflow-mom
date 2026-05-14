"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import {
  JURISTIC_TYPE_OPTIONS,
  INDIVIDUAL_TITLE_OPTIONS,
  getIndividualTitleLabelTh,
  getJuristicTypeLabelTh,
  type IndividualTitle,
  type JuristicType,
} from "@/lib/customer-name";

export type JuristicTypeValue = JuristicType;
export type IndividualTitleValue = IndividualTitle;

type ThaiAddressOption = {
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
};

type ThaiAddressField = keyof ThaiAddressOption;

function uniqueAddressOptions(
  rows: ThaiAddressOption[],
  field: ThaiAddressField,
): string[] {
  return Array.from(new Set(rows.map((row) => row[field]).filter(Boolean))).slice(
    0,
    100,
  );
}

function buildStructuredAddressSuffix(value: BusinessInfoValue): string {
  return [
    value.billingSubdistrict ? `ตำบล/แขวง${value.billingSubdistrict}` : "",
    value.billingDistrict ? `อำเภอ/เขต${value.billingDistrict}` : "",
    value.billingProvince ? `จังหวัด${value.billingProvince}` : "",
    value.billingPostalCode || "",
  ]
    .filter(Boolean)
    .join(" ");
}

function getCountryLabel(country?: string | null): string {
  if (!country || country === "TH") return "ไทย (TH)";
  if (country === "OTHER") return "ต่างประเทศ (Other)";
  return country;
}

export interface BusinessInfoValue {
  juristicType: JuristicTypeValue | "";
  individualTitle?: IndividualTitleValue | "";
  individualTitleOther?: string;
  taxId: string;
  branchNo: string; // "00000" = HQ, else branch number padded to 5
  name: string;
  address: string; // billing address
  country: string; // ISO, default "TH"
  billingSubdistrict?: string;
  billingDistrict?: string;
  billingProvince?: string;
  billingPostalCode?: string;
}

interface Props {
  value: BusinessInfoValue;
  onChange: (patch: Partial<BusinessInfoValue>) => void;
  /**
   * Called when full RD response comes back so caller can
   * push multiple fields at once (name + address + branchNo + juristicType).
   */
  onAutoFill?: (patch: Partial<BusinessInfoValue>) => void;
  nameLabel?: string;
  namePlaceholder?: string;
  showCountry?: boolean;
  disabled?: boolean;
}

export function BusinessInfoSection({
  value,
  onChange,
  onAutoFill,
  nameLabel = "ชื่อจริง / ชื่อกิจการ (ไม่ต้องใส่คำนำหน้าหรือคำลงท้าย)",
  namePlaceholder = "เช่น เอบีซีแมชชีน / สมชายการช่าง / สมชาย ใจดี",
  showCountry = true,
  disabled,
}: Props) {
  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [addressOptions, setAddressOptions] = useState<ThaiAddressOption[]>([]);

  const isHQ = !value.branchNo || value.branchNo === "00000";
  const isIndividual = value.juristicType === "INDIVIDUAL";
  const showOtherTitle = isIndividual && value.individualTitle === "OTHER";
  const isThaiAddress = !value.country || value.country === "TH";

  useEffect(() => {
    if (!isThaiAddress || disabled) {
      setAddressOptions([]);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "100" });
    if (value.billingProvince) params.set("province", value.billingProvince);
    if (value.billingDistrict) params.set("district", value.billingDistrict);
    if (value.billingSubdistrict) params.set("subdistrict", value.billingSubdistrict);
    if (value.billingPostalCode) params.set("postalCode", value.billingPostalCode);

    fetch(`/api/locations/thai-addresses?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Address lookup failed");
        return (await res.json()) as { items?: ThaiAddressOption[] };
      })
      .then((data) => setAddressOptions(data.items ?? []))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setAddressOptions([]);
      });

    return () => controller.abort();
  }, [
    disabled,
    isThaiAddress,
    value.billingDistrict,
    value.billingPostalCode,
    value.billingProvince,
    value.billingSubdistrict,
  ]);

  const handleAppendStructuredAddress = () => {
    const suffix = buildStructuredAddressSuffix(value);
    if (!suffix) return;
    if (value.address.includes(suffix)) return;
    onChange({ address: [value.address.trim(), suffix].filter(Boolean).join(" ") });
  };

  // Normalize displayed taxId so legacy-stored formatting (dashes, spaces,
  // NBSP) doesn't break the length check or the lookup button.
  const cleanTaxId = (value.taxId ?? "").replace(/[^\d]/g, "").slice(0, 13);

  const handleLookup = async () => {
    const taxId = cleanTaxId;
    if (taxId.length !== 13) {
      setLookupMsg({
        type: "err",
        text: "กรุณากรอกเลขผู้เสียภาษี 13 หลัก",
      });
      return;
    }
    setLooking(true);
    setLookupMsg(null);
    try {
      const res = await fetch("/api/lookup/tax-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxId,
          branchNo: value.branchNo || "00000",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ค้นหาไม่สำเร็จ");
      }
      const patch: Partial<BusinessInfoValue> = {
        name: data.name || value.name,
        address: data.address || value.address,
        billingSubdistrict: data.subdistrict || value.billingSubdistrict,
        billingDistrict: data.district || value.billingDistrict,
        billingProvince: data.province || value.billingProvince,
        billingPostalCode: data.postCode || value.billingPostalCode,
        branchNo: data.branchNo || value.branchNo || "00000",
        juristicType: data.juristicType || value.juristicType,
        country: "TH",
      };
      (onAutoFill ?? onChange)(patch);
      setLookupMsg({
        type: "ok",
        text:
          data.status === "INACTIVE"
            ? "พบข้อมูล (สถานะ: ยกเลิก/ไม่ใช้งาน)"
            : "ดึงข้อมูลสำเร็จ — ตรวจสอบและแก้ไขได้",
      });
    } catch (e) {
      setLookupMsg({
        type: "err",
        text: e instanceof Error ? e.message : "ค้นหาไม่สำเร็จ",
      });
    } finally {
      setLooking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Country */}
        {showCountry && (
          <div className="space-y-1.5">
            <Label>ประเทศ</Label>
            <Select
              value={value.country || "TH"}
              onValueChange={(v) => onChange({ country: v || "TH" })}
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(selectedCountry) => getCountryLabel(selectedCountry)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TH">ไทย (TH)</SelectItem>
                <SelectItem value="OTHER">ต่างประเทศ (Other)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Juristic type */}
        <div className="space-y-1.5">
          <Label>ประเภทนิติบุคคล</Label>
          <Select
            value={value.juristicType || ""}
            onValueChange={(v) => {
              const juristicType = (v as JuristicTypeValue) || "";
              onChange({
                juristicType,
                ...(juristicType === "INDIVIDUAL"
                  ? {}
                  : { individualTitle: undefined, individualTitleOther: "" }),
              });
            }}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="-- เลือกประเภท --">
                {(selectedJuristicType) =>
                  getJuristicTypeLabelTh(selectedJuristicType) || "-- เลือกประเภท --"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {JURISTIC_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.labelTh}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isIndividual && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>คำนำหน้าชื่อบุคคลธรรมดา</Label>
            <Select
              value={value.individualTitle || "NONE"}
              onValueChange={(v) => {
                const individualTitle = (v as IndividualTitleValue) || "NONE";
                onChange({
                  individualTitle,
                  ...(individualTitle === "OTHER"
                    ? {}
                    : { individualTitleOther: "" }),
                });
              }}
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="-- เลือกคำนำหน้า --">
                  {(selectedIndividualTitle) =>
                    getIndividualTitleLabelTh(selectedIndividualTitle) ||
                    "-- เลือกคำนำหน้า --"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {INDIVIDUAL_TITLE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.labelTh}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              ใช้สร้างชื่อเต็มในเอกสารอัตโนมัติ ผู้ใช้กรอกเฉพาะชื่อจริงด้านล่าง
            </p>
          </div>

          {showOtherTitle && (
            <div className="space-y-1.5">
              <Label>คำนำหน้าอื่นๆ *</Label>
              <Input
                value={value.individualTitleOther || ""}
                onChange={(e) => onChange({ individualTitleOther: e.target.value })}
                placeholder="เช่น ดร. / ผศ."
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground">
                จำเป็นเมื่อเลือก “อื่นๆ”
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tax ID + lookup */}
      <div className="space-y-1.5">
        <Label>เลขประจำตัวผู้เสียภาษี (13 หลัก)</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={cleanTaxId}
            onChange={(e) =>
              onChange({
                taxId: e.target.value.replace(/[^\d]/g, "").slice(0, 13),
              })
            }
            placeholder="0105XXXXXXXXX"
            inputMode="numeric"
            maxLength={13}
            disabled={disabled}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleLookup}
            // Do NOT disable based on length — let the click run and show
            // a friendly validation message inside handleLookup instead.
            // Previously an edit-mode customer whose taxId was stored with
            // formatting could never trigger the lookup at all.
            disabled={disabled || looking}
          >
            {looking ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-1" />
            )}
            ค้นหาจากกรมสรรพากร
          </Button>
        </div>
        {lookupMsg && (
          <p
            className={`text-xs ${
              lookupMsg.type === "ok"
                ? "text-emerald-600"
                : "text-destructive"
            }`}
          >
            {lookupMsg.text}
          </p>
        )}
      </div>

      {/* HQ / Branch */}
      <div className="space-y-1.5">
        <Label>สำนักงานใหญ่ / สาขา</Label>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="branch-kind"
              checked={isHQ}
              onChange={() => onChange({ branchNo: "00000" })}
              disabled={disabled}
            />
            สำนักงานใหญ่ (00000)
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="branch-kind"
              checked={!isHQ}
              onChange={() => onChange({ branchNo: "00001" })}
              disabled={disabled}
            />
            สาขาที่
          </label>
          <Input
            value={isHQ ? "" : value.branchNo}
            onChange={(e) =>
              onChange({
                branchNo: e.target.value
                  .replace(/[^\d]/g, "")
                  .slice(0, 5)
                  .padStart(5, "0"),
              })
            }
            disabled={disabled || isHQ}
            placeholder="00001"
            maxLength={5}
            className="w-28"
          />
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label>{nameLabel} *</Label>
        <Input
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={namePlaceholder}
          disabled={disabled}
        />
      </div>

      {/* Address */}
      <div className="space-y-1.5">
        <Label>ที่อยู่</Label>
        <Textarea
          value={value.address}
          onChange={(e) => onChange({ address: e.target.value })}
          rows={3}
          disabled={disabled}
          placeholder="เลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด รหัสไปรษณีย์"
        />
      </div>

      {isThaiAddress && (
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label>ข้อมูลที่อยู่แบบแยกส่วน</Label>
              <p className="text-xs text-muted-foreground">
                เก็บแยกสำหรับรายงาน/จัดกลุ่มในอนาคต โดยไม่แทนที่ที่อยู่เต็มด้านบนอัตโนมัติ
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAppendStructuredAddress}
              disabled={
                disabled ||
                !(
                  value.billingSubdistrict &&
                  value.billingDistrict &&
                  value.billingProvince &&
                  value.billingPostalCode
                )
              }
            >
              เติมท้ายที่อยู่
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>จังหวัด</Label>
              <Input
                value={value.billingProvince || ""}
                onChange={(e) =>
                  onChange({
                    billingProvince: e.target.value,
                    billingDistrict: "",
                    billingSubdistrict: "",
                    billingPostalCode: "",
                  })
                }
                list="thai-address-province-options"
                disabled={disabled}
                placeholder="เช่น ชลบุรี"
              />
              <datalist id="thai-address-province-options">
                {uniqueAddressOptions(addressOptions, "province").map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label>อำเภอ/เขต</Label>
              <Input
                value={value.billingDistrict || ""}
                onChange={(e) =>
                  onChange({
                    billingDistrict: e.target.value,
                    billingSubdistrict: "",
                    billingPostalCode: "",
                  })
                }
                list="thai-address-district-options"
                disabled={disabled || !value.billingProvince}
                placeholder="เช่น บ้านบึง"
              />
              <datalist id="thai-address-district-options">
                {uniqueAddressOptions(addressOptions, "district").map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label>ตำบล/แขวง</Label>
              <Input
                value={value.billingSubdistrict || ""}
                onChange={(e) => {
                  const subdistrict = e.target.value;
                  const match = addressOptions.find(
                    (row) =>
                      row.subdistrict === subdistrict &&
                      (!value.billingDistrict || row.district === value.billingDistrict) &&
                      (!value.billingProvince || row.province === value.billingProvince),
                  );
                  onChange({
                    billingSubdistrict: subdistrict,
                    billingPostalCode: match?.postalCode || value.billingPostalCode || "",
                  });
                }}
                list="thai-address-subdistrict-options"
                disabled={disabled || !value.billingDistrict}
                placeholder="เช่น บ้านบึง"
              />
              <datalist id="thai-address-subdistrict-options">
                {uniqueAddressOptions(addressOptions, "subdistrict").map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label>รหัสไปรษณีย์</Label>
              <Input
                value={value.billingPostalCode || ""}
                onChange={(e) =>
                  onChange({
                    billingPostalCode: e.target.value.replace(/[^\d]/g, "").slice(0, 5),
                  })
                }
                list="thai-address-postal-code-options"
                disabled={disabled}
                placeholder="เช่น 20170"
                inputMode="numeric"
                maxLength={5}
              />
              <datalist id="thai-address-postal-code-options">
                {uniqueAddressOptions(addressOptions, "postalCode").map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
