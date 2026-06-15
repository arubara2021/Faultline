"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Zap, Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useSimulate, useSimulateTargets } from "@/lib/hooks/use-simulate";
import { formatCompactDollars, formatOwnerTeam } from "@/lib/utils/format";

export function SimulateDialog({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>("postgres-primary");
  const { data: targets } = useSimulateTargets();
  const { trigger: simulate, isMutating } = useSimulate();
  const { mutate } = useSWRConfig();

  async function handleSimulate() {
    try {
      const result = await simulate({ serviceName: target, reset: true });
      // Refresh every live data source so the cascade appears immediately.
      await Promise.all([
        mutate("/api/incidents"),
        mutate("/api/graph"),
        mutate("/api/services"),
        mutate("/api/blast-radius"),
      ]);
      toast.error(`Failure injected: ${result.failedService}`, {
        description: `${result.blastRadiusCount} services affected · ${formatCompactDollars(
          result.totalRevenuePerMinDollars
        )}/min at risk · cascade depth ${result.cascadeDepth}`,
      });
      setOpen(false);
    } catch (err) {
      toast.error("Simulation failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="destructive" size="sm">
            <Zap />
            Simulate failure
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-red-500" />
            Simulate a service failure
          </DialogTitle>
          <DialogDescription>
            Inject a failure into a service to watch Faultline detect the
            outage, traverse the dependency graph, and quantify the revenue
            blast radius in real time.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            Target service
          </label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a service" />
            </SelectTrigger>
            <SelectContent>
              {targets?.services
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((s) => (
                  <SelectItem key={s.id} value={s.name}>
                    <span className="font-mono text-xs">{s.name}</span>
                    <span className="text-muted-foreground">
                      {formatOwnerTeam(s.ownerTeam)}
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Tip: <span className="font-mono">postgres-primary</span> produces
            the largest cascade.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isMutating}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSimulate}
            disabled={isMutating}
          >
            {isMutating ? (
              <>
                <Loader2 className="animate-spin" />
                Injecting…
              </>
            ) : (
              <>
                <RotateCcw />
                Reset &amp; inject
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
