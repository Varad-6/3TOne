import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { format } from "date-fns";
import { minutesToHHMM } from "../../utils/timeUtils";

const formatDate = (date) => {
  if (!date) return "N/A";
  try {
    return format(new Date(date), "MMM d, yyyy");
  } catch {
    return "Invalid Date";
  }
};

export default function ViewTicketDialog({
  open,
  onOpenChange,
  ticket,
  hideFields = [],
  extraFields = null,
}) {
  if (!ticket) return null;

  const budgetMinutes = Number(ticket.budget_minutes || 0);
  const usedMinutes = Number(ticket.used_minutes || 0);
  const isInactive = ticket.ticket_is_active === false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ticket.ticket_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2 text-sm">
          <div className="flex justify-between">
            <span className="font-medium text-muted-foreground">Client:</span>
            <span>{ticket.client_name || "-"}</span>
          </div>

          <div className="flex justify-between">
            <span className="font-medium text-muted-foreground">Project:</span>
            <span>{ticket.project_name || "-"}</span>
          </div>

          <div className="flex justify-between">
            <span className="font-medium text-muted-foreground">
              Ticket Code:
            </span>
            <span>
              {ticket.ticket_code ? (
                <Badge className="text-xs">{ticket.ticket_code}</Badge>
              ) : (
                "-"
              )}
            </span>
          </div>

          {ticket.description && (
            <div className="flex flex-col gap-1 pt-2 pb-2 border-t">
              <span className="font-medium text-muted-foreground">
                Description:
              </span>
              <p className="text-sm text-gray-700 leading-relaxed">
                {ticket.description}
              </p>
            </div>
          )}

          <div className="flex justify-between pt-2 border-t">
            <span className="font-medium text-muted-foreground">
              Start Date:
            </span>
            <span>
              {ticket.ticket_start_date
                ? formatDate(ticket.ticket_start_date)
                : "Not set"}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="font-medium text-muted-foreground">End Date:</span>
            <span>
              {ticket.ticket_end_date
                ? formatDate(ticket.ticket_end_date)
                : "No end date"}
            </span>
          </div>

          {!hideFields.includes("assignmentDate") && (
            <div className="flex justify-between">
              <span className="font-medium text-muted-foreground">
                Assignment Date:
              </span>
              <span>{formatDate(ticket.assign_start_date)}</span>
            </div>
          )}

          {!hideFields.includes("assignedHours") && (
            <div className="flex justify-between pt-2 border-t">
              <span className="font-medium text-muted-foreground">
                Assigned Hours:
              </span>
              <span className="font-semibold">
                {minutesToHHMM(budgetMinutes)}
              </span>
            </div>
          )}

          {!hideFields.includes("usedHours") && (
            <div className="flex justify-between">
              <span className="font-medium text-muted-foreground">
                Used Hours:
              </span>
              <span
                className={`font-semibold ${
                  usedMinutes > budgetMinutes
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {minutesToHHMM(usedMinutes)}
              </span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="font-medium text-muted-foreground">Status:</span>
            <Badge
              className={
                isInactive
                  ? "bg-gray-500 hover:bg-gray-600 text-white"
                  : "bg-green-500 hover:bg-green-600 text-white"
              }
            >
              {isInactive ? "Inactive" : "Active"}
            </Badge>
          </div>
        </div>
        {extraFields && (
          <div className="pt-3 border-t space-y-2">
            {typeof extraFields === "function"
              ? extraFields(ticket)
              : extraFields}
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
