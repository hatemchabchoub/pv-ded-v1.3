import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AutocompleteOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface AddField {
  key: string;
  label: string;
  required?: boolean;
}

interface AutocompleteWithAddProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (option: AutocompleteOption) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  addDialogTitle?: string;
  addFields: AddField[];
  onAddNew: (values: Record<string, string>) => Promise<void>;
  className?: string;
}

export function AutocompleteWithAdd({
  value,
  onChange,
  onSelect,
  options,
  placeholder,
  addDialogTitle = "إضافة جديد",
  addFields,
  onAddNew,
  className,
}: AutocompleteWithAddProps) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addValues, setAddValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = value.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(value.toLowerCase()) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(value.toLowerCase()))
      )
    : options;

  const exactMatch = options.some(o => o.label === value.trim());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = useCallback((opt: AutocompleteOption) => {
    onChange(opt.label);
    onSelect?.(opt);
    setOpen(false);
  }, [onChange, onSelect]);

  const handleAddNew = async () => {
    const missing = addFields.filter(f => f.required && !addValues[f.key]?.trim());
    if (missing.length > 0) return;
    setSaving(true);
    try {
      await onAddNew(addValues);
      setDialogOpen(false);
      setAddValues({});
    } finally {
      setSaving(false);
    }
  };

  const openAddDialog = () => {
    const initial: Record<string, string> = {};
    addFields.forEach(f => { initial[f.key] = ""; });
    // Pre-fill the first field with current input value
    if (addFields.length > 0 && value.trim()) {
      initial[addFields[0].key] = value.trim();
    }
    setAddValues(initial);
    setDialogOpen(true);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />

      {open && (filtered.length > 0 || (!exactMatch && value.trim())) && (
        <div className="absolute z-50 top-full mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover shadow-md">
          {filtered.slice(0, 20).map(opt => (
            <button
              key={opt.id}
              type="button"
              className="w-full text-start px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center justify-between"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
            >
              <span>{opt.label}</span>
              {opt.sublabel && <span className="text-xs text-muted-foreground">{opt.sublabel}</span>}
            </button>
          ))}
          {!exactMatch && value.trim() && (
            <button
              type="button"
              className="w-full text-start px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center gap-2 text-primary border-t"
              onMouseDown={(e) => { e.preventDefault(); openAddDialog(); }}
            >
              <Plus className="h-3.5 w-3.5" />
              إضافة "{value.trim()}" كعنصر جديد
            </button>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{addDialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {addFields.map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}{f.required ? " *" : ""}</Label>
                <Input
                  value={addValues[f.key] || ""}
                  onChange={(e) => setAddValues({ ...addValues, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button size="sm" onClick={handleAddNew} disabled={saving}>
              {saving ? "جاري الحفظ..." : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
