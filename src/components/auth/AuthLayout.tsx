import { FileText } from "lucide-react";
import { Link } from "react-router-dom";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-mesh flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Link to="/login" className="flex items-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold tracking-tight">QuoteGen</span>
          </Link>
          <h1 className="text-2xl font-semibold text-center">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground text-center mt-1">{subtitle}</p>}
        </div>
        <div className="rounded-xl border bg-card/80 backdrop-blur p-6 shadow-lg">{children}</div>
      </div>
    </div>
  );
}
