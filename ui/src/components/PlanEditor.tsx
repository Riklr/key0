import { useState } from "react";
import type { Plan } from "../types";
import { Field, Input, Select } from "./Field";

interface PlanEditorProps {
	plans: Plan[];
	onChange: (plans: Plan[]) => void;
}

const DURATION_PRESETS = [
	{ label: "Single-use", value: "" },
	{ label: "1 hour", value: 3600 },
	{ label: "24 hours", value: 86400 },
	{ label: "7 days", value: 604800 },
	{ label: "30 days (Monthly)", value: 2592000 },
	{ label: "365 days (Yearly)", value: 31536000 },
	{ label: "Custom", value: "custom" },
] as const;

const TAG_OPTIONS = ["most-popular", "recommended", "new", "best-value"] as const;

export function PlanEditor({ plans, onChange }: PlanEditorProps) {
	const [customDuration, setCustomDuration] = useState<Record<number, boolean>>({});

	const update = (index: number, field: keyof Plan, value: unknown) => {
		const next = [...plans];
		next[index] = { ...next[index], [field]: value };
		onChange(next);
	};

	const add = () => {
		onChange([
			...plans,
			{
				planId: "",
				displayName: "",
				description: "",
				unitAmount: "",
				resourceType: "api-access",
				expiresIn: "",
				features: [],
				tags: [],
			},
		]);
	};

	const remove = (index: number) => {
		onChange(plans.filter((_, i) => i !== index));
	};

	const toggleTag = (planIndex: number, tag: string) => {
		const next = [...plans];
		const tags = next[planIndex].tags || [];
		next[planIndex] = {
			...next[planIndex],
			tags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag],
		};
		onChange(next);
	};

	const getDurationPreset = (expiresIn: number | ""): string => {
		if (expiresIn === "") return "";
		const match = DURATION_PRESETS.find((p) => p.value === expiresIn);
		return match ? String(match.value) : "custom";
	};

	return (
		<div className="space-y-4">
			{plans.map((p, i) => (
				<div
					key={p.planId || i}
					className="relative rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 space-y-3"
				>
					{/* Header */}
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
							Plan {i + 1}
							{p.tags?.includes("most-popular") && (
								<span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 normal-case tracking-normal">
									Most Popular
								</span>
							)}
						</span>
						{plans.length > 1 && (
							<button
								type="button"
								onClick={() => remove(i)}
								className="text-neutral-500 hover:text-red-400 transition-colors"
								title="Remove plan"
							>
								<svg
									className="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
									aria-hidden="true"
								>
									<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						)}
					</div>

					{/* Row 1: Plan ID + Display Name */}
					<div className="grid grid-cols-2 gap-3">
						<Field label="Plan ID" required hint="Unique slug, e.g. starter-monthly">
							<Input
								value={p.planId}
								onChange={(e) => update(i, "planId", e.target.value)}
								placeholder="starter-monthly"
							/>
						</Field>
						<Field label="Display Name" required hint="Shown to agents and in UI">
							<Input
								value={p.displayName}
								onChange={(e) => update(i, "displayName", e.target.value)}
								placeholder="Starter"
							/>
						</Field>
					</div>

					{/* Row 2: Description */}
					<Field label="Description" hint="Short summary of this plan">
						<Input
							value={p.description || ""}
							onChange={(e) => update(i, "description", e.target.value)}
							placeholder="Best for developers running daily workflows"
						/>
					</Field>

					{/* Row 3: Amount + Duration */}
					<div className="grid grid-cols-2 gap-3">
						<Field label="Price (USDC)" required hint="e.g. 15.00 or 0.015">
							<div className="flex">
								<span className="inline-flex items-center rounded-l-lg border border-r-0 border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-400">
									$
								</span>
								<input
									value={p.unitAmount.replace(/^\$/, "")}
									onChange={(e) => update(i, "unitAmount", `$${e.target.value.replace(/^\$/, "")}`)}
									placeholder="15.00"
									className="w-full rounded-r-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
								/>
							</div>
						</Field>
						<Field label="Duration" hint="Token validity after purchase">
							<Select
								value={getDurationPreset(p.expiresIn)}
								onChange={(e) => {
									const val = e.target.value;
									if (val === "custom") {
										setCustomDuration({ ...customDuration, [i]: true });
									} else {
										setCustomDuration({ ...customDuration, [i]: false });
										update(i, "expiresIn", val === "" ? "" : Number(val));
									}
								}}
							>
								{DURATION_PRESETS.map((preset) => (
									<option key={String(preset.value)} value={String(preset.value)}>
										{preset.label}
									</option>
								))}
							</Select>
						</Field>
					</div>

					{/* Custom duration input */}
					{customDuration[i] && (
						<Field label="Custom Duration (seconds)">
							<Input
								type="number"
								value={p.expiresIn}
								onChange={(e) =>
									update(i, "expiresIn", e.target.value === "" ? "" : Number(e.target.value))
								}
								placeholder="86400"
							/>
						</Field>
					)}

					{/* Tags */}
					<div className="space-y-1.5">
						<span className="block text-sm font-medium text-neutral-300">Tags</span>
						<div className="flex flex-wrap gap-2">
							{TAG_OPTIONS.map((tag) => (
								<button
									key={tag}
									type="button"
									onClick={() => toggleTag(i, tag)}
									className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
										p.tags?.includes(tag)
											? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
											: "bg-neutral-800 text-neutral-500 border border-neutral-700 hover:border-neutral-600"
									}`}
								>
									{tag}
								</button>
							))}
						</div>
					</div>

					{/* Features — one per line */}
					<Field label="Features" hint="One feature per line — shown as a checklist to agents">
						<textarea
							value={(p.features || []).join("\n")}
							onChange={(e) => {
								const text = e.target.value;
								// Keep raw lines (including empty) while typing, filter on serialize
								update(i, "features", text === "" ? [] : text.split("\n"));
							}}
							placeholder={
								"1,650 requests/month\n10 concurrent agents\nAll LLM costs included\nPriority email support"
							}
							rows={4}
							className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-y"
						/>
					</Field>
				</div>
			))}

			<button
				type="button"
				onClick={add}
				className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-700 px-4 py-2 text-sm text-neutral-400 transition-colors hover:border-emerald-500 hover:text-emerald-400"
			>
				<svg
					className="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
					aria-hidden="true"
				>
					<path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				Add Plan
			</button>
		</div>
	);
}
