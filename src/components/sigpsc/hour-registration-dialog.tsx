import { Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { HourForm } from "@/components/sigpsc/hour-form";

export function HourRegistrationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hour-registration-dialog block h-[min(820px,90dvh)] w-[calc(100%-3rem)] max-w-6xl overflow-hidden border-0 p-0">
        <HourForm onDone={() => onOpenChange(false)} sidebarHeader={
        <DialogHeader className="registration-cover relative isolate overflow-hidden px-7 py-9 text-left text-primary-foreground">
          <img
            src="/images/hour-registration-library.jpg"
            alt=""
            className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 -z-10 bg-registration-shade" />
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Clock className="size-5" />
            Frequência · SIGPSC
          </div>
          <DialogTitle className="font-display text-2xl font-bold leading-tight">Registrar horas</DialogTitle>
          <DialogDescription className="pt-2 text-primary-foreground/90">
            Prestação de serviços à comunidade
          </DialogDescription>
        </DialogHeader>
        } />
      </DialogContent>
    </Dialog>
  );
}
