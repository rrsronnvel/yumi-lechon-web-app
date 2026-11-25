import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { FileSpreadsheet, Fingerprint, Upload, Usb } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { displayAuditDate } from "@/components/payroll/payrollDisplay";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import apiClient from "@/services/apiClient";

interface UploadBatch {
  fileName: string;
  periodStart: string;
  periodEnd: string;
  punchesImported: number;
  duplicatesSkipped: number;
  unmappedUserCount: number;
  importedAt: string;
  importedBy: string;
}

function uploadError(error: unknown) {
  if (isAxiosError<{ message?: string }>(error)) {
    if (error.response?.status === 413) return "Upload up to 16 MB at a time.";
    return error.response?.data?.message ?? error.message;
  }
  return "The upload could not be completed.";
}

export default function BiometricsUploadPage() {
  const { apiBaseUrl, user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["biometrics", "recent-uploads", apiBaseUrl, user?.username] as const;
  const recent = useQuery({
    queryKey,
    queryFn: async ({ signal }) => (await apiClient.get<UploadBatch[]>("/biometrics/recent-uploads", { signal })).data,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (selected: File[]) => {
      const form = new FormData();
      for (const file of selected) form.append("files", file);
      const response = await apiClient.post<UploadBatch[]>("/biometrics/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: async (batches) => {
      setFiles([]);
      const total = batches.reduce((sum, batch) => sum + batch.punchesImported, 0);
      toast.success(`Upload complete. ${total} new ${total === 1 ? "punch" : "punches"} imported.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ["payroll", apiBaseUrl, user?.username, "attendance"] }),
        queryClient.invalidateQueries({ queryKey: ["payroll", apiBaseUrl, user?.username, "roast-production"] }),
        queryClient.invalidateQueries({ queryKey: ["payroll", apiBaseUrl, user?.username, "preview"] }),
      ]);
    },
    onError: (error) => toast.error(uploadError(error)),
  });

  function selectFiles(selected: FileList | null) {
    if (!selected?.length || upload.isPending) return;
    const next = Array.from(selected);
    upload.reset();
    if (next.length > 2 || next.some((file) => !/\.xls$/i.test(file.name))) {
      setFiles([]);
      setSelectionError("Choose one or two Employee Attendance Record .xls files.");
      return;
    }
    setFiles(next);
    setSelectionError("");
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 pb-6">
      <header className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-950"><Fingerprint className="size-6" aria-hidden="true" /></span>
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-950 sm:text-3xl">Biometrics Upload</h1>
      </header>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs sm:p-5" aria-labelledby="afternoon-upload">
        <h2 id="afternoon-upload" className="flex items-center gap-2 font-bold"><Usb className="size-4 text-amber-800" aria-hidden="true" /> Afternoon USB checklist</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-stone-700">
          <li>Plug the FAT32 USB into the Deli ES151. Open Menu → Report → Download Employee Attendance Record.</li>
          <li>Drop the exported <strong>Employee Attendance Record.xls</strong> below and select Upload attendance.</li>
        </ol>

        <div className={cn("mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 p-4 sm:p-5", dragging && "border-amber-500 bg-amber-50")}
          onDragOver={(event) => { event.preventDefault(); if (!upload.isPending) setDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
          onDrop={(event) => { event.preventDefault(); setDragging(false); selectFiles(event.dataTransfer.files); }}>
          <div className="flex items-center gap-3">
            <Upload className="size-5 shrink-0 text-amber-800" aria-hidden="true" />
            <div><p className="font-semibold">Drop one or two .xls files</p><p className="text-sm text-stone-600">Use the raw Employee Attendance Record export.</p></div>
          </div>
          <input className="sr-only" ref={fileInput} type="file" accept=".xls" multiple tabIndex={-1} aria-label="Deli attendance exports"
            disabled={upload.isPending} onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>Choose files</Button>
            <Button type="button" disabled={!files.length || upload.isPending} onClick={() => upload.mutate(files)}>
              <Upload /> {upload.isPending ? "Uploading…" : "Upload attendance"}
            </Button>
          </div>
        </div>
        {!!files.length && <ul className="mt-3 space-y-1 text-sm text-stone-700">{files.map((file, index) => (
          <li key={`${index}-${file.name}`} className="flex items-center gap-2 wrap-anywhere"><FileSpreadsheet className="size-4 shrink-0" />{file.name}</li>
        ))}</ul>}
        {(selectionError || upload.isError) && <p role="alert" className="mt-3 text-sm text-red-800">{selectionError || uploadError(upload.error)}</p>}
        {upload.data && <p className="mt-3 text-sm font-medium text-emerald-900" role="status">
          {upload.data.reduce((sum, batch) => sum + batch.punchesImported, 0)} new punches imported · {upload.data.reduce((sum, batch) => sum + batch.duplicatesSkipped, 0)} duplicates skipped
        </p>}
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs" aria-labelledby="recent-uploads">
        <h2 id="recent-uploads" className="border-b border-stone-100 px-4 py-4 font-bold sm:px-5">Recent Uploads</h2>
        {recent.isPending && <p className="px-5 py-6 text-sm text-stone-600" role="status">Loading upload history…</p>}
        {recent.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 bg-red-50 px-5 py-3 text-sm text-red-900">
          <p>{uploadError(recent.error)}</p><Button type="button" variant="outline" onClick={() => void recent.refetch()}>Retry</Button>
        </div>}
        {recent.data?.length === 0 && <p className="px-5 py-6 text-sm text-stone-600">No attendance files have been uploaded yet.</p>}
        {!!recent.data?.length && (
          <Table className="min-w-[700px] [&_th:first-child]:pl-5 [&_td:first-child]:pl-5">
            <TableHeader className="bg-stone-50"><TableRow>
              {['File', 'Export dates', 'Uploaded at', 'Uploaded by', 'New punches', 'Duplicates', 'Unmapped IDs'].map((label) => <TableHead key={label} scope="col">{label}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>
              {recent.data.map((batch, index) => <TableRow key={`${batch.importedAt}-${batch.fileName}-${index}`}>
                <TableCell className="max-w-56 font-medium whitespace-normal wrap-anywhere">{batch.fileName}</TableCell>
                <TableCell>{batch.periodStart} to {batch.periodEnd}</TableCell>
                <TableCell>{displayAuditDate(batch.importedAt)}</TableCell>
                <TableCell>{batch.importedBy}</TableCell>
                <TableCell className="tabular-nums">{batch.punchesImported}</TableCell>
                <TableCell className="tabular-nums">{batch.duplicatesSkipped}</TableCell>
                <TableCell className="tabular-nums">{batch.unmappedUserCount}</TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
