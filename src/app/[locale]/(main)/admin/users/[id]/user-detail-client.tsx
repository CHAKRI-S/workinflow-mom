"use client";

import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useState } from "react";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

const ROLES_LIST = [
  "ADMIN",
  "MANAGER",
  "PLANNER",
  "SALES",
  "OPERATOR",
  "QC",
  "ACCOUNTING",
] as const;

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  MANAGER: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  PLANNER: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  SALES: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
  OPERATOR: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  QC: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800",
  ACCOUNTING: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800",
};

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserEditData {
  name: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
}

export function UserDetailClient({ user }: { user: User }) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UserEditData>({
    defaultValues: {
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      isActive: user.isActive,
    },
  });

  const isActive = watch("isActive");
  const currentRole = watch("role");

  const onSubmit = async (data: UserEditData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Only send password if provided
      const payload: Record<string, unknown> = {
        name: data.name,
        email: data.email,
        role: data.role,
        isActive: data.isActive,
      };
      if (data.password) {
        payload.password = data.password;
      }

      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update user");
      }

      setSuccess(true);
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
        <Link href="/admin/users">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-medium tracking-tight">
          {t("user.edit")}
        </h1>
      </div>

      {/* User Info Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{user.email}</span>
            <Badge
              variant="outline"
              className={`text-xs font-medium ${ROLE_COLORS[user.role] || ""}`}
            >
              {t(`user.roleLabel.${user.role}`)}
            </Badge>
            <Badge
              variant="outline"
              className={
                user.isActive
                  ? "bg-[#27a644]/15 text-[#4ade80] border-[#27a644]/25"
                  : "bg-[#e5484d]/12 text-[#f87171] border-[#e5484d]/20"
              }
            >
              {user.isActive ? t("user.active") : t("user.inactive")}
            </Badge>
            <span>
              {t("common.date")}: {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-[#27a644]/10 text-[#4ade80] rounded-md p-3 text-sm">
          Updated successfully
        </div>
      )}

      {/* Edit Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("user.name")} *</Label>
              <Input
                {...register("name", { required: "Name is required" })}
                placeholder={t("user.name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("user.email")} *</Label>
              <Input
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Invalid email",
                  },
                })}
                type="email"
                placeholder={t("user.email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("user.password")}</Label>
              <Input
                {...register("password", {
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters",
                  },
                })}
                type="password"
                placeholder={t("user.resetPassword")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Leave blank to keep current password
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>{t("user.role")}</Label>
              <Select
                value={currentRole}
                onValueChange={(v) => setValue("role", v ?? user.role)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES_LIST.map((role) => (
                    <SelectItem key={role} value={role}>
                      {t(`user.roleLabel.${role}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setValue("isActive", e.target.checked)}
                  className="rounded"
                />
                {t("user.isActive")} -{" "}
                {isActive ? t("user.active") : t("user.inactive")}
              </Label>
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
          <Link href="/admin/users">
            <Button type="button" variant="outline">
              {t("common.back")}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
