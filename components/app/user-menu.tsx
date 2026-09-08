"use client";

import { LogOut } from "lucide-react";

import { signOutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The signed-in user's avatar + menu. Sign-out is a Server Action submitted by
 * a real <form>, so it works even without JavaScript.
 */
export function UserMenu({
  name,
  email,
  roleLabel,
}: {
  name: string;
  email: string;
  roleLabel: string;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 px-2"
          aria-label="Open user menu"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {initials}
          </span>
          <span className="hidden text-sm font-medium sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span>{name}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {email}
          </span>
          <span className="mt-1 text-xs font-normal text-primary">
            {roleLabel}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-pointer">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
