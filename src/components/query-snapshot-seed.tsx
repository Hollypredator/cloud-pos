"use client";

import type { QueryKey } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { persistQuerySnapshot } from "@/lib/pos/snapshot-cache";

export function QuerySnapshotSeed<TData>({ queryKey, data }: { queryKey: QueryKey; data: TData }) {
  const queryClient = useQueryClient();
  const keyToken = JSON.stringify(queryKey);

  useEffect(() => {
    queryClient.setQueryData(queryKey, data);
    persistQuerySnapshot(queryKey, data);
  }, [data, keyToken, queryClient, queryKey]);

  return null;
}
