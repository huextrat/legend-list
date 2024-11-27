import { type StateContext, peek$ } from './state';
import type {
    InternalState,
    LegendListProps,
    ViewToken,
    ViewabilityConfig,
    ViewabilityConfigCallbackPair,
} from './types';

const mapViewabilityConfigCallbackPairs = new WeakMap<
    ViewabilityConfigCallbackPair,
    {
        viewableItems: ViewToken[];
        start: number;
        end: number;
        previousStart: number;
        previousEnd: number;
    }
>();
export function setupViewability(props: LegendListProps<any>) {
    let { viewabilityConfig, viewabilityConfigCallbackPairs, onViewableItemsChanged } = props;

    viewabilityConfigCallbackPairs =
        viewabilityConfigCallbackPairs! ||
        (onViewableItemsChanged && [
            { viewabilityConfig: viewabilityConfig || { viewAreaCoveragePercentThreshold: 0 }, onViewableItemsChanged },
        ]);

    if (viewabilityConfigCallbackPairs) {
        for (const pair of viewabilityConfigCallbackPairs) {
            mapViewabilityConfigCallbackPairs.set(pair, {
                viewableItems: [],
                start: -1,
                end: -1,
                previousStart: -1,
                previousEnd: -1,
            });
        }
    }
    return viewabilityConfigCallbackPairs;
}

export function updateViewableItems(
    state: InternalState,
    ctx: StateContext,
    viewabilityConfigCallbackPairs: ViewabilityConfigCallbackPair[] | null,
    getId: (index: number) => string,
    scrollSize: number,
    start: number,
    end: number,
) {
    if (!viewabilityConfigCallbackPairs) return;
    for (const viewabilityConfigCallbackPair of viewabilityConfigCallbackPairs) {
        const viewabilityState = mapViewabilityConfigCallbackPairs.get(viewabilityConfigCallbackPair)!;
        viewabilityState.start = start;
        viewabilityState.end = end;
        if (viewabilityConfigCallbackPair.viewabilityConfig.minimumViewTime) {
            const timer: any = setTimeout(() => {
                state.timeouts.delete(timer);
                updateViewableItemsWithConfig(state.data, viewabilityConfigCallbackPair, getId, state, ctx, scrollSize);
            }, viewabilityConfigCallbackPair.viewabilityConfig.minimumViewTime);
            state.timeouts.add(timer);
        } else {
            updateViewableItemsWithConfig(state.data, viewabilityConfigCallbackPair, getId, state, ctx, scrollSize);
        }
    }
}

function updateViewableItemsWithConfig(
    data: any[],
    viewabilityConfigCallbackPair: ViewabilityConfigCallbackPair,
    getId: (index: number) => string,
    state: InternalState,
    ctx: StateContext,
    scrollSize: number,
) {
    const viewabilityState = mapViewabilityConfigCallbackPairs.get(viewabilityConfigCallbackPair)!;
    const { viewableItems: previousViewableItems, start, previousStart, end, previousEnd } = viewabilityState;
    // if (previousStart === start && previousEnd === end) {
    //     // Already processed this, so skip it
    //     return;
    // }
    const changed: ViewToken[] = [];
    if (previousViewableItems) {
        for (const viewToken of previousViewableItems) {
            if (viewToken.index! < start || viewToken.index! > end) {
                viewToken.isViewable = false;
                changed.push(viewToken);
            }
        }
    }

    const viewableItems: ViewToken[] = [];

    for (let i = start; i <= end; i++) {
        const item = data[i];
        if (item) {
            const key = getId(i);
            if (isViewable(state, ctx, viewabilityConfigCallbackPair.viewabilityConfig, key, scrollSize)) {
                const viewToken: ViewToken = {
                    item,
                    key,
                    index: i,
                    isViewable: true,
                };

                viewableItems.push(viewToken);
                if (!previousViewableItems?.find((v) => v.key === viewToken.key)) {
                    changed.push(viewToken);
                }
            }
        }
    }

    Object.assign(viewabilityState, { viewableItems, previousStart: start, previousEnd: end });

    if (changed.length > 0) {
        viewabilityConfigCallbackPair.onViewableItemsChanged?.({ viewableItems, changed });
    }
}

function isViewable(
    state: InternalState,
    ctx: StateContext,
    viewabilityConfig: ViewabilityConfig,
    key: string,
    scrollSize: number,
) {
    const { sizes, positions, scroll } = state;
    const topPad = (peek$(ctx, 'stylePaddingTop') || 0) + (peek$(ctx, 'headerSize') || 0);
    const { itemVisiblePercentThreshold, viewAreaCoveragePercentThreshold } = viewabilityConfig;
    const viewAreaMode = viewAreaCoveragePercentThreshold != null;
    const viewablePercentThreshold = viewAreaMode ? viewAreaCoveragePercentThreshold : itemVisiblePercentThreshold;
    const top = positions.get(key)! - scroll + topPad;
    const size = sizes.get(key)! || 0;
    const bottom = top + size;
    const isEntirelyVisible = top >= 0 && bottom <= scrollSize && bottom > top;

    if (isEntirelyVisible) {
        return true;
    }

    const visibleHeight = Math.min(bottom, scrollSize) - Math.max(top, 0);
    const percent = 100 * (visibleHeight / (viewAreaMode ? scrollSize : size));
    return percent >= viewablePercentThreshold!;
}
