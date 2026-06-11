import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface DataTableColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
}

export default function DataTable<T>({
  columns,
  data,
  isLoading,
  emptyMessage = "Nenhum registro encontrado.",
  getRowId,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <Table className="data-grid">
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.header} className={col.className}>
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && (
          <TableRow>
            <TableCell colSpan={columns.length} className="py-6 text-center text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Carregando...
            </TableCell>
          </TableRow>
        )}
        {!isLoading && data.length === 0 && (
          <TableRow>
            <TableCell colSpan={columns.length} className="py-6 text-center text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
        {!isLoading &&
          data.map((row) => (
            <TableRow
              key={getRowId(row)}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? "cursor-pointer" : undefined}
            >
              {columns.map((col) => (
                <TableCell key={col.header} className={col.className}>
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}
