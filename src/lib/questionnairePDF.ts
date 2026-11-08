// A client's questionnaire answers as a PDF (admin → responses → Export PDF):
// the Thrive logo and pink stripe like the invoices, then each section with
// the question text the client saw and their answer. Runs in the browser.

import { answerText, SERVICE_TYPES, STATUS_LABELS, type AnswerValue, type AssignmentStatus, type Questionnaire } from './questionnaires';

export type QuestionnaireForPDF = {
  questionnaire: Pick<Questionnaire, 'title' | 'service_type' | 'sections'>;
  answers: Record<string, { value: AnswerValue; snapshot: string } | undefined>;
  clientName: string;
  status: AssignmentStatus;
  submittedAt: string | null;
  answered: number;
  total: number;
};

const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '');

async function logo(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch('/new-thrive/logo.png')).blob();
    const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob); });
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = data; });
    return { data, w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    return null;
  }
}

export async function generateQuestionnairePDF(r: QuestionnaireForPDF) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 20, TEXT_W = W - M * 2 - 8;
  let y = M;

  const stripe = () => { doc.setFillColor('#e50586'); doc.rect(W - 7, 0, 7, H, 'F'); };
  const room = (need: number) => {
    if (y + need > H - M) { doc.addPage(); stripe(); y = M; }
  };
  stripe();

  const img = await logo();
  if (img) { const w = 40; doc.addImage(img.data, 'PNG', M, y, w, (w * img.h) / img.w); y += (w * img.h) / img.w + 8; }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor('#0a0a0a');
  doc.text(r.questionnaire.title, M, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor('#6b6b6b');
  const meta = [r.clientName, SERVICE_TYPES[r.questionnaire.service_type], `${r.answered} of ${r.total} answered`,
    r.status === 'submitted' && r.submittedAt ? `Submitted ${fmt(r.submittedAt)}` : STATUS_LABELS[r.status]].filter(Boolean).join('  ·  ');
  doc.text(doc.splitTextToSize(meta, TEXT_W), M, y); y += 10;

  for (const s of r.questionnaire.sections) {
    room(16);
    doc.setDrawColor('#e5e5e5'); doc.line(M, y, W - M - 8, y); y += 7;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor('#e50586');
    doc.text(s.title.toUpperCase(), M, y); y += 7;
    for (const q of s.questions) {
      const a = r.answers[q.id];
      const prompt = doc.setFont('helvetica', 'bold').setFontSize(10).splitTextToSize(a?.snapshot || q.prompt, TEXT_W) as string[];
      const answer = doc.setFont('helvetica', 'normal').setFontSize(10.5).splitTextToSize(answerText(a?.value), TEXT_W) as string[];
      room(prompt.length * 4.6 + Math.min(answer.length, 6) * 5 + 4);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor('#2b2b2b');
      doc.text(prompt, M, y); y += prompt.length * 4.6 + 1;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(answer[0] === '—' ? '#a19d97' : '#0a0a0a');
      for (const line of answer) { room(5); doc.text(line, M, y); y += 5; }
      y += 4;
    }
  }

  const safe = `${r.clientName} ${r.questionnaire.title}`.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');
  doc.save(`${safe || 'questionnaire'}.pdf`);
}
