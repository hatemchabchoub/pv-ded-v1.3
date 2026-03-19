import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  parentPvId: string;
  onChangeParentPvId: (id: string) => void;
  /** Current pv_number being typed in the wizard, used for smart suggestions */
  currentPvNumber?: string;
}

export default function ParentPvSelector({ parentPvId, onChangeParentPvId, currentPvNumber }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: parentPvs } = useQuery({
    queryKey: ["parent-pvs-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pv")
        .select("id, pv_number, internal_reference, pv_date")
        .eq("pv_type", "محضر")
        .is("parent_pv_id", null)
        .order("pv_number", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  // Auto-suggest based on currentPvNumber when it changes
  useEffect(() => {
    if (currentPvNumber && currentPvNumber.trim() && !parentPvId) {
      // Extract the base number (e.g. "142" from "142/2025") for smarter matching
      const base = currentPvNumber.split("/")[0].trim();
      if (base) {
        setSearch(base);
        // Auto-select if there's an exact match
        const exact = parentPvs?.find(p => p.pv_number === currentPvNumber.trim());
        if (exact) {
          onChangeParentPvId(exact.id);
          setSearch(`${exact.pv_number} — ${exact.internal_reference}`);
        }
      }
    }
  }, [currentPvNumber, parentPvs]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = search.trim()
    ? (parentPvs || []).filter(p =>
        p.pv_number.includes(search.trim()) ||
        p.internal_reference.toLowerCase().includes(search.trim().toLowerCase())
      )
    : (parentPvs || []);

  const handleSelect = useCallback((pv: typeof filtered[0]) => {
    onChangeParentPvId(pv.id);
    setSearch(`${pv.pv_number} — ${pv.internal_reference}`);
    setOpen(false);
  }, [onChangeParentPvId]);

  const handleClear = () => {
    setSearch("");
    onChangeParentPvId("");
  };

  return (
    <div className="space-y-2">
      <Label>المحضر الأصلي (الأب) *</Label>
      <div ref={wrapperRef} className="relative">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
            // Clear selection if user edits
            if (parentPvId) onChangeParentPvId("");
          }}
          onFocus={() => setOpen(true)}
          placeholder="ابحث برقم المحضر..."
          autoComplete="off"
        />

        {open && filtered.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover shadow-md">
            {filtered.slice(0, 20).map(pv => (
              <button
                key={pv.id}
                type="button"
                className={cn(
                  "w-full text-start px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center justify-between",
                  parentPvId === pv.id && "bg-accent"
                )}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(pv); }}
              >
                <span className="font-medium">{pv.pv_number}</span>
                <span className="text-xs text-muted-foreground">{pv.internal_reference} ({pv.pv_date})</span>
              </button>
            ))}
          </div>
        )}

        {open && filtered.length === 0 && search.trim() && (
          <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-md p-3 text-sm text-muted-foreground text-center">
            لا توجد نتائج لـ "{search.trim()}"
          </div>
        )}
      </div>
      {parentPvId && (
        <button type="button" onClick={handleClear} className="text-xs text-primary hover:underline">
          إزالة الاختيار
        </button>
      )}
    </div>
  );
}
