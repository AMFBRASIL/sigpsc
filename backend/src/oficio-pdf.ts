import { readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

export type OficioRecord = { data: string; entrada: string; saida: string; horas: number; atividade: string };

export type OficioInput = {
  nome: string;
  processo: string;
  comarca: string;
  uf: string;
  supervisor: string;
  assinante: string;
  cargo: string;
  records: OficioRecord[];
  pacote: { fechadoEm: string; horas: string; periodo: string; dias: number; registros: number };
  numero: string;
  code: string;
  qr: Buffer;
};

const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function longDate(value: string) {
  const [day, month, year] = value.split("/");
  const name = months[Number(month) - 1];
  return day && name && year ? `${Number(day)} de ${name} de ${year}` : value;
}

function displayName(value: string) {
  const clean = value.trim();
  if (!clean || clean === "—") return clean;
  if (clean !== clean.toLocaleUpperCase("pt-BR")) return clean;
  const small = new Set(["de", "da", "do", "das", "dos", "e"]);
  return clean.toLocaleLowerCase("pt-BR").split(/\s+/).map((part, index) => (small.has(part) && index > 0 ? part : part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1))).join(" ");
}

function hourLabel(value: number) {
  const minutes = Math.round(value * 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

function brasao(): Buffer | null {
  const candidates = [path.resolve(process.cwd(), "assets/brasao-paranapanema.png"), path.resolve(__dirname, "../assets/brasao-paranapanema.png")];
  for (const file of candidates) {
    try {
      return readFileSync(file);
    } catch {
      /* try the next location */
    }
  }
  return null;
}

export function renderOficio(input: OficioInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 54, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    drawLetter(doc, input);
    drawAnnex(doc, input);
    doc.end();
  });
}

function drawLetter(doc: PDFKit.PDFDocument, input: OficioInput) {
  const left = 58;
  const width = doc.page.width - left * 2;
  const crest = brasao();
  const crestWidth = 78;
  if (crest) doc.image(crest, left, 40, { fit: [crestWidth, 92] });
  const textX = crest ? left + crestWidth + 12 : left;
  const textW = crest ? width - crestWidth - 12 : width;
  doc.fillColor("#111").font("Times-Bold").fontSize(9).text("PREFEITURA MUNICIPAL DA ESTÂNCIA TURÍSTICA DE", textX, 46, { width: textW, align: "center" });
  doc.font("Times-Bold").fontSize(20).text("PARANAPANEMA", textX, 60, { width: textW, align: "center", characterSpacing: 0.6 });
  const rule = 92;
  doc.lineWidth(1.1).moveTo(textX, rule).lineTo(textX + textW, rule).strokeColor("#111").stroke();
  doc.font("Times-Bold").fontSize(8).text("SECRETARIA DO VERDE E MEIO AMBIENTE", textX, rule + 5, { width: textW, align: "center", characterSpacing: 0.4 });

  const comarca = input.comarca && input.comarca !== "—" ? input.comarca : "Paranapanema";
  const uf = (input.uf || "SP").trim();
  const nome = displayName(input.nome);
  const responsavel = displayName(input.supervisor && input.supervisor !== "—" ? input.supervisor : input.assinante);
  doc.font("Times-Roman").fontSize(12).text(`Estância Turística de Paranapanema, ${longDate(input.pacote.fechadoEm)}.`, left, 162, { width, align: "center" });

  let y = 214;
  doc.font("Times-Bold").fontSize(12);
  for (const line of [
    `Ao Exmo. Sr. Dr. Juiz de Direito da comarca de ${comarca} -${uf}.`,
    `Referente: Execução Penal - ${input.processo}`,
    `Parte interessada: ${nome}`,
  ]) {
    doc.text(line, left, y, { width, align: "left" });
    y = doc.y + 3;
  }

  y += 26;
  doc.font("Times-Roman").fontSize(12).text("Excelentíssimo Senhor Juiz,", left, y, { width });
  const paragraphs = [
    "Esta Secretaria Municipal do Verde e do Meio Ambiente vem, por intermédio deste, ENCAMINHAR a Vossa Excelência o competente relatório de prestação de serviços à comunidade.",
    "Informamos ainda que o relatório anexo aponta os dias e horários de cumprimento da medida.",
    `Por oportuno, ressalte-se que o acompanhamento da prestação dos serviços teve como responsável o Sr. ${responsavel} - funcionário público municipal.`,
    "Sendo o que tinha para o momento, reitero protesto de estima e consideração.",
  ];
  y = doc.y + 22;
  for (const paragraph of paragraphs) {
    doc.font("Times-Roman").fontSize(12).text(paragraph, left, y, { width, align: "justify", indent: 36, lineGap: 3 });
    y = doc.y + 14;
  }

  const signTop = Math.max(y + 36, 548);
  doc.font("Times-Roman").fontSize(12).text("Atenciosamente,", left, signTop, { width, align: "center" });
  const lineWidth = 230;
  const lineX = (doc.page.width - lineWidth) / 2;
  const lineY = signTop + 72;
  doc.lineWidth(0.8).moveTo(lineX, lineY).lineTo(lineX + lineWidth, lineY).stroke();
  const signer = displayName(input.assinante);
  doc.font("Times-Bold").fontSize(11).text(signer, left, lineY + 8, { width, align: "center" });
  const cargo = input.cargo?.trim() || "Servidor público municipal";
  if (cargo.toLocaleLowerCase("pt-BR") !== signer.toLocaleLowerCase("pt-BR")) {
    doc.font("Times-Roman").fontSize(11).text(cargo, left, doc.y + 1, { width, align: "center" });
  }
  doc.font("Times-Roman").fontSize(9).text("Secretaria Municipal do Verde e do Meio Ambiente", left, doc.y + 2, { width, align: "center" });
}

function drawAnnex(doc: PDFKit.PDFDocument, input: OficioInput) {
  doc.addPage();
  const left = 54;
  const width = doc.page.width - left * 2;
  const nome = displayName(input.nome);
  doc.font("Times-Bold").fontSize(13).fillColor("#111").text("RELATÓRIO DE PRESTAÇÃO DE SERVIÇOS À COMUNIDADE", left, 48, { width, align: "center" });
  doc.font("Times-Roman").fontSize(11).text("Anexo — dias e horários de cumprimento da medida", left, doc.y + 4, { width, align: "center" });
  doc.moveDown(1.2);
  doc.fontSize(11).text(`Parte interessada: ${nome}`, left, doc.y, { width });
  doc.text(`Processo: ${input.processo}`);
  doc.text(`Período: ${input.pacote.periodo}`);

  const columns = [
    { label: "Data", width: 78 },
    { label: "Entrada", width: 58 },
    { label: "Saída", width: 58 },
    { label: "Horas", width: 52 },
    { label: "Atividade", width: width - 246 },
  ];
  let y = doc.y + 16;
  const drawHeader = () => {
    doc.rect(left, y, width, 20).fill("#f3f4f6");
    doc.fillColor("#111").font("Times-Bold").fontSize(10);
    let x = left;
    for (const column of columns) {
      doc.text(column.label, x + 4, y + 5, { width: column.width - 8, lineBreak: false });
      x += column.width;
    }
    y += 20;
  };
  drawHeader();
  doc.font("Times-Roman").fontSize(10);
  if (!input.records.length) {
    doc.text("Nenhuma hora validada neste fechamento.", left + 4, y + 8, { width: width - 8 });
    y += 28;
  }
  for (const row of input.records) {
    const activityHeight = doc.heightOfString(row.atividade, { width: columns[4]!.width - 8 });
    const rowHeight = Math.max(20, activityHeight + 8);
    if (y + rowHeight > 760) {
      doc.addPage();
      y = 48;
      drawHeader();
      doc.font("Times-Roman").fontSize(10);
    }
    doc.strokeColor("#d4d4d8").lineWidth(0.4).moveTo(left, y + rowHeight).lineTo(left + width, y + rowHeight).stroke();
    const cells = [row.data, row.entrada, row.saida, hourLabel(row.horas), row.atividade];
    let x = left;
    cells.forEach((cell, index) => {
      doc.fillColor("#111").text(cell, x + 4, y + 5, { width: columns[index]!.width - 8 });
      x += columns[index]!.width;
    });
    y += rowHeight;
  }

  if (y + 28 > 760) {
    doc.addPage();
    y = 48;
  }
  doc.rect(left, y, width, 26).fill("#f3f4f6");
  doc.fillColor("#111").font("Times-Bold").fontSize(11);
  const hoursX = left + columns[0]!.width + columns[1]!.width + columns[2]!.width;
  doc.text("Total de horas do pacote", left + 4, y + 7, { width: hoursX - left - 8, lineBreak: false });
  doc.text(input.pacote.horas, hoursX + 4, y + 7, { width: columns[3]!.width + columns[4]!.width - 8, lineBreak: false });
  y += 34;

  const footerTop = y + 18;
  doc.font("Times-Roman").fontSize(8).fillColor("#444");
  doc.text(`Documento ${input.numero}. Código de verificação ${input.code}.`, left, footerTop, { width: width - 80 });
  doc.text("A confirmação não divulga dados pessoais ou judiciais.", left, doc.y + 2, { width: width - 80 });
  doc.image(input.qr, left + width - 64, footerTop - 4, { width: 58 });
}
