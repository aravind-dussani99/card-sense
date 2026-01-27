"use client";

import { Button } from "@/components/ui/button";

export function TransactionsHeaderActions() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.dispatchEvent(new Event("open-sync-dialog"))}
      >
        Sync
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.dispatchEvent(new Event("open-filter-dialog"))}
      >
        Filter
      </Button>
    </div>
  );
}

