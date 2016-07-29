import compose, { ComposeFactory } from 'dojo-compose/compose';
import createDestroyable, { Destroyable } from 'dojo-compose/mixins/createDestroyable';
import WeakMap from 'dojo-shim/WeakMap';
import { h, VNode } from 'maquette/maquette';

import { Datum } from '../../data/interfaces';
import { Invalidatable, Point } from '../interfaces';

/* TODO! FIXME!

Hello! This mixin is not yet feature complete:

	* It assumes datum values are >= 0 (no negative values)
	* Configuration of the start value for range based axes is ignored. This will be necessary for line and
	  scatterplot charts, if not more chart types
	* Axes configuration cannot be provided through the widget state. This would also require label selectors to be
	  defined on the prototype since they can't be serialized into the state. Perhaps as topInputLabelSelector, etc
	* Axes configuration cannot be provided through the prototype. This is necessary to create widgets with a
	  default configuration
	* It's unclear how a default configuration would be extended through options and/or state
	* Certain configuration may be default for all enabled axes (e.g. ticks). Would be cool not to have to repeat that
	* Chart dimensions are not adjusted if exceeded by grid lines
	* No support for "mini ticks". These should probably be restricted to range based axes, where the step size
	  must be a multiple of the mini tick interval
	* Consider center (vertical) and middle (horizontal) axes for charts with negative values
	* Our targeted IE versions may not support dominant-baseline. If we know the line-height we may be able to polyfill
	  the currently limited set of allowed values, or maybe we need to support a perpendicularOffset option and remove
	  dominantBaseline
	* We may need perpendicularOffset anyhow (e.g. for the bottom axis it would move the label down, for the left axis
	  it would move it further left)

Good luck!
*/

/**
 * Configuration for a particular axis.
 */
export type AxisConfiguration<D> = HardcodedAxis | InputBasedAxis<D> | RangeBasedAxis;

export interface SharedConfiguration {
	/**
	 * Set to display grid lines behind the chart.
	 *
	 * The lines will eminating from this axis and be aligned with the axis markings.
	 */
	gridLines?: GridLineConfiguration;

	/**
	 * Set to `false` to disable labels. Alternatively provide configuration for how the labels are positioned.
	 */
	labels?: boolean | LabelConfiguration; // TODO: TS2 use false, not boolean

	/**
	 * Set to display ticks for the axis markings.
	 */
	ticks?: TickConfiguration;
};

export interface GridLineConfiguration {
	/**
	 * If set, renders the line with a fixed length. Else the line is rendered to the end of the chart (in the direction
	 * of the axis)
	 */
	length?: number;

	/**
	 * If set, renders a line for the zero point of the chart.
	 */
	zeroth?: boolean;
}

export type Anchor = 'start' | 'middle' | 'end';

export interface LabelConfiguration {
	/**
	 * The side of the plot point the label should be anchored to.
	 *
	 * Follows the direction of the axis. Defaults to 'middle'. Only has an effect for input based axes.
	 */
	anchor?: Anchor;

	/**
	 * The dominant baseline of the text, relative to the label's position.
	 *
	 * For bottom axes this defaults to 'text-before-edge', for top axes 'text-after-edge', and for left and right
	 * axes to 'middle'.
	 */
	dominantBaseline?: 'middle' | 'text-after-edge' | 'text-before-edge';

	/**
	 * Pixel offset for the label's position, following the direction of the axis.
	 */
	offset?: number;

	/**
	 * Rotation of the label, relative to its anchor point.
	 */
	rotation?: number;

	/**
	 * How the label text should be anchored, relative to the side of the plot point the label is anchored to.
	 *
	 * Follows the direction of the axis. For bottom and top axes this to 'middle', for left axes to 'end', and for
	 * right axes to 'start'.
	 */
	textAnchor?: Anchor;
}

export interface TickConfiguration {
	/**
	 * The side of the plot point the tick should be anchored to.
	 *
	 * Follows the direction of the axis. Defaults to 'middle'. Only has an effect for input based axes.
	 */
	anchor?: Anchor;

	/**
	 * Renders a tick with the given length.
	 */
	length: number;

	/**
	 * Pixel offset for the tick's position, following the direction of the axis.
	 */
	offset?: number;

	/**
	 * If set, renders a tick for the zero point of the chart.
	 */
	zeroth?: boolean;
}

export interface HardcodedAxis extends SharedConfiguration {
	/**
	 * A hardcoded list of axis markings.
	 *
	 * Each marking should be a floating point number that is >= 0 and <= 1. This is scaled to the end of the chart
	 * (in the direction of the axis). Values that are less than 0 or greater than 1 are ignored.
	 *
	 * By default no label is shown, however you can provide tuples of marking numbers and label strings.
	 */
	hardcoded: number[] | [number, string][];
}

export function isHardcoded(cfg: AxisConfiguration<any>): cfg is HardcodedAxis {
	return 'hardcoded' in cfg;
}

export interface InputBasedAxis<D> extends SharedConfiguration {
	/**
	 * Distribute markings based on how the inputs are plotted.
	 */
	inputs: boolean | { // TODO: TS2 use true, not boolean.
		/**
		 * Selects the label to be shown next to the marking.
		 */
		labelSelector: (datum: D) => string;
	};
}

export function isInputBased<D extends Datum<any>>(cfg: AxisConfiguration<D>): cfg is InputBasedAxis<D> {
	return 'inputs' in cfg;
}

export interface RangeBasedAxis extends SharedConfiguration {
	/**
	 * Distribute markings along a range, with equal steps between each marking.
	 */
	range: {
		/**
		 * The end of the range (inclusive). Defaults to the closest stepSize multiple that is greater than or equal to
		 * the largest datum value.
		 *
		 * abs(end) must be a multiple of stepSize, else is rounded up to the nearest stepSize multiple.
		 */
		end?: number;

		/**
		 * Whether the axis should be fixed to the end of the chart (in the direction of the axis).
		 *
		 * Defaults to `false`, in which case the axis is scaled proportionally to the size of the chart in order to show
		 * the range.
		 */
		fixed?: boolean;

		/**
		 * Selects the label to be shown next to the marking.
		 *
		 * If not provided the step will be shown as the label.
		 */
		labelSelector?: (step: number) => string;

		/**
		 * The starting point of the range. Defaults to zero.
		 *
		 * abs(start) must be a multiple of stepSize, else is rounded down to the nearest stepSize multiple.
		 */
		start?: number;

		/**
		 * The size of each step.
		 */
		stepSize: number;
	};
}

export function isRangeBased(cfg: AxisConfiguration<any>): cfg is RangeBasedAxis {
	return 'range' in cfg;
}

export interface CreatedAxes {
	bottom?: VNode[];
	extraHeight: number;
	extraWidth: number;
	left?: VNode[];
	right?: VNode[];
	top?: VNode[];
}

export type Side = 'bottom' | 'left' | 'right' | 'top';

export interface AxesOptions<D> {
	/**
	 * An axis that will be displayed below the plotted chart.
	 */
	bottomAxis?: AxisConfiguration<D>;

	/**
	 * An axis that will be displayed left of plotted chart.
	 */
	leftAxis?: AxisConfiguration<D>;

	/**
	 * An axis that will be displayed right of the plotted chart.
	 */
	rightAxis?: AxisConfiguration<D>;

	/**
	 * An axis that will be displayed above the plotted chart.
	 */
	topAxis?: AxisConfiguration<D>;
}

export interface AxesMixin<D extends Datum<any>> {
	/**
	 * An axis that will be displayed below the plotted chart.
	 */
	bottomAxis?: AxisConfiguration<D>;

	/**
	 * An axis that will be displayed left of plotted chart.
	 */
	leftAxis?: AxisConfiguration<D>;

	/**
	 * An axis that will be displayed right of the plotted chart.
	 */
	rightAxis?: AxisConfiguration<D>;

	/**
	 * An axis that will be displayed above the plotted chart.
	 */
	topAxis?: AxisConfiguration<D>;

	createAxes(points: Point<D>[], domainMax: number, chartX2: number, chartY2: number): CreatedAxes;

	createAxis(
		cfg: AxisConfiguration<D>,
		side: Side,
		points: Point<D>[],
		domainMax: number,
		chartX2: number,
		chartY2: number
	): [VNode[], number];

	createAxisLabel(
		cfg: LabelConfiguration,
		text: string,
		side: Side,
		index: number,
		p1: number,
		p2: number,
		ticks?: TickConfiguration
	): VNode;

	createAxisGridLine(
		length: number,
		side: Side,
		index: number,
		x: number,
		y: number
	): VNode;

	createAxisTick(cfg: TickConfiguration, side: Side, index: number, p1: number, p2?: number): VNode;

	createHardcodedAxis(
		cfg: HardcodedAxis,
		labels: LabelConfiguration,
		ticks: TickConfiguration,
		gridLineLength: number,
		side: Side,
		chartX2: number,
		chartY2: number
	): VNode[];

	createInputBasedAxis(
		cfg: InputBasedAxis<D>,
		labels: LabelConfiguration,
		ticks: TickConfiguration,
		gridLineLength: number,
		side: Side,
		points: Point<D>[]
	): VNode[];

	createRangeBasedAxis(
		cfg: RangeBasedAxis,
		labels: LabelConfiguration,
		ticks: TickConfiguration,
		gridLineLength: number,
		side: Side,
		points: Point<D>[],
		domainMax: number,
		chartX2: number,
		chartY2: number
	): [VNode[], number];
}

export type Axes<D extends Datum<any>> = Destroyable & Invalidatable & AxesMixin<D>;

export interface AxesFactory<D extends Datum<any>> extends ComposeFactory<
	Axes<D>,
	AxesOptions<D>
> {
	<D extends Datum<any>>(options?: AxesOptions<D>): Axes<D>;
}

interface AxesConfiguration<D> {
	bottom?: AxisConfiguration<D>;
	left?: AxisConfiguration<D>;
	right?: AxisConfiguration<D>;
	top?: AxisConfiguration<D>;
}

const shadowConfiguration = new WeakMap<Axes<any>, AxesConfiguration<any>>();

const createAxes: AxesFactory<any> = compose(<AxesMixin<any>> {
	get bottomAxis() {
		const axes: Axes<any> = this;
		return shadowConfiguration.get(axes).bottom;
	},

	set bottomAxis(axis: AxisConfiguration<any>) {
		const axes: Axes<any> = this;
		shadowConfiguration.get(axes).bottom = axis;
		axes.invalidate();
	},

	get leftAxis() {
		const axes: Axes<any> = this;
		return shadowConfiguration.get(axes).left;
	},

	set leftAxis(axis: AxisConfiguration<any>) {
		const axes: Axes<any> = this;
		shadowConfiguration.get(axes).left = axis;
		axes.invalidate();
	},

	get rightAxis() {
		const axes: Axes<any> = this;
		return shadowConfiguration.get(axes).right;
	},

	set rightAxis(axis: AxisConfiguration<any>) {
		const axes: Axes<any> = this;
		shadowConfiguration.get(axes).right = axis;
		axes.invalidate();
	},

	get topAxis() {
		const axes: Axes<any> = this;
		return shadowConfiguration.get(axes).top;
	},

	set topAxis(axis: AxisConfiguration<any>) {
		const axes: Axes<any> = this;
		shadowConfiguration.get(axes).top = axis;
		axes.invalidate();
	},

	createAxes<D extends Datum<any>>(points: Point<D>[], domainMax: number, chartX2: number, chartY2: number): CreatedAxes {
		const axes: Axes<D> = this;
		const configuration = shadowConfiguration.get(axes);

		const result: CreatedAxes = {
			extraHeight: 0,
			extraWidth: 0
		};

		if (configuration.bottom) {
			const [nodes, extra] = axes.createAxis(configuration.bottom, 'bottom', points, domainMax, chartX2, chartY2);
			result.bottom = nodes;
			result.extraWidth = Math.max(result.extraWidth, extra);
		}
		if (configuration.left) {
			const [nodes, extra] = axes.createAxis(configuration.left, 'left', points, domainMax, chartX2, chartY2);
			result.left = nodes;
			result.extraHeight = Math.max(result.extraHeight, extra);
		}
		if (configuration.right) {
			const [nodes, extra] = axes.createAxis(configuration.right, 'right', points, domainMax, chartX2, chartY2);
			result.right = nodes;
			result.extraHeight = Math.max(result.extraHeight, extra);
		}
		if (configuration.top) {
			const [nodes, extra] = axes.createAxis(configuration.top, 'top', points, domainMax, chartX2, chartY2);
			result.top = nodes;
			result.extraWidth = Math.max(result.extraWidth, extra);
		}
		return result;
	},

	createAxis<D extends Datum<any>>(
		cfg: AxisConfiguration<D>,
		side: Side,
		points: Point<D>[],
		domainMax: number,
		chartX2: number,
		chartY2: number
	): [VNode[], number] {
		const axes: Axes<D> = this;
		const { gridLines, ticks } = cfg;
		let labels: LabelConfiguration;
		if (cfg.labels !== false) {
			labels = cfg.labels || {};
		}

		const isHorizontal = side === 'bottom' || side === 'top';
		const nodes: VNode[] = [];
		let extraSpace = 0;

		let gridLineLength = 0;
		if (gridLines) {
			if ('length' in gridLines) {
				gridLineLength = gridLines.length;
			}
			else if (isHorizontal) {
				gridLineLength = chartY2;
			}
			else {
				gridLineLength = chartX2;
			}
		}

		if (ticks && ticks.zeroth) {
			if (isHorizontal) {
				nodes.push(axes.createAxisTick(ticks, side, 0, 0));
			}
			else {
				nodes.push(axes.createAxisTick(ticks, side, 0, chartY2));
			}
		}

		if (gridLines && gridLines.zeroth) {
			if (isHorizontal) {
				nodes.push(axes.createAxisGridLine(gridLineLength, side, 0, 0, 0));
			}
			else {
				nodes.push(axes.createAxisGridLine(gridLineLength, side, 0, 0, chartY2));
			}
		}

		if (isHardcoded(cfg)) {
			nodes.push(...axes.createHardcodedAxis(cfg, labels, ticks, gridLineLength, side, chartX2, chartY2));
		}
		else if (isInputBased(cfg)) {
			nodes.push(...axes.createInputBasedAxis(cfg, labels, ticks, gridLineLength, side, points));
		}
		else if (isRangeBased(cfg)) {
			let stepNodes: VNode[];
			[stepNodes, extraSpace] = axes.createRangeBasedAxis(cfg, labels, ticks, gridLineLength, side, points, domainMax, chartX2, chartY2);
			nodes.push(...stepNodes);
		}

		const chartSize = isHorizontal ? chartY2 : chartX2;
		if (gridLineLength > chartSize) {
			extraSpace = Math.max(extraSpace, gridLineLength - chartSize);
		}

		return [nodes, extraSpace];
	},

	createAxisGridLine(
		length: number,
		side: Side,
		index: number,
		x1: number,
		y1: number
	) {
		let x2 = x1;
		let y2 = y1;
		if (side === 'bottom') {
			y2 -= length;
		}
		else if (side === 'left') {
			x2 = length;
		}
		else if (side === 'right') {
			x2 -= length;
		}
		else if (side === 'top') {
			y2 += length;
		}

		return h('line', {
			key: `${side}-axis-line-${index}`,
			stroke: 'black',
			x1: String(x1),
			x2: String(x2),
			y1: String(y1),
			y2: String(y2)
		});
	},

	createAxisLabel(
		{
			anchor = <Anchor> 'middle',
			dominantBaseline,
			offset = 0,
			rotation = 0,
			textAnchor
		}: LabelConfiguration,
		text: string,
		side: Side,
		index: number,
		p1: number,
		p2: number,
		ticks: TickConfiguration = { length: 0 }
	) {
		let x = 0;
		let y = 0;
		if (side === 'bottom' || side === 'top') {
			textAnchor = textAnchor || 'middle';
			if (anchor === 'start') {
				x = p1;
			}
			else if (anchor === 'middle') {
				x = p1 + (p2 - p1) / 2;
			}
			else if (anchor === 'end') {
				x = p2;
			}
			x += offset;
		}
		else if (side === 'left' || side === 'right') {
			dominantBaseline = dominantBaseline || 'middle';
			if (anchor === 'start') {
				y = p2;
			}
			else if (anchor === 'middle') {
				y = p2 - (p2 - p1) / 2;
			}
			else if (anchor === 'end') {
				y = p1;
			}
			y += offset;
		}

		if (side === 'bottom') {
			dominantBaseline = dominantBaseline || 'text-before-edge';
			y += ticks.length;
		}
		else if (side === 'left') {
			textAnchor = textAnchor || 'end';
			x -= ticks.length;
		}
		else if (side === 'right') {
			textAnchor = textAnchor || 'start';
			x += ticks.length;
		}
		else if (side === 'top') {
			dominantBaseline = dominantBaseline || 'text-after-edge';
			y -= ticks.length;
		}

		return h('text', {
			key: `${side}-axis-label-${index}`,
			transform: `translate(0 0) rotate(${rotation} ${x} ${y})`,
			'text-anchor': textAnchor,
			'dominant-baseline': dominantBaseline,
			x: String(x),
			y: String(y)
		}, text);
	},

	createAxisTick(
		{
			anchor = <Anchor> 'middle',
			length,
			offset = 0
		}: TickConfiguration,
		side: Side,
		index: number,
		p1: number,
		p2: number = p1
	) {
		let x1 = 0;
		let y1 = 0;
		if (side === 'bottom' || side === 'top') {
			if (anchor === 'start') {
				x1 = p1;
			}
			else if (anchor === 'middle') {
				x1 = p1 + (p2 - p1) / 2;
			}
			else if (anchor === 'end') {
				x1 = p2;
			}
			x1 += offset;
		}
		else if (side === 'left' || side === 'right') {
			if (anchor === 'start') {
				y1 = p2;
			}
			else if (anchor === 'middle') {
				y1 = p2 - (p2 - p1) / 2;
			}
			else {
				y1 = p1;
			}
			y1 += offset;
		}

		let x2 = x1;
		let y2 = y1;
		if (side === 'bottom') {
			y2 += length;
		}
		else if (side === 'left') {
			x2 -= length;
		}
		else if (side === 'right') {
			x2 += length;
		}
		else if (side === 'top') {
			y2 -= length;
		}

		return h('line', {
			key: `${side}-axis-tick-${index}`,
			stroke: 'black',
			x1: String(x1),
			x2: String(x2),
			y1: String(y1),
			y2: String(y2)
		});
	},

	createHardcodedAxis(
		{ hardcoded }: HardcodedAxis,
		labels: LabelConfiguration,
		ticks: TickConfiguration,
		gridLineLength: number,
		side: Side,
		chartX2: number,
		chartY2: number
	) {
		const axes: Axes<any> = this;

		const isHorizontal = side === 'bottom' || side === 'top';
		const nodes: VNode[] = [];

		let index = 1;
		let prev = isHorizontal ? 0 : chartY2;
		for (const marking of hardcoded) {
			let relative: number;
			let text = '';
			if (Array.isArray(marking)) {
				[relative, text] = marking;
			}
			else {
				relative = marking;
			}

			if (relative < 0 || relative > 1) {
				continue;
			}

			const x = isHorizontal ? relative * chartX2 : 0;
			const y = isHorizontal ? 0 : chartY2 - relative * chartY2;
			if (ticks) {
				const p = isHorizontal ? x : y;
				nodes.push(axes.createAxisTick(ticks, side, index, p));
			}
			if (gridLineLength) {
				nodes.push(axes.createAxisGridLine(gridLineLength, side, index, x, y));
			}

			if (labels && text !== '') {
				const p1 = isHorizontal ? x : y;
				const p2 = prev;
				nodes.push(axes.createAxisLabel(labels, text, side, index, p1, p2, ticks));
			}

			index++;
			prev = isHorizontal ? x : y;
		}

		return nodes;
	},

	createInputBasedAxis<D extends Datum<any>>(
		{ inputs }: InputBasedAxis<D>,
		labels: LabelConfiguration,
		ticks: TickConfiguration,
		gridLineLength: number,
		side: Side,
		points: Point<D>[]
	) {
		const axes: Axes<D> = this;
		const labelSelector = typeof inputs === 'boolean' ? null : inputs.labelSelector;

		const isHorizontal = side === 'bottom' || side === 'top';
		const nodes: VNode[] = [];

		let index = 0;
		for (const { datum, x1, x2, y1, y2 } of points) {
			index++;

			const p1 = isHorizontal ? x1 : y1;
			const p2 = isHorizontal ? x2 : y2;
			if (ticks || gridLineLength) {
				if (ticks) {
					nodes.push(axes.createAxisTick(ticks, side, index, p1, p2));
				}
				if (gridLineLength) {
					const x = isHorizontal ? x2 : 0;
					const y = isHorizontal ? 0 : y1;
					nodes.push(axes.createAxisGridLine(gridLineLength, side, index, x, y));
				}
			}

			if (labels && labelSelector) {
				const text = labelSelector(datum);
				if (text !== '') {
					nodes.push(axes.createAxisLabel(labels, text, side, index, p1, p2, ticks));
				}
			}
		}

		return nodes;
	},

	createRangeBasedAxis<D extends Datum<any>>(
		{ range }: RangeBasedAxis,
		labels: LabelConfiguration,
		ticks: TickConfiguration,
		gridLineLength: number,
		side: Side,
		points: Point<D>[],
		domainMax: number,
		chartX2: number,
		chartY2: number
	) {
		const axes: Axes<D> = this;
		const {
			fixed = false,
			labelSelector
		} = range;

		const isHorizontal = side === 'bottom' || side === 'top';
		const nodes: VNode[] = [];

		const maxValue = domainMax || Math.max(...points.map(({ datum: { value } }) => value));
		let { end = maxValue } = range;

		// Heya! If you're looking to support configuration of the start value, please note that any non-zero start value
		// will impact the chart position and other axes, and that's not even considering negative values.
		const start = 0;

		const chartSize = isHorizontal ? chartX2 : chartY2;
		let size = chartSize;

		const { stepSize } = range;
		let extraSpace = 0;
		// Ensure max is a multiple of the stepSize.
		if (end % stepSize > 0) {
			end = Math.ceil(maxValue / stepSize) * stepSize;
		}
		if (!fixed && end !== maxValue) {
			// Adjust size so the steps are scaled correctly.
			size = chartSize / maxValue * end;
			if (size > chartSize) {
				// Percolate the extra size to the chart.
				extraSpace = size - chartSize;
			}
		}

		let index = 1;
		let prev = isHorizontal ? 0 : chartY2;
		for (let step = start; step <= end; step += stepSize) {
			const x = isHorizontal ? step / end * size : 0;
			const y = isHorizontal ? 0 : chartY2 - step / end * size;
			if (ticks) {
				const p = isHorizontal ? x : y;
				nodes.push(axes.createAxisTick(ticks, side, index, p));
			}
			if (gridLineLength) {
				nodes.push(axes.createAxisGridLine(gridLineLength, side, index, x, y));
			}

			const text = labelSelector ? labelSelector(step) : String(step);
			if (labels && text !== '') {
				const p1 = isHorizontal ? x : y;
				const p2 = prev;
				nodes.push(axes.createAxisLabel(labels, text, side, index, p1, p2, ticks));
			}

			index++;
			prev = isHorizontal ? x : y;
		}

		return [nodes, extraSpace];
	}
}).mixin({
	mixin: createDestroyable,

	initialize<D extends Datum<any>>(
		instance: Axes<D>,
		{
			bottomAxis,
			leftAxis,
			rightAxis,
			topAxis
		}: AxesOptions<D> = {}
	) {
		const configuration: AxesConfiguration<D> = {};
		if (bottomAxis) {
			configuration.bottom = bottomAxis;
		}
		if (leftAxis) {
			configuration.left = leftAxis;
		}
		if (rightAxis) {
			configuration.right = rightAxis;
		}
		if (topAxis) {
			configuration.top = topAxis;
		}

		shadowConfiguration.set(instance, configuration);
		instance.own({
			destroy() {
				shadowConfiguration.delete(instance);
			}
		});
	}
});

export default createAxes;
