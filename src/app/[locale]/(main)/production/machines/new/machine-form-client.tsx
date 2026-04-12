"use client";

import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
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
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

const MACHINE_TYPES = [
  "CNC_MILLING",
  "CNC_LATHE",
  "CNC_ROUTER",
  "CNC_ENGRAVING",
  "OTHER",
] as const;

const MACHINE_STATUSES = [
  "AVAILABLE",
  "IN_USE",
  "MAINTENANCE",
  "OFFLINE",
] as const;

const machineTypeLabel: Record<string, string> = {
  CNC_MILLING: "Milling",
  CNC_LATHE: "Lathe",
  CNC_ROUTER: "Router",
  CNC_ENGRAVING: "Engraving",
  OTHER: "Other",
};

interface MachineFormData {
  code: string;
  name: string;
  type: string;
  description: string;
  status: string;
}

export function MachineFormClient() {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<MachineFormData>({
    defaultValues: {
      code: "",
      name: "",
      type: "CNC_MILLING",
      description: "",
      status: "AVAILABLE",
    },
  });

  const onSubmit = async (data: MachineFormData) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/production/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create machine");
      }

      router.push("/production/machines");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/production/machines">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-medium tracking-tight">
          {t("machine.new")}
        </h1>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("machine.code")} *</Label>
              <Input
                {...register("code", { required: "Code is required" })}
                placeholder={t("machine.code")}
              />
              {errors.code && (
                <p className="text-xs text-destructive">
                  {errors.code.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("machine.name")} *</Label>
              <Input
                {...register("name", { required: "Name is required" })}
                placeholder={t("machine.name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("machine.type")}</Label>
              <Select
                defaultValue="CNC_MILLING"
                onValueChange={(v) => setValue("type", v ?? "CNC_MILLING")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("machine.selectType")} />
                </SelectTrigger>
                <SelectContent>
                  {MACHINE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {machineTypeLabel[type] || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("common.status")}</Label>
              <Select
                defaultValue="AVAILABLE"
                onValueChange={(v) => setValue("status", v ?? "AVAILABLE")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("machine.selectStatus")} />
                </SelectTrigger>
                <SelectContent>
                  {MACHINE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`machine.status.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>{t("machine.description")}</Label>
              <Textarea
                {...register("description")}
                placeholder={t("machine.description")}
                rows={3}
              />
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {t("common.save")}
          </Button>
          <Link href="/production/machines">
            <Button type="button" variant="outline">
              {t("common.cancel")}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
