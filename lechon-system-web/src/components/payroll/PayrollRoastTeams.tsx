import { useRef, useState } from "react";
import { Check, ClipboardCopy, Plus, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useCopyLastRoastTeamsMutation, usePayrollSettings, useSaveRoastTeamsMutation, type RoastMemberRole, type RoastProduction, type RoastTeam, type RoastTeamCandidate,
} from "@/hooks/usePayroll";
import { cn } from "@/lib/utils";
import { displayDate, money, validMoney, validRoastCount } from "./payrollDisplay";
import { PayrollField } from "./PayrollUi";

type MemberDraft = {
  employeeId: number;
  employeeName: string;
  weight: number;
  role: RoastMemberRole;
  override: string | null;
};

type TeamDraft = {
  key: string;
  id?: number;
  name: string;
  whole: string;
  bellies: string;
  cutOverride: string | null;
  tiktikRate: number;
  copiedTiktikRate?: boolean;
  members: MemberDraft[];
};

function savedTeamDraft(team: RoastTeam): TeamDraft {
  return {
    key: `team-${team.id}`, id: team.id, name: team.teamName, whole: String(team.wholeLechonCount), bellies: String(team.bellyCount),
    cutOverride: team.isTiktikDeductionOverridden ? String(team.tiktikDeductionAmount) : null,
    tiktikRate: team.tiktikRatePerLechonSnapshot,
    members: team.members.map((member) => ({
      employeeId: member.employeeId, employeeName: member.employeeName,
      weight: member.weightSnapshot, role: member.memberRole,
      override: member.allocatedAmountOverride === null ? null : String(member.allocatedAmountOverride),
    })),
  };
}

function newMemberDraft(candidate: RoastTeamCandidate, role: RoastMemberRole): MemberDraft {
  return {
    employeeId: candidate.employeeId, employeeName: candidate.employeeName,
    weight: role === "Roaster" ? candidate.incentiveWeight || 1 : 1, role, override: null,
  };
}

export function PayrollRoastTeams({ row, disabled, storeCounts }: {
  row: RoastProduction; disabled: boolean; storeCounts?: { whole: number; bellies: number };
}) {
  const [drafts, setDrafts] = useState(() => row.teams.map(savedTeamDraft));
  const nextTeam = useRef(1);
  const save = useSaveRoastTeamsMutation();
  const copy = useCopyLastRoastTeamsMutation();
  const settings = usePayrollSettings();
  const ratio = row.usesDualIncentives ? row.belliesPerWholeSnapshot : settings.data?.belliesPerWhole ?? row.belliesPerWholeSnapshot;
  const rate = row.usesDualIncentives ? row.partihanRatePerLechonSnapshot : settings.data?.partihanRatePerLechon ?? row.partihanRatePerLechonSnapshot;
  const enabled = row.usesDualIncentives ? row.partihanEnabledSnapshot : settings.data?.enablePartihan ?? true;
  const credits = new Map(row.teamCandidates.map((candidate) => [candidate.employeeId, candidate.dayCredit]));
  const busy = disabled || save.isPending || copy.isPending;
  const edited = JSON.stringify(drafts) !== JSON.stringify(row.teams.map(savedTeamDraft));
  const uniqueNames = new Set(drafts.map((team) => team.name.trim().toLowerCase())).size === drafts.length;
  const validAmounts = drafts.every((team) => team.cutOverride === null || validMoney(team.cutOverride));
  const validOverrides = drafts.every((team) => team.members.every((member) => member.override === null || validMoney(member.override)));
  const hasOffDuty = drafts.some((team) => team.members.some((member) => !credits.has(member.employeeId)));
  const validTeams = drafts.every((team) => team.name.trim() && validRoastCount(team.whole) && validRoastCount(team.bellies)
    && Number(team.whole) + Math.floor(Number(team.bellies) / ratio) <= 2_147_483_647);
  const wholeSum = drafts.reduce((sum, team) => sum + count(team.whole), 0);
  const bellySum = drafts.reduce((sum, team) => sum + count(team.bellies), 0);
  const teamEquivalent = drafts.reduce((sum, team) => sum + count(team.whole) + Math.floor(count(team.bellies) / ratio), 0);
  const storeWhole = storeCounts?.whole ?? row.wholeLechonCount;
  const storeBellies = storeCounts?.bellies ?? row.bellyCount;
  const storeEquivalent = row.isSaved || storeCounts ? storeWhole + Math.floor(storeBellies / ratio) : wholeSum + Math.floor(bellySum / ratio);
  const balanced = teamEquivalent === storeEquivalent;

  function addTeam() {
    const key = `new-team-${nextTeam.current++}`;
    setDrafts((teams) => [...teams, {
      key, name: "", whole: String(Math.max(0, storeWhole - wholeSum)), bellies: String(Math.max(0, storeBellies - bellySum)),
      cutOverride: null, tiktikRate: row.tiktikDeductionPerLechon, members: [],
    }]);
  }

  function copyLastTeams() {
    copy.mutate(row.productionDate, { onSuccess: ({ productionDate, teams }) => {
      if (!productionDate || !teams.length) {
        toast.info("No earlier teams saved.");
        return;
      }

      const candidates = new Map(row.teamCandidates.map((worker) => [worker.employeeId, worker]));
      const existingTeams = new Map(drafts.map((team) => [team.name.trim().toLowerCase(), team]));
      const skipped = new Set<number>();
      const copied = teams.map((team): TeamDraft => {
        const existing = existingTeams.get(team.teamName.toLowerCase());
        return {
          key: existing?.key ?? `new-team-${nextTeam.current++}`, id: existing?.id, name: team.teamName,
          whole: existing?.whole ?? "0", bellies: existing?.bellies ?? "0", cutOverride: existing?.cutOverride ?? null,
          tiktikRate: team.tiktikRatePerLechon, copiedTiktikRate: true,
          members: team.members.flatMap(({ employeeId, memberRole }) => {
            const worker = candidates.get(employeeId);
            if (!worker) {
              skipped.add(employeeId);
              return [];
            }
            return existing?.members.find((member) => member.employeeId === employeeId && member.role === memberRole) ??
              newMemberDraft(worker, memberRole);
          }),
        };
      });
      setDrafts(copied);
      const skippedText = skipped.size ? ` Skipped ${skipped.size} off-duty ${skipped.size === 1 ? "employee" : "employees"}.` : "";
      toast.success(`Copied teams from ${displayDate(productionDate)}.${skippedText}`);
    } });
  }

  function removeOffDuty() {
    setDrafts((teams) => teams.map((team) => ({ ...team, members: team.members.filter((member) => credits.has(member.employeeId)) })));
  }

  function update(key: string, values: Partial<TeamDraft>) {
    setDrafts((teams) => teams.map((team) => team.key === key ? { ...team, ...values } : team));
  }

  function saveTeams() {
    save.mutate({ date: row.productionDate, teams: drafts.map((team) => ({
      id: team.id, teamName: team.name.trim(), wholeLechonCount: Number(team.whole), bellyCount: Number(team.bellies),
      tiktikDeductionAmount: team.cutOverride === null ? null : Number(team.cutOverride),
      tiktikRatePerLechon: team.copiedTiktikRate ? team.tiktikRate : undefined,
      members: team.members.map((member) => ({ employeeId: member.employeeId, memberRole: member.role,
        allocatedAmountOverride: member.override === null ? undefined : Number(member.override), resetOverride: member.override === null })),
    })) }, { onSuccess: (result) => setDrafts(result.teams.map(savedTeamDraft)) });
  }

  return (
    <section className="grid gap-3 rounded-xl border border-stone-200 bg-white p-3 sm:p-4" aria-label={`Partihan teams for ${displayDate(row.productionDate)}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-bold"><Users className="size-4 text-amber-800" /> Teams / Partihan</h3>
          {!!drafts.length && <p role="status" className={cn("mt-1 max-w-prose text-xs", balanced ? "text-emerald-800" : "text-amber-900")}>
            {balanced && <Check className="mr-1 inline size-3" aria-hidden="true" />}
            Teams {teamEquivalent} equivalent · Store daily total {storeEquivalent} equivalent{!balanced && " · Counts differ"}
          </p>}
          {!!drafts.length && !row.isSaved && <p className="mt-1 text-xs text-stone-600">The first team save sets the store total for this date.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={copyLastTeams}><ClipboardCopy /> {copy.isPending ? "Copying…" : "Copy Last Teams"}</Button>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={addTeam}><Plus /> Add team</Button>
          <Button type="button" size="sm" disabled={busy || !edited || !validTeams || !uniqueNames || !validAmounts || !validOverrides || hasOffDuty}
            onClick={saveTeams}>{save.isPending ? "Saving…" : "Save teams"}</Button>
        </div>
      </div>
      {drafts.length === 0 && <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-600">This date uses single-pool Partihan when it has no saved teams.</p>}
      {!enabled && drafts.length > 0 && <p className="text-xs text-amber-900">Partihan payouts are off under this date’s saved policy.</p>}
      {!uniqueNames && <p role="alert" className="text-xs text-rose-800">Use a different name for each team.</p>}
      {hasOffDuty && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2 text-rose-800">
        <p role="alert" className="text-xs">Only employees with attendance credit on this date can receive Partihan.</p>
        <Button type="button" size="xs" variant="destructive" disabled={busy} onClick={removeOffDuty}>Remove off-duty</Button>
      </div>}
      {!!drafts.length && <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {drafts.map((team, index) => <TeamFields key={team.key} team={team} heading={team.name || `New team ${index + 1}`} ratio={ratio} rate={rate}
          enabled={enabled} candidates={row.teamCandidates} credits={credits} busy={busy} onChange={(values) => update(team.key, values)}
          onRemove={() => setDrafts((teams) => teams.filter((existing) => existing.key !== team.key))} />)}
      </div>}
      {row.teams.length > 0 && row.milestonePerPerson > 0 && <p className="text-xs text-stone-700">
        Daily milestone · {money(row.milestonePerPerson)} each for {row.teamCandidates.filter((worker) => worker.hasMilestoneBonus).map((worker) => worker.employeeName).join(", ") || "no eligible workers"}
      </p>}
    </section>
  );
}

const count = (value: string) => validRoastCount(value) ? Number(value) : 0;

function TeamFields({ team, heading, ratio, rate, enabled, candidates, credits, busy, onChange, onRemove }: {
  team: TeamDraft; heading: string; ratio: number; rate: number; enabled: boolean;
  candidates: RoastTeamCandidate[]; credits: Map<number, number>; busy: boolean;
  onChange: (values: Partial<TeamDraft>) => void; onRemove: () => void;
}) {
  const equivalents = count(team.whole) + Math.floor(count(team.bellies) / ratio);
  const gross = equivalents * rate;
  const defaultCut = equivalents * team.tiktikRate;
  const cut = team.cutOverride === null ? defaultCut : validMoney(team.cutOverride) ? Number(team.cutOverride) : 0;
  const net = Math.max(0, gross - cut);

  return (
    <fieldset className="min-w-0 rounded-xl border border-stone-200 p-3" disabled={busy}>
      <legend className="px-1.5 text-sm font-bold text-stone-800">{heading}</legend>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[minmax(8rem,1.4fr)_minmax(5rem,0.55fr)_minmax(6rem,0.65fr)_auto] sm:items-end">
        <div className="col-span-2 sm:col-span-1"><PayrollField label="Team name"><Input required maxLength={80} placeholder="Team name" value={team.name} onChange={(event) => onChange({ name: event.target.value })} /></PayrollField></div>
        <PayrollField label="Whole"><Input type="number" min="0" max="2147483647" step="1" required value={team.whole} onChange={(event) => onChange({ whole: event.target.value })} /></PayrollField>
        <PayrollField label={`Belly (${ratio} = 1)`}><Input type="number" min="0" max="2147483647" step="1" required value={team.bellies} onChange={(event) => onChange({ bellies: event.target.value })} /></PayrollField>
        <Button type="button" variant="ghost" size="icon" className="text-rose-800" aria-label={`Remove ${heading}`} onClick={onRemove}><Trash2 /></Button>
      </div>

      <div className="mt-3 grid grid-cols-2 items-start gap-2 rounded-lg bg-stone-50 p-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-stone-600">Gross · {equivalents} × {money(rate)}</p>
          <p className="font-bold tabular-nums">{money(gross)}</p>
        </div>
        <div className="min-w-0">
          <PayrollField label="Less Tiktik cut (₱)"><Input type="number" min="0" step="0.01" value={team.cutOverride ?? Number(defaultCut.toFixed(2))}
            onChange={(event) => onChange({ cutOverride: event.target.value })} /></PayrollField>
          {team.cutOverride === null ? <p className="mt-0.5 text-xs text-stone-500">Default × {money(team.tiktikRate)}</p> :
            <Button type="button" size="xs" variant="ghost" onClick={() => onChange({ cutOverride: null })}>Use default cut</Button>}
        </div>
        <div className="text-emerald-900">
          <p className="text-xs text-stone-600">Net pool</p>
          <p className="font-bold tabular-nums">{money(net)}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <MemberGroup role="Roaster" team={team} candidates={candidates} credits={credits} pool={enabled ? net : 0} enabled={enabled} onChange={onChange} />
        <MemberGroup role="Tiktik" team={team} candidates={candidates} credits={credits} pool={enabled ? cut : 0} enabled={enabled} onChange={onChange} />
      </div>
    </fieldset>
  );
}

function MemberGroup({ role, team, candidates, credits, pool, enabled, onChange }: {
  role: RoastMemberRole; team: TeamDraft; candidates: RoastTeamCandidate[]; credits: Map<number, number>;
  pool: number; enabled: boolean; onChange: (values: Partial<TeamDraft>) => void;
}) {
  const isRoaster = role === "Roaster";
  const members = team.members.filter((member) => member.role === role);
  const byId = new Map(team.members.map((member) => [member.employeeId, member]));
  const shares = enabled ? splitPreview(pool, members, credits) : new Map<number, number>();
  const paid = [...shares.values()].reduce((sum, value) => sum + value, 0);
  const hasOnDuty = members.some((member) => credits.has(member.employeeId));

  function toggle(candidate: RoastTeamCandidate, checked: boolean) {
    const remaining = team.members.filter((member) => member.employeeId !== candidate.employeeId);
    onChange({ members: checked ? [...remaining, newMemberDraft(candidate, role)] : remaining });
  }

  function editShare(employeeId: number, override: string | null) {
    onChange({ members: team.members.map((member) => member.employeeId === employeeId ? { ...member, override } : member) });
  }

  return (
    <section className="grid min-w-0 content-start gap-2 rounded-lg border border-stone-200 p-2.5">
      <h4 className="text-sm font-semibold">{isRoaster ? "Roasters on Duty" : "Tiktik Helpers"}</h4>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={isRoaster ? "Assign roasters" : "Assign Tiktik helpers"}>
        {candidates.length === 0 && <p className="text-xs text-stone-600">No employees with day credit on this date.</p>}
        {candidates.map((candidate) => {
          const current = byId.get(candidate.employeeId);
          const selected = current?.role === role;
          const tier = candidate.incentiveTier === "None" ? "" : candidate.incentiveTier.charAt(0);
          const weight = selected ? current.weight : candidate.incentiveWeight || 1;
          return <Button key={candidate.employeeId} type="button" size="xs" variant="outline" aria-pressed={selected}
            disabled={Boolean(current && !selected)} title={`${candidate.dayCredit.toFixed(1)} day credit`}
            className={cn("h-auto min-h-6 max-w-full whitespace-normal rounded-full px-2.5 py-0.5 text-left", selected && "border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-100")}
            onClick={() => toggle(candidate, !selected)}>
            {selected && <Check aria-hidden="true" />}
            <span className="break-words">{candidate.employeeName}{isRoaster && ` (${tier}${weight})`}</span>
          </Button>;
        })}
      </div>
      {!!members.length && <Table className="text-xs" aria-label={isRoaster ? "Roaster payouts" : "Tiktik payouts"}>
        <TableHeader><TableRow>
          <TableHead scope="col" className="h-7 px-1">Employee</TableHead>
          <TableHead scope="col" className="h-7 px-1 text-right">Share</TableHead>
          <TableHead scope="col" className="h-7 px-1">Override (₱)</TableHead>
        </TableRow></TableHeader>
        <TableBody>{members.map((member) => {
          const onDuty = credits.has(member.employeeId);
          return <TableRow key={member.employeeId}>
            <TableCell className="min-w-0 whitespace-normal px-1 py-1.5 font-medium">{member.employeeName}
              {!onDuty && <Badge className="ml-1 bg-rose-50 text-rose-800">Off duty</Badge>}
            </TableCell>
            <TableCell className="px-1 py-1.5 text-right font-semibold tabular-nums text-emerald-900">{money(shares.get(member.employeeId) ?? 0)}</TableCell>
            <TableCell className="px-1 py-1.5">
              <div className="flex items-center gap-0.5">
                <Input aria-label={`Peso override for ${member.employeeName}`} type="number" min="0" step="0.01" className="h-7 w-20 text-xs"
                  placeholder="Auto" disabled={!onDuty} value={member.override ?? ""} onChange={(event) => editShare(member.employeeId, event.target.value || null)} />
                {member.override !== null && <Button type="button" size="icon-xs" variant="ghost" aria-label={`Reset share for ${member.employeeName}`}
                  onClick={() => editShare(member.employeeId, null)}><X /></Button>}
              </div>
            </TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>}
      {!isRoaster && !hasOnDuty && <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-950">External / unassigned Tiktik · {money(pool)}</p>}
      {hasOnDuty && enabled && Math.round(paid * 100) !== Math.round(pool * 100) && <p className="text-xs text-amber-900">Shares total {money(paid)} for a {money(pool)} pool.</p>}
    </section>
  );
}

function splitPreview(pool: number, members: MemberDraft[], credits: Map<number, number>) {
  const shares = new Map<number, number>();
  let remaining = Math.round(pool * 100);
  for (const member of members) {
    if (!credits.has(member.employeeId) || member.override === null) continue;
    const amount = validMoney(member.override) ? Math.round(Number(member.override) * 100) : 0;
    shares.set(member.employeeId, amount);
    remaining -= amount;
  }
  remaining = Math.max(0, remaining);
  const weighted = members.filter((member) => member.override === null && credits.has(member.employeeId)).map((member) => ({
    id: member.employeeId, weight: Math.round(member.weight * 100) * Math.round((credits.get(member.employeeId) ?? 0) * 2),
  })).sort((first, second) => second.weight - first.weight || first.id - second.id);
  const totalWeight = weighted.reduce((sum, member) => sum + member.weight, 0);
  let remainder = remaining;
  for (const { id, weight } of weighted) {
    const numerator = remaining * weight;
    const base = Math.floor(numerator / totalWeight);
    const fraction = (numerator % totalWeight) * 2;
    const cents = base + (fraction > totalWeight || (fraction === totalWeight && base % 2 === 1) ? 1 : 0);
    shares.set(id, cents);
    remainder -= cents;
  }
  for (const { id } of weighted) {
    if (remainder === 0) break;
    const cents = shares.get(id) ?? 0;
    const correction = Math.max(-cents, remainder);
    shares.set(id, cents + correction);
    remainder -= correction;
  }
  return new Map([...shares].map(([id, cents]) => [id, cents / 100]));
}
