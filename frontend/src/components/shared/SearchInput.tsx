import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
}

export default function SearchInput({ value, onChange, placeholder = "Pesquisar...", delay = 400, className }: SearchInputProps) {
  const [internal, setInternal] = useState(value);

  useEffect(() => setInternal(value), [value]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (internal !== value) onChange(internal);
    }, delay);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internal]);

  return (
    <div className={"relative " + (className ?? "w-64")}>
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={internal}
        onChange={(e) => setInternal(e.target.value)}
        placeholder={placeholder}
        className="pl-7"
      />
    </div>
  );
}
