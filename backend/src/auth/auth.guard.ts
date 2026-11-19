import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { AppError } from "../common/app-error";
import { AuthService } from "./auth.service";
import { allows, IS_PUBLIC, SCREEN, type Actor } from "./actor";

export type AuthedRequest = Request & { actor?: Actor };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector, @Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const actor = await this.auth.actorFromRequest(request);
    if (actor) request.actor = actor;
    if (isPublic) return true;
    if (!actor) throw new AppError(401, "Sessão expirada ou ausente.", "SESSAO");
    const screen = this.reflector.getAllAndOverride<{ id: string; mode: "view" | "edit" } | undefined>(SCREEN, [context.getHandler(), context.getClass()]);
    if (screen && !allows(actor, screen.id, screen.mode)) throw new AppError(403, "Sem permissão para esta operação.", "PERMISSAO");
    return true;
  }
}

export function actorOf(request: AuthedRequest): Actor {
  if (!request.actor) throw new AppError(401, "Sessão expirada ou ausente.", "SESSAO");
  return request.actor;
}
