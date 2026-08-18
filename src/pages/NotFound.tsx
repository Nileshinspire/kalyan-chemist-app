import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col"
    >
      {/* Header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm tracking-tight">
              KC
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              Kalyan Chemist
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <p className="text-7xl font-extrabold text-primary/15">404</p>
          <h1 className="mt-4 text-2xl font-bold text-foreground">
            Page Not Found
          </h1>
          <p className="mt-2 max-w-sm mx-auto text-sm leading-relaxed text-muted-foreground">
            The page you are looking for does not exist or has been moved. If you
            believe this is an error, please get in touch with our support team.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              variant="outline"
              className="gap-2 text-sm"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="size-4" />
              Go Back
            </Button>
            <Button
              className="gap-2 text-sm font-semibold"
              onClick={() => navigate("/")}
            >
              <Home className="size-4" />
              Return Home
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
