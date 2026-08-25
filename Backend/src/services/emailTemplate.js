// src/services/emailTemplates.js
// ─────────────────────────────────────────────────────────────────────────────
// HTML Email Templates — all 4 notification conditions
// All CSS is inline (required for Outlook / Office 365).
// Place this file at:  src/services/emailTemplates.js
// ─────────────────────────────────────────────────────────────────────────────

const APP_URL = process.env.APP_URL || "https://timetrack.abhiyantatech.com";

const fmtMins = (m) => {
  const h = Math.floor(m / 60),
    min = m % 60;
  return h > 0 && min > 0 ? `${h}h ${min}m` : h > 0 ? `${h}h` : `${min}m`;
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

// ─── Layout wrapper ───────────────────────────────────────────────────────────
const wrap = (
  accentColor,
  headerIcon,
  headerTitle,
  bodyContent,
) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${headerTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:32px 16px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">
    <tr>
      <td align="center" style="background-color:${accentColor};padding:30px 36px;">
        <div style="font-size:36px;line-height:1;margin-bottom:10px;">${headerIcon}</div>
        <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">${headerTitle}</div>
        <div style="color:rgba(255,255,255,0.72);font-size:11px;margin-top:6px;text-transform:uppercase;letter-spacing:1.5px;">Abhiyanta Timesheet System</div>
      </td>
    </tr>
    <tr>
      <td style="padding:36px 36px 28px 36px;">${bodyContent}</td>
    </tr>
    <tr>
      <td align="center" style="background-color:#f8f9fb;padding:18px 36px;border-top:1px solid #e8eaed;">
        <p style="margin:0;font-size:11px;color:#9aa0a6;line-height:1.7;">
          This is an automated message. Please do not reply to this email.<br/>
          &copy; ${new Date().getFullYear()} Abhiyanta Information Systems Pvt. Ltd.
        </p>
      </td>
    </tr>
  </table>
  </td></tr>
</table>
</body>
</html>`;

const greeting = (name) =>
  `<p style="margin:0 0 18px 0;font-size:16px;color:#202124;">Hi <strong>${name}</strong>,</p>`;

const para = (html) =>
  `<p style="margin:0 0 16px 0;font-size:14px;color:#5f6368;line-height:1.65;">${html}</p>`;

const sectionLabel = (text) =>
  `<p style="margin:26px 0 8px 0;font-size:11px;font-weight:700;color:#9aa0a6;text-transform:uppercase;letter-spacing:1.2px;">${text}</p>`;

const infoRow = (label, valueHtml, isLast = false) =>
  `<tr>
    <td style="padding:10px 16px;font-size:13px;color:#5f6368;font-weight:600;width:155px;vertical-align:top;${isLast ? "" : "border-bottom:1px solid #f0f2f5;"}">${label}</td>
    <td style="padding:10px 16px;font-size:13px;color:#202124;vertical-align:top;${isLast ? "" : "border-bottom:1px solid #f0f2f5;"}">${valueHtml}</td>
  </tr>`;

const infoCard = (rowsHtml) =>
  `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8eaed;border-radius:8px;overflow:hidden;margin:6px 0 0;">${rowsHtml}</table>`;

const btn = (label, url, bg) =>
  `<table cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;">
    <tr><td style="border-radius:6px;background-color:${bg};">
      <a href="${url}" style="display:inline-block;padding:13px 30px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">${label} &rarr;</a>
    </td></tr>
  </table>`;

const pill = (text, bg, color) =>
  `<span style="display:inline-block;background-color:${bg};color:${color};font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.5px;">${text}</span>`;

const mono = (text) =>
  `<span style="font-family:'Courier New',Courier,monospace;background-color:#f1f3f4;padding:2px 7px;border-radius:4px;font-size:12px;color:#202124;">${text}</span>`;

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE 1 — MISSED / INCOMPLETE TIMESHEET REMINDER
// { firstName, lastName, logged (minutes), displayDate }
// ═══════════════════════════════════════════════════════════════════
export const missedTimesheetTemplate = ({
  firstName,
  lastName,
  logged,
  displayDate,
}) => {
  const remaining = 480 - logged;
  const isZero = logged === 0;
  const pct = Math.min(Math.round((logged / 480) * 100), 100);
  const accent = isZero ? "#d93025" : "#f29900";

  const statusBadge = isZero
    ? pill("No Entry", "#fce8e6", "#c5221f")
    : pill("Incomplete", "#fef3e2", "#b06000");

  const progressBar = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 4px;">
      <tr>
        <td style="font-size:12px;color:#5f6368;">Today&rsquo;s progress</td>
        <td align="right" style="font-size:12px;font-weight:600;color:#202124;">${fmtMins(logged)} / 8h</td>
      </tr>
    </table>
    <div style="background-color:#e8eaed;border-radius:4px;height:10px;overflow:hidden;">
      <div style="background-color:${accent};height:10px;border-radius:4px;width:${pct}%;"></div>
    </div>
    <div style="font-size:11px;color:#9aa0a6;margin-top:5px;">${pct}% complete &bull; ${fmtMins(remaining)} still needed</div>`;

  const bodyContent =
    greeting(`${firstName} ${lastName}`) +
    para(
      isZero
        ? `You have <strong>no timesheet entry</strong> recorded for today (<strong>${displayDate}</strong>). Daily entries are required &mdash; please fill in your hours before the day ends.`
        : `You have only logged <strong>${fmtMins(logged)}</strong> out of the required <strong>8 hours</strong> for today (<strong>${displayDate}</strong>). You still need <strong>${fmtMins(remaining)}</strong> more.`,
    ) +
    `<div style="background-color:#f8f9fb;border-radius:8px;padding:18px 22px;">
      <div style="margin-bottom:6px;">${statusBadge}</div>
      ${progressBar}
    </div>` +
    btn("Fill Timesheet Now", `${APP_URL}/timesheet`, accent);

  return wrap(accent, isZero ? "⚠️" : "⏰", "Timesheet Reminder", bodyContent);
};

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE 2 — TIMESHEET SUBMITTED FOR APPROVAL (sent to manager)
// { mgrFirstName, mgrLastName, empName, weekLabel, totalMins,
//   entries[{ entry_date, project_name, ticket_name, ticket_code, total_hours }] }
// ═══════════════════════════════════════════════════════════════════
export const timesheetSubmittedTemplate = ({
  mgrFirstName,
  mgrLastName,
  empName,
  weekLabel,
  totalMins,
  entries,
}) => {
  const accent = "#1a73e8";

  const tableRows = entries
    .map(
      (e, i) =>
        `<tr style="background-color:${i % 2 === 1 ? "#fafbff" : "#ffffff"};">
      <td style="padding:9px 13px;font-size:12px;color:#5f6368;border-bottom:1px solid #f0f2f5;white-space:nowrap;">${fmtDate(e.entry_date)}</td>
      <td style="padding:9px 13px;font-size:12px;color:#202124;border-bottom:1px solid #f0f2f5;">${e.project_name || "—"}</td>
      <td style="padding:9px 13px;font-size:12px;color:#202124;border-bottom:1px solid #f0f2f5;">${e.ticket_name || "—"} <span style="color:#9aa0a6;font-size:11px;">[${e.ticket_code || "—"}]</span></td>
      <td style="padding:9px 13px;font-size:12px;font-weight:600;color:#1a73e8;border-bottom:1px solid #f0f2f5;text-align:right;white-space:nowrap;">${fmtMins(e.total_hours)}</td>
    </tr>`,
    )
    .join("");

  const bodyContent =
    greeting(mgrFirstName ? `${mgrFirstName} ${mgrLastName}` : "Admin") +
    para(
      `<strong>${empName}</strong> has submitted their timesheet for the week of <strong>${weekLabel}</strong> and it is awaiting your approval.`,
    ) +
    sectionLabel("Summary") +
    infoCard(
      infoRow("Employee", `<strong>${empName}</strong>`) +
        infoRow("Week", weekLabel) +
        infoRow(
          "Total Hours",
          `<strong style="color:#1a73e8;">${fmtMins(totalMins)}</strong>`,
        ) +
        infoRow("Entries", `${entries.length} entries`, true),
    ) +
    sectionLabel("Entry Breakdown") +
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8eaed;border-radius:8px;overflow:hidden;margin:6px 0 0;">
      <tr style="background-color:#f1f5ff;">
        <th style="padding:10px 13px;font-size:11px;color:#5f6368;font-weight:700;text-align:left;border-bottom:1px solid #e8eaed;text-transform:uppercase;letter-spacing:0.8px;">Date</th>
        <th style="padding:10px 13px;font-size:11px;color:#5f6368;font-weight:700;text-align:left;border-bottom:1px solid #e8eaed;text-transform:uppercase;letter-spacing:0.8px;">Project</th>
        <th style="padding:10px 13px;font-size:11px;color:#5f6368;font-weight:700;text-align:left;border-bottom:1px solid #e8eaed;text-transform:uppercase;letter-spacing:0.8px;">Ticket</th>
        <th style="padding:10px 13px;font-size:11px;color:#5f6368;font-weight:700;text-align:right;border-bottom:1px solid #e8eaed;text-transform:uppercase;letter-spacing:0.8px;">Hours</th>
      </tr>
      ${tableRows}
      <tr style="background-color:#f1f5ff;">
        <td colspan="3" style="padding:10px 13px;font-size:13px;font-weight:700;color:#202124;border-top:2px solid #d2e3fc;">Total</td>
        <td style="padding:10px 13px;font-size:13px;font-weight:700;color:#1a73e8;text-align:right;border-top:2px solid #d2e3fc;">${fmtMins(totalMins)}</td>
      </tr>
    </table>` +
    btn("Review &amp; Approve", `${APP_URL}/manager/approvals`, accent);

  return wrap(accent, "📋", "Timesheet Submitted for Approval", bodyContent);
};

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE 3 — TICKET ASSIGNED (employee or manager, same template)
// { recipientFirst, recipientLast, assignerFirst, assignerLast,
//   ticketName, ticketCode, ticketDesc, ticketStart, ticketEnd,
//   projectName, assignStart, assignEnd, billableHours, isManager }
// ═══════════════════════════════════════════════════════════════════
export const ticketAssignedTemplate = ({
  recipientFirst,
  recipientLast,
  assignerFirst,
  assignerLast,
  ticketName,
  ticketCode,
  ticketDesc,
  ticketStart,
  ticketEnd,
  projectName,
  assignStart,
  assignEnd,
  billableHours,
  isManager = false,
}) => {
  const accent = isManager ? "#7c3aed" : "#0f9d58";
  const icon = isManager ? "🎯" : "🎫";
  const title = isManager
    ? "New Ticket Scope Assigned"
    : "New Ticket Assigned to You";
  const ctaUrl = isManager
    ? `${APP_URL}/manager/tickets`
    : `${APP_URL}/tickets`;
  const ctaLabel = isManager ? "View My Ticket Scope" : "View My Tickets";

  const assignEndVal = assignEnd
    ? fmtDate(assignEnd)
    : `<span style="color:#0f9d58;font-weight:600;">Open-ended</span>`;

  const bodyContent =
    greeting(`${recipientFirst} ${recipientLast}`) +
    para(
      `<strong>${assignerFirst} ${assignerLast}</strong> has assigned a new ${isManager ? "ticket scope" : "ticket"} to you.`,
    ) +
    sectionLabel("Ticket Details") +
    infoCard(
      infoRow("Ticket Name", `<strong>${ticketName}</strong>`) +
        infoRow("Ticket Code", mono(ticketCode)) +
        infoRow("Project", projectName) +
        (ticketDesc
          ? infoRow(
              "Description",
              `<span style="color:#5f6368;">${ticketDesc}</span>`,
            )
          : "") +
        infoRow(
          "Ticket Period",
          `${fmtDate(ticketStart)} &ndash; ${fmtDate(ticketEnd)}`,
        ) +
        infoRow("Assigned From", fmtDate(assignStart)) +
        infoRow("Assigned Until", assignEndVal) +
        infoRow(
          "Billable Hours",
          `<strong style="color:${accent};">${fmtMins(billableHours)}</strong>`,
        ) +
        infoRow("Assigned By", `${assignerFirst} ${assignerLast}`, true),
    ) +
    btn(ctaLabel, ctaUrl, accent);

  return wrap(accent, icon, title, bodyContent);
};

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE 4 — TIMESHEET APPROVED OR REJECTED (sent to employee)
// { firstName, lastName, actorName, actorRole, action,
//   weekLabel, finalStatus, comments }
// ═══════════════════════════════════════════════════════════════════
export const timesheetDecisionTemplate = ({
  firstName,
  lastName,
  actorName,
  actorRole,
  action,
  weekLabel,
  finalStatus,
  comments,
}) => {
  const isApproved = action === "approve";

  const statusMap = {
    Approved: {
      color: "#0f9d58",
      bg: "#e6f4ea",
      icon: "✅",
      label: "Fully Approved",
    },
    Rejected: {
      color: "#d93025",
      bg: "#fce8e6",
      icon: "❌",
      label: "Fully Rejected",
    },
    Partially_Approved: {
      color: "#e37400",
      bg: "#fef3e2",
      icon: "⚠️",
      label: "Partially Approved",
    },
    Partially_Rejected: {
      color: "#e37400",
      bg: "#fef3e2",
      icon: "⚠️",
      label: "Partially Rejected",
    },
    Submitted: {
      color: "#1a73e8",
      bg: "#e8f0fe",
      icon: "⏳",
      label: "Pending (Awaiting Other Approvals)",
    },
  };

  const cfg = statusMap[finalStatus] || statusMap["Submitted"];
  const accent = isApproved ? "#0f9d58" : "#d93025";
  const hdr = `Timesheet ${actorRole === "ADMIN" ? "Final " : ""}${isApproved ? "Approved" : "Rejected"}`;

  const statusBlock = `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;background-color:${cfg.bg};border-radius:8px;">
      <tr><td style="padding:14px 20px;">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="font-size:26px;padding-right:14px;vertical-align:middle;">${cfg.icon}</td>
          <td style="vertical-align:middle;">
            <div style="font-size:11px;color:#5f6368;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Overall Status</div>
            <div style="font-size:16px;font-weight:700;color:${cfg.color};">${cfg.label}</div>
          </td>
        </tr></table>
      </td></tr>
    </table>`;

  const commentsBlock = comments
    ? sectionLabel("Feedback / Reason") +
      `<div style="background-color:#fff8e1;border-left:4px solid #f29900;padding:13px 16px;border-radius:0 6px 6px 0;margin-top:6px;">
         <p style="margin:0;font-size:13px;color:#5f6368;line-height:1.65;">${comments}</p>
       </div>`
    : "";

  const partialNote =
    finalStatus === "Partially_Approved" || finalStatus === "Partially_Rejected"
      ? `<div style="background-color:#f8f9fb;border-radius:6px;padding:12px 16px;margin-top:16px;">
           <p style="margin:0;font-size:13px;color:#5f6368;line-height:1.6;">
             <strong>&#9432; Partial decision:</strong> Some entries have been acted on by ${actorName}, while others are still pending with another approver.
           </p>
         </div>`
      : "";

  const callToAction = isApproved
    ? `<p style="margin:22px 0 0;font-size:14px;color:#5f6368;line-height:1.6;">No further action is needed from you for this week. &#127881;</p>`
    : para(
        "Please review the feedback and resubmit your corrected timesheet.",
      ) + btn("Resubmit Timesheet", `${APP_URL}/timesheet`, "#d93025");

  const bodyContent =
    greeting(`${firstName} ${lastName}`) +
    para(
      `Your timesheet for the week of <strong>${weekLabel}</strong> has been ` +
        `<strong>${isApproved ? "approved" : "rejected"}</strong> by ` +
        `<strong>${actorName}</strong> (${actorRole}).`,
    ) +
    statusBlock +
    sectionLabel("Decision Details") +
    infoCard(
      infoRow("Week", weekLabel) +
        infoRow(
          "Action By",
          `${actorName} <span style="color:#9aa0a6;">(${actorRole})</span>`,
        ) +
        infoRow(
          "Decision",
          isApproved
            ? `<strong style="color:#0f9d58;">Approved &#10003;</strong>`
            : `<strong style="color:#d93025;">Rejected &#10007;</strong>`,
          true,
        ),
    ) +
    commentsBlock +
    partialNote +
    callToAction;

  return wrap(accent, isApproved ? "✅" : "❌", hdr, bodyContent);
};
