import type { LayoutRectangle } from "react-native";

import { IsNewArchitecture } from "@/constants";
import { calculateItemsInView } from "@/core/calculateItemsInView";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { peek$, type StateContext, set$ } from "@/state/state";
import type { InternalState, MaintainScrollAtEndOptions } from "@/types";
import { checkAllSizesKnown } from "@/utils/checkAllSizesKnown";
import { getItemSize } from "@/utils/getItemSize";
import { requestAdjust } from "@/utils/requestAdjust";

export function updateItemSizes(
    ctx: StateContext,
    state: InternalState,
    itemUpdates: { itemKey: string; sizeObj: { width: number; height: number } }[],
) {
    const {
        props: {
            horizontal,
            maintainVisibleContentPosition,
            suggestEstimatedItemSize,
            onItemSizeChanged,
            data,
            maintainScrollAtEnd,
        },
    } = state;

    if (!data) return;

    const containersDidLayout = peek$(ctx, "containersDidLayout");
    // Need to calculate if haven't all laid out yet
    let needsRecalculate = !containersDidLayout;
    let shouldMaintainScrollAtEnd = false;
    let minIndexSizeChanged: number | undefined;
    let maxOtherAxisSize = peek$(ctx, "otherAxisSize") || 0;

    for (const { itemKey, sizeObj } of itemUpdates) {
        const index = state.indexByKey.get(itemKey)!;
        const prevSizeKnown = state.sizesKnown.get(itemKey);

        const diff = updateOneItemSize(state, itemKey, sizeObj);
        const size = Math.floor((horizontal ? sizeObj.width : sizeObj.height) * 8) / 8;

        if (diff !== 0) {
            minIndexSizeChanged = minIndexSizeChanged !== undefined ? Math.min(minIndexSizeChanged, index) : index;

            // Handle scrolling adjustments
            if (
                state.scrollingTo?.viewPosition &&
                maintainVisibleContentPosition &&
                index === state.scrollingTo.index &&
                diff > 0
            ) {
                requestAdjust(ctx, state, diff * state.scrollingTo.viewPosition);
            }

            // Check if item is in view
            const { startBuffered, endBuffered } = state;
            needsRecalculate ||= index >= startBuffered && index <= endBuffered;
            if (!needsRecalculate) {
                const numContainers = ctx.values.get("numContainers") as number;
                for (let i = 0; i < numContainers; i++) {
                    if (peek$(ctx, `containerItemKey${i}`) === itemKey) {
                        needsRecalculate = true;
                        break;
                    }
                }
            }

            // Handle other axis size
            if (state.needsOtherAxisSize) {
                const otherAxisSize = horizontal ? sizeObj.height : sizeObj.width;
                maxOtherAxisSize = Math.max(maxOtherAxisSize, otherAxisSize);
            }

            // Check if we should maintain scroll at end
            if (prevSizeKnown !== undefined && Math.abs(prevSizeKnown - size) > 5) {
                shouldMaintainScrollAtEnd = true;
            }

            // Call onItemSizeChanged callback
            onItemSizeChanged?.({
                index,
                itemData: state.props.data[index],
                itemKey,
                previous: size - diff,
                size,
            });
        }
    }

    // Update state with minimum changed index
    if (minIndexSizeChanged !== undefined) {
        state.minIndexSizeChanged =
            state.minIndexSizeChanged !== undefined
                ? Math.min(state.minIndexSizeChanged, minIndexSizeChanged)
                : minIndexSizeChanged;
    }

    // Handle dev warning about estimated size
    if (__DEV__ && suggestEstimatedItemSize && minIndexSizeChanged !== undefined) {
        if (state.timeoutSizeMessage) clearTimeout(state.timeoutSizeMessage);
        state.timeoutSizeMessage = setTimeout(() => {
            state.timeoutSizeMessage = undefined;
            const num = state.sizesKnown.size;
            const avg = state.averageSizes[""]?.avg;
            console.warn(
                `[legend-list] Based on the ${num} items rendered so far, the optimal estimated size is ${avg}.`,
            );
        }, 1000);
    }

    const cur = peek$(ctx, "otherAxisSize");
    if (!cur || maxOtherAxisSize > cur) {
        set$(ctx, "otherAxisSize", maxOtherAxisSize);
    }

    if (containersDidLayout || checkAllSizesKnown(state)) {
        if (needsRecalculate) {
            state.scrollForNextCalculateItemsInView = undefined;

            calculateItemsInView(ctx, state, { doMVCP: true });
        }
        if (shouldMaintainScrollAtEnd) {
            if (maintainScrollAtEnd === true || (maintainScrollAtEnd as MaintainScrollAtEndOptions).onItemLayout) {
                doMaintainScrollAtEnd(ctx, state, false);
            }
        }
    }
}

export function updateItemSize(
    ctx: StateContext,
    state: InternalState,
    itemKey: string,
    sizeObj: { width: number; height: number },
) {
    if (IsNewArchitecture) {
        const { sizesKnown } = state;
        const numContainers = peek$(ctx, "numContainers");
        const changes: { itemKey: string; sizeObj: { width: number; height: number } }[] = [];

        // Run through all containers and if we don't already have a known size then measure the item
        // This is useful because when multiple items render in one frame, the first container fires a
        // useLayoutEffect and we can measure all containers before their useLayoutEffects fire after a delay.
        // This lets use fix any gaps/overlaps that might be visible before the useLayoutEffects fire for each container.
        for (let i = 0; i < numContainers; i++) {
            const containerItemKey = peek$(ctx, `containerItemKey${i}`);
            if (itemKey === containerItemKey) {
                // If it's this item just use the param
                changes.push({ itemKey, sizeObj });
            } else if (!sizesKnown.has(containerItemKey) && containerItemKey !== undefined) {
                const containerRef = ctx.viewRefs.get(i);
                if (containerRef?.current) {
                    let measured: LayoutRectangle;
                    containerRef.current.measure((x, y, width, height) => {
                        measured = { height, width, x, y };
                    });

                    if (measured!) {
                        changes.push({ itemKey: containerItemKey, sizeObj: measured });
                    }
                }
            }
        }

        if (changes.length > 0) {
            updateItemSizes(ctx, state, changes);
        }
    } else {
        updateItemSizes(ctx, state, [{ itemKey, sizeObj }]);
    }
}

export function updateOneItemSize(state: InternalState, itemKey: string, sizeObj: { width: number; height: number }) {
    const {
        sizes,
        indexByKey,
        sizesKnown,
        averageSizes,
        props: { data, horizontal },
    } = state;
    if (!data) return 0;

    const index = indexByKey.get(itemKey)!;
    const prevSize = getItemSize(state, itemKey, index, data as any);
    const size = Math.floor((horizontal ? sizeObj.width : sizeObj.height) * 8) / 8;

    sizesKnown.set(itemKey, size);

    // Update averages
    const itemType = "";
    let averages = averageSizes[itemType];
    if (!averages) {
        averages = averageSizes[itemType] = { avg: 0, num: 0 };
    }
    averages.avg = (averages.avg * averages.num + size) / (averages.num + 1);
    averages.num++;

    if (!prevSize || Math.abs(prevSize - size) > 0.1) {
        sizes.set(itemKey, size);
        return size - prevSize;
    }
    return 0;
}
