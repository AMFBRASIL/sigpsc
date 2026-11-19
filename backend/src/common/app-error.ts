import { HttpException } from "@nestjs/common";

export class AppError extends HttpException {
  constructor(status: number, message: string, code: string) {
    super({ message, code }, status);
  }
}
