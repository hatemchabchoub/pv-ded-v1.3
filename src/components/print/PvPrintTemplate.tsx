interface PvPrintData {
  pv: any;
  offenders: any[];
  violations: any[];
  seizures: any[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3 }).format(v);

const S = {
  page: { fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" } as React.CSSProperties,
  sectionTitle: { fontSize: "9pt", fontWeight: "bold" as const, borderBottom: "1pt solid #333", paddingBottom: "2pt", marginBottom: "4pt" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: "8pt" },
  th: { padding: "3pt 2pt", textAlign: "right" as const, borderBottom: "1pt solid #333", fontWeight: "bold" as const },
  thEnd: { padding: "3pt 2pt", textAlign: "left" as const, borderBottom: "1pt solid #333", fontWeight: "bold" as const },
  td: { padding: "2pt", borderBottom: "0.5pt solid #ddd" },
  tdEnd: { padding: "2pt", textAlign: "left" as const, fontFamily: "monospace", borderBottom: "0.5pt solid #ddd" },
  mono: { fontFamily: "monospace" },
  muted: { color: "#888", fontSize: "7.5pt" },
};

export default function PvPrintTemplate({ pv, offenders, violations, seizures }: PvPrintData) {
  return (
    <div className="hidden print:block print-pv" dir="rtl" style={S.page}>
      <div className="print-page">
        {/* Header */}
        <table style={{ width: "100%", marginBottom: "10pt", borderBottom: "2pt solid #1a1a1a", paddingBottom: "6pt" }}>
          <tbody>
            <tr>
              <td style={{ width: "30%", textAlign: "right", verticalAlign: "top", border: "none", padding: "0" }}>
                <img src="/logo-douane.png" alt="" style={{ height: "45pt", objectFit: "contain" }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div style={{ fontSize: "7.5pt", marginTop: "4pt" }}>
                  <div>القسم: {pv.departments?.name_ar || "—"}</div>
                  <div>الضابط: {pv.officers?.full_name || "—"}</div>
                  <div>الرتبة: {pv.officers?.rank_label || "—"}</div>
                </div>
              </td>
              <td style={{ textAlign: "center", verticalAlign: "middle", border: "none", padding: "0" }}>
                <div style={{ fontSize: "9pt" }}>الجمهورية التونسية</div>
                <div style={{ fontSize: "7.5pt", color: "#555" }}>وزارة المالية</div>
                <div style={{ fontSize: "11pt", fontWeight: "bold", marginTop: "2pt" }}>الإدارة العامة للديوانة</div>
              </td>
              <td style={{ width: "30%", textAlign: "left", verticalAlign: "top", border: "none", padding: "0" }} dir="ltr">
                <div style={{ fontSize: "9pt" }}>République Tunisienne</div>
                <div style={{ fontSize: "7.5pt", color: "#555" }}>Ministère des Finances</div>
                <div style={{ fontSize: "10pt", fontWeight: 600 }}>Direction Générale des Douanes</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* PV Title */}
        <div style={{ textAlign: "center", marginBottom: "12pt" }}>
          <h1 style={{ fontSize: "13pt", fontWeight: "bold", margin: "0" }}>
            {pv.pv_type === "ضلع" ? "ضلع حجز" : "محضر حجز"}
          </h1>
          <h2 style={{ fontSize: "11pt", fontWeight: "bold", margin: "2pt 0 0 0" }} dir="ltr">
            {pv.pv_type === "ضلع" ? "Aile de saisie" : "Procès-verbal de saisie"}
          </h2>
          <div style={{ display: "flex", justifyContent: "center", gap: "20pt", marginTop: "6pt", fontSize: "9pt" }}>
            <span>عدد: <strong style={S.mono}>{pv.pv_number}</strong></span>
            <span>المرجع: <strong style={S.mono} dir="ltr">{pv.internal_reference}</strong></span>
            <span>التاريخ: <strong>{pv.pv_date}</strong></span>
          </div>
        </div>


        {/* Referral */}
        <div style={{ marginBottom: "10pt" }}>
          <div style={S.sectionTitle}>الإحالة — Saisine</div>
          <div style={{ display: "flex", gap: "20pt", fontSize: "8pt" }}>
            <div><span style={{ color: "#666" }}>طبيعة الإحالة: </span><strong>{pv.referral_type || "—"}</strong></div>
            <div><span style={{ color: "#666" }}>الحالة: </span><strong>{pv.case_status || "—"}</strong></div>
          </div>
        </div>

        {/* Offenders */}
        <div style={{ marginBottom: "10pt" }}>
          <div style={S.sectionTitle}>المخالفون — Contrevenants ({offenders.length})</div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>#</th>
                <th style={S.th}>الإسم أو الشركة</th>
                <th style={S.th}>المعرف</th>
                <th style={S.th}>النوع</th>
                <th style={S.th}>العنوان</th>
              </tr>
            </thead>
            <tbody>
              {offenders.map((o, i) => (
                <tr key={o.id}>
                  <td style={S.td}>{i + 1}</td>
                  <td style={{ ...S.td, fontWeight: 500 }}>{o.name_or_company}</td>
                  <td style={{ ...S.td, ...S.mono }}>{o.identifier || "—"}</td>
                  <td style={S.td}>{o.person_type === "physical" ? "شخص طبيعي" : "شخص معنوي"}</td>
                  <td style={S.td}>{[o.address, o.city].filter(Boolean).join(", ") || "—"}</td>
                </tr>
              ))}
              {offenders.length === 0 && (
                <tr><td colSpan={5} style={{ ...S.td, textAlign: "center", color: "#999" }}>—</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Violations */}
        <div style={{ marginBottom: "10pt" }}>
          <div style={S.sectionTitle}>المخالفات — Infractions ({violations.length})</div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>#</th>
                <th style={S.th}>المخالفة</th>
                <th style={S.th}>الصنف</th>
                <th style={S.th}>الأساس القانوني</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((v, i) => (
                <tr key={v.id}>
                  <td style={S.td}>{i + 1}</td>
                  <td style={{ ...S.td, fontWeight: 500 }}>{v.violation_label}</td>
                  <td style={S.td}>{v.violation_category || "—"}</td>
                  <td style={S.td}>{v.legal_basis || "—"}</td>
                </tr>
              ))}
              {violations.length === 0 && (
                <tr><td colSpan={4} style={{ ...S.td, textAlign: "center", color: "#999" }}>—</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Seizures */}
        <div style={{ marginBottom: "10pt" }}>
          <div style={S.sectionTitle}>المحجوزات — Saisies ({seizures.length})</div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>الصنف</th>
                <th style={S.th}>النوع</th>
                <th style={S.thEnd}>الكمية</th>
                <th style={S.th}>الوحدة</th>
                <th style={S.thEnd}>القيمة (د.ت)</th>
                <th style={S.th}>نوع الحجز</th>
              </tr>
            </thead>
            <tbody>
              {seizures.map((s) => (
                <tr key={s.id}>
                  <td style={S.td}>{s.goods_category || "—"}</td>
                  <td style={S.td}>{s.goods_type || "—"}</td>
                  <td style={S.tdEnd}>{Number(s.quantity).toLocaleString()}</td>
                  <td style={S.td}>{s.unit || "—"}</td>
                  <td style={S.tdEnd}>{fmt(Number(s.estimated_value) || 0)}</td>
                  <td style={S.td}>
                    {s.seizure_type === "actual" ? "فعلي" : s.seizure_type === "virtual" ? "صوري" : s.seizure_type === "precautionary" ? "تحفظي" : "—"}
                  </td>
                </tr>
              ))}
              {seizures.length === 0 && (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", color: "#999" }}>—</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Seizure Summary */}
        <table style={{ width: "100%", border: "1.5pt solid #333", marginBottom: "12pt", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th colSpan={4} style={{ textAlign: "right", fontSize: "9pt", fontWeight: "bold", padding: "3pt 6pt", borderBottom: "1pt solid #333", background: "#f5f5f5" }}>
                ملخص المحجوزات — Récapitulatif
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ textAlign: "center", padding: "4pt", fontSize: "8pt", width: "25%", border: "none" }}>
                <div style={{ color: "#666" }}>المحجوز الفعلي</div>
                <div style={{ fontWeight: "bold", fontFamily: "monospace", fontSize: "10pt" }}>{fmt(Number(pv.total_actual_seizure) || 0)}</div>
              </td>
              <td style={{ textAlign: "center", padding: "4pt", fontSize: "8pt", width: "25%", border: "none" }}>
                <div style={{ color: "#666" }}>المحجوز الصوري</div>
                <div style={{ fontWeight: "bold", fontFamily: "monospace", fontSize: "10pt" }}>{fmt(Number(pv.total_virtual_seizure) || 0)}</div>
              </td>
              <td style={{ textAlign: "center", padding: "4pt", fontSize: "8pt", width: "25%", border: "none" }}>
                <div style={{ color: "#666" }}>المحجوز التحفظي</div>
                <div style={{ fontWeight: "bold", fontFamily: "monospace", fontSize: "10pt" }}>{fmt(Number(pv.total_precautionary_seizure) || 0)}</div>
              </td>
              <td style={{ textAlign: "center", padding: "4pt", fontSize: "8pt", width: "25%", border: "none" }}>
                <div style={{ color: "#666" }}>المجموع الكلي</div>
                <div style={{ fontWeight: "bold", fontFamily: "monospace", fontSize: "12pt" }}>{fmt(Number(pv.total_seizure) || 0)} د.ت</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Notes */}
        {pv.notes && (
          <div style={{ marginBottom: "12pt" }}>
            <div style={S.sectionTitle}>ملاحظات — Observations</div>
            <div style={{ fontSize: "8pt", whiteSpace: "pre-wrap" }}>{pv.notes}</div>
          </div>
        )}

        {/* Signatures */}
        <div style={{ marginTop: "28pt", display: "flex", justifyContent: "space-between", fontSize: "8pt", textAlign: "center" }}>
          <div style={{ width: "30%" }}>
            <div style={{ fontWeight: 500, marginBottom: "36pt" }}>الضابط المحرر</div>
            <div style={{ borderTop: "0.5pt solid #333", paddingTop: "2pt" }}>Agent verbalisateur</div>
            <div style={{ marginTop: "2pt", color: "#666", fontSize: "7pt" }}>{pv.officers?.full_name || ""}</div>
          </div>
          <div style={{ width: "30%" }}>
            <div style={{ fontWeight: 500, marginBottom: "36pt" }}>رئيس القسم</div>
            <div style={{ borderTop: "0.5pt solid #333", paddingTop: "2pt" }}>Chef de division</div>
          </div>
          <div style={{ width: "30%" }}>
            <div style={{ fontWeight: 500, marginBottom: "36pt" }}>المدير الجهوي</div>
            <div style={{ borderTop: "0.5pt solid #333", paddingTop: "2pt" }}>Directeur régional</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: "16pt", paddingTop: "4pt", borderTop: "0.5pt solid #999", fontSize: "6.5pt", color: "#888", display: "flex", justifyContent: "space-between" }}>
          <span>طبع بتاريخ: {new Date().toLocaleDateString("fr-TN")}</span>
          <span>المرجع: {pv.internal_reference}</span>
          <span>© {new Date().getFullYear()} العقيد حاتم شبشوب — إدارة الأبحاث الديوانية · v1.11 beta 2026</span>
        </div>
      </div>
    </div>
  );
}
