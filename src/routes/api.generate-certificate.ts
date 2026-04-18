import { createFileRoute } from "@tanstack/react-router";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Body = z.object({
  application_id: z.string().uuid(),
});

export const Route = createFileRoute("/api/generate-certificate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const json = await request.json();
          const parsed = Body.safeParse(json);
          if (!parsed.success) {
            return Response.json({ error: "Invalid body" }, { status: 400 });
          }
          const { application_id } = parsed.data;

          // Fetch application + student
          const { data: app, error: appErr } = await supabaseAdmin
            .from("applications")
            .select("*")
            .eq("id", application_id)
            .maybeSingle();
          if (appErr || !app) {
            return Response.json({ error: "Application not found" }, { status: 404 });
          }
          if (app.status !== "principal_approved" && app.current_stage !== "completed") {
            return Response.json(
              { error: "Application not yet approved by principal" },
              { status: 400 },
            );
          }

          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("*")
            .eq("id", app.student_id)
            .maybeSingle();

          // Reuse existing certificate row or create one
          const { data: existing } = await supabaseAdmin
            .from("certificates")
            .select("*")
            .eq("application_id", application_id)
            .maybeSingle();

          const certId = existing?.id ?? crypto.randomUUID();

          // Public verify URL — use request origin
          const origin = new URL(request.url).origin;
          const verifyUrl = `${origin}/certificate/${certId}`;

          // QR code as PNG data URL
          const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
            width: 256,
            margin: 1,
            color: { dark: "#003153", light: "#ffffff" },
          });

          // Build PDF
          const pdf = await PDFDocument.create();
          const page = pdf.addPage([595, 842]); // A4 portrait
          const helv = await pdf.embedFont(StandardFonts.Helvetica);
          const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
          const blue = rgb(0, 49 / 255, 83 / 255);

          // Header bar
          page.drawRectangle({ x: 0, y: 770, width: 595, height: 72, color: blue });
          page.drawText("NEXUS", { x: 40, y: 800, size: 22, font: bold, color: rgb(1, 1, 1) });
          page.drawText("Automated Clearance Protocol", {
            x: 40, y: 782, size: 10, font: helv, color: rgb(1, 1, 1),
          });
          page.drawText(`Certificate ID: ${certId.slice(0, 8).toUpperCase()}`, {
            x: 380, y: 800, size: 9, font: helv, color: rgb(1, 1, 1),
          });

          // Title
          page.drawText("DIGITAL NO-DUES CERTIFICATE", {
            x: 78, y: 700, size: 22, font: bold, color: blue,
          });
          page.drawLine({
            start: { x: 78, y: 692 }, end: { x: 517, y: 692 },
            thickness: 1, color: blue,
          });

          // Body
          let y = 640;
          const drawField = (label: string, value: string) => {
            page.drawText(label, { x: 80, y, size: 9, font: helv, color: rgb(0.45, 0.45, 0.45) });
            page.drawText(value || "—", {
              x: 220, y, size: 12, font: bold, color: rgb(0.1, 0.1, 0.1),
            });
            y -= 28;
          };
          drawField("Student name", profile?.full_name ?? "—");
          drawField("Roll number", profile?.roll_no ?? "—");
          drawField("Department", profile?.department ?? "—");
          drawField("Approved on", new Date(app.updated_at).toLocaleString());
          drawField("Application ID", app.id);

          // Statement
          y -= 10;
          const statement =
            "This is to certify that the student named above has cleared all institutional dues and has obtained no-dues clearance from Lab in-charge, Head of Department, and the Principal as per the digital chain of custody recorded in the Nexus system.";
          drawWrapped(page, statement, { x: 80, y, width: 350, font: helv, size: 11, color: rgb(0.15, 0.15, 0.15), lineHeight: 16 });

          // Transcript box (chain of custody)
          y -= 140;
          page.drawRectangle({
            x: 70, y: y - 110, width: 455, height: 130,
            borderColor: blue, borderWidth: 0.8, color: rgb(0.97, 0.98, 1),
          });
          page.drawText("CHAIN OF CUSTODY", {
            x: 80, y: y + 5, size: 10, font: bold, color: blue,
          });
          let chainY = y - 12;
          const chain = Array.isArray(app.chain_of_custody) ? (app.chain_of_custody as Array<Record<string, unknown>>) : [];
          chain.slice(0, 6).forEach((c) => {
            const event = String(c.event ?? "—");
            const stage = c.stage ? ` (${c.stage})` : "";
            const at = c.at ? new Date(String(c.at)).toLocaleString() : "";
            page.drawText(`• ${event}${stage} — ${at}`, {
              x: 88, y: chainY, size: 9, font: helv, color: rgb(0.2, 0.2, 0.2),
            });
            chainY -= 15;
          });

          // QR code
          const qrBytes = Uint8Array.from(
            atob(qrDataUrl.split(",")[1]),
            (c) => c.charCodeAt(0),
          );
          const qrImage = await pdf.embedPng(qrBytes);
          page.drawImage(qrImage, { x: 450, y: 600, width: 90, height: 90 });
          page.drawText("Scan to verify", {
            x: 458, y: 590, size: 8, font: helv, color: rgb(0.4, 0.4, 0.4),
          });

          // Footer
          page.drawText(`Verify: ${verifyUrl}`, {
            x: 40, y: 40, size: 8, font: helv, color: rgb(0.4, 0.4, 0.4),
          });
          page.drawText("This document is system-generated and tamper-evident.", {
            x: 40, y: 26, size: 8, font: helv, color: rgb(0.4, 0.4, 0.4),
          });

          const pdfBytes = await pdf.save();

          // Upload to public bucket
          const path = `${app.student_id}/${certId}.pdf`;
          const up = await supabaseAdmin.storage
            .from("nexus-certificates")
            .upload(path, pdfBytes, {
              contentType: "application/pdf",
              upsert: true,
            });
          if (up.error) {
            return Response.json({ error: up.error.message }, { status: 500 });
          }
          const { data: pub } = supabaseAdmin.storage
            .from("nexus-certificates")
            .getPublicUrl(path);

          // Upsert certificate row
          if (existing) {
            await supabaseAdmin
              .from("certificates")
              .update({
                certificate_url: pub.publicUrl,
                qr_code_url: verifyUrl,
                issued_at: new Date().toISOString(),
              })
              .eq("id", certId);
          } else {
            await supabaseAdmin.from("certificates").insert({
              id: certId,
              application_id: application_id,
              certificate_url: pub.publicUrl,
              qr_code_url: verifyUrl,
            });
          }

          // Mark application completed
          await supabaseAdmin
            .from("applications")
            .update({ current_stage: "completed" })
            .eq("id", application_id);

          return Response.json({
            ok: true,
            certificate_id: certId,
            url: pub.publicUrl,
            verify_url: verifyUrl,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Server error";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});

function drawWrapped(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  opts: {
    x: number;
    y: number;
    width: number;
    font: import("pdf-lib").PDFFont;
    size: number;
    color: ReturnType<typeof rgb>;
    lineHeight: number;
  },
) {
  const words = text.split(" ");
  let line = "";
  let y = opts.y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const width = opts.font.widthOfTextAtSize(test, opts.size);
    if (width > opts.width) {
      page.drawText(line, { x: opts.x, y, size: opts.size, font: opts.font, color: opts.color });
      y -= opts.lineHeight;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) {
    page.drawText(line, { x: opts.x, y, size: opts.size, font: opts.font, color: opts.color });
  }
}
