interface WeeklyReportData {
  periodLabel: string;
  departmentName?: string;
  stats: {
    totalPv: number;
    totalSeizure: number;
    totalActual: number;
    totalVirtual: number;
    totalPrecautionary: number;
    customs: number;
    currency: number;
    publicLaw: number;
  };
  byDept: { name: string; code: string; count: number; seizure: number }[];
  byOfficer: { name: string; count: number; seizure: number }[];
  byStatus: Record<string, number>;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 0 }).format(v);

const statusLabels: Record<string, string> = {
  draft: "مسودة / Brouillon",
  under_review: "قيد المراجعة / En révision",
  validated: "مصادق / Validé",
  archived: "مؤرشف / Archivé",
};

export default function WeeklyReportPrintTemplate({ periodLabel, departmentName, stats, byDept, byOfficer, byStatus }: WeeklyReportData) {
  return (
    <div className="hidden print:block print-report" dir="rtl" style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}>
      <div className="print-page">
        {/* Header with logo area */}
        <table style={{ width: "100%", marginBottom: "12pt", borderBottom: "2pt solid #1a1a1a", paddingBottom: "8pt" }}>
          <tbody>
            <tr>
              <td style={{ width: "25%", textAlign: "right", verticalAlign: "top", border: "none", padding: "0" }}>
                <img src="/logo-douane.png" alt="" style={{ height: "50pt", objectFit: "contain" }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </td>
              <td style={{ textAlign: "center", verticalAlign: "middle", border: "none", padding: "0" }}>
                <div style={{ fontSize: "10pt" }}>الجمهورية التونسية — République Tunisienne</div>
                <div style={{ fontSize: "8pt", color: "#555" }}>وزارة المالية — Ministère des Finances</div>
                <div style={{ fontSize: "11pt", fontWeight: "bold", marginTop: "2pt" }}>الإدارة العامة للديوانة — Direction Générale des Douanes</div>
                {departmentName && (
                  <div style={{ fontSize: "9pt", marginTop: "2pt", fontWeight: 500 }}>{departmentName}</div>
                )}
              </td>
              <td style={{ width: "25%", textAlign: "left", verticalAlign: "top", border: "none", padding: "0" }}>
                <div style={{ fontSize: "7pt", color: "#888" }}>
                  طبع: {new Date().toLocaleDateString("fr-TN")}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Report title */}
        <div style={{ textAlign: "center", marginBottom: "14pt" }}>
          <h1 style={{ fontSize: "14pt", fontWeight: "bold", margin: "0 0 4pt 0" }}>التقرير الدوري — Rapport périodique</h1>
          <div style={{ fontSize: "9pt" }}>{periodLabel}</div>
          <div style={{ fontSize: "7.5pt", color: "#888", marginTop: "2pt" }}>
            تاريخ الطباعة: {new Date().toLocaleDateString("fr-TN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>

        {/* KPI Summary Box */}
        <table style={{ width: "100%", border: "1.5pt solid #333", marginBottom: "14pt", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th colSpan={4} style={{ textAlign: "right", fontSize: "9pt", fontWeight: "bold", padding: "4pt 6pt", borderBottom: "1pt solid #333", background: "#f5f5f5" }}>
                المؤشرات الرئيسية — Indicateurs clés
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ textAlign: "center", padding: "6pt 4pt", width: "25%", border: "none" }}>
                <div style={{ fontSize: "7.5pt", color: "#666" }}>مجموع المحاضر</div>
                <div style={{ fontSize: "16pt", fontWeight: "bold", fontFamily: "monospace" }}>{stats.totalPv}</div>
                <div style={{ fontSize: "6.5pt", color: "#999" }}>Total PV</div>
              </td>
              <td style={{ textAlign: "center", padding: "6pt 4pt", width: "25%", border: "none" }}>
                <div style={{ fontSize: "7.5pt", color: "#666" }}>المحجوز الكلي (د.ت)</div>
                <div style={{ fontSize: "16pt", fontWeight: "bold", fontFamily: "monospace" }}>{fmt(stats.totalSeizure)}</div>
                <div style={{ fontSize: "6.5pt", color: "#999" }}>Total saisies</div>
              </td>
              <td style={{ textAlign: "center", padding: "6pt 4pt", width: "25%", border: "none" }}>
                <div style={{ fontSize: "7.5pt", color: "#666" }}>المحجوز الفعلي</div>
                <div style={{ fontSize: "16pt", fontWeight: "bold", fontFamily: "monospace" }}>{fmt(stats.totalActual)}</div>
                <div style={{ fontSize: "6.5pt", color: "#999" }}>Saisies réelles</div>
              </td>
              <td style={{ textAlign: "center", padding: "6pt 4pt", width: "25%", border: "none" }}>
                <div style={{ fontSize: "7.5pt", color: "#666" }}>المحجوز الصوري</div>
                <div style={{ fontSize: "16pt", fontWeight: "bold", fontFamily: "monospace" }}>{fmt(stats.totalVirtual)}</div>
                <div style={{ fontSize: "6.5pt", color: "#999" }}>Saisies fictives</div>
              </td>
            </tr>
            <tr style={{ borderTop: "0.5pt solid #ccc" }}>
              <td style={{ textAlign: "center", padding: "4pt", border: "none" }}>
                <div style={{ fontSize: "7.5pt", color: "#666" }}>مخالفات ديوانية</div>
                <div style={{ fontSize: "12pt", fontWeight: "bold", fontFamily: "monospace" }}>{stats.customs}</div>
              </td>
              <td style={{ textAlign: "center", padding: "4pt", border: "none" }}>
                <div style={{ fontSize: "7.5pt", color: "#666" }}>مخالفات صرفية</div>
                <div style={{ fontSize: "12pt", fontWeight: "bold", fontFamily: "monospace" }}>{stats.currency}</div>
              </td>
              <td style={{ textAlign: "center", padding: "4pt", border: "none" }}>
                <div style={{ fontSize: "7.5pt", color: "#666" }}>مخالفات حق عام</div>
                <div style={{ fontSize: "12pt", fontWeight: "bold", fontFamily: "monospace" }}>{stats.publicLaw}</div>
              </td>
              <td style={{ textAlign: "center", padding: "4pt", border: "none" }}>
                <div style={{ fontSize: "7.5pt", color: "#666" }}>المحجوز التحفظي</div>
                <div style={{ fontSize: "12pt", fontWeight: "bold", fontFamily: "monospace" }}>{fmt(stats.totalPrecautionary)}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Status breakdown */}
        <div style={{ marginBottom: "12pt" }}>
          <div style={{ fontSize: "9pt", fontWeight: "bold", borderBottom: "1pt solid #333", paddingBottom: "2pt", marginBottom: "4pt" }}>
            توزيع حسب الحالة — Répartition par statut
          </div>
          <div style={{ display: "flex", gap: "16pt", fontSize: "8pt" }}>
            {Object.entries(byStatus).map(([k, v]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: "4pt" }}>
                <span style={{ display: "inline-block", width: "8pt", height: "8pt", border: "0.5pt solid #333" }} />
                <span>{statusLabels[k] || k}: <strong style={{ fontFamily: "monospace" }}>{v}</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* Department table */}
        <div style={{ marginBottom: "12pt" }}>
          <div style={{ fontSize: "9pt", fontWeight: "bold", borderBottom: "1pt solid #333", paddingBottom: "2pt", marginBottom: "4pt" }}>
            التفصيل حسب القسم — Détail par département
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt" }}>
            <thead>
              <tr style={{ borderBottom: "1pt solid #333" }}>
                <th style={{ padding: "3pt 2pt", textAlign: "right" }}>#</th>
                <th style={{ padding: "3pt 2pt", textAlign: "right" }}>القسم — Département</th>
                <th style={{ padding: "3pt 2pt", textAlign: "right" }}>Code</th>
                <th style={{ padding: "3pt 2pt", textAlign: "left" }}>عدد المحاضر</th>
                <th style={{ padding: "3pt 2pt", textAlign: "left" }}>المحجوز (د.ت)</th>
                <th style={{ padding: "3pt 2pt", textAlign: "left" }}>%</th>
              </tr>
            </thead>
            <tbody>
              {byDept.map((d, i) => (
                <tr key={d.code} style={{ borderBottom: "0.5pt solid #ddd" }}>
                  <td style={{ padding: "2pt", fontFamily: "monospace" }}>{i + 1}</td>
                  <td style={{ padding: "2pt" }}>{d.name}</td>
                  <td style={{ padding: "2pt", fontFamily: "monospace" }}>{d.code}</td>
                  <td style={{ padding: "2pt", textAlign: "left", fontFamily: "monospace" }}>{d.count}</td>
                  <td style={{ padding: "2pt", textAlign: "left", fontFamily: "monospace" }}>{fmt(d.seizure)}</td>
                  <td style={{ padding: "2pt", textAlign: "left", fontFamily: "monospace" }}>
                    {stats.totalPv > 0 ? ((d.count / stats.totalPv) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: "1.5pt solid #333", fontWeight: "bold" }}>
                <td style={{ padding: "3pt 2pt" }} colSpan={3}>المجموع — Total</td>
                <td style={{ padding: "3pt 2pt", textAlign: "left", fontFamily: "monospace" }}>{stats.totalPv}</td>
                <td style={{ padding: "3pt 2pt", textAlign: "left", fontFamily: "monospace" }}>{fmt(stats.totalSeizure)}</td>
                <td style={{ padding: "3pt 2pt", textAlign: "left", fontFamily: "monospace" }}>100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Officer table */}
        <div style={{ marginBottom: "12pt" }}>
          <div style={{ fontSize: "9pt", fontWeight: "bold", borderBottom: "1pt solid #333", paddingBottom: "2pt", marginBottom: "4pt" }}>
            التفصيل حسب الضابط — Détail par officier
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt" }}>
            <thead>
              <tr style={{ borderBottom: "1pt solid #333" }}>
                <th style={{ padding: "3pt 2pt", textAlign: "right" }}>#</th>
                <th style={{ padding: "3pt 2pt", textAlign: "right" }}>الضابط — Officier</th>
                <th style={{ padding: "3pt 2pt", textAlign: "left" }}>عدد المحاضر</th>
                <th style={{ padding: "3pt 2pt", textAlign: "left" }}>المحجوز (د.ت)</th>
                <th style={{ padding: "3pt 2pt", textAlign: "left" }}>المعدل / محضر</th>
              </tr>
            </thead>
            <tbody>
              {byOfficer.slice(0, 20).map((o, i) => (
                <tr key={o.name + i} style={{ borderBottom: "0.5pt solid #ddd" }}>
                  <td style={{ padding: "2pt", fontFamily: "monospace" }}>{i + 1}</td>
                  <td style={{ padding: "2pt" }}>{o.name}</td>
                  <td style={{ padding: "2pt", textAlign: "left", fontFamily: "monospace" }}>{o.count}</td>
                  <td style={{ padding: "2pt", textAlign: "left", fontFamily: "monospace" }}>{fmt(o.seizure)}</td>
                  <td style={{ padding: "2pt", textAlign: "left", fontFamily: "monospace" }}>
                    {o.count > 0 ? fmt(Math.round(o.seizure / o.count)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div style={{ marginTop: "30pt", display: "flex", justifyContent: "space-between", fontSize: "8pt", textAlign: "center" }}>
          <div style={{ width: "40%" }}>
            <div style={{ fontWeight: 500, marginBottom: "40pt" }}>رئيس مصلحة المحاضر</div>
            <div style={{ borderTop: "0.5pt solid #333", paddingTop: "2pt" }}>Chef du service contentieux</div>
          </div>
          <div style={{ width: "40%" }}>
            <div style={{ fontWeight: 500, marginBottom: "40pt" }}>المدير الجهوي</div>
            <div style={{ borderTop: "0.5pt solid #333", paddingTop: "2pt" }}>Directeur régional</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: "20pt", paddingTop: "4pt", borderTop: "0.5pt solid #999", fontSize: "6.5pt", color: "#888", display: "flex", justifyContent: "space-between" }}>
          <span>طبع بتاريخ: {new Date().toLocaleDateString("fr-TN")}</span>
          <span>© {new Date().getFullYear()} العقيد حاتم شبشوب — إدارة الأبحاث الديوانية · v1.11 beta 2026</span>
        </div>
      </div>
    </div>
  );
}
