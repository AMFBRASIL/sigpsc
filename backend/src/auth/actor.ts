import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC = "sigpsc:public";
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const SCREEN = "sigpsc:screen";
export const Screen = (id: string, mode: "view" | "edit" = "view") => SetMetadata(SCREEN, { id, mode });

export type Actor = {
  id: number;
  nome: string;
  email: string;
  perfilId: number;
  perfilNome: string;
  localId: number | null;
  localNome: string | null;
  administrador: boolean;
  screens: Record<string, { view: boolean; edit: boolean }>;
  ip: string | null;
};

export function allows(actor: Actor, screen: string, mode: "view" | "edit"): boolean {
  const permission = actor.screens[screen];
  if (!permission) return false;
  return mode === "view" ? permission.view || permission.edit : permission.edit;
}
