import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { ensureReady } from "./bootstrap";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
    await ensureReady(this);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
