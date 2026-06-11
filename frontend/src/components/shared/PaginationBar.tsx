import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaginatedResponse } from "@/lib/api";

interface PaginationBarProps {
  meta: PaginatedResponse<unknown>["meta"];
  onPageChange: (page: number) => void;
}

export default function PaginationBar({ meta, onPageChange }: PaginationBarProps) {
  if (meta.total === 0) return null;

  const start = (meta.page - 1) * meta.pageSize + 1;
  const end = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <div className="flex items-center justify-between border-t px-2 py-2 text-xs text-muted-foreground">
      <span>
        Exibindo {start}-{end} de {meta.total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="px-2">
          Pagina {meta.page} de {Math.max(meta.totalPages, 1)}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
