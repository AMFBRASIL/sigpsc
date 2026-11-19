import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./auth/auth.guard";
import { AuthService } from "./auth/auth.service";
import { AllExceptionsFilter } from "./common/http";
import { AttendanceController, AuthController, DocumentsController, OrdersController, PrestadoresController, PublicController, ReportsController, WorkspaceController } from "./http/api.controller";
import { SettingsController } from "./http/settings.controller";
import { MailService } from "./mail/mail.service";
import { OperationsService } from "./operations.service";
import { PrismaService } from "./prisma.service";
import { RecordsService } from "./records.service";
import { SettingsService } from "./settings.service";

@Module({
  controllers: [AuthController, PrestadoresController, AttendanceController, OrdersController, DocumentsController, ReportsController, WorkspaceController, SettingsController, PublicController],
  providers: [
    PrismaService,
    MailService,
    AuthService,
    RecordsService,
    OperationsService,
    SettingsService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
