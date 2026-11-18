import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoProvider, useDemo } from "@/lib/daily-demo";
import { HourForm } from "@/components/sigpsc/hour-form";

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
afterEach(cleanup);
function Records() {
  const { records } = useDemo();
  return <output data-testid="records">{JSON.stringify(records)}</output>;
}
describe("Registro em etapas", () => {
  it("envia a duração e a atividade escolhida como um registro pendente", () => {
    render(
      <DemoProvider>
        <HourForm />
        <Records />
      </DemoProvider>,
    );
    fireEvent.change(screen.getByLabelText("Saída"), { target: { value: "12:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Apoio na biblioteca" }));
    fireEvent.click(screen.getByRole("button", { name: "Conferir registro" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar para validação" }));
    const records = JSON.parse(screen.getByTestId("records").textContent ?? "[]");
    expect(records.at(-1)).toMatchObject({
      prestadorId: "1",
      horas: 4.5,
      atividade: "Apoio na biblioteca",
      status: "Pendente",
    });
  });
  it("mantém os horários e a atividade ao voltar para editar", () => {
    render(
      <DemoProvider>
        <HourForm />
      </DemoProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Tarde/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Organização do acervo" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByLabelText("Entrada")).toHaveValue("13:00");
    expect(screen.getByLabelText("Saída")).toHaveValue("17:00");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByLabelText("Atividade realizada")).toHaveValue("Organização do acervo");
  });
});
