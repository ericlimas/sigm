import { Construction } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Construction className="h-4 w-4 text-warning" />
            {title}
          </CardTitle>
          <CardDescription>
            {description ?? "Modulo em construcao. A listagem e os formularios serao disponibilizados em breve."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Esta tela faz parte do escopo navegavel do sistema e sera implementada nas proximas etapas.
        </CardContent>
      </Card>
    </div>
  );
}
