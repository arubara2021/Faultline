"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CircleCheck, Info, AlertTriangle, OctagonX, Loader2 } from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      richColors
      closeButton
      icons={{
        success: <CircleCheck className="size-4" />,
        info: <Info className="size-4" />,
        warning: <AlertTriangle className="size-4" />,
        error: <OctagonX className="size-4" />,
        loading: <Loader2 className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "#111318",
          "--normal-text": "#F1F5F9",
          "--normal-border": "#1E2128",
          "--border-radius": "10px",
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          background: "#111318",
          border: "1px solid #1E2128",
          color: "#F1F5F9",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          borderRadius: "10px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.45)",
        },
        classNames: {
          description: "!text-[#94A3B8] !text-[12px]",
          closeButton: "!border-[#1E2128] !bg-[#1A1D24] !text-[#94A3B8] hover:!text-[#F1F5F9]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };