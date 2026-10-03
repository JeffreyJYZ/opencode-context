/** @jsxImportSource @opentui/solid */
// The /context dialog: a stacked bar, the measured header, then one row per
// bucket (and one per tool under Tool Outputs), delta.app's Context Window
// order. Colours are fixed so the bar reads the same on any theme; the row
// text uses the host theme's text tokens.
import { RGBA } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { For, Show } from "solid-js";
import type { Breakdown, Bucket, Tone } from "./breakdown";
import { formatBytes, formatPercent, formatTokens } from "./format";

const PALETTE: Record<Tone, RGBA> = {
	thinking: RGBA.fromValues(0.93, 0.69, 0.31, 1),
	outputs: RGBA.fromValues(0.87, 0.45, 0.5, 1),
	system: RGBA.fromValues(0.63, 0.67, 0.73, 1),
	inputs: RGBA.fromValues(0.4, 0.72, 0.75, 1),
	user: RGBA.fromValues(0.82, 0.67, 0.42, 1),
	assistant: RGBA.fromValues(0.67, 0.56, 0.9, 1),
	toolDefs: RGBA.fromValues(0.5, 0.62, 0.9, 1),
	other: RGBA.fromValues(0.55, 0.58, 0.62, 1),
};

/** opentui styles a span through `style`; a bare `fg` prop is silently ignored. */
const span = (fg: RGBA): { style: { fg: RGBA } } =>
	({ style: { fg } }) as unknown as { style: { fg: RGBA } };

const BAR_WIDTH = 56;
const LABEL_WIDTH = 26;
const SIZE_WIDTH = 9;
const PCT_WIDTH = 7;

export interface DialogColors {
	readonly label: RGBA;
	readonly value: RGBA;
	readonly muted: RGBA;
}

function Bar(props: { breakdown: Breakdown }) {
	const segments = () => {
		const total = props.breakdown.totalBytes || 1;
		return props.breakdown.buckets.map((bucket) => ({
			tone: bucket.tone,
			cells: Math.max(1, Math.round((bucket.bytes / total) * BAR_WIDTH)),
		}));
	};
	return (
		<text>
			<For each={segments()}>
				{(segment) => (
					<span {...span(PALETTE[segment.tone])}>
						{"█".repeat(segment.cells)}
					</span>
				)}
			</For>
		</text>
	);
}

function Row(props: {
	bucket: Bucket;
	total: number;
	indent: string;
	colors: DialogColors;
}) {
	const label = () =>
		(props.indent + props.bucket.label)
			.slice(0, LABEL_WIDTH)
			.padEnd(LABEL_WIDTH);
	return (
		<text>
			<span {...span(PALETTE[props.bucket.tone])}>{"▌ "}</span>
			<span {...span(props.colors.label)}>{label()}</span>
			<span {...span(props.colors.value)}>
				{formatBytes(props.bucket.bytes).padStart(SIZE_WIDTH)}
			</span>
			<span {...span(props.colors.muted)}>
				{`  ${formatPercent(props.bucket.bytes, props.total).padStart(PCT_WIDTH)}`}
			</span>
		</text>
	);
}

export function BreakdownDialog(props: {
	breakdown: Breakdown;
	colors: DialogColors;
	title?: string;
}): JSX.Element {
	const header = () => {
		const { measuredTokens, limit, percent } = props.breakdown;
		const used =
			measuredTokens !== undefined ? formatTokens(measuredTokens) : "?";
		const cap = limit !== undefined ? formatTokens(limit) : "?";
		return `${used} / ${cap}${percent !== undefined ? `   ${percent}%` : ""}`;
	};
	return (
		<box flexDirection="column">
			<text>
				<b>{props.title ?? "Context Window"}</b>
			</text>
			<Bar breakdown={props.breakdown} />
			<text>
				<b>{header()}</b>
			</text>
			<Show
				when={props.breakdown.buckets.length > 0}
				fallback={<text fg={props.colors.muted}>no context to show yet</text>}
			>
				<For each={props.breakdown.buckets}>
					{(bucket) => (
						<>
							<Row
								bucket={bucket}
								total={props.breakdown.totalBytes}
								indent=""
								colors={props.colors}
							/>
							<For each={bucket.children}>
								{(child) => (
									<Row
										bucket={child}
										total={props.breakdown.totalBytes}
										indent="  "
										colors={props.colors}
									/>
								)}
							</For>
						</>
					)}
				</For>
			</Show>
		</box>
	);
}
