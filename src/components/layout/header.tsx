"use client";

import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogOut } from "lucide-react";

export function Header() {
  const { data: session } = useSession();
  const t = useTranslations("auth");

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="h-14 border-b bg-background flex items-center justify-between px-4">
      <div />

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LocaleSwitcher />

        {session?.user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="relative h-8 w-8 rounded-full cursor-pointer outline-none">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{session.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {session.user.email}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {session.user.role?.toLowerCase()}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut className="mr-2 h-4 w-4" />
                {t("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
